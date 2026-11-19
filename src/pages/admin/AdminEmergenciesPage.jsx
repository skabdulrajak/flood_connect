import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CheckCircle2,
  HeartPulse,
  LifeBuoy,
  Loader2,
  Lock,
  MapPin,
  Phone,
  RefreshCw,
  Search,
  Siren,
  Sparkles,
  Users,
} from 'lucide-react';
import {
  DemoDataBadge,
  OriginBadge,
  SeverityBadge,
  StatusBadge,
} from '../../components/common/Badges';
import { EmptyState, ErrorState, LoadingState } from '../../components/common/StateFeedback';
import { EmergencyStatusTracker } from '../../components/emergency/EmergencyStatusTracker';
import { AiFallbackNotice } from '../../components/ai/AiFallbackNotice';
import { TranslateTextBlock } from '../../components/ai/TranslateTextBlock';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { dataService } from '../../services/dataService';
import { suggestEmergencyPriority } from '../../services/aiService';
import { formatNumber, formatTimestamp, getSeverityMeta } from '../../utils/constants';

export function AdminEmergenciesPage() {
  const { t } = useTranslation();
  const { user, isDemoMode } = useAuth();
  const { showToast } = useToast();

  const [requests, setRequests] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Inline control state keyed by request.id
  const [drafts, setDrafts] = useState({});
  const [savingId, setSavingId] = useState(null);
  const [aiPriorityById, setAiPriorityById] = useState({});

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [reqList, teamList] = await Promise.all([
        dataService.getAllEmergencyRequests(),
        dataService.getRescueTeams(),
      ]);
      setRequests(reqList);
      setTeams(teamList);

      const initialDrafts = {};
      reqList.forEach((r) => {
        initialDrafts[r.id] = {
          assigned_team_id: r.assigned_team_id || '',
          status: r.status,
          reviewed_priority: r.reviewed_priority || r.severity || 'high',
          note: '',
        };
      });
      setDrafts(initialDrafts);
    } catch (err) {
      setError(err.message || t('errors.loadEmergenciesFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredRequests = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return requests.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (q) {
        const hay = `${r.request_code} ${r.requester_name} ${r.locality} ${r.location_text} ${r.description} ${r.assigned_team_name || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [requests, searchQuery, statusFilter]);

  const updateDraft = (id, patch) => {
    setDrafts((prev) => ({
      ...prev,
      [id]: { ...(prev[id] || {}), ...patch },
    }));
  };

  const handleRunAiPriority = async (req) => {
    setAiPriorityById((prev) => ({
      ...prev,
      [req.id]: { ...(prev[req.id] || {}), loading: true },
    }));
    try {
      const suggestion = await suggestEmergencyPriority({
        people_count: req.people_count,
        children_count: req.children_count,
        elderly_count: req.elderly_count,
        medical_needs: req.medical_needs,
        accessibility_needs: req.accessibility_needs,
        is_trapped: /trapped|stranded|terrace|roof/i.test(req.description || ''),
        description: req.description,
        locality: req.locality,
      });
      setAiPriorityById((prev) => ({
        ...prev,
        [req.id]: { loading: false, suggestion },
      }));
    } catch {
      setAiPriorityById((prev) => ({
        ...prev,
        [req.id]: { ...(prev[req.id] || {}), loading: false },
      }));
      showToast(t('errors.aiPriorityFailed'), 'error');
    }
  };

  const handleQuickVerify = async (req) => {
    if (!user) return;
    setSavingId(req.id);
    try {
      await dataService.updateEmergencyRequestAdmin(
        user.id,
        req.id,
        { status: 'verified', reviewed_priority: drafts[req.id]?.reviewed_priority || req.severity },
        t('admin.defaultEmergencyVerifyNote')
      );
      showToast(t('admin.toastEmergencyVerified', { code: req.request_code }), 'success');
      await loadData();
    } catch (err) {
      showToast(err.message || t('errors.verifyRequestFailed'), 'error');
    } finally {
      setSavingId(null);
    }
  };

  const handleApplyDispatchUpdate = async (req) => {
    if (!user) return;
    const draft = drafts[req.id];
    if (!draft) return;

    setSavingId(req.id);
    try {
      await dataService.updateEmergencyRequestAdmin(
        user.id,
        req.id,
        {
          assigned_team_id: draft.assigned_team_id || null,
          status: draft.status,
          reviewed_priority: draft.reviewed_priority,
        },
        draft.note || ''
      );
      showToast(t('admin.toastDispatchUpdated', { code: req.request_code }), 'success');
      await loadData();
    } catch (err) {
      showToast(err.message || t('errors.updateEmergencyFailed'), 'error');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-[#0B2545]" aria-hidden="true" />
              <p className="text-xs font-semibold text-[#C06310]">
                {t('admin.emergenciesEyebrow')}
              </p>
            </div>
            <h2 className="mt-1 text-lg font-bold text-[#0B2545]">
              {t('admin.emergenciesHeading')}
            </h2>
            <p className="mt-1 text-sm text-slate-600">{t('admin.emergenciesSubtitle')}</p>
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

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="relative lg:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('admin.searchEmergenciesPlaceholder')}
              className="w-full rounded-md border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-[#13A89E] focus:outline-none"
            />
          </div>
          <select
            aria-label={t('admin.filterEmergenciesStatus')}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-[#13A89E] focus:outline-none"
          >
            <option value="all">
              {t('admin.allStatusesCount', { count: formatNumber(requests.length) })}
            </option>
            <option value="pending">{t('emergency.steps.pending')}</option>
            <option value="verified">{t('status.verified')}</option>
            <option value="assigned">{t('status.assigned')}</option>
            <option value="rescue_in_progress">{t('status.rescue_in_progress')}</option>
            <option value="resolved">{t('status.resolved')}</option>
            <option value="closed">{t('status.closed')}</option>
            <option value="cancelled">{t('status.cancelled')}</option>
          </select>
        </div>
      </section>

      {loading ? (
        <LoadingState message={t('admin.loadingEmergenciesQueue')} />
      ) : error ? (
        <ErrorState message={error} onRetry={loadData} />
      ) : filteredRequests.length === 0 ? (
        <EmptyState
          icon={Siren}
          title={t('admin.emptyEmergenciesTitle')}
          description={t('admin.emptyEmergenciesDesc')}
          actionLabel={t('admin.showAllRequestsBtn')}
          onAction={() => {
            setSearchQuery('');
            setStatusFilter('all');
          }}
        />
      ) : (
        <div className="space-y-4">
          {filteredRequests.map((req) => {
            const draft = drafts[req.id] || {
              assigned_team_id: req.assigned_team_id || '',
              status: req.status,
              reviewed_priority: req.reviewed_priority || req.severity || 'high',
              note: '',
            };
            const isSaving = savingId === req.id;

            return (
              <article
                key={req.id}
                className="rounded-lg border border-slate-200 bg-white p-5 space-y-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-[#0B2545] tabular-nums">
                        {req.request_code}
                      </span>
                      <StatusBadge status={req.status} kind="emergency" />
                      <SeverityBadge severity={req.reviewed_priority || req.severity} />
                      <OriginBadge origin={req.info_origin} />
                    </div>
                    <h3 className="text-base font-bold text-[#0B2545]">
                      {req.requester_name} · {req.locality}
                    </h3>
                    <p className="text-xs text-slate-500 tabular-nums">
                      {t('admin.loggedUpdatedMeta', {
                        created: formatTimestamp(req.created_at),
                        updated: formatTimestamp(req.updated_at),
                      })}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={Boolean(aiPriorityById[req.id]?.loading)}
                      onClick={() => handleRunAiPriority(req)}
                      className="inline-flex items-center gap-1.5 rounded-md border border-[#13A89E] bg-[#ECFAF8] px-3 py-1.5 text-xs font-semibold text-[#0A625C] hover:bg-[#13A89E] hover:text-white transition-colors disabled:opacity-60"
                    >
                      {aiPriorityById[req.id]?.loading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      <span>
                        {aiPriorityById[req.id]?.loading
                          ? t('emergency.evaluatingPriority')
                          : t('emergency.aiPriorityButton')}
                      </span>
                    </button>

                    {req.status === 'pending' ? (
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => handleQuickVerify(req)}
                        className="inline-flex items-center gap-1.5 rounded-md bg-[#13A89E] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0E857D] disabled:opacity-60"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>{t('admin.verifyRequestBtn')}</span>
                      </button>
                    ) : null}
                  </div>
                </div>

                {/* 6-step status tracker */}
                <EmergencyStatusTracker status={req.status} compact />

                {/* Protected Household Details */}
                <div className="grid gap-3 rounded-md border border-slate-200 bg-[#F4F6F8] p-3.5 text-xs sm:grid-cols-2 lg:grid-cols-4">
                  <div className="flex items-start gap-2">
                    <Phone className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#0B2545]" />
                    <div>
                      <p className="font-semibold text-[#0B2545]">{t('admin.protectedContactLabel')}</p>
                      <p className="font-mono font-semibold text-slate-800 tabular-nums">
                        {req.contact_phone}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Users className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#0B2545]" />
                    <div>
                      <p className="font-semibold text-[#0B2545]">{t('admin.peopleCountLabel')}</p>
                      <p className="text-slate-700 tabular-nums">
                        {t('admin.peopleBreakdownLine', {
                          total: formatNumber(req.people_count),
                          children: formatNumber(req.children_count || 0),
                          elderly: formatNumber(req.elderly_count || 0),
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <HeartPulse className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-700" />
                    <div>
                      <p className="font-semibold text-[#0B2545]">
                        {t('rescue.medicalAccessibilityLabel')}
                      </p>
                      <p className="text-slate-700">
                        {req.medical_needs || t('admin.noMedicalNeedsListed')}
                      </p>
                      {req.accessibility_needs ? (
                        <p className="mt-0.5 text-slate-600">{req.accessibility_needs}</p>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#0B2545]" />
                    <div>
                      <p className="font-semibold text-[#0B2545]">{t('admin.exactLocationLabel')}</p>
                      <p className="text-slate-700">{req.location_text}</p>
                      <p className="font-mono text-[11px] text-slate-500 tabular-nums">
                        {Number(req.latitude).toFixed(4)}, {Number(req.longitude).toFixed(4)}
                      </p>
                    </div>
                  </div>
                </div>

                <TranslateTextBlock text={req.description} label={t('rescue.emergencyDescLabel')} />

                {aiPriorityById[req.id]?.suggestion ? (
                  <div className="rounded-md border border-slate-200 bg-[#F4F6F8] p-3.5 space-y-2.5 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <OriginBadge origin="ai_suggested" />
                        <span className="font-semibold text-[#0B2545]">
                          {t('admin.suggestedPriorityLabel')}:
                        </span>
                        <SeverityBadge
                          severity={aiPriorityById[req.id].suggestion.suggestedPriority}
                        />
                        <span className="rounded border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-semibold text-[#0B2545]">
                          {t('common.humanReviewRequired')}: {t('common.yes')}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const suggested = aiPriorityById[req.id].suggestion.suggestedPriority;
                          updateDraft(req.id, {
                            reviewed_priority: suggested,
                          });
                          showToast(
                            t('admin.toastDraftPrioritySet', {
                              priority: getSeverityMeta(suggested).label,
                            }),
                            'info'
                          );
                        }}
                        className="rounded bg-[#0B2545] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[#13315C]"
                      >
                        {t('admin.useInPriorityDraftBtn')}
                      </button>
                    </div>

                    <AiFallbackNotice
                      usedFallback={aiPriorityById[req.id].suggestion.usedFallback}
                      notice={aiPriorityById[req.id].suggestion.fallbackNotice}
                      compact
                    />

                    <p className="text-slate-700">{aiPriorityById[req.id].suggestion.rationale}</p>

                    {aiPriorityById[req.id].suggestion.riskFactors?.length > 0 ? (
                      <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-slate-600">
                        {aiPriorityById[req.id].suggestion.riskFactors.map((factor) => (
                          <li key={factor}>{factor}</li>
                        ))}
                      </ul>
                    ) : null}

                    <p className="text-[11px] text-slate-500">
                      {aiPriorityById[req.id].suggestion.disclaimer}
                    </p>
                  </div>
                ) : null}

                {req.responder_notes ? (
                  <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                    <span className="font-semibold text-[#0B2545]">
                      {t('admin.latestResponderNoteLabel')}:
                    </span>{' '}
                    {req.responder_notes}
                  </div>
                ) : null}

                {/* Admin Dispatch & Status Controls */}
                <div className="rounded-md border border-slate-200 bg-white p-3.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#0B2545]">
                    <LifeBuoy className="h-4 w-4 text-[#F28C28]" />
                    <span>{t('admin.dispatchControlsHeading')}</span>
                  </div>

                  <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600">
                        {t('admin.assignRescueTeamLabel')}
                      </label>
                      <select
                        value={draft.assigned_team_id}
                        onChange={(e) =>
                          updateDraft(req.id, { assigned_team_id: e.target.value })
                        }
                        className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800"
                      >
                        <option value="">{t('admin.unassignedOption')}</option>
                        {teams.map((tm) => (
                          <option key={tm.id} value={tm.id}>
                            {tm.name} ({tm.team_code}) · {t(`status.team.${tm.status}`, { defaultValue: tm.status })}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600">
                        {t('admin.requestStatusLabel')}
                      </label>
                      <select
                        value={draft.status}
                        onChange={(e) => updateDraft(req.id, { status: e.target.value })}
                        className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800"
                      >
                        <option value="pending">{t('emergency.steps.pending')}</option>
                        <option value="verified">{t('status.verified')}</option>
                        <option value="assigned">{t('status.assigned')}</option>
                        <option value="rescue_in_progress">{t('status.rescue_in_progress')}</option>
                        <option value="resolved">{t('status.resolved')}</option>
                        <option value="closed">{t('status.closed')}</option>
                        <option value="cancelled">{t('status.cancelled')}</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600">
                        {t('admin.reviewedPriorityLabel')}
                      </label>
                      <select
                        value={draft.reviewed_priority}
                        onChange={(e) =>
                          updateDraft(req.id, { reviewed_priority: e.target.value })
                        }
                        className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800"
                      >
                        <option value="low">{t('severity.low')}</option>
                        <option value="medium">{t('severity.moderate')}</option>
                        <option value="high">{t('severity.high')}</option>
                        <option value="critical">{t('severity.critical')}</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600">
                        {t('admin.dispatchAuditNoteLabel')}
                      </label>
                      <input
                        type="text"
                        value={draft.note}
                        onChange={(e) => updateDraft(req.id, { note: e.target.value })}
                        placeholder={t('admin.dispatchAuditNotePlaceholder')}
                        className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-xs"
                      />
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[11px] text-slate-500">
                      {t('admin.currentTeamLabel')}:{' '}
                      <strong className="text-[#0B2545]">
                        {req.assigned_team_name || t('admin.notAssignedYet')}
                      </strong>
                    </p>
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => handleApplyDispatchUpdate(req)}
                      className="rounded-md bg-[#0B2545] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#13315C] disabled:opacity-60"
                    >
                      {isSaving ? t('common.updating') : t('admin.saveDispatchStatusBtn')}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
