import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  APIProvider,
  AdvancedMarker,
  InfoWindow,
  Map as GoogleMap,
  Pin,
  useMap,
} from '@vis.gl/react-google-maps';
import { useTranslation } from 'react-i18next';
import {
  CheckCircle2,
  HeartPulse,
  LifeBuoy,
  Lock,
  MapPin,
  MessageSquarePlus,
  Navigation,
  Phone,
  RefreshCw,
  ShieldAlert,
  Users,
} from 'lucide-react';
import {
  DemoDataBadge,
  SeverityBadge,
  StatusBadge,
} from '../../components/common/Badges';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { EmptyState, ErrorState, LoadingState } from '../../components/common/StateFeedback';
import { EmergencyStatusTracker } from '../../components/emergency/EmergencyStatusTracker';
import { TranslateTextBlock } from '../../components/ai/TranslateTextBlock';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { dataService } from '../../services/dataService';
import {
  EAST_GODAVARI_CENTER,
  formatNumber,
  formatTimestamp,
  getSeverityMeta,
  getStatusMeta,
} from '../../utils/constants';

const MAPS_API_KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '').trim();
const GMP_ATTRIBUTION_IDS = ['gmp_mcp_codeassist_v1_aistudio'];

const DISPATCH_PIN_COLORS = {
  critical: { bg: '#DC2626', border: '#991B1B' },
  high: { bg: '#F28C28', border: '#9A4E0A' },
  medium: { bg: '#D97706', border: '#92400E' },
  low: { bg: '#13A89E', border: '#0E6F68' },
};

function FocusMapController({ target }) {
  const map = useMap();
  useEffect(() => {
    if (
      map &&
      target &&
      Number.isFinite(Number(target.latitude)) &&
      Number.isFinite(Number(target.longitude))
    ) {
      map.panTo({ lat: Number(target.latitude), lng: Number(target.longitude) });
      map.setZoom(13);
    }
  }, [target, map]);
  return null;
}

