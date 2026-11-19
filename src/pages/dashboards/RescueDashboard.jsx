import { useCallback, useEffect, useState } from 'react';
import { Link, Route, Routes } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Bell, CheckCheck, History, LifeBuoy, Lock, Radio } from 'lucide-react';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import { DemoDataBadge } from '../../components/common/Badges';
import { LoadingState } from '../../components/common/StateFeedback';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { dataService } from '../../services/dataService';
import { getNavItemsForRole } from '../../utils/dashboardNav';
import { ROLES, formatNumber, formatTimestamp } from '../../utils/constants';
import { RescueAssignedPage } from '../rescue/RescueAssignedPage';
import { RescueReadinessPage } from '../rescue/RescueReadinessPage';
import { RescueHistoryPage } from '../rescue/RescueHistoryPage';

function RescueOverview() {
  const { t } = useTranslation();
  const { user, profile, isDemoMode } = useAuth();
  const { showToast } = useToast();

  const [teams, setTeams] = useState([]);
  const [assigned, setAssigned] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadOverview = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [myTeams, myAssigned, myNotifs] = await Promise.all([
        dataService.getMyRescueTeams(user.id),
        dataService.getAssignedEmergencyRequests(user.id),
        dataService.getNotifications(user.id),
      ]);
      setTeams(myTeams);
      setAssigned(myAssigned);
      setNotifications(myNotifs);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const activeCount = assigned.filter((r) =>
    ['assigned', 'rescue_in_progress'].includes(r.status)
  ).length;
  const resolvedCount = assigned.filter((r) => ['resolved', 'closed'].includes(r.status)).length;
  const primaryTeam = teams[0] || null;
  const unreadNotifs = notifications.filter((n) => !n.is_read);

  const handleMarkAllRead = async () => {
    if (!user) return;
    await dataService.markAllNotificationsRead(user.id);
    showToast(t('notifications.allMarkedReadToast'), 'info');
    loadOverview();
  };

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-[#C06310]">
              {t('dashboard.rescueEyebrow', {
                district: profile?.district || t('common.regionTagline'),
              })}
            </p>
            <h2 className="mt-1 text-xl font-bold text-[#0B2545]">
              {profile?.full_name || t('nav.roles.rescue_team')}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {primaryTeam
                ? t('dashboard.rescueUnitSummary', {
                    name: primaryTeam.name,
                    code: primaryTeam.team_code,
                    base: primaryTeam.base_location,
                  })
                : t('dashboard.rescueSubtitle')}
            </p>
          </div>
          {isDemoMode ? <DemoDataBadge /> : null}
        </div>
      </section>

      {loading ? (
        <LoadingState message={t('common.loading')} />
      ) : (
        <section className="grid gap-4 sm:grid-cols-3">
          <Link
            to="/dashboard/rescue/assignments"
            className="rounded-lg border border-slate-200 bg-white p-5 hover:border-[#13A89E] transition-colors"
          >
            <p className="text-xs font-semibold text-slate-600">{t('dashboard.kpiAssignedRescues')}</p>
            <p className="mt-2 font-mono text-2xl font-bold text-[#C06310] tabular-nums">
              {formatNumber(activeCount)}
            </p>
            <p className="mt-1 text-xs text-slate-500">{t('nav.assignedRescues')} →</p>
          </Link>

          <Link
            to="/dashboard/rescue/readiness"
            className="rounded-lg border border-slate-200 bg-white p-5 hover:border-[#13A89E] transition-colors"
          >
            <p className="text-xs font-semibold text-slate-600">{t('dashboard.kpiTeamStatus')}</p>
            <p className="mt-2 text-2xl font-bold text-[#0B2545]">
              {primaryTeam
                ? t(`status.${primaryTeam.status}`, { defaultValue: primaryTeam.status })
                : t('common.notAssigned')}
            </p>
            <p className="mt-1 text-xs text-slate-500">{t('nav.teamReadiness')} →</p>
          </Link>

          <Link
            to="/dashboard/rescue/history"
            className="rounded-lg border border-slate-200 bg-white p-5 hover:border-[#13A89E] transition-colors"
          >
            <p className="text-xs font-semibold text-slate-600">{t('dashboard.kpiResolvedRequests')}</p>
            <p className="mt-2 font-mono text-2xl font-bold text-emerald-700 tabular-nums">
              {formatNumber(resolvedCount)}
            </p>
            <p className="mt-1 text-xs text-slate-500">{t('nav.assignmentHistory')} →</p>
          </Link>
        </section>
      )}

      {/* Dispatch Notifications */}
      <section className="rounded-lg border border-slate-200 bg-white p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-[#0B2545]" aria-hidden="true" />
            <h3 className="text-sm font-bold text-[#0B2545]">
              {t('nav.notifications')} ({t('notifications.unreadCount', { count: formatNumber(unreadNotifs.length) })})
            </h3>
          </div>
          {unreadNotifs.length > 0 ? (
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#0E857D] hover:underline"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              <span>{t('notifications.markAllRead')}</span>
            </button>
          ) : null}
        </div>
        {notifications.length === 0 ? (
          <p className="text-xs text-slate-500">{t('dashboard.noNotifications')}</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {notifications.slice(0, 5).map((n) => (
              <li key={n.id} className="py-2.5 flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p
                    className={`text-xs ${
                      n.is_read ? 'font-medium text-slate-700' : 'font-bold text-[#0B2545]'
                    }`}
                  >
                    {n.title}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-600">{n.message}</p>
                </div>
                <span className="font-mono text-[11px] text-slate-500 tabular-nums">
                  {formatTimestamp(n.created_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 flex items-start gap-3">
        <Lock className="mt-0.5 h-5 w-5 shrink-0 text-[#0B2545]" aria-hidden="true" />
        <p className="text-xs leading-relaxed text-slate-600">
          {t('dashboard.rescueRlsNotice')}
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <Link
          to="/dashboard/rescue/assignments"
          className="rounded-lg border border-slate-200 bg-white p-5 hover:border-[#13A89E] transition-colors"
        >
          <LifeBuoy className="h-5 w-5 text-[#F28C28]" aria-hidden="true" />
          <h3 className="mt-3 text-base font-bold text-[#0B2545]">{t('nav.assignedRescues')}</h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">
            {t('rescue.assignedSubtitle')}
          </p>
        </Link>

        <Link
          to="/dashboard/rescue/readiness"
          className="rounded-lg border border-slate-200 bg-white p-5 hover:border-[#13A89E] transition-colors"
        >
          <Radio className="h-5 w-5 text-[#13A89E]" aria-hidden="true" />
          <h3 className="mt-3 text-base font-bold text-[#0B2545]">{t('nav.teamReadiness')}</h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">
            {t('rescue.readinessSubtitle')}
          </p>
        </Link>

        <Link
          to="/dashboard/rescue/history"
          className="rounded-lg border border-slate-200 bg-white p-5 hover:border-[#13A89E] transition-colors"
        >
          <History className="h-5 w-5 text-[#13A89E]" aria-hidden="true" />
          <h3 className="mt-3 text-base font-bold text-[#0B2545]">{t('nav.assignmentHistory')}</h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">
            {t('rescue.historySubtitle')}
          </p>
        </Link>
      </section>
    </div>
  );
}

export function RescueDashboard() {
  const { t } = useTranslation();
  const navItems = getNavItemsForRole(ROLES.RESCUE_TEAM);

  return (
    <Routes>
      <Route
        index
        element={
          <DashboardLayout navItems={navItems} pageTitle={t('dashboard.rescueTitle')}>
            <RescueOverview />
          </DashboardLayout>
        }
      />
      <Route
        path="assignments"
        element={
          <DashboardLayout navItems={navItems} pageTitle={t('rescue.assignedTitle')}>
            <RescueAssignedPage />
          </DashboardLayout>
        }
      />
      <Route
        path="readiness"
        element={
          <DashboardLayout navItems={navItems} pageTitle={t('rescue.readinessTitle')}>
            <RescueReadinessPage />
          </DashboardLayout>
        }
      />
      <Route
        path="history"
        element={
          <DashboardLayout navItems={navItems} pageTitle={t('rescue.historyTitle')}>
            <RescueHistoryPage />
          </DashboardLayout>
        }
      />
    </Routes>
  );
}
