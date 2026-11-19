import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  CloudUpload,
  Crosshair,
  FileText,
  Info,
  Loader2,
  Map,
  Send,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { useSubmissionCooldown } from '../../hooks/useSubmissionCooldown';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { dataService } from '../../services/dataService';
import { classifyIncident } from '../../services/aiService';
import {
  DEFAULT_DISTRICT,
  EAST_GODAVARI_COORDS,
  EAST_GODAVARI_LOCALITIES,
  formatTimestamp,
  getIncidentCategories,
  getIncidentCategoryLabel,
  haversineDistanceKm,
} from '../../utils/constants';
import { validateIncidentForm } from '../../utils/validation';
import { LocationPickerMap } from '../../components/map/LocationPickerMap';
import { PhotoUploadField } from '../../components/common/PhotoUploadField';
import { OriginBadge, SeverityBadge, StatusBadge } from '../../components/common/Badges';
import { AiFallbackNotice } from '../../components/ai/AiFallbackNotice';
import { TranslateTextBlock } from '../../components/ai/TranslateTextBlock';

function toLocalDateTimeInputValue(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

export function ReportIncidentPage() {
  const { t } = useTranslation();
  const { user, profile } = useAuth();
  const { showToast } = useToast();
  const { isOnline } = useOnlineStatus();

  const defaultLocality =
    profile?.locality && EAST_GODAVARI_COORDS[profile.locality]
      ? profile.locality
      : EAST_GODAVARI_LOCALITIES[0];
  const defaultCoords = EAST_GODAVARI_COORDS[defaultLocality] || { lat: 17.0005, lng: 81.804 };

  const [form, setForm] = useState({
    category: 'residential_flooding',
    title: '',
    description: '',
    locality: defaultLocality,
    location_text: '',
    latitude: String(defaultCoords.lat),
    longitude: String(defaultCoords.lng),
    severity: 'medium',
    observed_at: toLocalDateTimeInputValue(),
    contact_phone: profile?.phone || '',
  });
  const [photoFile, setPhotoFile] = useState(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsStatus, setGpsStatus] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [duplicateWarning, setDuplicateWarning] = useState('');
  const [allowDuplicateOverride, setAllowDuplicateOverride] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submittedRecord, setSubmittedRecord] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState(null);

  const cooldown = useSubmissionCooldown('incident_report', user?.id || 'public');
  const inFlightRef = useRef(false);
  const incidentCategories = getIncidentCategories();

  useEffect(() => {
    if (profile?.phone && !form.contact_phone) {
      setForm((prev) => ({ ...prev, contact_phone: profile.phone }));
    }
  }, [profile?.phone]);

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (duplicateWarning) {
      setDuplicateWarning('');
      setAllowDuplicateOverride(false);
    }
  };

  const handleLocalityChange = (nextLocality) => {
    const coords = EAST_GODAVARI_COORDS[nextLocality];
    setForm((prev) => ({
      ...prev,
      locality: nextLocality,
      ...(coords ? { latitude: String(coords.lat), longitude: String(coords.lng) } : {}),
    }));
  };

  const handleCaptureGps = () => {
    setGpsStatus('');
    if (!navigator.geolocation) {
      setGpsStatus(t('incident.gpsUnavailable'));
      return;
    }

    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = Number(position.coords.latitude.toFixed(6));
        const lng = Number(position.coords.longitude.toFixed(6));
        setForm((prev) => ({
          ...prev,
          latitude: String(lat),
          longitude: String(lng),
        }));
        setGpsStatus(
          `${t('incident.gpsSuccess')} (${lat.toFixed(5)}, ${lng.toFixed(5)}, ±${Math.round(
            position.coords.accuracy
          )}m)`
        );
        setGpsLoading(false);
      },
      (geoErr) => {
        if (geoErr.code === 1) {
          setGpsStatus(t('incident.gpsDenied'));
        } else {
          setGpsStatus(t('incident.gpsUnavailable'));
        }
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleRunAiClassification = async () => {
    if (!form.title.trim() && !form.description.trim()) {
      setErrorMsg(t('incident.aiNeedsText'));
      return;
    }
    setErrorMsg('');
    setAiLoading(true);
    try {
      const suggestion = await classifyIncident({
        title: form.title,
        description: form.description,
        locality: form.locality,
        location_text: form.location_text,
      });
      setAiSuggestion(suggestion);
    } finally {
      setAiLoading(false);
    }
  };

  const handleApplyAiSuggestion = () => {
    if (!aiSuggestion) return;
    setForm((prev) => ({
      ...prev,
      category: aiSuggestion.suggestedCategory || prev.category,
      severity: aiSuggestion.suggestedUrgency || prev.severity,
    }));
    showToast({
      title: t('incident.aiPanelTitle'),
      message: t('incident.aiApplied'),
      type: 'info',
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (inFlightRef.current || submitting) return;

    setErrorMsg('');
    setFieldErrors({});

    const limitCheck = cooldown.checkNow();
    if (!limitCheck.allowed) {
      setErrorMsg(limitCheck.message);
      return;
    }

    const validation = validateIncidentForm(form);
    if (!validation.isValid) {
      setFieldErrors(validation.fieldErrors);
      setErrorMsg(validation.firstError);
      return;
    }

    const clean = validation.sanitized;

    inFlightRef.current = true;
    setSubmitting(true);

    try {
      if (!allowDuplicateOverride) {
        const myRecent = await dataService.getMyIncidents(user.id);
        const tenMinsAgo = Date.now() - 10 * 60 * 1000;
        const lat = Number(clean.latitude);
        const lng = Number(clean.longitude);

        const probableDuplicate = myRecent.find((item) => {
          const createdMs = new Date(item.created_at).getTime();
          if (createdMs < tenMinsAgo) return false;
          if (item.category !== clean.category) return false;
          const distKm = haversineDistanceKm(lat, lng, Number(item.latitude), Number(item.longitude));
          return distKm < 0.35;
        });

        if (probableDuplicate) {
          setDuplicateWarning(
            t('incident.duplicateSubmitWarning', {
              category: getIncidentCategoryLabel(probableDuplicate.category),
              code: probableDuplicate.incident_code,
            })
          );
          setAllowDuplicateOverride(true);
          setSubmitting(false);
          inFlightRef.current = false;
          return;
        }
      }

      let photoUrls = [];
      let deferredPhotoFile = null;
      if (photoFile) {
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
          deferredPhotoFile = photoFile;
        } else {
          try {
            const uploadRes = await dataService.uploadIncidentPhoto(user.id, photoFile);
            if (uploadRes?.url) photoUrls = [uploadRes.url];
          } catch (uploadErr) {
            if (typeof navigator !== 'undefined' && navigator.onLine === false) {
              deferredPhotoFile = photoFile;
            } else {
              throw uploadErr;
            }
          }
        }
      }

      const created = await dataService.createIncident(
        user.id,
        {
          category: clean.category,
          title: clean.title,
          description: clean.description,
          locality: clean.locality,
          location_text: clean.location_text,
          district: profile?.district || DEFAULT_DISTRICT,
          latitude: Number(clean.latitude),
          longitude: Number(clean.longitude),
          severity: clean.severity,
          observed_at: new Date(clean.observed_at).toISOString(),
          contact_phone: clean.contact_phone,
          photo_urls: photoUrls,
        },
        { photoFile: deferredPhotoFile || photoFile }
      );

      cooldown.markSubmitted();
      setSubmittedRecord(created);
      setDuplicateWarning('');
      setAllowDuplicateOverride(false);
      if (created.queuedOffline) {
        showToast({
          title: t('pwa.reportQueuedToastTitle', { defaultValue: 'Flood Report Saved Offline' }),
          message: t('pwa.reportQueuedToastMessage', {
            code: created.incident_code,
            defaultValue:
              'Stored in IndexedDB ({{code}}). Background Sync will submit it automatically once connection returns.',
          }),
          type: 'info',
        });
      } else {
        showToast({
          title: t('incident.successTitle'),
          message: t('incident.successBannerBody', { code: created.incident_code }),
          type: 'success',
        });
      }
    } catch (err) {
      setErrorMsg(err?.message || t('errors.saveFailed'));
    } finally {
      setSubmitting(false);
      inFlightRef.current = false;
    }
  };

  const handleResetForNew = () => {
    setSubmittedRecord(null);
    setPhotoFile(null);
    setGpsStatus('');
    setErrorMsg('');
    setAiSuggestion(null);
    setForm((prev) => ({
      ...prev,
      title: '',
      description: '',
      location_text: '',
      observed_at: toLocalDateTimeInputValue(),
    }));
  };

  if (submittedRecord) {
    const isQueuedOffline = Boolean(submittedRecord.queuedOffline);
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6 sm:p-8 space-y-6">
        <div className="flex items-start gap-3">
          <div
            className={`rounded-md p-2.5 shrink-0 ${
              isQueuedOffline
                ? 'bg-[#FEF5EC] text-[#C06310]'
                : 'bg-emerald-50 text-emerald-700'
            }`}
          >
            {isQueuedOffline ? (
              <CloudUpload className="h-6 w-6" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
            )}
          </div>
          <div>
            <p
              className={`text-xs font-semibold ${
                isQueuedOffline ? 'text-[#9A4D09]' : 'text-emerald-800'
              }`}
            >
              {isQueuedOffline
                ? t('pwa.reportQueuedCardTitle', {
                    defaultValue: 'Saved Offline in IndexedDB — Waiting for Connection',
                  })
                : t('incident.successBannerTitle')}
            </p>
            <h2 className="mt-1 text-xl font-bold text-[#0B2545]">
              {t('incident.incidentId')}:{' '}
              <span className="font-mono text-[#0E857D] tabular-nums">
                {submittedRecord.incident_code}
              </span>
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
              {isQueuedOffline
                ? t('pwa.reportQueuedCardBody', {
                    code: submittedRecord.incident_code,
                    defaultValue:
                      'Your flood report ({{code}}) is safely stored in IndexedDB on this device. Background Sync will automatically retry submission as soon as your internet connection is restored.',
                  })
                : t('incident.successBannerBody', { code: submittedRecord.incident_code })}
            </p>
          </div>
        </div>

        <div className="rounded-md border border-slate-200 bg-[#F4F6F8] p-4 space-y-2.5 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <OriginBadge origin={submittedRecord.info_origin} />
            <StatusBadge status={submittedRecord.status} kind="incident" />
            <SeverityBadge severity={submittedRecord.severity} />
          </div>
          <p className="font-semibold text-[#0B2545]">{submittedRecord.title}</p>
          <p className="text-xs text-slate-600">
            {getIncidentCategoryLabel(submittedRecord.category)} · {submittedRecord.location_text},{' '}
            {submittedRecord.locality}
          </p>
          <p className="text-xs text-slate-500 tabular-nums">
            {t('incident.observedAtLabel')}: {formatTimestamp(submittedRecord.observed_at)} ·{' '}
            {Number(submittedRecord.latitude).toFixed(5)},{' '}
            {Number(submittedRecord.longitude).toFixed(5)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            to={`/dashboard/citizen/map?lat=${submittedRecord.latitude}&lng=${submittedRecord.longitude}`}
            className="inline-flex items-center gap-2 rounded-md bg-[#0B2545] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#13315C] transition-colors"
          >
            <Map className="h-4 w-4" />
            <span>{t('shelters.openInMap')}</span>
          </Link>
          <Link
            to="/dashboard/citizen/submissions"
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-[#0B2545] hover:bg-slate-50 transition-colors"
          >
            <FileText className="h-4 w-4" />
            <span>{t('incident.viewMyReports')}</span>
          </Link>
          <button
            type="button"
            onClick={handleResetForNew}
            className="rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            {t('incident.reportAnother')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-5 flex items-start gap-3">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-[#0E857D]" aria-hidden="true" />
        <div className="text-xs leading-relaxed text-slate-700">
          <p className="font-semibold text-[#0B2545]">{t('incident.guidelinesTitle')}</p>
          <p className="mt-1">
            {t('incident.pageSubtitle')}{' '}
            <Link to="/dashboard/citizen/emergency" className="font-semibold text-[#C06310] underline">
              {t('landing.ctaRequestHelp')}
            </Link>{' '}
            (<strong>112</strong>).
          </p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        noValidate
        className="rounded-lg border border-slate-200 bg-white p-6 space-y-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-lg font-bold text-[#0B2545]">{t('incident.pageTitle')}</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {t('emergency.contactPrivacyNote')}
            </p>
          </div>
          <OriginBadge origin="citizen_submitted" />
        </div>

        {!isOnline ? (
          <div
            role="status"
            aria-live="polite"
            className="flex items-start gap-2.5 rounded-md border border-[#F28C28]/50 bg-[#FEF5EC] px-4 py-3 text-xs text-[#9A4D09]"
          >
            <CloudUpload className="mt-0.5 h-4 w-4 shrink-0 text-[#C06310]" aria-hidden="true" />
            <div>
              <p className="font-semibold text-[#0B2545]">
                {t('pwa.offlineFormNoticeTitle', {
                  defaultValue: 'Offline Submission Supported (Background Sync)',
                })}
              </p>
              <p className="mt-0.5 leading-relaxed">
                {t('pwa.offlineFormNoticeBody', {
                  defaultValue:
                    'You are currently offline. You can still submit this flood report — it will be stored in IndexedDB and automatically synced when your connection is restored.',
                })}
              </p>
            </div>
          </div>
        ) : null}

        {errorMsg ? (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-700" />
            <span>{errorMsg}</span>
          </div>
        ) : null}

        {duplicateWarning ? (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-md border border-[#F28C28] bg-[#FEF5EC] px-4 py-3 text-sm text-[#9A4D09]"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#C06310]" />
            <span>{duplicateWarning}</span>
          </div>
        ) : null}

        {/* Type, Severity, Observed Time */}
        <div className="grid gap-5 md:grid-cols-3">
          <div>
            <label htmlFor="inc-category" className="block text-sm font-semibold text-[#0B2545]">
              {t('incident.categoryLabel')} *
            </label>
            <select
              id="inc-category"
              value={form.category}
              onChange={(e) => updateField('category', e.target.value)}
              className="mt-1.5 block w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-[#0B2545] focus:border-[#13A89E] focus:outline-none"
            >
              {incidentCategories.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="inc-severity" className="block text-sm font-semibold text-[#0B2545]">
              {t('incident.severityLabel')} *
            </label>
            <select
              id="inc-severity"
              value={form.severity}
              onChange={(e) => updateField('severity', e.target.value)}
              className="mt-1.5 block w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-[#0B2545] focus:border-[#13A89E] focus:outline-none"
            >
              <option value="low">{t('incident.severityOptionLow')}</option>
              <option value="medium">{t('incident.severityOptionMedium')}</option>
              <option value="high">{t('incident.severityOptionHigh')}</option>
              <option value="critical">{t('incident.severityOptionCritical')}</option>
            </select>
          </div>

          <div>
            <label htmlFor="inc-observed" className="block text-sm font-semibold text-[#0B2545]">
              {t('incident.observedAtLabel')} *
            </label>
            <input
              id="inc-observed"
              type="datetime-local"
              required
              value={form.observed_at}
              onChange={(e) => updateField('observed_at', e.target.value)}
              className="mt-1.5 block w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-[#0B2545] tabular-nums focus:border-[#13A89E] focus:outline-none"
            />
          </div>
        </div>

        {/* Title & Description */}
        <div>
          <label htmlFor="inc-title" className="block text-sm font-semibold text-[#0B2545]">
            {t('incident.headlineLabel')} *
          </label>
          <input
            id="inc-title"
            type="text"
            required
            value={form.title}
            onChange={(e) => updateField('title', e.target.value)}
            placeholder={t('incident.headlinePlaceholder')}
            className="mt-1.5 block w-full rounded-md border border-slate-300 px-3.5 py-2.5 text-sm text-[#0B2545] focus:border-[#13A89E] focus:outline-none"
          />
        </div>

        <div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label htmlFor="inc-desc" className="block text-sm font-semibold text-[#0B2545]">
              {t('incident.descriptionLabel')} *
            </label>
            <button
              type="button"
              disabled={aiLoading}
              onClick={handleRunAiClassification}
              className="inline-flex items-center gap-1.5 rounded-md border border-[#13A89E] bg-[#ECFAF8] px-3 py-1.5 text-xs font-semibold text-[#0A625C] hover:bg-[#13A89E] hover:text-white transition-colors disabled:opacity-60"
            >
              {aiLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              <span>{aiLoading ? t('incident.aiAssisting') : t('incident.aiAssistButton')}</span>
            </button>
          </div>
          <textarea
            id="inc-desc"
            rows={3}
            required
            value={form.description}
            onChange={(e) => updateField('description', e.target.value)}
            placeholder={t('incident.descriptionPlaceholder')}
            className="mt-1.5 block w-full rounded-md border border-slate-300 px-3.5 py-2.5 text-sm text-[#0B2545] focus:border-[#13A89E] focus:outline-none"
          />

          {aiSuggestion ? (
            <div className="mt-3 rounded-md border border-slate-200 bg-[#F4F6F8] p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <OriginBadge origin="ai_suggested" />
                  <span className="rounded border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-semibold text-[#0B2545]">
                    {t('common.humanReviewRequired')}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleApplyAiSuggestion}
                  className="rounded-md bg-[#0B2545] px-3 py-1 text-xs font-semibold text-white hover:bg-[#13315C] transition-colors"
                >
                  {t('incident.aiApplySuggestion')}
                </button>
              </div>

              <AiFallbackNotice
                usedFallback={aiSuggestion.usedFallback}
                notice={aiSuggestion.fallbackNotice}
                compact
              />

              <div className="grid gap-3 sm:grid-cols-2 text-xs">
                <div className="rounded border border-slate-200 bg-white p-2.5">
                  <p className="font-semibold text-slate-500">
                    {t('incident.aiSuggestedCategory')}
                  </p>
                  <p className="mt-0.5 font-bold text-[#0B2545]">
                    {getIncidentCategoryLabel(aiSuggestion.suggestedCategory)}
                  </p>
                </div>
                <div className="rounded border border-slate-200 bg-white p-2.5">
                  <p className="font-semibold text-slate-500">
                    {t('incident.aiSuggestedUrgency')}
                  </p>
                  <div className="mt-1">
                    <SeverityBadge severity={aiSuggestion.suggestedUrgency} />
                  </div>
                </div>
              </div>

              {aiSuggestion.keywords && aiSuggestion.keywords.length > 0 ? (
                <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                  <span className="font-semibold text-slate-600">{t('incident.aiKeywords')}:</span>
                  {aiSuggestion.keywords.map((kw) => (
                    <span
                      key={kw}
                      className="rounded border border-slate-200 bg-white px-2 py-0.5 font-medium text-slate-700"
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              ) : null}

              <div className="rounded border border-slate-200 bg-white p-2.5">
                <p className="mb-1 text-[11px] font-semibold text-slate-500">
                  {t('incident.aiSummary')}
                </p>
                <TranslateTextBlock
                  text={aiSuggestion.shortSummary}
                  label={t('incident.aiSummary')}
                  compact
                />
              </div>

              <p className="text-[11px] text-slate-500">{t('incident.aiReviewNotice')}</p>
            </div>
          ) : null}
        </div>

        {/* Location & Coordinates + GPS + Map Picker */}
        <div className="space-y-4 border-t border-slate-100 pt-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-[#0B2545]">
                {t('incident.sectionLocation')} *
              </h3>
              <p className="text-xs text-slate-500">{t('incident.mapPickerHelp')}</p>
            </div>
            <button
              type="button"
              onClick={handleCaptureGps}
              disabled={gpsLoading}
              className="inline-flex items-center gap-2 rounded-md border border-[#13A89E] bg-[#ECFAF8] px-3.5 py-2 text-xs font-semibold text-[#0A625C] hover:bg-[#13A89E] hover:text-white transition-colors shrink-0 disabled:opacity-60"
            >
              {gpsLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Crosshair className="h-4 w-4" aria-hidden="true" />
              )}
              <span>{gpsLoading ? t('incident.locatingGps') : t('incident.useGpsButton')}</span>
            </button>
          </div>

          {gpsStatus ? (
            <p className="text-xs font-medium text-[#0E857D]">{gpsStatus}</p>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="inc-locality" className="block text-sm font-semibold text-[#0B2545]">
                {t('auth.localityLabel')} *
              </label>
              <select
                id="inc-locality"
                value={form.locality}
                onChange={(e) => handleLocalityChange(e.target.value)}
                className="mt-1.5 block w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-[#0B2545] focus:border-[#13A89E] focus:outline-none"
              >
                {EAST_GODAVARI_LOCALITIES.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="inc-location-text" className="block text-sm font-semibold text-[#0B2545]">
                {t('incident.locationTextLabel')} *
              </label>
              <input
                id="inc-location-text"
                type="text"
                required
                value={form.location_text}
                onChange={(e) => updateField('location_text', e.target.value)}
                placeholder={t('incident.locationTextPlaceholder')}
                className="mt-1.5 block w-full rounded-md border border-slate-300 px-3.5 py-2.5 text-sm text-[#0B2545] focus:border-[#13A89E] focus:outline-none"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="inc-lat" className="block text-xs font-semibold text-slate-600">
                {t('incident.latitudeLabel')} *
              </label>
              <input
                id="inc-lat"
                type="number"
                step="0.000001"
                required
                value={form.latitude}
                onChange={(e) => updateField('latitude', e.target.value)}
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm text-[#0B2545] tabular-nums focus:border-[#13A89E] focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="inc-lng" className="block text-xs font-semibold text-slate-600">
                {t('incident.longitudeLabel')} *
              </label>
              <input
                id="inc-lng"
                type="number"
                step="0.000001"
                required
                value={form.longitude}
                onChange={(e) => updateField('longitude', e.target.value)}
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm text-[#0B2545] tabular-nums focus:border-[#13A89E] focus:outline-none"
              />
            </div>
          </div>

          <LocationPickerMap
            latitude={form.latitude}
            longitude={form.longitude}
            onChange={({ lat, lng }) =>
              setForm((prev) => ({ ...prev, latitude: String(lat), longitude: String(lng) }))
            }
          />
        </div>

        {/* Contact Phone + Optional Photo */}
        <div className="grid gap-6 border-t border-slate-100 pt-5 md:grid-cols-2">
          <div>
            <label htmlFor="inc-contact" className="block text-sm font-semibold text-[#0B2545]">
              {t('incident.contactLabel')} *
            </label>
            <input
              id="inc-contact"
              type="tel"
              required
              value={form.contact_phone}
              onChange={(e) => updateField('contact_phone', e.target.value)}
              placeholder={t('incident.contactPlaceholder')}
              className="mt-1.5 block w-full rounded-md border border-slate-300 px-3.5 py-2.5 text-sm text-[#0B2545] focus:border-[#13A89E] focus:outline-none"
            />
            <p className="mt-1 text-xs text-slate-500">
              {t('emergency.contactPrivacyNote')}
            </p>
          </div>

          <PhotoUploadField file={photoFile} onFileChange={setPhotoFile} />
        </div>

        {cooldown.isLimited ? (
          <div
            role="status"
            aria-live="polite"
            className="flex items-start gap-2.5 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-900"
          >
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
            <span className="tabular-nums">{cooldown.message}</span>
          </div>
        ) : null}

        {Object.keys(fieldErrors).length > 1 ? (
          <ul className="list-disc pl-5 space-y-1 rounded-md border border-red-200 bg-red-50/70 p-3 text-xs text-red-800">
            {Object.values(fieldErrors).map((msg) => (
              <li key={msg}>{msg}</li>
            ))}
          </ul>
        ) : null}

        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 pt-5">
          <Link
            to="/dashboard/citizen"
            className="min-h-[42px] inline-flex items-center rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            {t('common.cancel')}
          </Link>
          <button
            type="submit"
            disabled={submitting || cooldown.isLimited}
            className="inline-flex min-h-[42px] items-center gap-2 rounded-md bg-[#0B2545] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#13315C] transition-colors disabled:opacity-60"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" aria-hidden="true" />}
            <span className="tabular-nums">
              {submitting
                ? t('incident.submitting')
                : cooldown.isLimited
                ? t('landing.cooldownButton', { seconds: cooldown.remainingSeconds })
                : allowDuplicateOverride
                ? t('incident.submitAnyway')
                : t('incident.submitButton')}
            </span>
          </button>
        </div>
      </form>
    </div>
  );
}
