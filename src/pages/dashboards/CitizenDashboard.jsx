import { useEffect, useMemo, useState } from 'react';
import { Link, Route, Routes } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowRight,
  Bell,
  Building2,
  CheckCheck,
  Clock,
  FilePlus2,
  FileText,
  Info,
  Map,
  MapPin,
  Megaphone,
  Siren,
} from 'lucide-react';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import {
  OriginBadge,
  SeverityBadge,
  StatusBadge,
} from '../../components/common/Badges';
import { EmergencyStatusTracker } from '../../components/emergency/EmergencyStatusTracker';
import { ErrorState, LoadingState } from '../../components/common/StateFeedback';
import { useAuth } from '../../hooks/useAuth';
import { dataService } from '../../services/dataService';
import { getNavItemsForRole } from '../../utils/dashboardNav';
import {
  EAST_GODAVARI_CENTER,
  EAST_GODAVARI_COORDS,
  formatNumber,
  formatTimestamp,
  getIncidentCategoryLabel,
  haversineDistanceKm,
  ROLES,
} from '../../utils/constants';
import { ReportIncidentPage } from '../citizen/ReportIncidentPage';
import { EmergencyRequestPage } from '../citizen/EmergencyRequestPage';
import { MySubmissionsPage } from '../citizen/MySubmissionsPage';
import { CitizenMapPage } from '../citizen/CitizenMapPage';
import { CitizenAlertsSheltersPage } from '../citizen/CitizenAlertsSheltersPage';

