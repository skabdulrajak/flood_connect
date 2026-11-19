/**
 * FloodConnect IndexedDB Offline Flood Report Outbox
 * Stores flood reports submitted while offline (including optional photo File/Blob
 * attachments) in IndexedDB so they survive reloads and automatically retry via
 * Workbox Background Sync + online connectivity listeners once connection returns.
 */

export const OFFLINE_INCIDENT_DB_NAME = 'floodconnect-offline-db';
export const OFFLINE_INCIDENT_DB_VERSION = 1;
export const OFFLINE_INCIDENT_STORE = 'pending_flood_reports';
export const FLOOD_REPORT_SYNC_TAG = 'floodconnect-flood-reports-sync';
export const OFFLINE_QUEUE_EVENT = 'fc-offline-queue-updated';
export const OFFLINE_SYNC_COMPLETE_EVENT = 'fc-offline-sync-complete';

export interface QueuedPhotoAttachment {
  name: string;
  type: string;
  size: number;
  blob: Blob;
}

export interface QueuedFloodReportRecord {
  id: string;
  incident_code: string;
  userId: string;
  dataMode: string;
  payload: Record<string, unknown>;
  photoAttachment: QueuedPhotoAttachment | null;
  queuedAt: string;
  retryCount: number;
  lastError: string | null;
  status: 'queued' | 'syncing' | 'failed';
}

interface SyncManagerLike {
  register(tag: string): Promise<void>;
}

function isIndexedDBAvailable(): boolean {
  return typeof window !== 'undefined' && 'indexedDB' in window;
}

function openOutboxDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isIndexedDBAvailable()) {
      reject(new Error('IndexedDB is unavailable in this browser context.'));
      return;
    }

    const request = window.indexedDB.open(OFFLINE_INCIDENT_DB_NAME, OFFLINE_INCIDENT_DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(OFFLINE_INCIDENT_STORE)) {
        const store = db.createObjectStore(OFFLINE_INCIDENT_STORE, { keyPath: 'id' });
        store.createIndex('userId', 'userId', { unique: false });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('queuedAt', 'queuedAt', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error || new Error('Failed to open FloodConnect IndexedDB outbox.'));
  });
}

function notifyQueueUpdated(detail?: Record<string, unknown>) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(OFFLINE_QUEUE_EVENT, { detail: detail || {} }));
  }
}

export async function registerFloodReportBackgroundSync(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const syncManager = (registration as unknown as { sync?: SyncManagerLike })?.sync;
    if (syncManager && typeof syncManager.register === 'function') {
      await syncManager.register(FLOOD_REPORT_SYNC_TAG);
      return true;
    }
    if (registration?.active) {
      registration.active.postMessage({
        type: 'FC_REQUEST_BG_SYNC',
        tag: FLOOD_REPORT_SYNC_TAG,
      });
    }
    return false;
  } catch {
    return false;
  }
}

