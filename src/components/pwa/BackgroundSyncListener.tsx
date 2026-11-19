import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { flushPendingFloodReports } from '../../pwa/backgroundSyncManager';
import { OFFLINE_SYNC_COMPLETE_EVENT } from '../../utils/offlineIncidentQueue';

interface AuthContextValueLike {
  user?: { id?: string } | null;
  isAuthenticated?: boolean;
}

interface ToastContextValueLike {
  showToast?: (payload: { title: string; message: string; type?: string }) => void;
}

/**
 * Headless listener mounted inside AuthProvider + ToastProvider.
 * Automatically retries queued IndexedDB flood reports whenever:
 * 1. Browser connectivity is restored (`online` event)
 * 2. Workbox Service Worker fires a Background Sync message (`FC_TRIGGER_BACKGROUND_SYNC`)
 * 3. User signs in or reloads while online with pending queued reports
 */
export function BackgroundSyncListener() {
  const { t } = useTranslation();
  const { user, isAuthenticated } = useAuth() as unknown as AuthContextValueLike;
  const { showToast } = useToast() as unknown as ToastContextValueLike;
  const userId = user?.id;

  useEffect(() => {
    if (!isAuthenticated || !userId) return;

    const triggerFlush = (trigger: string) => {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
      flushPendingFloodReports({ userId, trigger }).catch(() => {});
    };

    // Initial check on mount / login if online
    triggerFlush('startup');

    const handleOnline = () => triggerFlush('online-event');
    const handleSwMessage = (event: MessageEvent) => {
      if (event.data?.type === 'FC_TRIGGER_BACKGROUND_SYNC') {
        triggerFlush('sw-background-sync');
      }
    };

    window.addEventListener('online', handleOnline);
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleSwMessage);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleSwMessage);
      }
    };
  }, [isAuthenticated, userId]);

  useEffect(() => {
    const handleSyncComplete = (event: Event) => {
      const detail = (event as CustomEvent)?.detail || {};
      const syncedCount = Number(detail.syncedCount) || 0;
      const codes = Array.isArray(detail.syncedCodes) ? detail.syncedCodes : [];
      if (syncedCount <= 0 || typeof showToast !== 'function') return;

      showToast({
        title: t('pwa.syncSuccessTitle', {
          defaultValue: 'Offline Flood Reports Synced',
        }),
        message: t('pwa.syncSuccessMessage', {
          count: syncedCount,
          codes: codes.join(', '),
          defaultValue:
            syncedCount === 1
              ? '1 queued flood report ({{codes}}) was automatically submitted.'
              : '{{count}} queued flood reports ({{codes}}) were automatically submitted.',
        }),
        type: 'success',
      });
    };

    window.addEventListener(OFFLINE_SYNC_COMPLETE_EVENT, handleSyncComplete);
    return () => window.removeEventListener(OFFLINE_SYNC_COMPLETE_EVENT, handleSyncComplete);
  }, [showToast, t]);

  return null;
}
