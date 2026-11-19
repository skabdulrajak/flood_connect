import { useCallback, useEffect, useState } from 'react';
import { Link, Route, Routes } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Building2,
  ClipboardCheck,
  History,
  Info,
  LifeBuoy,
  Megaphone,
  RefreshCw,
  ShieldCheck,
  Siren,
  Users,
} from 'lucide-react';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import { DemoDataBadge, OriginBadge } from '../../components/common/Badges';
import { ErrorState, LoadingState } from '../../components/common/StateFeedback';
import { useAuth } from '../../hooks/useAuth';
import { dataService } from '../../services/dataService';
import { getAiServiceStatus } from '../../services/aiService';
import { getNavItemsForRole } from '../../utils/dashboardNav';
import { ROLES, formatNumber } from '../../utils/constants';
import { AdminIncidentsPage } from '../admin/AdminIncidentsPage';
import { AdminEmergenciesPage } from '../admin/AdminEmergenciesPage';
import { AdminTeamsPage } from '../admin/AdminTeamsPage';
import { AdminVolunteersPage } from '../admin/AdminVolunteersPage';
import { AdminAlertsPage } from '../admin/AdminAlertsPage';
import { AdminSheltersPage } from '../admin/AdminSheltersPage';
import { AdminUsersPage } from '../admin/AdminUsersPage';
import { AdminAuditPage } from '../admin/AdminAuditPage';
import { AdminAnalyticsPage } from '../admin/AdminAnalyticsPage';
import { AdminOfficialInfoPage } from '../admin/AdminOfficialInfoPage';

function StatCard({ label, value, sublabel, valueTone = 'text-[#0B2545]', to }) {
  const inner = (
    <div className="rounded-lg border border-slate-200 bg-white p-4 transition-colors hover:border-[#13A89E]">
      <p className="text-xs font-semibold text-slate-600">{label}</p>
      <p className={`mt-2 font-mono text-2xl font-bold tabular-nums ${valueTone}`}>{value}</p>
      <p className="mt-1 text-[11px] text-slate-500">{sublabel}</p>
    </div>
  );
  return to ? <Link to={to}>{inner}</Link> : inner;
}

