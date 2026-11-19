import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CheckCircle2,
  ClipboardList,
  MapPin,
  Plus,
  RefreshCw,
  ShieldCheck,
  UserCheck,
  XCircle,
} from 'lucide-react';
import { DemoDataBadge, SeverityBadge } from '../../components/common/Badges';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { EmptyState, ErrorState, LoadingState } from '../../components/common/StateFeedback';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { dataService } from '../../services/dataService';
import { EAST_GODAVARI_LOCALITIES, formatNumber, formatTimestamp } from '../../utils/constants';

const TASK_STATUS_STYLE = {
  open: 'bg-amber-50 text-amber-900 border-amber-500/40',
  assigned: 'bg-slate-100 text-[#0B2545] border-[#0B2545]/25',
  in_progress: 'bg-[#FEF5EC] text-[#9A4D09] border-[#F28C28]/45',
  completed: 'bg-emerald-50 text-emerald-800 border-emerald-600/30',
  cancelled: 'bg-slate-100 text-slate-600 border-slate-300',
};

export function AdminVolunteersPage() {
  const { t } = useTranslation();
  const { user, isDemoMode } = useAuth();
  const { showToast } = useToast();

  const taskTypes = [
    { value: 'shelter_support', label: t('admin.taskTypeShelterSupport') },
    { value: 'field_support', label: t('admin.taskTypeFieldSupport') },
    { value: 'relief_distribution', label: t('admin.taskTypeReliefDistribution') },
    { value: 'community_outreach', label: t('admin.taskTypeCommunityOutreach') },
  ];

  const [volunteers, setVolunteers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [shelters, setShelters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [activeTab, setActiveTab] = useState('roster'); // 'roster' | 'tasks'
  const [confirmDecision, setConfirmDecision] = useState(null); // { volunteer, decision }
  const [busyDecision, setBusyDecision] = useState(false);

  const [showTaskForm, setShowTaskForm] = useState(false);
  const [creatingTask, setCreatingTask] = useState(false);
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    task_type: 'shelter_support',
    locality: EAST_GODAVARI_LOCALITIES[0],
    shelter_id: '',
    assigned_volunteer_id: '',
    priority: 'medium',
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [volList, taskList, shelterList] = await Promise.all([
        dataService.getVolunteers(),
        dataService.getVolunteerTasks(),
        dataService.getShelters(),
      ]);
      setVolunteers(volList);
      setTasks(taskList);
      setShelters(shelterList);
    } catch (err) {
      setError(err.message || t('errors.loadVolunteersTasksFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const approvedVolunteers = useMemo(
    () => volunteers.filter((v) => v.approval_status === 'approved'),
    [volunteers]
  );
  const pendingVolunteers = useMemo(
    () => volunteers.filter((v) => v.approval_status === 'pending'),
    [volunteers]
  );

  const handleConfirmDecision = async () => {
    if (!confirmDecision || !user) return;
    setBusyDecision(true);
    try {
      await dataService.reviewVolunteerApplication(
        user.id,
        confirmDecision.volunteer.id,
        confirmDecision.decision
      );
      showToast(
        confirmDecision.decision === 'approved'
          ? t('admin.toastVolunteerApproved', { name: confirmDecision.volunteer.full_name })
          : t('admin.toastVolunteerDeclined', { name: confirmDecision.volunteer.full_name }),
        confirmDecision.decision === 'approved' ? 'success' : 'info'
      );
      setConfirmDecision(null);
      await loadData();
    } catch (err) {
      showToast(err.message || t('errors.reviewApplicationFailed'), 'error');
    } finally {
      setBusyDecision(false);
    }
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!user) return;
    if (!taskForm.title.trim() || !taskForm.description.trim()) {
      showToast(t('admin.validationTaskTitleDesc'), 'error');
      return;
    }
    setCreatingTask(true);
    try {
      await dataService.createVolunteerTask(user.id, {
        ...taskForm,
        shelter_id: taskForm.shelter_id || null,
        assigned_volunteer_id: taskForm.assigned_volunteer_id || null,
      });
      showToast(t('admin.toastTaskCreated'), 'success');
      setTaskForm({
        title: '',
        description: '',
        task_type: 'shelter_support',
        locality: EAST_GODAVARI_LOCALITIES[0],
        shelter_id: '',
        assigned_volunteer_id: '',
        priority: 'medium',
      });
      setShowTaskForm(false);
      await loadData();
    } catch (err) {
      showToast(err.message || t('errors.createVolunteerTaskFailed'), 'error');
    } finally {
      setCreatingTask(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-[#0E857D]">
              {t('admin.volunteersEyebrow')}
            </p>
            <h2 className="mt-1 text-lg font-bold text-[#0B2545]">
              {t('admin.volunteersHeading')}
            </h2>
            <p className="mt-1 text-sm text-slate-600">{t('admin.volunteersSubtitle')}</p>
          </div>
          <div className="flex items-center gap-2">
            {isDemoMode ? <DemoDataBadge compact /> : null}
            <button
              type="button"
              onClick={loadData}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>{t('common.refresh')}</span>
            </button>
          </div>
        </div>

        {/* Sub-tabs */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <div className="inline-flex flex-wrap rounded-md border border-slate-200 bg-[#F4F6F8] p-1">
            <button
              type="button"
              onClick={() => setActiveTab('roster')}
              className={`rounded px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                activeTab === 'roster'
                  ? 'bg-[#0B2545] text-white'
                  : 'text-slate-700 hover:bg-white'
              }`}
            >
              {t('admin.tabVolunteersCount', { count: formatNumber(volunteers.length) })}
              {pendingVolunteers.length > 0
                ? ` · ${t('admin.pendingSuffix', { count: formatNumber(pendingVolunteers.length) })}`
                : ''}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('tasks')}
              className={`rounded px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                activeTab === 'tasks'
                  ? 'bg-[#0B2545] text-white'
                  : 'text-slate-700 hover:bg-white'
              }`}
            >
              {t('admin.tabVolunteerTasksCount', { count: formatNumber(tasks.length) })}
            </button>
          </div>

          {activeTab === 'tasks' ? (
            <button
              type="button"
              onClick={() => setShowTaskForm((p) => !p)}
              className="inline-flex items-center gap-1.5 rounded-md bg-[#0B2545] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#13315C]"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{showTaskForm ? t('admin.closeTaskFormBtn') : t('admin.createTaskBtn')}</span>
            </button>
          ) : null}
        </div>
      </section>

      {loading ? (
        <LoadingState message={t('admin.loadingVolunteersTasks')} />
      ) : error ? (
        <ErrorState message={error} onRetry={loadData} />
      ) : activeTab === 'roster' ? (
        <div className="space-y-4">
          {volunteers.length === 0 ? (
            <EmptyState
              icon={ShieldCheck}
              title={t('admin.emptyVolunteersTitle')}
              description={t('admin.emptyVolunteersDesc')}
            />
          ) : (
            volunteers.map((vol) => (
              <article
                key={vol.id}
                className="rounded-lg border border-slate-200 bg-white p-5 flex flex-wrap items-start justify-between gap-4"
              >
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-bold text-[#0B2545]">{vol.full_name}</h3>
                    <span
                      className={`rounded border px-2 py-0.5 text-xs font-semibold ${
                        vol.approval_status === 'approved'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-600/30'
                          : vol.approval_status === 'pending'
                          ? 'bg-amber-50 text-amber-900 border-amber-500/40'
                          : 'bg-slate-100 text-slate-600 border-slate-300'
                      }`}
                    >
                      {t(`status.approval.${vol.approval_status}`, {
                        defaultValue: vol.approval_status,
                      })}
                    </span>
                    {vol.approval_status === 'approved' ? (
                      <span className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-700">
                        {t('admin.availabilityBadge', {
                          status: t(`status.availability.${vol.availability_status || 'available'}`, {
                            defaultValue: vol.availability_status || 'available',
                          }),
                        })}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-xs text-slate-600">
                    {vol.locality || 'East Godavari'} · {vol.email || t('admin.registeredUserFallback')}
                    {vol.phone ? ` · ${vol.phone}` : ''}
                  </p>
                  {Array.isArray(vol.skills) && vol.skills.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {vol.skills.map((skill) => (
                        <span
                          key={skill}
                          className="rounded border border-slate-200 bg-[#F4F6F8] px-2 py-0.5 text-[11px] font-medium text-slate-700"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {vol.notes ? (
                    <p className="text-xs text-slate-500 pt-1">
                      {t('common.note')}: {vol.notes}
                    </p>
                  ) : null}
                </div>

                <div className="flex items-center gap-2">
                  {vol.approval_status !== 'approved' ? (
                    <button
                      type="button"
                      onClick={() =>
                        setConfirmDecision({ volunteer: vol, decision: 'approved' })
                      }
                      className="inline-flex items-center gap-1.5 rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800"
                    >
                      <UserCheck className="h-3.5 w-3.5" />
                      <span>{t('admin.approveVolunteerBtn')}</span>
                    </button>
                  ) : null}
                  {vol.approval_status !== 'rejected' ? (
                    <button
                      type="button"
                      onClick={() =>
                        setConfirmDecision({ volunteer: vol, decision: 'rejected' })
                      }
                      className="inline-flex items-center gap-1.5 rounded-md border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-800 hover:bg-red-100"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      <span>
                        {vol.approval_status === 'approved'
                          ? t('admin.revokeBtn')
                          : t('admin.rejectBtn')}
                      </span>
                    </button>
                  ) : null}
                </div>
              </article>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {showTaskForm ? (
            <form
              onSubmit={handleCreateTask}
              className="rounded-lg border border-slate-200 bg-white p-5 space-y-4"
            >
              <h3 className="text-sm font-bold text-[#0B2545]">{t('admin.createNewTaskHeading')}</h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700">
                    {t('admin.taskTitleLabel')} *
                  </label>
                  <input
                    type="text"
                    required
                    value={taskForm.title}
                    onChange={(e) => setTaskForm((p) => ({ ...p, title: e.target.value }))}
                    placeholder={t('admin.taskTitlePlaceholder')}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    {t('admin.taskTypeLabel')}
                  </label>
                  <select
                    value={taskForm.task_type}
                    onChange={(e) => setTaskForm((p) => ({ ...p, task_type: e.target.value }))}
                    className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    {taskTypes.map((tt) => (
                      <option key={tt.value} value={tt.value}>
                        {tt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    {t('incident.localityLabel')}
                  </label>
                  <select
                    value={taskForm.locality}
                    onChange={(e) => setTaskForm((p) => ({ ...p, locality: e.target.value }))}
                    className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    {EAST_GODAVARI_LOCALITIES.map((loc) => (
                      <option key={loc} value={loc}>
                        {loc}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    {t('admin.assignVolunteerOptionalLabel')}
                  </label>
                  <select
                    value={taskForm.assigned_volunteer_id}
                    onChange={(e) =>
                      setTaskForm((p) => ({ ...p, assigned_volunteer_id: e.target.value }))
                    }
                    className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="">{t('admin.openForAnyVolunteerOption')}</option>
                    {approvedVolunteers.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.full_name} ({v.locality})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    {t('common.priority')}
                  </label>
                  <select
                    value={taskForm.priority}
                    onChange={(e) => setTaskForm((p) => ({ ...p, priority: e.target.value }))}
                    className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="low">{t('severity.low')}</option>
                    <option value="medium">{t('severity.moderate')}</option>
                    <option value="high">{t('severity.high')}</option>
                    <option value="critical">{t('severity.critical')}</option>
                  </select>
                </div>
                <div className="sm:col-span-2 lg:col-span-3">
                  <label className="block text-xs font-semibold text-slate-700">
                    {t('admin.linkedShelterOptionalLabel')}
                  </label>
                  <select
                    value={taskForm.shelter_id}
                    onChange={(e) => setTaskForm((p) => ({ ...p, shelter_id: e.target.value }))}
                    className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="">{t('common.none')}</option>
                    {shelters.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.locality})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2 lg:col-span-3">
                  <label className="block text-xs font-semibold text-slate-700">
                    {t('admin.taskInstructionsLabel')} *
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={taskForm.description}
                    onChange={(e) => setTaskForm((p) => ({ ...p, description: e.target.value }))}
                    placeholder={t('admin.taskInstructionsPlaceholder')}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowTaskForm(false)}
                  className="rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={creatingTask}
                  className="rounded-md bg-[#0B2545] px-4 py-2 text-xs font-semibold text-white hover:bg-[#13315C] disabled:opacity-60"
                >
                  {creatingTask ? t('common.saving') : t('admin.publishTaskBtn')}
                </button>
              </div>
            </form>
          ) : null}

          {tasks.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title={t('admin.emptyVolunteerTasksTitle')}
              description={t('admin.emptyVolunteerTasksDesc')}
              actionLabel={t('admin.createTaskAction')}
              onAction={() => setShowTaskForm(true)}
            />
          ) : (
            tasks.map((task) => (
              <article
                key={task.id}
                className="rounded-lg border border-slate-200 bg-white p-5 space-y-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded border px-2 py-0.5 text-xs font-semibold ${
                        TASK_STATUS_STYLE[task.status] || TASK_STATUS_STYLE.open
                      }`}
                    >
                      {t(`status.task.${task.status}`, { defaultValue: task.status.replace('_', ' ') })}
                    </span>
                    <SeverityBadge severity={task.priority} />
                    <span className="inline-flex items-center gap-1 text-xs text-slate-600">
                      <MapPin className="h-3.5 w-3.5" />
                      {task.locality}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500 tabular-nums">
                    {t('common.createdAt', { time: formatTimestamp(task.created_at) })}
                  </span>
                </div>
                <h3 className="text-base font-bold text-[#0B2545]">{task.title}</h3>
                <p className="text-sm text-slate-700">{task.description}</p>
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-xs text-slate-600 border-t border-slate-100">
                  <span>
                    {t('admin.assignedToLabel')}:{' '}
                    <strong className="text-[#0B2545]">
                      {task.assigned_volunteer_name || t('volunteer.filterOpenQueue')}
                    </strong>
                  </span>
                  {task.progress_note ? (
                    <span className="inline-flex items-center gap-1 text-emerald-800">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {task.progress_note}
                    </span>
                  ) : null}
                </div>
              </article>
            ))
          )}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(confirmDecision)}
        title={
          confirmDecision?.decision === 'approved'
            ? t('admin.confirmApproveVolunteerTitle', {
                name: confirmDecision?.volunteer?.full_name || '',
              })
            : t('admin.confirmDeclineVolunteerTitle', {
                name: confirmDecision?.volunteer?.full_name || '',
              })
        }
        description={
          confirmDecision?.decision === 'approved'
            ? t('admin.confirmApproveVolunteerDesc')
            : t('admin.confirmDeclineVolunteerDesc')
        }
        confirmLabel={
          confirmDecision?.decision === 'approved'
            ? t('admin.confirmApprovalBtn')
            : t('admin.confirmDeclineBtn')
        }
        tone={confirmDecision?.decision === 'approved' ? 'primary' : 'danger'}
        busy={busyDecision}
        onConfirm={handleConfirmDecision}
        onCancel={() => setConfirmDecision(null)}
      />
    </div>
  );
}
