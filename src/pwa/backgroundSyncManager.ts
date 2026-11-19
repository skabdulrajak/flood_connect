import {
  offlineIncidentQueue,
  registerFloodReportBackgroundSync,
  OFFLINE_SYNC_COMPLETE_EVENT,
  type QueuedFloodReportRecord,
} from '../utils/offlineIncidentQueue';
import { dataService } from '../services/dataService';

export interface SyncFlushResult {
  syncedCount: number;
  failedCount: number;
  remainingCount: number;
  syncedCodes: string[];
  skippedOffline: boolean;
}

let activeFlushPromise: Promise<SyncFlushResult> | null = null;

function isLikelyNetworkFailure(err: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return true;
  }
  const msg = String((err as { message?: string })?.message || err || '').toLowerCase();
  const code = String((err as { code?: string })?.code || '').toLowerCase();
  return (
    code.includes('unavailable') ||
    code.includes('network-request-failed') ||
    msg.includes('failed to fetch') ||
    msg.includes('network') ||
    msg.includes('offline') ||
    msg.includes('timeout') ||
    msg.includes('load failed')
  );
}

/**
 * Drains queued offline flood reports from IndexedDB and submits them to the
 * active FloodConnect backend (Firestore, Supabase, or Demo Mode) once online.
 * Protected by a singleton mutex so overlapping `online` and Service Worker
 * `sync` events never duplicate a submission.
 */
export async function flushPendingFloodReports(options?: {
  userId?: string;
  trigger?: string;
}): Promise<SyncFlushResult> {
  if (activeFlushPromise) {
    return activeFlushPromise;
  }

  activeFlushPromise = (async (): Promise<SyncFlushResult> => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      const pending = await offlineIncidentQueue.getPendingFloodReports(options?.userId);
      return {
        syncedCount: 0,
        failedCount: 0,
        remainingCount: pending.length,
        syncedCodes: [],
        skippedOffline: true,
      };
    }

    const pending = await offlineIncidentQueue.getPendingFloodReports(options?.userId);
    if (pending.length === 0) {
      return {
        syncedCount: 0,
        failedCount: 0,
        remainingCount: 0,
        syncedCodes: [],
        skippedOffline: false,
      };
    }

    // Replay oldest-first so timeline ordering is preserved
    const ordered: QueuedFloodReportRecord[] = [...pending].reverse();
    let syncedCount = 0;
    let failedCount = 0;
    const syncedCodes: string[] = [];

    for (const item of ordered) {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        break;
      }

      try {
        await offlineIncidentQueue.updateQueuedReport(item.id, {
          status: 'syncing',
          lastError: null,
        });

        const payloadToSubmit: Record<string, unknown> = { ...item.payload };

        // Upload any photo File/Blob stored in IndexedDB while offline
        if (item.photoAttachment?.blob) {
          const restoredFile = new File(
            [item.photoAttachment.blob],
            item.photoAttachment.name || 'offline-flood-photo.jpg',
            { type: item.photoAttachment.type || 'image/jpeg' }
          );
          const uploadRes = await dataService.uploadIncidentPhoto(item.userId, restoredFile);
          const resolvedUrl =
            typeof uploadRes === 'string' ? uploadRes : uploadRes?.url || null;
          if (resolvedUrl) {
            const existingUrls = Array.isArray(payloadToSubmit.photo_urls)
              ? payloadToSubmit.photo_urls
              : [];
            payloadToSubmit.photo_urls = [...existingUrls, resolvedUrl];
          }
        }

        const created = await dataService.createIncidentDirect(item.userId, payloadToSubmit);
        await offlineIncidentQueue.removeQueuedReport(item.id);
        syncedCount += 1;
        if (created?.incident_code) {
          syncedCodes.push(String(created.incident_code));
        }
      } catch (err) {
        failedCount += 1;
        const message =
          err instanceof Error ? err.message : 'Unable to sync report yet. Will retry automatically.';
        const nextStatus = isLikelyNetworkFailure(err) ? 'queued' : 'failed';
        await offlineIncidentQueue.updateQueuedReport(item.id, {
          status: nextStatus,
          retryCount: (item.retryCount || 0) + 1,
          lastError: message,
        });
        if (isLikelyNetworkFailure(err)) {
          await registerFloodReportBackgroundSync();
          break;
        }
      }
    }

    const remaining = await offlineIncidentQueue.getPendingFloodReports(options?.userId);

    const result: SyncFlushResult = {
      syncedCount,
      failedCount,
      remainingCount: remaining.length,
      syncedCodes,
      skippedOffline: false,
    };

    if (syncedCount > 0 && typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent(OFFLINE_SYNC_COMPLETE_EVENT, {
          detail: { ...result, trigger: options?.trigger || 'auto' },
        })
      );
    }

    return result;
  })();

  try {
    return await activeFlushPromise;
  } finally {
    activeFlushPromise = null;
  }
}