export const offlineIncidentQueue = {
  DB_NAME: OFFLINE_INCIDENT_DB_NAME,
  STORE_NAME: OFFLINE_INCIDENT_STORE,
  SYNC_TAG: FLOOD_REPORT_SYNC_TAG,
  QUEUE_EVENT: OFFLINE_QUEUE_EVENT,
  SYNC_COMPLETE_EVENT: OFFLINE_SYNC_COMPLETE_EVENT,

  async enqueueFloodReport({
    userId,
    dataMode = 'demo',
    payload,
    photoFile = null,
  }: {
    userId: string;
    dataMode?: string;
    payload: Record<string, unknown>;
    photoFile?: File | null;
  }): Promise<QueuedFloodReportRecord> {
    const now = new Date();
    const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
    const id = `offline_inc_${now.getTime()}_${suffix}`;
    const incidentCode = `QUEUED-${String(now.getTime()).slice(-5)}-${suffix}`;

    const photoAttachment: QueuedPhotoAttachment | null =
      photoFile instanceof Blob
        ? {
            name: (photoFile as File).name || `offline-photo-${now.getTime()}.jpg`,
            type: photoFile.type || 'image/jpeg',
            size: photoFile.size,
            blob: photoFile,
          }
        : null;

    const record: QueuedFloodReportRecord = {
      id,
      incident_code: incidentCode,
      userId: String(userId || 'anonymous'),
      dataMode: String(dataMode || 'demo'),
      payload: { ...payload },
      photoAttachment,
      queuedAt: now.toISOString(),
      retryCount: 0,
      lastError: null,
      status: 'queued',
    };

    const db = await openOutboxDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(OFFLINE_INCIDENT_STORE, 'readwrite');
      tx.objectStore(OFFLINE_INCIDENT_STORE).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('Failed to store offline flood report.'));
    });
    db.close();

    // Register Workbox / native Service Worker Background Sync tag
    await registerFloodReportBackgroundSync();

    // Also fire a lightweight background relay signal through the SW's Workbox BackgroundSync route
    if (typeof fetch === 'function') {
      fetch('/api/offline-reports/relay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          queueId: record.id,
          incidentCode: record.incident_code,
          locality: record.payload.locality || 'East Godavari',
          category: record.payload.category || 'other',
          severity: record.payload.severity || 'medium',
          queuedAt: record.queuedAt,
        }),
      }).catch(() => {
        // Expected when offline — Workbox BackgroundSyncPlugin queues this request automatically
      });
    }

    notifyQueueUpdated({ action: 'enqueued', id: record.id });
    return record;
  },

  async getPendingFloodReports(userId?: string): Promise<QueuedFloodReportRecord[]> {
    if (!isIndexedDBAvailable()) return [];
    try {
      const db = await openOutboxDb();
      const rows = await new Promise<QueuedFloodReportRecord[]>((resolve, reject) => {
        const tx = db.transaction(OFFLINE_INCIDENT_STORE, 'readonly');
        const store = tx.objectStore(OFFLINE_INCIDENT_STORE);
        const req = userId ? store.index('userId').getAll(userId) : store.getAll();
        req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : []);
        req.onerror = () => reject(req.error);
      });
      db.close();
      return rows.sort(
        (a, b) => new Date(b.queuedAt).getTime() - new Date(a.queuedAt).getTime()
      );
    } catch {
      return [];
    }
  },

  async getPendingCount(userId?: string): Promise<number> {
    const items = await offlineIncidentQueue.getPendingFloodReports(userId);
    return items.length;
  },

  async updateQueuedReport(
    id: string,
    patch: Partial<Pick<QueuedFloodReportRecord, 'status' | 'retryCount' | 'lastError'>>
  ): Promise<QueuedFloodReportRecord | null> {
    if (!isIndexedDBAvailable()) return null;
    const db = await openOutboxDb();
    const updated = await new Promise<QueuedFloodReportRecord | null>((resolve, reject) => {
      const tx = db.transaction(OFFLINE_INCIDENT_STORE, 'readwrite');
      const store = tx.objectStore(OFFLINE_INCIDENT_STORE);
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const existing = getReq.result as QueuedFloodReportRecord | undefined;
        if (!existing) {
          resolve(null);
          return;
        }
        const next: QueuedFloodReportRecord = { ...existing, ...patch };
        store.put(next);
        tx.oncomplete = () => resolve(next);
      };
      getReq.onerror = () => reject(getReq.error);
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    notifyQueueUpdated({ action: 'updated', id });
    return updated;
  },

  async removeQueuedReport(id: string): Promise<void> {
    if (!isIndexedDBAvailable()) return;
    const db = await openOutboxDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(OFFLINE_INCIDENT_STORE, 'readwrite');
      tx.objectStore(OFFLINE_INCIDENT_STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    notifyQueueUpdated({ action: 'removed', id });
  },

  /**
   * Formats a queued IndexedDB record into the same shape expected by citizen/volunteer
   * incident lists so offline reports appear immediately in My Submissions.
   */
  toDisplayIncident(record: QueuedFloodReportRecord) {
    const p = record.payload || {};
    return {
      id: record.id,
      incident_code: record.incident_code,
      user_id: record.userId,
      category: String(p.category || 'other'),
      title: String(p.title || ''),
      description: String(p.description || ''),
      locality: String(p.locality || 'East Godavari'),
      location_text: String(p.location_text || ''),
      district: String(p.district || 'East Godavari'),
      latitude: Number(p.latitude) || 17.0005,
      longitude: Number(p.longitude) || 81.804,
      severity: String(p.severity || 'medium'),
      observed_at: String(p.observed_at || record.queuedAt),
      created_at: record.queuedAt,
      contact_phone: String(p.contact_phone || p.reporter_contact_phone || ''),
      photo_urls: Array.isArray(p.photo_urls) ? p.photo_urls : [],
      info_origin: 'citizen_submitted',
      status: 'queued_offline',
      queuedOffline: true,
      queueId: record.id,
      retryCount: record.retryCount,
      lastError: record.lastError,
      hasOfflinePhoto: Boolean(record.photoAttachment),
    };
  },
};