export function RescueAssignedPage() {
  const { t, i18n } = useTranslation();
  const { user, isDemoMode } = useAuth();
  const { showToast } = useToast();
  const activeLang = ['en', 'hi', 'te'].includes(i18n.language) ? i18n.language : 'en';

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [selectedId, setSelectedId] = useState(null);
  const [notesById, setNotesById] = useState({});
  const [busyId, setBusyId] = useState(null);
  const [resolveTarget, setResolveTarget] = useState(null);

  const loadAssigned = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      const list = await dataService.getAssignedEmergencyRequests(user.id);
      setRequests(list);
      if (list.length > 0) {
        setSelectedId((prev) => (prev && list.some((r) => r.id === prev) ? prev : list[0].id));
      }
    } catch (err) {
      setError(err.message || t('errors.loadAssignedRequestsFailed'));
    } finally {
      setLoading(false);
    }
  }, [user, t]);

  useEffect(() => {
    loadAssigned();
  }, [loadAssigned]);

  const selectedRequest = useMemo(
    () => requests.find((r) => r.id === selectedId) || requests[0] || null,
    [requests, selectedId]
  );

  const runProgressUpdate = async (req, { nextStatus, assignmentStatus, defaultNote }) => {
    if (!user) return;
    const typedNote = (notesById[req.id] || '').trim();
    setBusyId(req.id);
    try {
      await dataService.updateRescueProgress(user.id, req.id, {
        nextStatus,
        assignmentStatus,
        notes: typedNote || defaultNote,
      });
      setNotesById((prev) => ({ ...prev, [req.id]: '' }));
      showToast(
        nextStatus === 'resolved'
          ? t('rescue.toastMarkedResolved', { code: req.request_code })
          : t('rescue.toastProgressUpdated', { code: req.request_code }),
        'success'
      );
      setResolveTarget(null);
      await loadAssigned();
    } catch (err) {
      showToast(err.message || t('errors.updateRescueProgressFailed'), 'error');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Privacy Banner */}
      <section className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-[#C06310]">
              {t('rescue.assignedEyebrow')}
            </p>
            <h2 className="mt-1 text-lg font-bold text-[#0B2545]">
              {t('rescue.assignedHeading')}
            </h2>
            <p className="mt-1 text-sm text-slate-600">{t('rescue.assignedSubtitle')}</p>
          </div>
          <div className="flex items-center gap-2">
            {isDemoMode ? <DemoDataBadge compact /> : null}
            <button
              type="button"
              onClick={loadAssigned}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>{t('common.refresh')}</span>
            </button>
          </div>
        </div>

        <div className="flex items-start gap-2.5 rounded-md border border-[#0B2545]/20 bg-[#F4F6F8] px-3.5 py-2.5 text-xs text-slate-700">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-[#0B2545]" aria-hidden="true" />
          <span>
            <strong>{t('rescue.protectedViewLabel')}:</strong> {t('rescue.protectedViewNotice')}
          </span>
        </div>
      </section>

      {loading ? (
        <LoadingState message={t('rescue.loadingAssigned')} />
      ) : error ? (
        <ErrorState message={error} onRetry={loadAssigned} />
      ) : requests.length === 0 ? (
        <EmptyState
          icon={LifeBuoy}
          title={t('rescue.emptyAssignedTitle')}
          description={t('rescue.emptyAssignedDesc')}
        />
      ) : (
        <>
          {/* Interactive Assigned Rescue Map */}
          <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-red-700" aria-hidden="true" />
                <h3 className="text-sm font-bold text-[#0B2545]">
                  {t('rescue.coordinatesMapHeading', { count: formatNumber(requests.length) })}
                </h3>
              </div>
              <span className="text-xs text-slate-500">{t('rescue.clickMarkerHint')}</span>
            </div>
            <div className="h-72 w-full">
              {MAPS_API_KEY ? (
                <APIProvider apiKey={MAPS_API_KEY} language={activeLang} region="IN">
                  <GoogleMap
                    mapId="DEMO_MAP_ID"
                    defaultCenter={
                      selectedRequest
                        ? {
                            lat: Number(selectedRequest.latitude),
                            lng: Number(selectedRequest.longitude),
                          }
                        : { lat: EAST_GODAVARI_CENTER.lat, lng: EAST_GODAVARI_CENTER.lng }
                    }
                    defaultZoom={12}
                    gestureHandling="greedy"
                    streetViewControl={false}
                    internalUsageAttributionIds={GMP_ATTRIBUTION_IDS}
                    style={{ width: '100%', height: '100%' }}
                  >
                    <FocusMapController target={selectedRequest} />
                    {requests.map((req) => {
                      const lat = Number(req.latitude);
                      const lng = Number(req.longitude);
                      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
                      const priority = req.reviewed_priority || req.severity || 'high';
                      const colors = DISPATCH_PIN_COLORS[priority] || DISPATCH_PIN_COLORS.high;
                      return (
                        <AdvancedMarker
                          key={req.id}
                          position={{ lat, lng }}
                          title={req.request_code}
                          onClick={() => setSelectedId(req.id)}
                        >
                          <Pin
                            background={colors.bg}
                            borderColor={colors.border}
                            glyphColor="#FFFFFF"
                            scale={req.id === selectedId ? 1.2 : 1.0}
                          />
                        </AdvancedMarker>
                      );
                    })}
                    {selectedRequest &&
                    Number.isFinite(Number(selectedRequest.latitude)) &&
                    Number.isFinite(Number(selectedRequest.longitude)) ? (
                      <InfoWindow
                        position={{
                          lat: Number(selectedRequest.latitude),
                          lng: Number(selectedRequest.longitude),
                        }}
                        maxWidth={260}
                        onCloseClick={() => setSelectedId(null)}
                      >
                        <div className="min-w-[200px] space-y-1 text-xs text-[#0B2545]">
                          <p className="font-mono font-bold text-[#0B2545]">
                            {selectedRequest.request_code}
                          </p>
                          <p className="font-semibold text-slate-800">
                            {selectedRequest.requester_name}
                          </p>
                          <p className="text-slate-600">{selectedRequest.location_text}</p>
                          <p className="text-slate-700">
                            {t('rescue.popupPeoplePriority', {
                              count: formatNumber(selectedRequest.people_count),
                              priority: getSeverityMeta(
                                selectedRequest.reviewed_priority || selectedRequest.severity || 'high'
                              ).label,
                            })}
                          </p>
                          <p className="font-mono text-[#0B2545]">
                            {t('rescue.telPrefix')}: {selectedRequest.contact_phone}
                          </p>
                        </div>
                      </InfoWindow>
                    ) : null}
                  </GoogleMap>
                </APIProvider>
              ) : (
                <div className="flex h-full items-center justify-center bg-[#F4F6F8] p-4 text-xs text-slate-600">
                  Configure <code className="mx-1 font-mono">VITE_GOOGLE_MAPS_API_KEY</code> to view assigned dispatch coordinates on Google Maps.
                </div>
              )}
            </div>
          </section>

          {/* Assigned Request Cards */}
          <div className="space-y-4">
            {requests.map((req) => {
              const isSelected = req.id === selectedId;
              const isBusy = busyId === req.id;
              const isClosedOrResolved = ['resolved', 'closed', 'cancelled'].includes(req.status);
              const priority = req.reviewed_priority || req.severity || 'high';

              return (
                <article
                  key={req.id}
                  onClick={() => setSelectedId(req.id)}
                  className={`rounded-lg border bg-white p-5 space-y-4 transition-colors ${
                    isSelected ? 'border-[#0B2545]' : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-[#0B2545] tabular-nums">
                          {req.request_code}
                        </span>
                        <StatusBadge status={req.status} kind="emergency" />
                        <SeverityBadge severity={priority} />
                        {req.assignment_status ? (
                          <span className="rounded border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                            {t('rescue.unitStageLabel', {
                              stage: t(`status.assignment.${req.assignment_status}`, {
                                defaultValue: req.assignment_status.replaceAll('_', ' '),
                              }),
                            })}
                          </span>
                        ) : null}
                      </div>
                      <h3 className="text-base font-bold text-[#0B2545]">
                        {req.requester_name} · {req.locality}
                      </h3>
                      <p className="text-xs text-slate-500 tabular-nums">
                        {t('rescue.assignedTeamUpdated', {
                          team: req.assigned_team_name || t('rescue.yourUnit'),
                          time: formatTimestamp(req.updated_at),
                        })}
                      </p>
                    </div>
                  </div>

                  <EmergencyStatusTracker status={req.status} compact />

                  {/* Protected Contact, Medical & People Info */}
                  <div className="grid gap-3 rounded-md border border-slate-200 bg-[#F4F6F8] p-3.5 text-xs sm:grid-cols-2 lg:grid-cols-4">
                    <div className="flex items-start gap-2">
                      <Phone className="mt-0.5 h-4 w-4 shrink-0 text-[#0B2545]" />
                      <div>
                        <p className="font-semibold text-[#0B2545]">
                          {t('rescue.directContactLabel')}
                        </p>
                        <a
                          href={`tel:${req.contact_phone}`}
                          onClick={(e) => e.stopPropagation()}
                          className="font-mono text-sm font-bold text-[#0E857D] hover:underline tabular-nums"
                        >
                          {req.contact_phone}
                        </a>
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <Users className="mt-0.5 h-4 w-4 shrink-0 text-[#0B2545]" />
                      <div>
                        <p className="font-semibold text-[#0B2545]">
                          {t('rescue.householdCountLabel')}
                        </p>
                        <p className="text-slate-800 font-semibold tabular-nums">
                          {t('rescue.totalPeopleCount', { count: formatNumber(req.people_count) })}
                        </p>
                        <p className="text-slate-600 tabular-nums">
                          {t('rescue.childrenElderlyBreakdown', {
                            children: formatNumber(req.children_count || 0),
                            elderly: formatNumber(req.elderly_count || 0),
                          })}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <HeartPulse className="mt-0.5 h-4 w-4 shrink-0 text-red-700" />
                      <div>
                        <p className="font-semibold text-[#0B2545]">
                          {t('rescue.medicalAccessibilityLabel')}
                        </p>
                        <p className="text-slate-800">
                          {req.medical_needs || t('rescue.noUrgentMedicalNoted')}
                        </p>
                        {req.accessibility_needs ? (
                          <p className="mt-0.5 text-slate-600">{req.accessibility_needs}</p>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#0B2545]" />
                      <div>
                        <p className="font-semibold text-[#0B2545]">
                          {t('rescue.exactCoordinatesLabel')}
                        </p>
                        <p className="text-slate-800">{req.location_text}</p>
                        <p className="font-mono text-[11px] text-slate-600 tabular-nums">
                          {Number(req.latitude).toFixed(5)}, {Number(req.longitude).toFixed(5)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <TranslateTextBlock text={req.description} label={t('rescue.emergencyDescLabel')} />

                  {req.responder_notes ? (
                    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                      <span className="font-semibold text-[#0B2545]">
                        {t('rescue.lastLoggedNote')}:
                      </span>{' '}
                      {req.responder_notes}
                    </div>
                  ) : null}

                  {/* Responder Action Panel */}
                  {!isClosedOrResolved ? (
                    <div
                      className="rounded-md border border-slate-200 bg-white p-3.5 space-y-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div>
                        <label className="block text-xs font-semibold text-slate-700">
                          {t('rescue.fieldProgressNoteLabel')}
                        </label>
                        <input
                          type="text"
                          value={notesById[req.id] || ''}
                          onChange={(e) =>
                            setNotesById((prev) => ({ ...prev, [req.id]: e.target.value }))
                          }
                          placeholder={t('rescue.fieldProgressNotePlaceholder')}
                          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-[#13A89E] focus:outline-none"
                        />
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {req.status === 'assigned' || req.assignment_status === 'assigned' ? (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() =>
                              runProgressUpdate(req, {
                                nextStatus: 'rescue_in_progress',
                                assignmentStatus: 'en_route',
                                defaultNote: t('rescue.defaultNoteEnRoute'),
                              })
                            }
                            className="inline-flex items-center gap-1.5 rounded-md bg-[#0B2545] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#13315C] disabled:opacity-60"
                          >
                            <Navigation className="h-3.5 w-3.5" />
                            <span>{t('rescue.acceptMarkEnRoute')}</span>
                          </button>
                        ) : null}

                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() =>
                            runProgressUpdate(req, {
                              nextStatus: 'rescue_in_progress',
                              assignmentStatus: 'on_site',
                              defaultNote: t('rescue.defaultNoteOnSite'),
                            })
                          }
                          className="inline-flex items-center gap-1.5 rounded-md bg-[#F28C28] px-3.5 py-2 text-xs font-semibold text-[#0B2545] hover:bg-[#df7c1d] disabled:opacity-60"
                        >
                          <ShieldAlert className="h-3.5 w-3.5" />
                          <span>{t('rescue.updateOnSite')}</span>
                        </button>

                        <button
                          type="button"
                          disabled={isBusy || !(notesById[req.id] || '').trim()}
                          onClick={() =>
                            runProgressUpdate(req, {
                              nextStatus: req.status,
                              assignmentStatus: req.assignment_status || 'en_route',
                              defaultNote: '',
                            })
                          }
                          className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        >
                          <MessageSquarePlus className="h-3.5 w-3.5" />
                          <span>{t('rescue.addFieldNote')}</span>
                        </button>

                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => setResolveTarget(req)}
                          className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>{t('rescue.markResolved')}</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-md border border-emerald-600/30 bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-800">
                      {t('rescue.operationMarkedStatus', {
                        status: getStatusMeta(req.status, 'emergency').label,
                      })}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </>
      )}

      <ConfirmDialog
        open={Boolean(resolveTarget)}
        title={t('rescue.resolveConfirmTitle', { code: resolveTarget?.request_code || '' })}
        description={t('rescue.resolveConfirmDesc', {
          count: formatNumber(resolveTarget?.people_count || 0),
          locality: resolveTarget?.locality || '',
        })}
        confirmLabel={t('rescue.confirmMarkResolved')}
        tone="primary"
        busy={busyId === resolveTarget?.id}
        onConfirm={() => {
          if (!resolveTarget) return;
          runProgressUpdate(resolveTarget, {
            nextStatus: 'resolved',
            assignmentStatus: 'resolved',
            defaultNote: t('rescue.defaultNoteResolved'),
          });
        }}
        onCancel={() => setResolveTarget(null)}
      />
    </div>
  );
}
