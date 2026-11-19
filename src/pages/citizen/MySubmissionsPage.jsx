import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  FilePlus2,
  FileText,
  Map,
  Search,
  Siren,
  Users,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { dataService } from '../../services/dataService';
import { formatNumber, formatTimestamp, getIncidentCategoryLabel } from '../../utils/constants';
import { OriginBadge, SeverityBadge, StatusBadge } from '../../components/common/Badges';
import { EmergencyStatusTracker } from '../../components/emergency/EmergencyStatusTracker';
import { TranslateTextBlock } from '../../components/ai/TranslateTextBlock';
import { EmptyState, ErrorState, LoadingState } from '../../components/common/StateFeedback';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import {
  OFFLINE_QUEUE_EVENT,
  OFFLINE_SYNC_COMPLETE_EVENT,
} from '../../utils/offlineIncidentQueue';

export function MySubmissionsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState('reports');
  const [incidents, setIncidents] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  const loadData = async () => {
    if (!user?.id) return;
    setLoading(true);
    setError('');
    try {
      const [myIncidents, myRequests] = await Promise.all([
        dataService.getMyIncidents(user.id),
        dataService.getMyEmergencyRequests(user.id),
      ]);
      setIncidents(myIncidents);
      setRequests(myRequests);
    } catch (err) {
      setError(err?.message || t('errors.loadSubmissionsFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const handleSyncRefresh = () => {
      loadData();
    };
    window.addEventListener(OFFLINE_SYNC_COMPLETE_EVENT, handleSyncRefresh);
    window.addEventListener(OFFLINE_QUEUE_EVENT, handleSyncRefresh);
    return () => {
      window.removeEventListener(OFFLINE_SYNC_COMPLETE_EVENT, handleSyncRefresh);
      window.removeEventListener(OFFLINE_QUEUE_EVENT, handleSyncRefresh);
    };
  }, [user?.id]);

  const filteredIncidents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return incidents.filter((item) => {
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      if (!q) return true;
      return (
        item.incident_code?.toLowerCase().includes(q) ||
        item.title?.toLowerCase().includes(q) ||
        item.locality?.toLowerCase().includes(q) ||
        item.location_text?.toLowerCase().includes(q)
      );
    });
  }, [incidents, searchQuery, statusFilter]);

  const filteredRequests = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return requests.filter((item) => {
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      if (!q) return true;
      return (
        item.request_code?.toLowerCase().includes(q) ||
        item.locality?.toLowerCase().includes(q) ||
        item.location_text?.toLowerCase().includes(q) ||
        item.description?.toLowerCase().includes(q)
      );
    });
  }, [requests, searchQuery, statusFilter]);

  const handleConfirmCancel = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      const updated = await dataService.cancelEmergencyRequest(user.id, cancelTarget.id);
      setRequests((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      setCancelTarget(null);
      showToast({
        title: t('emergency.toastCancelledTitle', { code: updated.request_code }),
        message: t('emergency.toastCancelledMsg'),
        type: 'info',
      });
    } catch (err) {
      showToast({
        title: t('emergency.toastCancelFailedTitle'),
        message: err?.message || t('common.tryAgain'),
        type: 'error',
      });
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Segmented Switcher + Action CTAs */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex flex-wrap rounded-lg border border-slate-200 bg-white p-1">
          <button
            type="button"
            onClick={() => {
              setActiveTab('reports');
              setStatusFilter('all');
            }}
            className={`rounded-md px-4 py-2 text-sm font-semibold transition-colors shrink-0 tabular-nums ${
              activeTab === 'reports'
                ? 'bg-[#0B2545] text-white'
                : 'text-slate-600 hover:text-[#0B2545]'
            }`}
          >
            {t('incident.myReportsCount', { count: formatNumber(incidents.length) })}
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('requests');
              setStatusFilter('all');
            }}
            className={`rounded-md px-4 py-2 text-sm font-semibold transition-colors shrink-0 tabular-nums ${
              activeTab === 'requests'
                ? 'bg-[#0B2545] text-white'
                : 'text-slate-600 hover:text-[#0B2545]'
            }`}
          >
            {t('emergency.myRequestsCount', { count: formatNumber(requests.length) })}
          </button>
        </div>

        <div className="flex flex-wrap gap-2.5 shrink-0">
          <Link
            to="/dashboard/citizen/report"
            className="inline-flex items-center gap-1.5 rounded-md bg-[#0B2545] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#13315C] transition-colors shrink-0"
          >
            <FilePlus2 className="h-4 w-4" />
            <span>{t('incident.newFloodReport')}</span>
          </Link>
          <Link
            to="/dashboard/citizen/emergency"
            className="inline-flex items-center gap-1.5 rounded-md bg-[#F28C28] px-3.5 py-2 text-xs font-bold text-[#0B2545] hover:bg-[#D97316] hover:text-white transition-colors shrink-0"
          >
            <Siren className="h-4 w-4" />
            <span>{t('emergency.newEmergencyRequest')}</span>
          </Link>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              activeTab === 'reports'
                ? t('incident.searchReportsPlaceholder')
                : t('emergency.searchRequestsPlaceholder')
            }
            className="w-full rounded-md border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-[#0B2545] focus:border-[#13A89E] focus:outline-none"
          />
        </div>

        <select
          aria-label={t('common.filterByStatus')}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-[#0B2545] focus:border-[#13A89E] focus:outline-none"
        >
          <option value="all">{t('common.allStatuses')}</option>
          {activeTab === 'reports' ? (
            <>
              <option value="queued_offline">{t('status.queued_offline')}</option>
              <option value="pending_verification">{t('status.pending_verification')}</option>
              <option value="verified">{t('status.verified')}</option>
              <option value="rejected">{t('status.rejected')}</option>
              <option value="duplicate">{t('status.duplicate')}</option>
            </>
          ) : (
            <>
              <option value="pending">{t('emergency.steps.pending')}</option>
              <option value="verified">{t('status.verified')}</option>
              <option value="assigned">{t('status.assigned')}</option>
              <option value="rescue_in_progress">{t('status.rescue_in_progress')}</option>
              <option value="resolved">{t('status.resolved')}</option>
              <option value="closed">{t('status.closed')}</option>
              <option value="cancelled">{t('status.cancelled')}</option>
            </>
          )}
        </select>
      </div>

      {/* Data Content */}
      {loading ? (
        <LoadingState message={t('incident.loadingHistory')} />
      ) : error ? (
        <ErrorState message={error} onRetry={loadData} />
      ) : activeTab === 'reports' ? (
        filteredIncidents.length === 0 ? (
          <EmptyState
            title={t('incident.noReportsFoundTitle')}
            description={
              incidents.length === 0
                ? t('incident.noReportsSubmittedYet')
                : t('incident.noReportsMatchFilter')
            }
            icon={FileText}
          />
        ) : (
          <div className="space-y-4">
            {filteredIncidents.map((inc) => (
              <article
                key={inc.id}
                className="rounded-lg border border-slate-200 bg-white p-5 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="font-mono text-sm font-bold text-[#0E857D] tabular-nums">
                      {inc.incident_code}
                    </span>
                    <span className="text-xs font-medium text-slate-500">
                      {getIncidentCategoryLabel(inc.category)} · {inc.locality}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <OriginBadge origin={inc.info_origin} />
                    <SeverityBadge severity={inc.reviewed_priority || inc.severity} />
                    <StatusBadge status={inc.status} kind="incident" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <h3 className="text-base font-bold text-[#0B2545]">{inc.title}</h3>
                  <TranslateTextBlock text={inc.description} label={t('incident.reportDescriptionLabel')} />
                </div>

                {Array.isArray(inc.photo_urls) && inc.photo_urls[0] ? (
                  <div>
                    <img
                      src={inc.photo_urls[0]}
                      alt={t('incident.attachedEvidenceAlt', { code: inc.incident_code })}
                      referrerPolicy="no-referrer"
                      className="h-36 w-52 rounded-md border border-slate-200 object-cover"
                    />
                  </div>
                ) : null}

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3 text-xs text-slate-500">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 tabular-nums">
                    <span>
                      {t('incident.locationPrefix')}: {inc.location_text}
                    </span>
                    <span>·</span>
                    <span>
                      {t('incident.observedPrefix')}: {formatTimestamp(inc.observed_at || inc.created_at)}
                    </span>
                    <span>·</span>
                    <span>
                      {t('incident.pinPrefix')}: {Number(inc.latitude).toFixed(4)}, {Number(inc.longitude).toFixed(4)}
                    </span>
                  </div>

                  <Link
                    to={`/dashboard/citizen/map?lat=${inc.latitude}&lng=${inc.longitude}`}
                    className="inline-flex items-center gap-1 font-semibold text-[#0B2545] hover:text-[#13A89E]"
                  >
                    <Map className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{t('map.showOnMap')}</span>
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )
      ) : filteredRequests.length === 0 ? (
        <EmptyState
          title={t('emergency.noRequestsFoundTitle')}
          description={
            requests.length === 0
              ? t('emergency.noRequestsLoggedYet')
              : t('emergency.noRequestsMatchFilter')
          }
          icon={Siren}
        />
      ) : (
        <div className="space-y-4">
          {filteredRequests.map((req) => (
            <article
              key={req.id}
              className="rounded-lg border border-slate-200 bg-white p-5 space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="font-mono text-sm font-bold text-[#0B2545] tabular-nums">
                    {req.request_code}
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 tabular-nums">
                    <Users className="h-3.5 w-3.5 text-[#13A89E]" aria-hidden="true" />
                    {t('emergency.totalCount', { count: formatNumber(req.people_count) })}
                    {req.children_count > 0
                      ? ` · ${t('emergency.childrenCountShort', { count: formatNumber(req.children_count) })}`
                      : ''}
                    {req.elderly_count > 0
                      ? ` · ${t('emergency.elderlyCountShort', { count: formatNumber(req.elderly_count) })}`
                      : ''}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <SeverityBadge severity={req.reviewed_priority || req.severity} />
                  <StatusBadge status={req.status} kind="emergency" />
                </div>
              </div>

              <EmergencyStatusTracker status={req.status} />

              <div className="grid gap-3 rounded-md border border-slate-100 bg-[#F4F6F8] p-3.5 text-xs text-slate-700 sm:grid-cols-2">
                <div>
                  <p className="font-semibold text-[#0B2545]">{t('emergency.locationPrivateLabel')}</p>
                  <p className="mt-0.5">
                    {req.location_text}, {req.locality}
                  </p>
                </div>
                <div>
                  <p className="font-semibold text-[#0B2545]">{t('emergency.situationSummaryLabel')}</p>
                  <div className="mt-1">
                    <TranslateTextBlock
                      text={req.description}
                      label={t('emergency.situationSummaryLabel')}
                      compact
                    />
                  </div>
                </div>
                {req.medical_needs ? (
                  <div>
                    <p className="font-semibold text-[#0B2545]">{t('emergency.medicalNeedsLabel')}</p>
                    <p className="mt-0.5">{req.medical_needs}</p>
                  </div>
                ) : null}
                {req.accessibility_needs ? (
                  <div>
                    <p className="font-semibold text-[#0B2545]">{t('emergency.accessibilityLabel')}</p>
                    <p className="mt-0.5">{req.accessibility_needs}</p>
                  </div>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3 text-xs text-slate-500">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 tabular-nums">
                  <span>
                    {t('common.submitted')}: {formatTimestamp(req.created_at)}
                  </span>
                  {req.assigned_team_name ? (
                    <>
                      <span>·</span>
                      <span className="font-semibold text-[#0B2545]">
                        {t('emergency.assignedTeamPrefix')}: {req.assigned_team_name}
                      </span>
                    </>
                  ) : null}
                </div>

                {['pending', 'verified'].includes(req.status) ? (
                  <button
                    type="button"
                    onClick={() => setCancelTarget(req)}
                    className="inline-flex items-center gap-1 rounded border border-red-200 bg-white px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 transition-colors"
                  >
                    <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{t('emergency.cancelRequest')}</span>
                  </button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(cancelTarget)}
        title={t('emergency.cancelConfirmTitle', {
          code: cancelTarget?.request_code || t('emergency.emergencyRequestFallback'),
        })}
        description={t('emergency.cancelConfirmDesc')}
        confirmLabel={t('emergency.confirmCancelBtn')}
        cancelLabel={t('emergency.keepActiveBtn')}
        tone="danger"
        busy={cancelling}
        onConfirm={handleConfirmCancel}
        onCancel={() => setCancelTarget(null)}
      />
    </div>
  );
}
