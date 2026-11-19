import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CheckCircle2,
  ClipboardList,
  MapPin,
  PlayCircle,
  RefreshCw,
  UserCheck,
  XCircle,
} from 'lucide-react';
import { DemoDataBadge, SeverityBadge } from '../../components/common/Badges';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { EmptyState, ErrorState, LoadingState } from '../../components/common/StateFeedback';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { dataService } from '../../services/dataService';
import { formatNumber, formatTimestamp } from '../../utils/constants';

const TASK_STATUS_STYLE = {
  open: 'bg-amber-50 text-amber-900 border-amber-500/40',
  assigned: 'bg-slate-100 text-[#0B2545] border-[#0B2545]/25',
  in_progress: 'bg-[#FEF5EC] text-[#9A4D09] border-[#F28C28]/45',
  completed: 'bg-emerald-50 text-emerald-800 border-emerald-600/30',
  cancelled: 'bg-slate-100 text-slate-600 border-slate-300',
};

export function VolunteerTasksPage() {
  const { t } = useTranslation();
  const { user, isDemoMode } = useAuth();
  const { showToast } = useToast();

  const [volunteerRecord, setVolunteerRecord] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [filter, setFilter] = useState('all'); // 'all' | 'open' | 'mine' | 'completed'
  const [noteByTask, setNoteByTask] = useState({});
  const [busyTaskId, setBusyTaskId] = useState(null);
  const [declineTarget, setDeclineTarget] = useState(null);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      const [vol, list] = await Promise.all([
        dataService.getMyVolunteerRecord(user.id),
        dataService.getVolunteerTasksForUser(user.id),
      ]);
      setVolunteerRecord(vol);
      setTasks(list);
    } catch (err) {
      setError(err.message || t('errors.loadVolunteerTasksFailed'));
    } finally {
      setLoading(false);
    }
  }, [user, t]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((item) => {
      const isMine = volunteerRecord && item.assigned_volunteer_id === volunteerRecord.id;
      if (filter === 'open') return item.status === 'open';
      if (filter === 'mine') return isMine && item.status !== 'completed';
      if (filter === 'completed') return isMine && item.status === 'completed';
      return true;
    });
  }, [tasks, filter, volunteerRecord]);

  const isApproved = volunteerRecord?.approval_status === 'approved';

  const handleTaskAction = async (task, action) => {
    if (!user) return;
    setBusyTaskId(task.id);
    try {
      const note = (noteByTask[task.id] || '').trim();
      await dataService.respondToVolunteerTask(user.id, task.id, action, note);
      setNoteByTask((prev) => ({ ...prev, [task.id]: '' }));
      const messages = {
        accept: t('volunteer.toastTaskAccepted', { title: task.title }),
        decline: t('volunteer.toastTaskDeclined', { title: task.title }),
        start: t('volunteer.toastTaskStarted', { title: task.title }),
        complete: t('volunteer.toastTaskCompleted', { title: task.title }),
      };
      showToast(messages[action] || t('volunteer.toastTaskUpdated'), action === 'decline' ? 'info' : 'success');
      setDeclineTarget(null);
      await loadData();
    } catch (err) {
      showToast(err.message || t('errors.updateTaskFailed'), 'error');
    } finally {
      setBusyTaskId(null);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-[#0E857D]">{t('volunteer.tasksEyebrow')}</p>
            <h2 className="mt-1 text-lg font-bold text-[#0B2545]">{t('volunteer.tasksHeading')}</h2>
            <p className="mt-1 text-sm text-slate-600">{t('volunteer.tasksSubtitle')}</p>
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

        <div className="inline-flex flex-wrap rounded-md border border-slate-200 bg-[#F4F6F8] p-1">
          {[
            { id: 'all', label: t('volunteer.filterAllCount', { count: formatNumber(tasks.length) }) },
            { id: 'open', label: t('volunteer.filterOpenQueue') },
            { id: 'mine', label: t('volunteer.filterMyActive') },
            { id: 'completed', label: t('status.completed') },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              className={`rounded px-3 py-1.5 text-xs font-semibold transition-colors ${
                filter === item.id ? 'bg-[#0B2545] text-white' : 'text-slate-700 hover:bg-white'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </section>

      {loading ? (
        <LoadingState message={t('volunteer.loadingTasks')} />
      ) : error ? (
        <ErrorState message={error} onRetry={loadData} />
      ) : filteredTasks.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={t('volunteer.emptyTasksTitle')}
          description={t('volunteer.emptyTasksDesc')}
          actionLabel={t('volunteer.showAllTasks')}
          onAction={() => setFilter('all')}
        />
      ) : (
        <div className="space-y-4">
          {filteredTasks.map((task) => {
            const isMine = volunteerRecord && task.assigned_volunteer_id === volunteerRecord.id;
            const busy = busyTaskId === task.id;
            const isDone = task.status === 'completed' || task.status === 'cancelled';

            return (
              <article
                key={task.id}
                className="rounded-lg border border-slate-200 bg-white p-5 space-y-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="space-y-1">
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
                    <h3 className="text-base font-bold text-[#0B2545]">{task.title}</h3>
                  </div>
                  <span className="text-[11px] text-slate-500 tabular-nums">
                    {t('common.updatedAt', { time: formatTimestamp(task.updated_at || task.created_at) })}
                  </span>
                </div>

                <p className="text-sm leading-relaxed text-slate-700">{task.description}</p>

                {task.progress_note ? (
                  <div className="rounded-md border border-slate-200 bg-[#F4F6F8] px-3 py-2 text-xs text-slate-700">
                    <span className="font-semibold text-[#0B2545]">
                      {t('volunteer.latestProgressNote')}:
                    </span>{' '}
                    {task.progress_note}
                  </div>
                ) : null}

                {!isDone && isApproved ? (
                  <div className="rounded-md border border-slate-200 bg-white p-3 space-y-2.5">
                    <input
                      type="text"
                      value={noteByTask[task.id] || ''}
                      onChange={(e) =>
                        setNoteByTask((prev) => ({ ...prev, [task.id]: e.target.value }))
                      }
                      placeholder={t('volunteer.progressNotePlaceholder')}
                      className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-xs focus:border-[#13A89E] focus:outline-none"
                    />

                    <div className="flex flex-wrap items-center gap-2">
                      {task.status === 'open' ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleTaskAction(task, 'accept')}
                          className="inline-flex items-center gap-1.5 rounded-md bg-[#0B2545] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#13315C] disabled:opacity-60"
                        >
                          <UserCheck className="h-3.5 w-3.5" />
                          <span>{t('volunteer.acceptTask')}</span>
                        </button>
                      ) : null}

                      {isMine && task.status === 'assigned' ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleTaskAction(task, 'start')}
                          className="inline-flex items-center gap-1.5 rounded-md bg-[#F28C28] px-3.5 py-1.5 text-xs font-semibold text-[#0B2545] hover:bg-[#df7c1d] disabled:opacity-60"
                        >
                          <PlayCircle className="h-3.5 w-3.5" />
                          <span>{t('volunteer.startProgress')}</span>
                        </button>
                      ) : null}

                      {isMine && ['assigned', 'in_progress'].includes(task.status) ? (
                        <>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handleTaskAction(task, 'complete')}
                            className="inline-flex items-center gap-1.5 rounded-md bg-emerald-700 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>{t('volunteer.markCompleted')}</span>
                          </button>

                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => setDeclineTarget(task)}
                            className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-800 hover:bg-red-100 disabled:opacity-60"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            <span>{t('volunteer.declineRelease')}</span>
                          </button>
                        </>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(declineTarget)}
        title={t('volunteer.declineConfirmTitle', { title: declineTarget?.title || '' })}
        description={t('volunteer.declineConfirmDesc')}
        confirmLabel={t('volunteer.declineConfirmBtn')}
        tone="danger"
        busy={busyTaskId === declineTarget?.id}
        onConfirm={() => {
          if (declineTarget) handleTaskAction(declineTarget, 'decline');
        }}
        onCancel={() => setDeclineTarget(null)}
      />
    </div>
  );
}
