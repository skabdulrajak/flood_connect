import { useCallback, useEffect, useState } from 'react';
import { offlineEmergencyCache } from '../utils/offlineEmergencyCache';
import {
  offlineIncidentQueue,
  OFFLINE_QUEUE_EVENT,
  OFFLINE_SYNC_COMPLETE_EVENT,
  type QueuedFloodReportRecord,
} from '../utils/offlineIncidentQueue';

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [offlineReady, setOfflineReady] = useState(false);
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [snapshot, setSnapshot] = useState(() => offlineEmergencyCache.getSnapshotSync());
  const [pendingReports, setPendingReports] = useState<QueuedFloodReportRecord[]>([]);

  const refreshPendingReports = useCallback(async () => {
    const items = await offlineIncidentQueue.getPendingFloodReports();
    setPendingReports(items);
  }, []);

  useEffect(() => {
    refreshPendingReports().catch(() => {});

    const handleOnline = () => {
      setIsOnline(true);
      refreshPendingReports().catch(() => {});
    };
    const handleOffline = () => {
      setIsOnline(false);
      setSnapshot(offlineEmergencyCache.getSnapshotSync());
      refreshPendingReports().catch(() => {});
    };
    const handleCacheUpdate = () => setSnapshot(offlineEmergencyCache.getSnapshotSync());
    const handleOfflineReady = () => setOfflineReady(true);
    const handleNeedRefresh = () => setNeedsRefresh(true);
    const handleQueueChanged = () => {
      refreshPendingReports().catch(() => {});
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener(offlineEmergencyCache.CACHE_EVENT, handleCacheUpdate);
    window.addEventListener('fc-sw-offline-ready', handleOfflineReady);
    window.addEventListener('fc-sw-need-refresh', handleNeedRefresh);
    window.addEventListener(OFFLINE_QUEUE_EVENT, handleQueueChanged);
    window.addEventListener(OFFLINE_SYNC_COMPLETE_EVENT, handleQueueChanged);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener(offlineEmergencyCache.CACHE_EVENT, handleCacheUpdate);
      window.removeEventListener('fc-sw-offline-ready', handleOfflineReady);
      window.removeEventListener('fc-sw-need-refresh', handleNeedRefresh);
      window.removeEventListener(OFFLINE_QUEUE_EVENT, handleQueueChanged);
      window.removeEventListener(OFFLINE_SYNC_COMPLETE_EVENT, handleQueueChanged);
    };
  }, [refreshPendingReports]);

  return {
    isOnline,
    offlineReady,
    needsRefresh,
    snapshot,
    pendingReports,
    pendingReportsCount: pendingReports.length,
    refreshPendingReports,
  };
}