function CitizenOverview() {
  const { t } = useTranslation();
  const { user, profile } = useAuth();

  const [alerts, setAlerts] = useState([]);
  const [mapIncidents, setMapIncidents] = useState([]);
  const [myIncidents, setMyIncidents] = useState([]);
  const [myRequests, setMyRequests] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [shelters, setShelters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadDashboard = async () => {
    if (!user?.id) return;
    setLoading(true);
    setError('');
    try {
      const [alertList, visibleIncidents, ownIncidents, ownRequests, notifList, shelterList] =
        await Promise.all([
          dataService.getActiveAlerts(),
          dataService.getMapIncidents({ userId: user.id, role: profile?.role || ROLES.CITIZEN }),
          dataService.getMyIncidents(user.id),
          dataService.getMyEmergencyRequests(user.id),
          dataService.getNotifications(user.id),
          dataService.getShelters(),
        ]);
      setAlerts(alertList);
      setMapIncidents(visibleIncidents);
      setMyIncidents(ownIncidents);
      setMyRequests(ownRequests);
      setNotifications(notifList);
      setShelters(shelterList);
    } catch (err) {
      setError(err?.message || t('errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, [user?.id, profile?.role]);

  const userOriginCoords = useMemo(() => {
    if (profile?.locality && EAST_GODAVARI_COORDS[profile.locality]) {
      return EAST_GODAVARI_COORDS[profile.locality];
    }
    return { lat: EAST_GODAVARI_CENTER.lat, lng: EAST_GODAVARI_CENTER.lng };
  }, [profile?.locality]);

  const nearbyVerifiedIncidents = useMemo(() => {
    return mapIncidents
      .filter((i) => i.status === 'verified')
      .map((i) => ({
        ...i,
        distanceKm: haversineDistanceKm(
          userOriginCoords.lat,
          userOriginCoords.lng,
          Number(i.latitude),
          Number(i.longitude)
        ),
      }))
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, 4);
  }, [mapIncidents, userOriginCoords]);

  const nearbyShelters = useMemo(() => {
    return shelters
      .map((s) => ({
        ...s,
        distanceKm: haversineDistanceKm(
          userOriginCoords.lat,
          userOriginCoords.lng,
          Number(s.latitude),
          Number(s.longitude)
        ),
      }))
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, 3);
  }, [shelters, userOriginCoords]);

  const activeEmergency = useMemo(() => {
    return myRequests.find((r) => !['closed', 'cancelled'].includes(r.status)) || myRequests[0] || null;
  }, [myRequests]);

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

  if (loading) return <LoadingState message={t('common.loading')} />;
  if (error) return <ErrorState message={error} onRetry={loadDashboard} />;

  return (
    <div className="space-y-6">
      {/* Header Welcome & Primary Actions */}
      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold text-[#0E857D]">
              {profile?.district || t('common.regionTagline')} · {profile?.locality || t('common.notProvided')}
            </p>
            <h2 className="mt-1 text-xl font-bold text-[#0B2545]">
              {t('dashboard.welcome', { name: profile?.full_name || t('nav.roles.citizen') })}
            </h2>
            <p className="mt-1 text-sm text-slate-600">{t('dashboard.citizenSubtitle')}</p>
          </div>
          <div className="flex flex-wrap gap-2.5 shrink-0">
            <Link
              to="/dashboard/citizen/emergency"
              className="inline-flex items-center gap-2 rounded-md bg-[#F28C28] px-4 py-2.5 text-sm font-bold text-[#0B2545] hover:bg-[#D97316] hover:text-white transition-colors"
            >
              <Siren className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{t('landing.ctaRequestHelp')}</span>
            </Link>
            <Link
              to="/dashboard/citizen/report"
              className="inline-flex items-center gap-2 rounded-md bg-[#0B2545] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#13315C] transition-colors"
            >
              <FilePlus2 className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{t('nav.reportFlood')}</span>
            </Link>
            <Link
              to="/dashboard/citizen/map"
              className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-[#0B2545] hover:bg-slate-50 transition-colors"
            >
              <Map className="h-4 w-4 text-[#13A89E] shrink-0" aria-hidden="true" />
              <span>{t('nav.liveMap')}</span>
            </Link>
          </div>
        </div>

        {/* Pending Volunteer Status Notice */}
        {profile?.volunteer_status === 'pending' ? (
          <div className="mt-5 flex items-start gap-3 rounded-md border border-[#13A89E]/40 bg-[#ECFAF8] px-4 py-3 text-sm text-[#0B2545]">
            <Clock className="mt-0.5 h-5 w-5 shrink-0 text-[#0E857D]" aria-hidden="true" />
            <div>
              <p className="font-semibold">{t('dashboard.volunteerPendingTitle')}</p>
              <p className="mt-0.5 text-xs text-slate-700">
                {t('auth.volunteerPendingNote')}
              </p>
            </div>
          </div>
        ) : null}
      </section>

      {/* Quick KPI Strip */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold text-slate-500">{t('dashboard.myRecentReports')}</p>
          <p className="mt-1.5 font-mono text-2xl font-bold text-[#0B2545] tabular-nums">
            {formatNumber(myIncidents.length)}
          </p>
          <p className="mt-1 text-xs text-slate-500 tabular-nums">
            {t('dashboard.verifiedPendingBreakdown', {
              verified: formatNumber(myIncidents.filter((i) => i.status === 'verified').length),
              pending: formatNumber(
                myIncidents.filter((i) => i.status === 'pending_verification').length
              ),
            })}
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold text-slate-500">{t('dashboard.myRecentRequests')}</p>
          <p className="mt-1.5 font-mono text-2xl font-bold text-[#C06310] tabular-nums">
            {formatNumber(myRequests.length)}
          </p>
          <p className="mt-1 text-xs text-slate-500 tabular-nums">
            {t('dashboard.activeCount', {
              count: formatNumber(
                myRequests.filter((r) => !['resolved', 'closed', 'cancelled'].includes(r.status))
                  .length
              ),
            })}
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold text-slate-500">{t('dashboard.nearbyIncidents')}</p>
          <p className="mt-1.5 font-mono text-2xl font-bold text-emerald-700 tabular-nums">
            {formatNumber(nearbyVerifiedIncidents.length)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {t('dashboard.nearLocality', { locality: profile?.locality || t('common.regionTagline') })}
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold text-slate-500">{t('dashboard.recentNotifications')}</p>
          <p className="mt-1.5 font-mono text-2xl font-bold text-[#0E857D] tabular-nums">
            {formatNumber(unreadCount)}
          </p>
          <p className="mt-1 text-xs text-slate-500 tabular-nums">
            {t('dashboard.openSheltersCount', {
              count: formatNumber(shelters.filter((s) => s.status === 'open').length),
            })}
          </p>
        </div>
      </section>

      {/* 1. Official Alerts Panel */}
      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Megaphone className="h-4 w-4 text-[#0B2545]" aria-hidden="true" />
            <h3 className="text-sm font-bold text-[#0B2545]">{t('dashboard.activeAlerts')}</h3>
          </div>
          <OriginBadge origin="official_government" />
        </div>

        {alerts.length === 0 ? (
          <div className="mt-3 flex items-start gap-2.5 text-sm text-slate-700">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#0B2545]" aria-hidden="true" />
            <div>
              <p className="font-semibold text-[#0B2545]">
                {t('alerts.liveOfficialUnavailable')}
              </p>
              <p className="mt-0.5 text-xs text-slate-600">
                {t('alerts.liveOfficialUnavailableDetail')}
              </p>
            </div>
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className="rounded-md border border-slate-200 bg-[#F4F6F8] p-3.5 space-y-1.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-bold text-[#0B2545]">{alert.title}</p>
                  <SeverityBadge severity={alert.severity} />
                </div>
                <p className="text-xs text-slate-700">{alert.message}</p>
                <p className="text-[11px] text-slate-500 tabular-nums">
                  {alert.source_agency} · {formatTimestamp(alert.published_at)}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 2. Active Emergency Request Status Tracker */}
      {activeEmergency ? (
        <section className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-[#C06310]">
                {t('emergency.trackerTitle')}
              </p>
              <h3 className="mt-0.5 font-mono text-base font-bold text-[#0B2545] tabular-nums">
                {activeEmergency.request_code} · {activeEmergency.locality}
              </h3>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={activeEmergency.status} kind="emergency" />
              <Link
                to="/dashboard/citizen/submissions"
                className="text-xs font-semibold text-[#0E857D] hover:underline"
              >
                {t('emergency.viewTracker')}
              </Link>
            </div>
          </div>
          <EmergencyStatusTracker status={activeEmergency.status} compact />
          <p className="text-xs text-slate-500 tabular-nums">
            {t('emergency.peopleAffected', { count: formatNumber(activeEmergency.people_count) })} ·{' '}
            {formatTimestamp(activeEmergency.created_at)}
            {activeEmergency.assigned_team_name
              ? ` · ${t('emergency.assignedTeam')}: ${activeEmergency.assigned_team_name}`
              : ''}
          </p>
        </section>
      ) : null}

      {/* Main Two-Column Operational Grid */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* 3. Nearby Verified Incidents */}
        <section className="lg:col-span-7 rounded-lg border border-slate-200 bg-white p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-[#0B2545]">
                {t('dashboard.nearbyIncidents')}
              </h3>
              <p className="text-xs text-slate-500">
                {t('dashboard.sortedByDistance', {
                  locality: profile?.locality || t('common.regionTagline'),
                })}
              </p>
            </div>
            <Link
              to="/dashboard/citizen/map"
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#0E857D] hover:text-[#0B2545] shrink-0"
            >
              <span>{t('nav.liveMap')}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {nearbyVerifiedIncidents.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">
              {t('dashboard.noNearbyIncidents')}
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {nearbyVerifiedIncidents.map((inc) => (
                <div key={inc.id} className="py-3 first:pt-0 last:pb-0 space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-xs font-semibold text-[#0E857D] tabular-nums">
                      {inc.incident_code} · ~{inc.distanceKm.toFixed(1)} km
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <SeverityBadge severity={inc.reviewed_priority || inc.severity} />
                      <OriginBadge origin={inc.info_origin} />
                    </div>
                  </div>
                  <p className="text-sm font-semibold text-[#0B2545]">{inc.title}</p>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                    <span>
                      {getIncidentCategoryLabel(inc.category)} · {inc.locality}
                    </span>
                    <Link
                      to={`/dashboard/citizen/map?lat=${inc.latitude}&lng=${inc.longitude}`}
                      className="inline-flex items-center gap-1 font-semibold text-[#0B2545] hover:text-[#13A89E]"
                    >
                      <MapPin className="h-3.5 w-3.5" />
                      <span>{t('shelters.openInMap')}</span>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 4. Notifications Panel */}
        <section className="lg:col-span-5 rounded-lg border border-slate-200 bg-white p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-[#0B2545]" aria-hidden="true" />
              <h3 className="text-sm font-bold text-[#0B2545]">
                {t('nav.notifications')} ({t('notifications.unreadCount', { count: formatNumber(unreadCount) })})
              </h3>
            </div>
            {unreadCount > 0 ? (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#0E857D] hover:text-[#0B2545]"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                <span>{t('notifications.markAllRead')}</span>
              </button>
            ) : null}
          </div>

          {notifications.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">
              {t('dashboard.noNotifications')}
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {notifications.slice(0, 4).map((n) => (
                <div key={n.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-2">
                    <p
                      className={`text-xs font-semibold ${
                        n.is_read ? 'text-slate-600' : 'text-[#0B2545]'
                      }`}
                    >
                      {n.title}
                    </p>
                    {!n.is_read ? (
                      <button
                        type="button"
                        onClick={() => handleMarkRead(n.id)}
                        className="text-[11px] font-semibold text-[#0E857D] hover:underline shrink-0"
                      >
                        {t('notifications.markRead')}
                      </button>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{n.message}</p>
                  <p className="mt-1 text-[11px] text-slate-400 tabular-nums">
                    {formatTimestamp(n.created_at)}
                  </p>
                </div>
              ))}
            </div>
          )}

          <div className="border-t border-slate-100 pt-2">
            <Link
              to="/dashboard/citizen/alerts-shelters"
              className="text-xs font-semibold text-[#0E857D] hover:underline"
            >
              {t('notifications.openCentre')}
            </Link>
          </div>
        </section>
      </div>

      {/* Bottom Two-Column Row */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* 5a. My Recent Reports */}
        <section className="lg:col-span-6 rounded-lg border border-slate-200 bg-white p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-[#13A89E]" aria-hidden="true" />
              <h3 className="text-sm font-bold text-[#0B2545]">{t('dashboard.myRecentReports')}</h3>
            </div>
            <Link
              to="/dashboard/citizen/submissions"
              className="text-xs font-semibold text-[#0E857D] hover:underline"
            >
              {t('common.viewAll')} ({formatNumber(myIncidents.length)})
            </Link>
          </div>

          {myIncidents.length === 0 ? (
            <div className="py-4 text-center space-y-2">
              <p className="text-sm text-slate-500">{t('dashboard.noMyReports')}</p>
              <Link
                to="/dashboard/citizen/report"
                className="inline-block text-xs font-semibold text-[#0B2545] underline"
              >
                {t('landing.ctaReport')}
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {myIncidents.slice(0, 3).map((inc) => (
                <div key={inc.id} className="py-3 first:pt-0 last:pb-0 space-y-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-xs font-semibold text-[#0E857D] tabular-nums">
                      {inc.incident_code}
                    </span>
                    <StatusBadge status={inc.status} kind="incident" />
                  </div>
                  <p className="text-sm font-semibold text-[#0B2545]">{inc.title}</p>
                  <p className="text-xs text-slate-500 tabular-nums">
                    {inc.locality} · {formatTimestamp(inc.observed_at || inc.created_at)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 5b. Nearby Relief Shelters */}
        <section className="lg:col-span-6 rounded-lg border border-slate-200 bg-white p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-[#13A89E]" aria-hidden="true" />
              <h3 className="text-sm font-bold text-[#0B2545]">{t('dashboard.nearbyShelters')}</h3>
            </div>
            <Link
              to="/dashboard/citizen/alerts-shelters"
              className="text-xs font-semibold text-[#0E857D] hover:underline"
            >
              {t('common.viewAll')} ({formatNumber(shelters.length)})
            </Link>
          </div>

          {nearbyShelters.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-500">
              {t('dashboard.noShelters')}
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {nearbyShelters.map((sh) => {
                const pct =
                  sh.capacity > 0
                    ? Math.min(100, Math.round((sh.current_occupancy / sh.capacity) * 100))
                    : 0;
                return (
                  <div key={sh.id} className="py-3 first:pt-0 last:pb-0 space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-[#0B2545]">{sh.name}</p>
                      <span className="font-mono text-xs text-slate-500 tabular-nums">
                        ~{sh.distanceKm.toFixed(1)} km
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 tabular-nums">
                      {sh.locality} ·{' '}
                      {t('shelters.occupancyText', {
                        occupied: formatNumber(sh.current_occupancy),
                        capacity: formatNumber(sh.capacity),
                      })}{' '}
                      ({pct}%) ·{' '}
                      <Link
                        to={`/dashboard/citizen/map?lat=${sh.latitude}&lng=${sh.longitude}`}
                        className="font-semibold text-[#0E857D] hover:underline"
                      >
                        {t('shelters.openInMap')}
                      </Link>
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export function CitizenDashboard() {
  const { t } = useTranslation();
  const navItems = getNavItemsForRole(ROLES.CITIZEN);

  return (
    <Routes>
      <Route
        index
        element={
          <DashboardLayout navItems={navItems} pageTitle={t('dashboard.citizenTitle')}>
            <CitizenOverview />
          </DashboardLayout>
        }
      />
      <Route
        path="map"
        element={
          <DashboardLayout navItems={navItems} pageTitle={t('map.citizenTitle')}>
            <CitizenMapPage />
          </DashboardLayout>
        }
      />
      <Route
        path="report"
        element={
          <DashboardLayout navItems={navItems} pageTitle={t('incident.pageTitle')}>
            <ReportIncidentPage />
          </DashboardLayout>
        }
      />
      <Route
        path="emergency"
        element={
          <DashboardLayout navItems={navItems} pageTitle={t('emergency.pageTitle')}>
            <EmergencyRequestPage />
          </DashboardLayout>
        }
      />
      <Route
        path="submissions"
        element={
          <DashboardLayout navItems={navItems} pageTitle={t('incident.myReportsTitle')}>
            <MySubmissionsPage />
          </DashboardLayout>
        }
      />
      <Route
        path="alerts-shelters"
        element={
          <DashboardLayout navItems={navItems} pageTitle={t('alerts.pageTitle')}>
            <CitizenAlertsSheltersPage />
          </DashboardLayout>
        }
      />
    </Routes>
  );
}
