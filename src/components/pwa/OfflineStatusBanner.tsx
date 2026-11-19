import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  Building2,
  ChevronDown,
  ChevronUp,
  CloudUpload,
  Loader2,
  Phone,
  RefreshCw,
  Trash2,
  WifiOff,
} from 'lucide-react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { applyPendingServiceWorkerUpdate } from '../../pwa/registerSW';
import { flushPendingFloodReports } from '../../pwa/backgroundSyncManager';
import { offlineIncidentQueue } from '../../utils/offlineIncidentQueue';
import { formatTimestamp } from '../../utils/constants';

interface CachedAlert {
  id: string;
  title?: string;
  affected_area?: string;
  message?: string;
}

interface CachedShelter {
  id: string;
  name?: string;
  locality?: string;
  current_occupancy?: number;
  capacity?: number;
  status?: string;
}

export function OfflineStatusBanner() {
  const { t } = useTranslation();
  const { isOnline, needsRefresh, snapshot, pendingReports, pendingReportsCount } = useOnlineStatus();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [refreshDismissed, setRefreshDismissed] = useState(false);
  const [syncingNow, setSyncingNow] = useState(false);

  const showRefreshBanner = needsRefresh && !refreshDismissed && isOnline;
  const showPendingOnlineBar = isOnline && pendingReportsCount > 0;

  if (isOnline && !showRefreshBanner && !showPendingOnlineBar) {
    return null;
  }

  const handleManualSync = async () => {
    if (syncingNow || !isOnline) return;
    setSyncingNow(true);
    try {
      await flushPendingFloodReports({ trigger: 'manual-banner' });
    } finally {
      setSyncingNow(false);
    }
  };

  const handleDiscardQueued = async (id: string) => {
    await offlineIncidentQueue.removeQueuedReport(id);
  };

  return (
    <div className="sticky top-0 z-40">
      {/* Offline Mode Bar + Expandable Cached Emergency Data & Queued Outbox Reference */}
      {!isOnline ? (
        <div
          role="status"
          aria-live="polite"
          className="border-b border-amber-400/50 bg-[#0B2545] text-white"
        >
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-2 text-xs sm:px-6">
            <div className="flex flex-wrap items-center gap-2">
              <WifiOff className="h-4 w-4 shrink-0 text-[#F28C28]" aria-hidden="true" />
              <span className="font-semibold text-[#F28C28]">
                {t('pwa.offlineTitle', { defaultValue: 'Offline Mode' })}
              </span>
              <span className="text-slate-200">
                {t('pwa.offlineDesc', {
                  defaultValue:
                    'No internet connection. Showing cached static app and emergency data.',
                })}
              </span>
              {pendingReportsCount > 0 ? (
                <span className="inline-flex items-center gap-1 rounded border border-[#F28C28]/60 bg-[#F28C28]/20 px-2 py-0.5 font-mono text-[11px] font-semibold text-[#FFD7AD] tabular-nums">
                  <CloudUpload className="h-3 w-3" aria-hidden="true" />
                  <span>
                    {t('pwa.queuedCountBadge', {
                      count: pendingReportsCount,
                      defaultValue: '{{count}} report(s) queued for auto-sync',
                    })}
                  </span>
                </span>
              ) : null}
              {snapshot.lastSyncedAt ? (
                <span className="font-mono text-[11px] text-slate-300 tabular-nums">
                  ({t('pwa.lastSynced', { defaultValue: 'Cached' })}:{' '}
                  {formatTimestamp(snapshot.lastSyncedAt)})
                </span>
              ) : null}
            </div>

            <button
              type="button"
              onClick={() => setDrawerOpen((v) => !v)}
              aria-expanded={drawerOpen}
              className="inline-flex items-center gap-1 rounded border border-white/25 bg-white/10 px-2.5 py-1 text-xs font-semibold text-white hover:bg-white/20 transition-colors whitespace-nowrap"
            >
              <span>
                {drawerOpen
                  ? t('pwa.hideCachedEmergency', { defaultValue: 'Hide Offline Emergency Data' })
                  : t('pwa.viewCachedEmergency', { defaultValue: 'View Offline Emergency Data' })}
              </span>
              {drawerOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
          </div>

          {drawerOpen ? (
            <div className="border-t border-white/15 bg-[#F4F6F8] text-[#0B2545]">
              <div className="mx-auto grid max-w-7xl gap-4 px-4 py-4 sm:px-6 md:grid-cols-3">
                {/* Offline Emergency Helplines */}
                <div className="rounded-lg border border-slate-200 bg-white p-3.5">
                  <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[#0B2545]">
                    <Phone className="h-3.5 w-3.5 text-[#13A89E]" aria-hidden="true" />
                    <span>{t('pwa.offlineHelplinesTitle', { defaultValue: 'Emergency Helplines' })}</span>
                  </h3>
                  <ul className="mt-2.5 space-y-1.5 text-xs">
                    {snapshot.helplines.map((h) => (
                      <li
                        key={h.number}
                        className="flex items-center justify-between border-b border-slate-100 pb-1 last:border-b-0"
                      >
                        <span className="text-slate-700">
                          {t(h.labelKey, { defaultValue: h.fallback })}
                        </span>
                        <span className="font-mono font-bold text-[#0B2545] tabular-nums">
                          {h.number}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Cached Active Alerts */}
                <div className="rounded-lg border border-slate-200 bg-white p-3.5">
                  <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[#0B2545]">
                    <AlertTriangle className="h-3.5 w-3.5 text-[#C06310]" aria-hidden="true" />
                    <span>
                      {t('pwa.cachedAlertsTitle', {
                        defaultValue: 'Cached Active Alerts ({{count}})',
                        count: snapshot.activeAlerts.length,
                      })}
                    </span>
                  </h3>
                  {snapshot.activeAlerts.length === 0 ? (
                    <p className="mt-2 text-xs text-slate-500">
                      {t('pwa.noCachedAlerts', {
                        defaultValue: 'No alerts cached yet. Open Alerts while online to cache them.',
                      })}
                    </p>
                  ) : (
                    <ul className="mt-2 space-y-2 max-h-40 overflow-y-auto text-xs">
                      {(snapshot.activeAlerts as CachedAlert[]).slice(0, 5).map((alert) => (
                        <li key={alert.id} className="rounded border border-slate-100 bg-[#F4F6F8] p-2">
                          <p className="font-semibold text-[#0B2545]">{alert.title}</p>
                          <p className="mt-0.5 text-[11px] text-slate-600 line-clamp-2">
                            {alert.affected_area ? `${alert.affected_area} · ` : ''}
                            {alert.message}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Cached Relief Shelters */}
                <div className="rounded-lg border border-slate-200 bg-white p-3.5">
                  <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[#0B2545]">
                    <Building2 className="h-3.5 w-3.5 text-[#13A89E]" aria-hidden="true" />
                    <span>
                      {t('pwa.cachedSheltersTitle', {
                        defaultValue: 'Cached Relief Shelters ({{count}})',
                        count: snapshot.shelters.length,
                      })}
                    </span>
                  </h3>
                  {snapshot.shelters.length === 0 ? (
                    <p className="mt-2 text-xs text-slate-500">
                      {t('pwa.noCachedShelters', {
                        defaultValue: 'No shelters cached yet. Open Shelters while online to cache them.',
                      })}
                    </p>
                  ) : (
                    <ul className="mt-2 space-y-2 max-h-40 overflow-y-auto text-xs">
                      {(snapshot.shelters as CachedShelter[]).slice(0, 6).map((sh) => (
                        <li key={sh.id} className="rounded border border-slate-100 bg-[#F4F6F8] p-2">
                          <p className="font-semibold text-[#0B2545]">{sh.name}</p>
                          <p className="mt-0.5 text-[11px] text-slate-600">
                            {sh.locality} · {sh.current_occupancy}/{sh.capacity} ({sh.status})
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* Queued Offline Flood Reports stored in IndexedDB */}
              {pendingReportsCount > 0 ? (
                <div className="mx-auto max-w-7xl px-4 pb-4 sm:px-6">
                  <div className="rounded-lg border border-[#F28C28]/40 bg-white p-3.5">
                    <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[#9A4D09]">
                      <CloudUpload className="h-3.5 w-3.5 text-[#C06310]" aria-hidden="true" />
                      <span>
                        {t('pwa.queuedOutboxTitle', {
                          count: pendingReportsCount,
                          defaultValue: 'Queued Offline Flood Reports in IndexedDB ({{count}})',
                        })}
                      </span>
                    </h3>
                    <p className="mt-1 text-[11px] text-slate-600">
                      {t('pwa.queuedOutboxDesc', {
                        defaultValue:
                          'Saved locally on this device. Background Sync will submit these reports automatically when connection returns.',
                      })}
                    </p>
                    <ul className="mt-2.5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 text-xs">
                      {pendingReports.map((item) => (
                        <li
                          key={item.id}
                          className="flex items-start justify-between gap-2 rounded border border-slate-200 bg-[#F4F6F8] p-2.5"
                        >
                          <div className="min-w-0">
                            <p className="font-mono text-[11px] font-bold text-[#0B2545] tabular-nums">
                              {item.incident_code}
                            </p>
                            <p className="truncate font-semibold text-[#0B2545]">
                              {String(item.payload?.title || '')}
                            </p>
                            <p className="text-[11px] text-slate-500">
                              {String(item.payload?.locality || 'East Godavari')} ·{' '}
                              {formatTimestamp(item.queuedAt)}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDiscardQueued(item.id)}
                            aria-label={t('pwa.removeQueuedReport', {
                              defaultValue: 'Remove queued report',
                            })}
                            className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-700 shrink-0"
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Online Background Sync Outbox Bar (shown when back online with queued reports) */}
      {showPendingOnlineBar ? (
        <div
          role="status"
          aria-live="polite"
          className="border-b border-[#F28C28]/40 bg-[#FEF5EC] px-4 py-2 text-xs text-[#9A4D09]"
        >
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 sm:px-2">
            <div className="flex items-center gap-2">
              {syncingNow ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-[#C06310]" aria-hidden="true" />
              ) : (
                <CloudUpload className="h-3.5 w-3.5 text-[#C06310]" aria-hidden="true" />
              )}
              <span className="font-semibold">
                {t('pwa.onlinePendingBanner', {
                  count: pendingReportsCount,
                  defaultValue:
                    '{{count}} offline flood report(s) waiting in IndexedDB to finish syncing.',
                })}
              </span>
            </div>
            <button
              type="button"
              disabled={syncingNow}
              onClick={handleManualSync}
              className="inline-flex items-center gap-1.5 rounded bg-[#0B2545] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[#13315C] disabled:opacity-60 transition-colors"
            >
              {syncingNow ? (
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
              ) : (
                <RefreshCw className="h-3 w-3" aria-hidden="true" />
              )}
              <span>
                {syncingNow
                  ? t('pwa.syncingNow', { defaultValue: 'Syncing...' })
                  : t('pwa.retrySyncNow', { defaultValue: 'Sync Now' })}
              </span>
            </button>
          </div>
        </div>
      ) : null}

      {/* Service Worker Update Ready Bar */}
      {showRefreshBanner ? (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-2 border-b border-[#13A89E]/30 bg-[#EBF7F6] px-4 py-2 text-xs text-[#0B2545]"
        >
          <span>
            {t('pwa.updateAvailable', {
              defaultValue: 'A newer offline-ready version of FloodConnect is available.',
            })}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => applyPendingServiceWorkerUpdate()}
              className="inline-flex items-center gap-1 rounded bg-[#0B2545] px-2.5 py-1 font-semibold text-white hover:bg-[#13315C]"
            >
              <RefreshCw className="h-3 w-3" aria-hidden="true" />
              <span>{t('pwa.reloadNow', { defaultValue: 'Reload Now' })}</span>
            </button>
            <button
              type="button"
              onClick={() => setRefreshDismissed(true)}
              className="text-slate-600 hover:underline"
            >
              {t('common.close', { defaultValue: 'Dismiss' })}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
