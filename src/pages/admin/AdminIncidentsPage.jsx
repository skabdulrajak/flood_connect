import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CheckCircle2,
  ClipboardCheck,
  Clock,
  CopyX,
  Edit3,
  History,
  Image as ImageIcon,
  Loader2,
  MapPin,
  Phone,
  RefreshCw,
  Search,
  Sparkles,
  X,
  XCircle,
} from 'lucide-react';
import {
  DemoDataBadge,
  OriginBadge,
  SeverityBadge,
  StatusBadge,
} from '../../components/common/Badges';
import { EmptyState, ErrorState, LoadingState } from '../../components/common/StateFeedback';
import { AiFallbackNotice } from '../../components/ai/AiFallbackNotice';
import { TranslateTextBlock } from '../../components/ai/TranslateTextBlock';
import { AdminAreaSummaryPanel } from '../../components/ai/AdminAreaSummaryPanel';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { dataService } from '../../services/dataService';
import { classifyIncident, detectDuplicateIncidents } from '../../services/aiService';
import {
  EAST_GODAVARI_LOCALITIES,
  formatNumber,
  formatTimestamp,
  getIncidentCategories,
  getIncidentCategoryLabel,
  getSeverityMeta,
  getStatusMeta,
} from '../../utils/constants';

export function AdminIncidentsPage() {
  const { t } = useTranslation();
  const { user, isDemoMode } = useAuth();
  const { showToast } = useToast();

  const categories = getIncidentCategories();

  const [incidents, setIncidents] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');

  // Review / Action state per incident
  const [activeAction, setActiveAction] = useState(null); // { incident, mode: 'verify' | 'reject' | 'duplicate' | 'edit' }
  const [reasonNote, setReasonNote] = useState('');
  const [priorityDraft, setPriorityDraft] = useState('');
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    category: 'residential_flooding',
    locality: EAST_GODAVARI_LOCALITIES[0],
    location_text: '',
    reviewed_priority: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [expandedHistoryId, setExpandedHistoryId] = useState(null);
  const [aiById, setAiById] = useState({}); // { [id]: { loading, classification, duplicates } }

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [incList, histList] = await Promise.all([
        dataService.getAllIncidents(),
        dataService.getIncidentVerificationHistory(),
      ]);
      setIncidents(incList);
      setHistory(histList);
    } catch (err) {
      setError(err.message || t('errors.loadIncidentsFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredIncidents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return incidents.filter((inc) => {
      if (statusFilter !== 'all' && inc.status !== statusFilter) return false;
      if (categoryFilter !== 'all' && inc.category !== categoryFilter) return false;
      const effectiveSev = inc.reviewed_priority || inc.severity;
      if (severityFilter !== 'all' && effectiveSev !== severityFilter) return false;
      if (q) {
        const hay = `${inc.incident_code} ${inc.title} ${inc.description} ${inc.locality} ${inc.location_text}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [incidents, searchQuery, statusFilter, categoryFilter, severityFilter]);

  const openActionModal = (incident, mode) => {
    setActiveAction({ incident, mode });
    setReasonNote('');
    setPriorityDraft(incident.reviewed_priority || incident.severity || 'medium');
    if (mode === 'edit') {
      setEditForm({
        title: incident.title || '',
        description: incident.description || '',
        category: incident.category || 'residential_flooding',
        locality: incident.locality || EAST_GODAVARI_LOCALITIES[0],
        location_text: incident.location_text || '',
        reviewed_priority: incident.reviewed_priority || incident.severity || 'medium',
      });
    }
  };

  const closeActionModal = () => {
    if (submitting) return;
    setActiveAction(null);
    setReasonNote('');
  };

  const handleSubmitAction = async (e) => {
    e.preventDefault();
    if (!activeAction || !user) return;
    const { incident, mode } = activeAction;

    if ((mode === 'reject' || mode === 'duplicate') && reasonNote.trim().length < 5) {
      showToast(t('admin.validationAuditReasonMin'), 'error');
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'verify') {
        await dataService.updateIncidentAdmin(
          user.id,
          incident.id,
          { status: 'verified', reviewed_priority: priorityDraft || incident.severity },
          reasonNote.trim() || t('admin.defaultVerifyNote')
        );
        showToast(t('admin.toastIncidentVerified', { code: incident.incident_code }), 'success');
      } else if (mode === 'reject') {
        await dataService.updateIncidentAdmin(
          user.id,
          incident.id,
          { status: 'rejected', reviewed_priority: priorityDraft || incident.reviewed_priority },
          reasonNote.trim()
        );
        showToast(t('admin.toastIncidentRejected', { code: incident.incident_code }), 'info');
      } else if (mode === 'duplicate') {
        await dataService.updateIncidentAdmin(
          user.id,
          incident.id,
          { status: 'duplicate' },
          reasonNote.trim()
        );
        showToast(t('admin.toastIncidentDuplicate', { code: incident.incident_code }), 'info');
      } else if (mode === 'edit') {
        if (!editForm.title.trim() || !editForm.description.trim()) {
          showToast(t('admin.validationTitleDescRequired'), 'error');
          setSubmitting(false);
          return;
        }
        await dataService.updateIncidentAdmin(
          user.id,
          incident.id,
          {
            title: editForm.title.trim(),
            description: editForm.description.trim(),
            category: editForm.category,
            locality: editForm.locality,
            location_text: editForm.location_text.trim(),
            reviewed_priority: editForm.reviewed_priority || null,
          },
          reasonNote.trim() || t('admin.defaultEditIncidentNote')
        );
        showToast(t('admin.toastIncidentUpdated', { code: incident.incident_code }), 'success');
      }

      setActiveAction(null);
      await loadData();
    } catch (err) {
      showToast(err.message || t('errors.updateIncidentFailed'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const getHistoryForIncident = (incidentId) =>
    history.filter((h) => h.incident_id === incidentId);

  const handleRunAiReview = async (inc) => {
    setAiById((prev) => ({
      ...prev,
      [inc.id]: { ...(prev[inc.id] || {}), loading: true },
    }));
    try {
      const [classification, duplicates] = await Promise.all([
        classifyIncident({
          title: inc.title,
          description: inc.description,
          locality: inc.locality,
          location_text: inc.location_text,
        }),
        detectDuplicateIncidents(inc, incidents),
      ]);
      setAiById((prev) => ({
        ...prev,
        [inc.id]: { loading: false, classification, duplicates },
      }));
    } catch {
      setAiById((prev) => ({
        ...prev,
        [inc.id]: { ...(prev[inc.id] || {}), loading: false },
      }));
      showToast(t('errors.aiReviewFailed'), 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-[#0E857D]">
              {t('admin.incidentsEyebrow')}
            </p>
            <h2 className="mt-1 text-lg font-bold text-[#0B2545]">
              {t('admin.incidentsHeading')}
            </h2>
            <p className="mt-1 text-sm text-slate-600">{t('admin.incidentsSubtitle')}</p>
          </div>
          <div className="flex items-center gap-2">
            {isDemoMode ? <DemoDataBadge compact /> : null}
            <button
              type="button"
              onClick={loadData}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>{t('common.refresh')}</span>
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('admin.searchIncidentsPlaceholder')}
              className="w-full rounded-md border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 focus:border-[#13A89E] focus:outline-none"
            />
          </div>

          <select
            aria-label={t('admin.filterVerificationStatus')}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-[#13A89E] focus:outline-none"
          >
            <option value="all">
              {t('admin.allStatusesCount', { count: formatNumber(incidents.length) })}
            </option>
            <option value="pending_verification">{t('status.pending_verification')}</option>
            <option value="verified">{t('alerts.originAdminVerified')}</option>
            <option value="rejected">{t('status.rejected')}</option>
            <option value="duplicate">{t('status.duplicate')}</option>
          </select>

          <select
            aria-label={t('admin.filterIncidentType')}
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-[#13A89E] focus:outline-none"
          >
            <option value="all">{t('admin.allHazardTypes')}</option>
            {categories.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>

          <select
            aria-label={t('admin.filterEffectiveSeverity')}
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-[#13A89E] focus:outline-none"
          >
            <option value="all">{t('admin.allSeveritiesPriorities')}</option>
            <option value="critical">{t('severity.critical')}</option>
            <option value="high">{t('severity.high')}</option>
            <option value="medium">{t('severity.moderate')}</option>
            <option value="low">{t('severity.low')}</option>
          </select>
        </div>
      </section>

      {/* Stage 5: Grounded Area Situational Summary */}
      {!loading && !error ? <AdminAreaSummaryPanel incidents={incidents} /> : null}

      {/* Content */}
      {loading ? (
        <LoadingState message={t('admin.loadingIncidentsQueue')} />
      ) : error ? (
        <ErrorState message={error} onRetry={loadData} />
      ) : filteredIncidents.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title={t('admin.emptyIncidentsTitle')}
          description={t('admin.emptyIncidentsDesc')}
          actionLabel={t('common.clearFilters')}
          onAction={() => {
            setSearchQuery('');
            setStatusFilter('all');
            setCategoryFilter('all');
            setSeverityFilter('all');
          }}
        />
      ) : (
        <div className="space-y-4">
          {filteredIncidents.map((inc) => {
            const itemHistory = getHistoryForIncident(inc.id);
            const showHist = expandedHistoryId === inc.id;
            const photoUrl = Array.isArray(inc.photo_urls) && inc.photo_urls[0];

            return (
              <article
                key={inc.id}
                className="rounded-lg border border-slate-200 bg-white p-5 transition-colors hover:border-slate-300"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-[#0B2545] tabular-nums">
                        {inc.incident_code}
                      </span>
                      <StatusBadge status={inc.status} kind="incident" />
                      <OriginBadge origin={inc.info_origin} />
                      <SeverityBadge severity={inc.reviewed_priority || inc.severity} />
                      {inc.reviewed_priority && inc.reviewed_priority !== inc.severity ? (
                        <span className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                          {t('admin.reporterSeverityBadge', {
                            severity: getSeverityMeta(inc.severity).label,
                          })}
                        </span>
                      ) : null}
                    </div>
                    <h3 className="text-base font-bold text-[#0B2545]">{inc.title}</h3>
                    <p className="text-xs font-medium text-slate-500">
                      {getIncidentCategoryLabel(inc.category)} · {inc.locality}, {inc.district}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openActionModal(inc, 'verify')}
                      className="inline-flex items-center gap-1.5 rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 transition-colors"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>
                        {inc.status === 'verified'
                          ? t('admin.reconfirmPriorityBtn')
                          : t('admin.verifyBtn')}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => openActionModal(inc, 'edit')}
                      className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      <span>{t('common.edit')}</span>
                    </button>
                    {inc.status !== 'rejected' ? (
                      <button
                        type="button"
                        onClick={() => openActionModal(inc, 'reject')}
                        className="inline-flex items-center gap-1.5 rounded-md border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-800 hover:bg-red-100 transition-colors"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        <span>{t('admin.rejectBtn')}</span>
                      </button>
                    ) : null}
                    {inc.status !== 'duplicate' ? (
                      <button
                        type="button"
                        onClick={() => openActionModal(inc, 'duplicate')}
                        className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
                      >
                        <CopyX className="h-3.5 w-3.5" />
                        <span>{t('status.duplicate')}</span>
                      </button>
                    ) : null}
                    <button
                      type="button"
                      disabled={Boolean(aiById[inc.id]?.loading)}
                      onClick={() => handleRunAiReview(inc)}
                      className="inline-flex items-center gap-1.5 rounded-md border border-[#13A89E] bg-[#ECFAF8] px-3 py-1.5 text-xs font-semibold text-[#0A625C] hover:bg-[#13A89E] hover:text-white transition-colors disabled:opacity-60"
                    >
                      {aiById[inc.id]?.loading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      <span>
                        {aiById[inc.id]?.loading
                          ? t('admin.analyzingAi')
                          : t('admin.aiTriageDuplicatesBtn')}
                      </span>
                    </button>
                  </div>
                </div>

                <div className="mt-3">
                  <TranslateTextBlock text={inc.description} label={t('incident.reportDescriptionLabel')} />
                </div>

                {/* Stage 5: AI Classification + Duplicate Detection Panel */}
                {aiById[inc.id]?.classification || aiById[inc.id]?.duplicates ? (
                  <div className="mt-4 rounded-md border border-slate-200 bg-[#F4F6F8] p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <OriginBadge origin="ai_suggested" />
                        <span className="rounded border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-semibold text-[#0B2545]">
                          {t('common.humanReviewRequired')}: {t('common.yes')}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500">
                        {t('admin.aiBoundaryDisclaimer')}
                      </span>
                    </div>

                    <AiFallbackNotice
                      usedFallback={
                        Boolean(aiById[inc.id]?.classification?.usedFallback) ||
                        Boolean(aiById[inc.id]?.duplicates?.usedFallback)
                      }
                      notice={
                        aiById[inc.id]?.classification?.fallbackNotice ||
                        aiById[inc.id]?.duplicates?.fallbackNotice
                      }
                      compact
                    />

                    {aiById[inc.id]?.classification ? (
                      <div className="rounded border border-slate-200 bg-white p-3 space-y-2 text-xs">
                        <div className="flex flex-wrap items-center gap-3">
                          <span>
                            <strong className="text-slate-600">{t('incident.suggestedTypeLabel')}:</strong>{' '}
                            <span className="font-bold text-[#0B2545]">
                              {getIncidentCategoryLabel(
                                aiById[inc.id].classification.suggestedCategory
                              )}
                            </span>
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <strong className="text-slate-600">{t('incident.suggestedUrgencyLabel')}:</strong>
                            <SeverityBadge
                              severity={aiById[inc.id].classification.suggestedUrgency}
                            />
                          </span>
                        </div>

                        {aiById[inc.id].classification.keywords?.length > 0 ? (
                          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                            <span className="font-semibold text-slate-600">
                              {t('incident.keywordsLabel')}:
                            </span>
                            {aiById[inc.id].classification.keywords.map((kw) => (
                              <span
                                key={kw}
                                className="rounded border border-slate-200 bg-[#F4F6F8] px-1.5 py-0.5 text-slate-700"
                              >
                                {kw}
                              </span>
                            ))}
                          </div>
                        ) : null}

                        <div>
                          <p className="text-[11px] font-semibold text-slate-500">
                            {t('incident.shortSummaryLabel')}
                          </p>
                          <TranslateTextBlock
                            text={aiById[inc.id].classification.shortSummary}
                            label={t('admin.aiSummaryLabel')}
                            compact
                          />
                        </div>
                      </div>
                    ) : null}

                    {/* Duplicate Detection Results */}
                    {aiById[inc.id]?.duplicates ? (
                      <div className="rounded border border-slate-200 bg-white p-3 space-y-2 text-xs">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-bold text-[#0B2545]">
                            {t('admin.possibleDuplicatesHeading', {
                              count: formatNumber(aiById[inc.id].duplicates.matches.length),
                            })}
                          </p>
                          <span className="text-[11px] text-slate-500">
                            {t('admin.duplicateMetricsHint')}
                          </span>
                        </div>

                        {aiById[inc.id].duplicates.matches.length === 0 ? (
                          <p className="text-xs text-slate-600">
                            {t('admin.noDuplicatesDetected')}
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {aiById[inc.id].duplicates.matches.map((match) => (
                              <div
                                key={match.incidentId}
                                className="flex flex-wrap items-start justify-between gap-2 rounded border border-slate-200 bg-[#F4F6F8] p-2.5"
                              >
                                <div className="space-y-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-mono text-xs font-bold text-[#0B2545] tabular-nums">
                                      {match.incidentCode}
                                    </span>
                                    <span className="rounded bg-[#0B2545] px-2 py-0.5 font-mono text-[11px] font-bold text-white tabular-nums">
                                      {t('admin.matchScoreBadge', { score: formatNumber(match.score) })}
                                    </span>
                                    <StatusBadge status={match.status} kind="incident" />
                                  </div>
                                  <p className="font-semibold text-slate-800">
                                    {match.title} · {match.locality}
                                  </p>
                                  <p className="text-[11px] text-slate-600 tabular-nums">
                                    {t('admin.duplicateMatchDetails', {
                                      distance:
                                        match.distanceKm !== null
                                          ? `${match.distanceKm} km`
                                          : t('common.notApplicable'),
                                      hours: formatNumber(match.timeDiffHours),
                                      categoryMatch: match.sameCategory
                                        ? t('common.same')
                                        : t('common.different'),
                                      similarity: formatNumber(match.textSimilarityPct),
                                    })}
                                  </p>
                                  {match.aiNote ? (
                                    <p className="text-[11px] text-[#0B2545]">{match.aiNote}</p>
                                  ) : null}
                                </div>
                                {inc.status !== 'duplicate' ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      openActionModal(inc, 'duplicate');
                                      setReasonNote(
                                        t('admin.duplicateDefaultNote', {
                                          code: match.incidentCode,
                                          score: match.score,
                                        })
                                      );
                                    }}
                                    className="rounded border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-[#0B2545] hover:bg-slate-100"
                                  >
                                    {t('admin.reviewMarkDuplicateBtn')}
                                  </button>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        )}
                        <p className="text-[11px] text-slate-500">
                          {aiById[inc.id].duplicates.disclaimer}
                        </p>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <div className="mt-4 grid gap-3 rounded-md border border-slate-200 bg-[#F4F6F8] p-3 text-xs text-slate-700 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="flex items-start gap-2">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#0B2545]" />
                    <div>
                      <p className="font-semibold text-[#0B2545]">{t('admin.locationPointLabel')}</p>
                      <p className="text-slate-600">{inc.location_text}</p>
                      <p className="font-mono text-[11px] text-slate-500 tabular-nums">
                        {Number(inc.latitude).toFixed(4)}, {Number(inc.longitude).toFixed(4)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#0B2545]" />
                    <div>
                      <p className="font-semibold text-[#0B2545]">{t('admin.observedLoggedLabel')}</p>
                      <p className="text-slate-600 tabular-nums">
                        {formatTimestamp(inc.observed_at || inc.created_at)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Phone className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#0B2545]" />
                    <div>
                      <p className="font-semibold text-[#0B2545]">
                        {t('admin.reporterContactLabel')}
                      </p>
                      <p className="font-mono text-slate-700 tabular-nums">
                        {inc.reporter_contact_phone || t('common.notProvided')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <ImageIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#0B2545]" />
                    <div>
                      <p className="font-semibold text-[#0B2545]">{t('admin.photoEvidenceLabel')}</p>
                      {photoUrl ? (
                        <img
                          src={photoUrl}
                          alt={t('incident.attachedEvidenceAlt', { code: inc.incident_code })}
                          className="mt-1 h-14 w-24 rounded border border-slate-300 object-cover"
                        />
                      ) : (
                        <p className="text-slate-500">{t('admin.noPhotoAttached')}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Verification History Toggle */}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                  <button
                    type="button"
                    onClick={() => setExpandedHistoryId(showHist ? null : inc.id)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0B2545] hover:text-[#13A89E]"
                  >
                    <History className="h-3.5 w-3.5" />
                    <span>
                      {showHist
                        ? t('admin.hideAuditHistory', { count: formatNumber(itemHistory.length) })
                        : t('admin.viewAuditHistory', { count: formatNumber(itemHistory.length) })}
                    </span>
                  </button>
                  {inc.verified_at ? (
                    <span className="text-[11px] text-emerald-700 tabular-nums">
                      {t('admin.verifiedAtTimestamp', { time: formatTimestamp(inc.verified_at) })}
                    </span>
                  ) : null}
                </div>

                {showHist ? (
                  <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3 space-y-2">
                    {itemHistory.length === 0 ? (
                      <p className="text-xs text-slate-500">{t('admin.noHistoryTransitions')}</p>
                    ) : (
                      itemHistory.map((h) => (
                        <div
                          key={h.id}
                          className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-200 pb-2 last:border-b-0 last:pb-0 text-xs"
                        >
                          <div>
                            <p className="font-semibold text-[#0B2545]">
                              {getStatusMeta(h.previous_status, 'incident').label} →{' '}
                              {getStatusMeta(h.new_status, 'incident').label}
                              {h.new_priority
                                ? ` (${t('common.priority')}: ${getSeverityMeta(h.new_priority).label})`
                                : ''}
                            </p>
                            <p className="text-slate-600">{h.notes}</p>
                          </div>
                          <span className="font-mono text-[11px] text-slate-500 tabular-nums">
                            {formatTimestamp(h.created_at)}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}

      {/* Action / Edit Modal */}
      {activeAction ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B2545]/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-lg border border-slate-200 bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-xs font-bold text-[#0E857D]">
                  {activeAction.incident.incident_code}
                </p>
                <h3 className="mt-0.5 text-base font-bold text-[#0B2545]">
                  {activeAction.mode === 'verify'
                    ? t('admin.modalVerifyTitle')
                    : activeAction.mode === 'reject'
                    ? t('admin.modalRejectTitle')
                    : activeAction.mode === 'duplicate'
                    ? t('admin.modalDuplicateTitle')
                    : t('admin.modalEditIncidentTitle')}
                </h3>
              </div>
              <button
                type="button"
                onClick={closeActionModal}
                aria-label={t('common.close')}
                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitAction} className="mt-4 space-y-4">
              {activeAction.mode === 'edit' ? (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">
                      {t('incident.titleLabel')}
                    </label>
                    <input
                      type="text"
                      required
                      value={editForm.title}
                      onChange={(e) => setEditForm((p) => ({ ...p, title: e.target.value }))}
                      className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#13A89E] focus:outline-none"
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        {t('volunteer.hazardTypeLabel')}
                      </label>
                      <select
                        value={editForm.category}
                        onChange={(e) => setEditForm((p) => ({ ...p, category: e.target.value }))}
                        className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                      >
                        {categories.map((c) => (
                          <option key={c.value} value={c.value}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        {t('admin.localityEastGodavari')}
                      </label>
                      <select
                        value={editForm.locality}
                        onChange={(e) => setEditForm((p) => ({ ...p, locality: e.target.value }))}
                        className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                      >
                        {EAST_GODAVARI_LOCALITIES.map((loc) => (
                          <option key={loc} value={loc}>
                            {loc}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">
                      {t('admin.locationDescLabel')}
                    </label>
                    <input
                      type="text"
                      value={editForm.location_text}
                      onChange={(e) =>
                        setEditForm((p) => ({ ...p, location_text: e.target.value }))
                      }
                      className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">
                      {t('incident.descriptionLabel')}
                    </label>
                    <textarea
                      rows={3}
                      required
                      value={editForm.description}
                      onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))}
                      className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">
                      {t('admin.reviewedPriorityLabel')}
                    </label>
                    <select
                      value={editForm.reviewed_priority}
                      onChange={(e) =>
                        setEditForm((p) => ({ ...p, reviewed_priority: e.target.value }))
                      }
                      className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                    >
                      <option value="low">{t('severity.low')}</option>
                      <option value="medium">{t('severity.moderate')}</option>
                      <option value="high">{t('severity.high')}</option>
                      <option value="critical">{t('severity.critical')}</option>
                    </select>
                  </div>
                </>
              ) : null}

              {activeAction.mode === 'verify' ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    {t('admin.adminReviewedPriorityLabel')}
                  </label>
                  <select
                    value={priorityDraft}
                    onChange={(e) => setPriorityDraft(e.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="low">{t('severity.low')}</option>
                    <option value="medium">{t('severity.moderate')}</option>
                    <option value="high">{t('severity.high')}</option>
                    <option value="critical">{t('severity.critical')}</option>
                  </select>
                  <p className="mt-1 text-xs text-slate-500">
                    {t('admin.reporterOriginallySelected')}{' '}
                    <strong>{getSeverityMeta(activeAction.incident.severity).label}</strong>
                  </p>
                </div>
              ) : null}

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  {t('admin.verificationAuditReasonLabel')}{' '}
                  {activeAction.mode === 'reject' || activeAction.mode === 'duplicate'
                    ? t('admin.requiredTag')
                    : t('admin.loggedInHistoryTag')}
                </label>
                <textarea
                  rows={3}
                  required={activeAction.mode === 'reject' || activeAction.mode === 'duplicate'}
                  value={reasonNote}
                  onChange={(e) => setReasonNote(e.target.value)}
                  placeholder={
                    activeAction.mode === 'verify'
                      ? t('admin.verifyReasonPlaceholder')
                      : activeAction.mode === 'reject'
                      ? t('admin.rejectReasonPlaceholder')
                      : activeAction.mode === 'duplicate'
                      ? t('admin.duplicateReasonPlaceholder')
                      : t('admin.editReasonPlaceholder')
                  }
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeActionModal}
                  disabled={submitting}
                  className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className={`rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 ${
                    activeAction.mode === 'reject'
                      ? 'bg-red-700 hover:bg-red-800'
                      : activeAction.mode === 'verify'
                      ? 'bg-emerald-700 hover:bg-emerald-800'
                      : 'bg-[#0B2545] hover:bg-[#13315C]'
                  }`}
                >
                  {submitting
                    ? t('common.saving')
                    : activeAction.mode === 'verify'
                    ? t('admin.confirmVerificationBtn')
                    : activeAction.mode === 'reject'
                    ? t('admin.confirmRejectionBtn')
                    : activeAction.mode === 'duplicate'
                    ? t('admin.markDuplicateBtn')
                    : t('common.saveChanges')}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
