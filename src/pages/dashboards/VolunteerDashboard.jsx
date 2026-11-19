import { useCallback, useEffect, useState } from 'react';
import { Link, Route, Routes } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Bell,
  Building2,
  CheckCheck,
  CheckCircle2,
  ClipboardList,
  Compass,
  ShieldCheck,
} from 'lucide-react';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import { DemoDataBadge } from '../../components/common/Badges';
import { LoadingState } from '../../components/common/StateFeedback';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { dataService } from '../../services/dataService';
import { getNavItemsForRole } from '../../utils/dashboardNav';
import { ROLES, formatNumber, formatTimestamp } from '../../utils/constants';
import { VolunteerTasksPage } from '../volunteer/VolunteerTasksPage';
import { VolunteerFieldSupportPage } from '../volunteer/VolunteerFieldSupportPage';
import { VolunteerSheltersPage } from '../volunteer/VolunteerSheltersPage';

function VolunteerOverview() {
  const { t } = useTranslation();
  const { user, profile, isDemoMode } = useAuth();
  const { showToast } = useToast();

  const [volRecord, setVolRecord] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [observations, setObservations] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingAvail, setUpdatingAvail] = useState(false);

  const availabilityOptions = [
    { value: 'available', label: t('status.available') },
    { value: 'busy', label: t('status.busy') },
    { value: 'offline', label: t('status.offline') },
  ];

  const loadOverview = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [vol, taskList, obsList, notifList] = await Promise.all([
        dataService.getMyVolunteerRecord(user.id),
        dataService.getVolunteerTasksForUser(user.id),
        dataService.getMyIncidents(user.id),
        dataService.getNotifications(user.id),
      ]);
      setVolRecord(vol);
      setTasks(taskList);
      setObservations(obsList);
      setNotifications(notifList);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const isApproved =
    volRecord?.approval_status === 'approved' || profile?.volunteer_status === 'approved';
  const myActiveTasks = tasks.filter(
    (task) =>
      volRecord &&
      task.assigned_volunteer_id === volRecord.id &&
      ['assigned', 'in_progress'].includes(task.status)
  ).length;
  const openQueueCount = tasks.filter((task) => task.status === 'open').length;
  const unreadNotifs = notifications.filter((n) => !n.is_read);

  const handleAvailabilityChange = async (nextStatus) => {
    if (!user || !volRecord || volRecord.availability_status === nextStatus) return;
    setUpdatingAvail(true);
    try {
      const updated = await dataService.updateVolunteerAvailability(user.id, nextStatus);
      setVolRecord((prev) => ({ ...prev, availability_status: updated.availability_status }));
      showToast(
        t('rescue.availabilityUpdatedToast', {
          status: t(`status.${nextStatus}`, { defaultValue: nextStatus }),
        }),
        'success'
      );
    } catch (err) {
      showToast(err.message || t('errors.saveFailed'), 'error');
    } finally {
      setUpdatingAvail(false);
    }
  };

  const handleMarkAllRead = async () => {
    if (!user) return;
    await dataService.markAllNotificationsRead(user.id);
    showToast(t('notifications.allMarkedReadToast'), 'info');
    loadOverview();
  };

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-6 space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold text-[#0E857D]">
              {t('dashboard.volunteerEyebrow', {
                locality: profile?.locality || t('common.regionTagline'),
              })}
            </p>
            <h2 className="mt-1 text-xl font-bold text-[#0B2545]">
              {t('dashboard.welcome', { name: profile?.full_name || t('nav.roles.volunteer') })}
            </h2>
            <p className="mt-1 text-sm text-slate-600">{t('dashboard.volunteerSubtitle')}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isDemoMode ? <DemoDataBadge compact /> : null}
            <div className="inline-flex items-center gap-1.5 rounded-md border border-emerald-600/30 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 shrink-0">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>
                {isApproved ? t('dashboard.approvedVolunteer') : t('auth.pendingAdminApproval')}
              </span>
            </div>
          </div>
        </div>

        {/* Interactive Availability Toggle */}
        {volRecord ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <span className="text-xs font-semibold text-slate-700">
              {t('rescue.availabilityLabel')}:
            </span>
            <div className="inline-flex flex-wrap rounded-md border border-slate-200 bg-[#F4F6F8] p-1">
              {availabilityOptions.map((opt) => {
                const active = (volRecord.availability_status || 'available') === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={updatingAvail}
                    onClick={() => handleAvailabilityChange(opt.value)}
                    className={`rounded px-3 py-1.5 text-xs font-semibold transition-colors ${
                      active
                        ? 'bg-[#0B2545] text-white'
                        : 'text-slate-700 hover:bg-white'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </section>

      {loading ? (
        <LoadingState message={t('common.loading')} />
      ) : (
        <section className="grid gap-4 sm:grid-cols-3">
          <Link
            to="/dashboard/volunteer/tasks"
            className="rounded-lg border border-slate-200 bg-white p-5 hover:border-[#13A89E] transition-colors"
          >
            <p className="text-xs font-semibold text-slate-600">{t('dashboard.kpiActiveTasks')}</p>
            <p className="mt-2 font-mono text-2xl font-bold text-[#0B2545] tabular-nums">
              {formatNumber(myActiveTasks)}
            </p>
            <p className="mt-1 text-xs text-slate-500">{t('nav.assignedTasks')} →</p>
          </Link>

          <Link
            to="/dashboard/volunteer/tasks"
            className="rounded-lg border border-slate-200 bg-white p-5 hover:border-[#13A89E] transition-colors"
          >
            <p className="text-xs font-semibold text-slate-600">{t('dashboard.openDistrictTasks')}</p>
            <p className="mt-2 font-mono text-2xl font-bold text-[#C06310] tabular-nums">
              {formatNumber(openQueueCount)}
            </p>
            <p className="mt-1 text-xs text-slate-500">{t('rescue.acceptTask')} →</p>
          </Link>

          <Link
            to="/dashboard/volunteer/field-support"
            className="rounded-lg border border-slate-200 bg-white p-5 hover:border-[#13A89E] transition-colors"
          >
            <p className="text-xs font-semibold text-slate-600">{t('nav.fieldObservations')}</p>
            <p className="mt-2 font-mono text-2xl font-bold text-[#0E857D] tabular-nums">
              {formatNumber(observations.length)}
            </p>
            <p className="mt-1 text-xs text-slate-500">{t('rescue.submitObservation')} →</p>
          </Link>
        </section>
      )}

      {/* Notifications */}
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

      <section className="grid gap-4 sm:grid-cols-3">
        <Link
          to="/dashboard/volunteer/tasks"
          className="rounded-lg border border-slate-200 bg-white p-5 hover:border-[#13A89E] transition-colors"
        >
          <ClipboardList className="h-5 w-5 text-[#13A89E]" aria-hidden="true" />
          <h3 className="mt-3 text-base font-bold text-[#0B2545]">{t('nav.assignedTasks')}</h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">
            {t('rescue.volunteerTasksSubtitle')}
          </p>
        </Link>

        <Link
          to="/dashboard/volunteer/field-support"
          className="rounded-lg border border-slate-200 bg-white p-5 hover:border-[#13A89E] transition-colors"
        >
          <Compass className="h-5 w-5 text-[#13A89E]" aria-hidden="true" />
          <h3 className="mt-3 text-base font-bold text-[#0B2545]">{t('nav.fieldObservations')}</h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">
            {t('rescue.volunteerFieldSubtitle')}
          </p>
        </Link>

        <Link
          to="/dashboard/volunteer/shelters"
          className="rounded-lg border border-slate-200 bg-white p-5 hover:border-[#13A89E] transition-colors"
        >
          <Building2 className="h-5 w-5 text-[#13A89E]" aria-hidden="true" />
          <h3 className="mt-3 text-base font-bold text-[#0B2545]">{t('nav.shelterStatus')}</h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">
            {t('rescue.volunteerSheltersSubtitle')}
          </p>
        </Link>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 flex items-start gap-3">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#0B2545]" aria-hidden="true" />
        <p className="text-xs leading-relaxed text-slate-600">
          {t('dashboard.volunteerPrivacyBoundary')}
        </p>
      </section>
    </div>
  );
}

export function VolunteerDashboard() {
  const { t } = useTranslation();
  const navItems = getNavItemsForRole(ROLES.VOLUNTEER);

  return (
    <Routes>
      <Route
        index
        element={
          <DashboardLayout navItems={navItems} pageTitle={t('dashboard.volunteerTitle')}>
            <VolunteerOverview />
          </DashboardLayout>
        }
      />
      <Route
        path="tasks"
        element={
          <DashboardLayout navItems={navItems} pageTitle={t('rescue.volunteerTasksTitle')}>
            <VolunteerTasksPage />
          </DashboardLayout>
        }
      />
      <Route
        path="field-support"
        element={
          <DashboardLayout navItems={navItems} pageTitle={t('rescue.volunteerFieldTitle')}>
            <VolunteerFieldSupportPage />
          </DashboardLayout>
        }
      />
      <Route
        path="shelters"
        element={
          <DashboardLayout navItems={navItems} pageTitle={t('rescue.volunteerSheltersTitle')}>
            <VolunteerSheltersPage />
          </DashboardLayout>
        }
      />
    </Routes>
  );
}