function AdminOverview() {
  const { t } = useTranslation();
  const { profile, isDemoMode } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const aiStatus = getAiServiceStatus();

  const loadStats = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await dataService.getAdminDashboardStats();
      setStats(data);
    } catch (err) {
      setError(err.message || t('errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-[#0E857D]">
              {t('dashboard.adminEyebrow')}
            </p>
            <h2 className="mt-1 text-xl font-bold text-[#0B2545]">
              {profile?.full_name || t('nav.roles.admin')}
            </h2>
            <p className="mt-1 text-sm text-slate-600">{t('dashboard.adminSubtitle')}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isDemoMode ? <DemoDataBadge /> : null}
            <button
              type="button"
              onClick={loadStats}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>{t('common.refresh')}</span>
            </button>
          </div>
        </div>
      </section>

      {loading ? (
        <LoadingState message={t('common.loading')} />
      ) : error ? (
        <ErrorState message={error} onRetry={loadStats} />
      ) : stats ? (
        <>
          {/* Incident Metrics */}
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                {t('nav.incidents')}
              </h3>
              <Link
                to="/dashboard/admin/incidents"
                className="text-xs font-semibold text-[#0E857D] hover:underline"
              >
                {t('admin.incidentsTitle')} →
              </Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label={t('dashboard.kpiTotalIncidents')}
                value={formatNumber(stats.totalIncidents)}
                sublabel={t('dashboard.subAllReports')}
                to="/dashboard/admin/incidents"
              />
              <StatCard
                label={t('dashboard.kpiPendingVerification')}
                value={formatNumber(stats.pendingIncidents)}
                sublabel={t('dashboard.subPendingReview')}
                valueTone="text-[#C06310]"
                to="/dashboard/admin/incidents"
              />
              <StatCard
                label={t('dashboard.kpiVerifiedIncidents')}
                value={formatNumber(stats.verifiedIncidents)}
                sublabel={t('dashboard.subPublicMap')}
                valueTone="text-emerald-700"
                to="/dashboard/admin/incidents"
              />
              <StatCard
                label={t('dashboard.kpiCriticalIncidents')}
                value={formatNumber(stats.criticalIncidents)}
                sublabel={t('dashboard.subCriticalUrgency')}
                valueTone="text-red-700"
                to="/dashboard/admin/incidents"
              />
            </div>
          </section>

          {/* Emergency & Rescue Metrics */}
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                {t('nav.emergencyRequests')}
              </h3>
              <Link
                to="/dashboard/admin/emergencies"
                className="text-xs font-semibold text-[#0E857D] hover:underline"
              >
                {t('admin.emergenciesTitle')} →
              </Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label={t('dashboard.kpiTotalRequests')}
                value={formatNumber(stats.totalRequests)}
                sublabel={t('dashboard.subPrivateRls')}
                to="/dashboard/admin/emergencies"
              />
              <StatCard
                label={t('dashboard.kpiPendingRequests')}
                value={formatNumber(stats.pendingRequests)}
                sublabel={t('dashboard.subNeedsTriage')}
                valueTone="text-red-700"
                to="/dashboard/admin/emergencies"
              />
              <StatCard
                label={t('dashboard.kpiActiveOperations')}
                value={formatNumber(stats.activeOperations)}
                sublabel={t('dashboard.subActiveRescueOps')}
                valueTone="text-[#C06310]"
                to="/dashboard/admin/emergencies"
              />
              <StatCard
                label={t('dashboard.kpiResolvedRequests')}
                value={formatNumber(stats.resolvedRequests)}
                sublabel={t('dashboard.subCompletedRescues')}
                valueTone="text-emerald-700"
                to="/dashboard/admin/emergencies"
              />
            </div>
          </section>

          {/* Workforce, Alerts & Shelters */}
          <section className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              {t('dashboard.responseCapacityHeading')}
            </h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label={t('dashboard.kpiAvailableTeams')}
                value={`${formatNumber(stats.availableTeams)} / ${formatNumber(stats.totalTeams)}`}
                sublabel={t('dashboard.subReadyDispatch')}
                valueTone="text-[#0E857D]"
                to="/dashboard/admin/rescue-teams"
              />
              <StatCard
                label={t('dashboard.kpiActiveVolunteers')}
                value={`${formatNumber(stats.approvedVolunteers)} / ${formatNumber(stats.pendingVolunteers)}`}
                sublabel={t('dashboard.subVolunteersRatio')}
                to="/dashboard/admin/volunteers"
              />
              <StatCard
                label={t('dashboard.activeAlerts')}
                value={formatNumber(stats.activeAlerts)}
                sublabel={
                  stats.activeAlerts === 0
                    ? t('alerts.liveOfficialUnavailable')
                    : t('landing.statPublishedWithSource')
                }
                to="/dashboard/admin/alerts"
              />
              <StatCard
                label={t('dashboard.kpiOpenShelters')}
                value={`${formatNumber(stats.openShelters)} / ${formatNumber(stats.totalShelters)}`}
                sublabel={t('common.regionTagline')}
                to="/dashboard/admin/shelters"
              />
            </div>
          </section>
        </>
      ) : null}

      {/* Official Telemetry & AI Status */}
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-bold text-[#0B2545]">
              {t('dashboard.officialTelemetryTitle')}
            </p>
            <OriginBadge origin="official_government" />
          </div>
          <p className="mt-2 text-sm text-slate-700">
            {stats?.activeAlerts > 0
              ? t('dashboard.officialAlertsCountNote', { count: formatNumber(stats.activeAlerts) })
              : t('alerts.liveOfficialUnavailable')}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            <Link to="/dashboard/admin/official-info" className="font-semibold text-[#0E857D] hover:underline">
              {t('nav.officialUpdates')}
            </Link>{' '}
            ·{' '}
            <Link to="/dashboard/admin/analytics" className="font-semibold text-[#0E857D] hover:underline">
              {t('nav.analytics')}
            </Link>
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-bold text-[#0B2545]">
              {t('dashboard.aiBoundaryTitle')}
            </p>
            <OriginBadge origin="ai_suggested" />
          </div>
          <p className="mt-2 text-xs leading-relaxed text-slate-700">
            {aiStatus.available
              ? t('dashboard.aiConfiguredNote', { mode: aiStatus.mode })
              : t('common.aiUnavailableMessage')}
          </p>
          <p className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500">
            <Info className="h-3.5 w-3.5 shrink-0 text-[#13A89E]" />
            <span>{t('incident.aiReviewNotice')}</span>
          </p>
        </div>
      </section>

      {/* Quick Admin Modules */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link
          to="/dashboard/admin/incidents"
          className="rounded-lg border border-slate-200 bg-white p-4 hover:border-[#13A89E] transition-colors"
        >
          <ClipboardCheck className="h-5 w-5 text-[#13A89E]" aria-hidden="true" />
          <h3 className="mt-2.5 text-sm font-bold text-[#0B2545]">{t('nav.incidents')}</h3>
          <p className="mt-1 text-xs text-slate-600">{t('admin.incidentsSubtitle')}</p>
        </Link>
        <Link
          to="/dashboard/admin/emergencies"
          className="rounded-lg border border-slate-200 bg-white p-4 hover:border-[#13A89E] transition-colors"
        >
          <Siren className="h-5 w-5 text-[#F28C28]" aria-hidden="true" />
          <h3 className="mt-2.5 text-sm font-bold text-[#0B2545]">{t('nav.emergencyRequests')}</h3>
          <p className="mt-1 text-xs text-slate-600">{t('admin.emergenciesSubtitle')}</p>
        </Link>
        <Link
          to="/dashboard/admin/rescue-teams"
          className="rounded-lg border border-slate-200 bg-white p-4 hover:border-[#13A89E] transition-colors"
        >
          <LifeBuoy className="h-5 w-5 text-[#0B2545]" aria-hidden="true" />
          <h3 className="mt-2.5 text-sm font-bold text-[#0B2545]">{t('nav.rescueTeams')}</h3>
          <p className="mt-1 text-xs text-slate-600">{t('admin.teamsSubtitle')}</p>
        </Link>
        <Link
          to="/dashboard/admin/volunteers"
          className="rounded-lg border border-slate-200 bg-white p-4 hover:border-[#13A89E] transition-colors"
        >
          <ShieldCheck className="h-5 w-5 text-[#13A89E]" aria-hidden="true" />
          <h3 className="mt-2.5 text-sm font-bold text-[#0B2545]">{t('nav.volunteers')}</h3>
          <p className="mt-1 text-xs text-slate-600">{t('admin.volunteersSubtitle')}</p>
        </Link>
        <Link
          to="/dashboard/admin/alerts"
          className="rounded-lg border border-slate-200 bg-white p-4 hover:border-[#13A89E] transition-colors"
        >
          <Megaphone className="h-5 w-5 text-[#F28C28]" aria-hidden="true" />
          <h3 className="mt-2.5 text-sm font-bold text-[#0B2545]">{t('nav.alerts')}</h3>
          <p className="mt-1 text-xs text-slate-600">{t('admin.alertsSubtitle')}</p>
        </Link>
        <Link
          to="/dashboard/admin/shelters"
          className="rounded-lg border border-slate-200 bg-white p-4 hover:border-[#13A89E] transition-colors"
        >
          <Building2 className="h-5 w-5 text-[#13A89E]" aria-hidden="true" />
          <h3 className="mt-2.5 text-sm font-bold text-[#0B2545]">{t('nav.shelters')}</h3>
          <p className="mt-1 text-xs text-slate-600">{t('admin.sheltersSubtitle')}</p>
        </Link>
        <Link
          to="/dashboard/admin/users"
          className="rounded-lg border border-slate-200 bg-white p-4 hover:border-[#13A89E] transition-colors"
        >
          <Users className="h-5 w-5 text-[#0B2545]" aria-hidden="true" />
          <h3 className="mt-2.5 text-sm font-bold text-[#0B2545]">{t('nav.usersRoles')}</h3>
          <p className="mt-1 text-xs text-slate-600">{t('admin.usersSubtitle')}</p>
        </Link>
        <Link
          to="/dashboard/admin/audit"
          className="rounded-lg border border-slate-200 bg-white p-4 hover:border-[#13A89E] transition-colors"
        >
          <History className="h-5 w-5 text-[#0B2545]" aria-hidden="true" />
          <h3 className="mt-2.5 text-sm font-bold text-[#0B2545]">{t('nav.auditLog')}</h3>
          <p className="mt-1 text-xs text-slate-600">{t('admin.auditSubtitle')}</p>
        </Link>
      </section>
    </div>
  );
}

export function AdminDashboard() {
  const { t } = useTranslation();
  const navItems = getNavItemsForRole(ROLES.ADMIN);

  return (
    <Routes>
      <Route
        index
        element={
          <DashboardLayout navItems={navItems} pageTitle={t('dashboard.adminTitle')}>
            <AdminOverview />
          </DashboardLayout>
        }
      />
      <Route
        path="incidents"
        element={
          <DashboardLayout navItems={navItems} pageTitle={t('admin.incidentsTitle')}>
            <AdminIncidentsPage />
          </DashboardLayout>
        }
      />
      <Route
        path="emergencies"
        element={
          <DashboardLayout navItems={navItems} pageTitle={t('admin.emergenciesTitle')}>
            <AdminEmergenciesPage />
          </DashboardLayout>
        }
      />
      <Route
        path="rescue-teams"
        element={
          <DashboardLayout navItems={navItems} pageTitle={t('admin.teamsTitle')}>
            <AdminTeamsPage />
          </DashboardLayout>
        }
      />
      <Route
        path="volunteers"
        element={
          <DashboardLayout navItems={navItems} pageTitle={t('admin.volunteersTitle')}>
            <AdminVolunteersPage />
          </DashboardLayout>
        }
      />
      <Route
        path="alerts"
        element={
          <DashboardLayout navItems={navItems} pageTitle={t('admin.alertsTitle')}>
            <AdminAlertsPage />
          </DashboardLayout>
        }
      />
      <Route
        path="shelters"
        element={
          <DashboardLayout navItems={navItems} pageTitle={t('admin.sheltersTitle')}>
            <AdminSheltersPage />
          </DashboardLayout>
        }
      />
      <Route
        path="users"
        element={
          <DashboardLayout navItems={navItems} pageTitle={t('admin.usersTitle')}>
            <AdminUsersPage />
          </DashboardLayout>
        }
      />
      <Route
        path="analytics"
        element={
          <DashboardLayout navItems={navItems} pageTitle={t('analytics.pageTitle')}>
            <AdminAnalyticsPage />
          </DashboardLayout>
        }
      />
      <Route
        path="official-info"
        element={
          <DashboardLayout navItems={navItems} pageTitle={t('admin.officialInfoTitle')}>
            <AdminOfficialInfoPage />
          </DashboardLayout>
        }
      />
      <Route
        path="audit"
        element={
          <DashboardLayout navItems={navItems} pageTitle={t('admin.auditTitle')}>
            <AdminAuditPage />
          </DashboardLayout>
        }
      />
    </Routes>
  );
}
