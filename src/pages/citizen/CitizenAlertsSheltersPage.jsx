import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Bell, Building2, CheckCheck, Info, Map, Megaphone } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { dataService } from '../../services/dataService';
import { EAST_GODAVARI_LOCALITIES, formatNumber, formatTimestamp } from '../../utils/constants';
import { OriginBadge, SeverityBadge } from '../../components/common/Badges';
import { OfficialInformationSection } from '../../components/official/OfficialInformationSection';
import { TranslateTextBlock } from '../../components/ai/TranslateTextBlock';
import { EmptyState, ErrorState, LoadingState } from '../../components/common/StateFeedback';

export function CitizenAlertsSheltersPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const [shelters, setShelters] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [localityFilter, setLocalityFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [alertList, shelterList, notifList] = await Promise.all([
        dataService.getActiveAlerts(),
        dataService.getShelters(),
        user?.id ? dataService.getNotifications(user.id) : Promise.resolve([]),
      ]);
      setAlerts(alertList);
      setShelters(shelterList);
      setNotifications(notifList);
    } catch (err) {
      setError(err?.message || t('errors.loadAlertsSheltersFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user?.id]);

  const filteredShelters = useMemo(() => {
    if (localityFilter === 'all') return shelters;
    return shelters.filter((s) => s.locality === localityFilter);
  }, [shelters, localityFilter]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const handleMarkRead = async (notifId) => {
    await dataService.markNotificationRead(user.id, notifId);
    setNotifications((prev) =>
      prev.map((n) => (n.id === notifId ? { ...n, is_read: true } : n))
    );
  };

  const handleMarkAllRead = async () => {
    await dataService.markAllNotificationsRead(user.id);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  if (loading) return <LoadingState message={t('alerts.loadingAlertsShelters')} />;
  if (error) return <ErrorState message={error} onRetry={loadData} />;

  return (
    <div className="space-y-6">
      {/* Official Hydrological & Weather Information (Rainfall, Forecasts, River Levels) */}
      <OfficialInformationSection compact />

      {/* Official Alerts Section (Ground Rule 6 compliant) */}
      <section className="rounded-lg border border-slate-200 bg-white p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-[#0B2545]" aria-hidden="true" />
            <h2 className="text-lg font-bold text-[#0B2545]">
              {t('alerts.officialDistrictAdvisories')}
            </h2>
          </div>
          <OriginBadge origin="official_government" />
        </div>

        {alerts.length === 0 ? (
          <div className="flex items-start gap-2.5 rounded-md border border-slate-200 bg-[#F4F6F8] p-4 text-sm text-slate-700">
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-[#0B2545]" aria-hidden="true" />
            <div>
              <p className="font-semibold text-[#0B2545]">
                {t('alerts.liveOfficialUnavailable')}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">
                {t('alerts.liveOfficialUnavailableDetail')}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className="rounded-md border border-slate-200 bg-[#F4F6F8] p-4 space-y-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-[#0B2545]">{alert.title}</h3>
                  <div className="flex items-center gap-2">
                    <SeverityBadge severity={alert.severity} />
                    <OriginBadge origin={alert.info_origin} />
                  </div>
                </div>
                <TranslateTextBlock text={alert.message} label={t('alerts.advisoryLabel')} />
                <p className="text-xs text-slate-500 tabular-nums">
                  {t('alerts.sourcePublished', {
                    source: alert.source_agency,
                    time: formatTimestamp(alert.published_at),
                  })}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Relief Shelters Directory */}
      <section className="rounded-lg border border-slate-200 bg-white p-6 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-[#13A89E]" aria-hidden="true" />
            <div>
              <h2 className="text-lg font-bold text-[#0B2545]">{t('shelters.eastGodavariHeading')}</h2>
              <p className="text-xs text-slate-500">
                {t('shelters.verifiedCampsSubtitle')}
              </p>
            </div>
          </div>

          <select
            aria-label={t('shelters.filterByLocality')}
            value={localityFilter}
            onChange={(e) => setLocalityFilter(e.target.value)}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-[#0B2545] focus:border-[#13A89E] focus:outline-none"
          >
            <option value="all">
              {t('shelters.allLocalitiesCount', { count: formatNumber(shelters.length) })}
            </option>
            {EAST_GODAVARI_LOCALITIES.map((loc) => (
              <option key={loc} value={loc}>
                {loc}
              </option>
            ))}
          </select>
        </div>

        {filteredShelters.length === 0 ? (
          <EmptyState
            title={t('shelters.noSheltersInLocalityTitle')}
            description={t('shelters.noSheltersInLocalityDesc')}
            icon={Building2}
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {filteredShelters.map((sh) => {
              const pct =
                sh.capacity > 0
                  ? Math.min(100, Math.round((sh.current_occupancy / sh.capacity) * 100))
                  : 0;
              return (
                <div
                  key={sh.id}
                  className="flex flex-col justify-between rounded-lg border border-slate-200 bg-[#F4F6F8] p-5 space-y-3"
                >
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h3 className="text-sm font-bold text-[#0B2545]">{sh.name}</h3>
                      <OriginBadge origin={sh.info_origin} />
                    </div>
                    <p className="text-xs text-slate-600">
                      {sh.address} · <strong className="text-[#0B2545]">{sh.locality}</strong>
                    </p>
                    <div>
                      <div className="flex justify-between gap-2 text-xs font-semibold text-[#0B2545] tabular-nums">
                        <span>
                          {t('common.status')}: {t(`status.shelter.${sh.status}`, { defaultValue: sh.status.replace('_', ' ') })}
                        </span>
                        <span>
                          {t('shelters.bedsOccupancyPct', {
                            occupied: formatNumber(sh.current_occupancy),
                            capacity: formatNumber(sh.capacity),
                            pct: formatNumber(pct),
                          })}
                        </span>
                      </div>
                      <div className="mt-1.5 h-2 w-full rounded bg-slate-200 overflow-hidden">
                        <div
                          className={`h-full ${pct >= 85 ? 'bg-[#F28C28]' : 'bg-[#13A89E]'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                    {Array.isArray(sh.amenities) && sh.amenities.length > 0 ? (
                      <p className="text-xs text-slate-600">
                        <strong>{t('shelters.amenitiesLabel')}:</strong> {sh.amenities.join(' · ')}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-200 pt-3 text-xs">
                    <span className="text-slate-500">
                      {sh.contact_officer_name || t('shelters.districtReliefDesk')}
                    </span>
                    <Link
                      to={`/dashboard/citizen/map?lat=${sh.latitude}&lng=${sh.longitude}`}
                      className="inline-flex items-center gap-1 font-semibold text-[#0B2545] hover:text-[#13A89E]"
                    >
                      <Map className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{t('shelters.locateOnMap')}</span>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Personal Notifications */}
      <section className="rounded-lg border border-slate-200 bg-white p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-[#0B2545]" aria-hidden="true" />
            <h2 className="text-lg font-bold text-[#0B2545]">
              {t('notifications.yourNotificationsUnread', { count: formatNumber(unreadCount) })}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/notifications"
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-[#0B2545] hover:bg-slate-50 transition-colors"
            >
              {t('notifications.openCentre')}
            </Link>
            {unreadCount > 0 ? (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-[#0B2545] hover:bg-slate-50 transition-colors"
              >
                <CheckCheck className="h-3.5 w-3.5 text-[#13A89E]" />
                <span>{t('notifications.markAllRead')}</span>
              </button>
            ) : null}
          </div>
        </div>

        {notifications.length === 0 ? (
          <EmptyState
            title={t('notifications.emptyTitle')}
            description={t('notifications.citizenEmptyDesc')}
            icon={Bell}
          />
        ) : (
          <div className="divide-y divide-slate-200">
            {notifications.map((notif) => (
              <div
                key={notif.id}
                className={`flex flex-col gap-2 py-3.5 sm:flex-row sm:items-start sm:justify-between ${
                  notif.is_read ? 'opacity-75' : ''
                }`}
              >
                <div>
                  <p className="text-sm font-semibold text-[#0B2545]">{notif.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{notif.message}</p>
                  <p className="mt-1 text-[11px] text-slate-500 tabular-nums">
                    {formatTimestamp(notif.created_at)}
                  </p>
                </div>
                {!notif.is_read ? (
                  <button
                    type="button"
                    onClick={() => handleMarkRead(notif.id)}
                    className="self-start rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-[#0B2545] hover:bg-slate-50 shrink-0"
                  >
                    {t('notifications.markRead')}
                  </button>
                ) : (
                  <span className="text-xs text-slate-400 shrink-0">{t('notifications.read')}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
