import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Crosshair,
  FileText,
  Loader2,
  Lock,
  PhoneCall,
  Siren,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { useSubmissionCooldown } from '../../hooks/useSubmissionCooldown';
import { dataService } from '../../services/dataService';
import { suggestEmergencyPriority } from '../../services/aiService';
import {
  DEFAULT_DISTRICT,
  EAST_GODAVARI_COORDS,
  EAST_GODAVARI_LOCALITIES,
  formatNumber,
  formatTimestamp,
  getOfficialEmergencyHelplines,
} from '../../utils/constants';
import { validateEmergencyForm } from '../../utils/validation';
import { LocationPickerMap } from '../../components/map/LocationPickerMap';
import { PhotoUploadField } from '../../components/common/PhotoUploadField';
import { EmergencyStatusTracker } from '../../components/emergency/EmergencyStatusTracker';
import { OriginBadge, SeverityBadge, StatusBadge } from '../../components/common/Badges';
import { AiFallbackNotice } from '../../components/ai/AiFallbackNotice';

export function EmergencyRequestPage() {
  const { t } = useTranslation();
  const { user, profile } = useAuth();
  const { showToast } = useToast();

  const helplines = getOfficialEmergencyHelplines();

  const defaultLocality =
    profile?.locality && EAST_GODAVARI_COORDS[profile.locality]
      ? profile.locality
      : EAST_GODAVARI_LOCALITIES[0];
  const defaultCoords = EAST_GODAVARI_COORDS[defaultLocality] || { lat: 17.0005, lng: 81.804 };

  const [form, setForm] = useState({
    requester_name: profile?.full_name || '',
    contact_phone: profile?.phone || '',
    locality: defaultLocality,
    location_text: '',
    latitude: String(defaultCoords.lat),
    longitude: String(defaultCoords.lng),
    people_count: '1',
    children_count: '0',
    elderly_count: '0',
    medical_needs: '',
    accessibility_needs: '',
    is_trapped: false,
    severity: 'high',
    description: '',
    disclaimerAccepted: false,
  });

  const [photoFile, setPhotoFile] = useState(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsStatus, setGpsStatus] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [createdRequest, setCreatedRequest] = useState(null);
  const [activeRequests, setActiveRequests] = useState([]);
  const [aiPriorityLoading, setAiPriorityLoading] = useState(false);
  const [aiPriorityResult, setAiPriorityResult] = useState(null);

  const cooldown = useSubmissionCooldown('emergency_request', user?.id || 'public');
  const inFlightRef = useRef(false);

  const loadMyRequests = async () => {
    if (!user?.id) return;
    try {
      const list = await dataService.getMyEmergencyRequests(user.id);
      setActiveRequests(list);
    } catch {
      // Non-blocking on initial form load
    }
  };

  useEffect(() => {
    loadMyRequests();
  }, [user?.id]);

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
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
      setGpsStatus(t('incident.gpsNotSupported'));
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = Number(position.coords.latitude.toFixed(6));
        const lng = Number(position.coords.longitude.toFixed(6));
        setForm((prev) => ({ ...prev, latitude: String(lat), longitude: String(lng) }));
        setGpsStatus(
          t('incident.gpsCaptured', { lat: lat.toFixed(5), lng: lng.toFixed(5) })
        );
        setGpsLoading(false);
      },
      () => {
        setGpsStatus(t('incident.gpsPermissionError'));
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handlePreviewAiPriority = async () => {
    setAiPriorityLoading(true);
    try {
      const suggestion = await suggestEmergencyPriority({
        people_count: Number(form.people_count) || 1,
        children_count: Number(form.children_count) || 0,
        elderly_count: Number(form.elderly_count) || 0,
        medical_needs: form.medical_needs,
        accessibility_needs: form.accessibility_needs,
        is_trapped: form.is_trapped,
        description: form.description,
        locality: form.locality,
      });
      setAiPriorityResult(suggestion);
    } finally {
      setAiPriorityLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (inFlightRef.current || submitting) return;

    setErrorMsg('');
    setFieldErrors({});

    const limitCheck = cooldown.checkNow();
    if (!limitCheck.allowed) {
      setErrorMsg(
        t('emergency.cooldownDangerSuffix', { message: limitCheck.message })
      );
      return;
    }

    const validation = validateEmergencyForm(form);
    if (!validation.isValid) {
      setFieldErrors(validation.fieldErrors);
      setErrorMsg(validation.firstError);
      return;
    }

    const clean = validation.sanitized;

    inFlightRef.current = true;
    setSubmitting(true);

    try {
      let photoUrls = [];
      if (photoFile) {
        const uploaded = await dataService.uploadIncidentPhoto(user.id, photoFile);
        if (uploaded?.url) photoUrls = [uploaded.url];
      }

      const saved = await dataService.createEmergencyRequest(user.id, {
        requester_name: clean.requester_name,
        contact_phone: clean.contact_phone,
        locality: clean.locality,
        location_text: clean.location_text,
        district: profile?.district || DEFAULT_DISTRICT,
        latitude: Number(clean.latitude),
        longitude: Number(clean.longitude),
        people_count: Number(clean.people_count),
        children_count: Number(clean.children_count),
        elderly_count: Number(clean.elderly_count),
        medical_needs: clean.medical_needs,
        accessibility_needs: clean.accessibility_needs,
        severity: clean.severity,
        description: clean.is_trapped
          ? `[TRAPPED / UNABLE TO EXIT] ${clean.description}`
          : clean.description,
        photo_urls: photoUrls,
      });

      cooldown.markSubmitted();
      setCreatedRequest(saved);
      setActiveRequests((prev) => [saved, ...prev]);
      showToast({
        title: t('emergency.toastLoggedTitle', { code: saved.request_code }),
        message: t('emergency.toastLoggedMessage'),
        type: 'warning',
      });
    } catch (submitErr) {
      setErrorMsg(submitErr?.message || t('errors.submitEmergencyFailed'));
    } finally {
      setSubmitting(false);
      inFlightRef.current = false;
    }
  };

  return (
    <div className="space-y-6">
      {/* Critical Safety Disclaimer + Official Emergency Contacts (112, 108, 101, 1077) */}
      <section className="rounded-lg border border-red-300 bg-red-50/70 p-5 space-y-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-700" aria-hidden="true" />
          <div>
            <h2 className="text-base font-bold text-red-900">
              {t('emergency.safetyNoticeTitle')}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-red-900/90">
              {t('emergency.safetyNoticeBody')}
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {helplines.map((line) => (
            <div
              key={line.number}
              className="flex items-start gap-2.5 rounded-md border border-red-200 bg-white px-3.5 py-2.5"
            >
              <PhoneCall className="mt-0.5 h-4 w-4 shrink-0 text-red-700" aria-hidden="true" />
              <div>
                <p className="font-mono text-lg font-bold leading-none text-red-800 tabular-nums">
                  {line.number}
                </p>
                <p className="mt-1 text-xs font-semibold text-[#0B2545]">{line.label}</p>
                <p className="text-[11px] text-slate-600">{line.note}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Created Request Confirmation + 6-Status Tracker */}
      {createdRequest ? (
        <section className="rounded-lg border border-emerald-600/35 bg-white p-6 space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="rounded-md bg-emerald-50 p-2 text-emerald-700">
                <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
              </div>
              <div>
                <p className="text-xs font-semibold text-emerald-800">
                  {t('emergency.loggedEyebrow')}
                </p>
                <h3 className="mt-0.5 text-xl font-bold text-[#0B2545]">
                  {t('emergency.requestIdLabel')}{' '}
                  <span className="font-mono text-[#0E857D] tabular-nums">
                    {createdRequest.request_code}
                  </span>
                </h3>
                <p className="mt-1 text-xs text-slate-600">
                  {t('emergency.loggedPrivacyNote')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <SeverityBadge severity={createdRequest.severity} />
              <StatusBadge status={createdRequest.status} kind="emergency" />
            </div>
          </div>

          <EmergencyStatusTracker status={createdRequest.status} />

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Link
              to="/dashboard/citizen/submissions"
              className="inline-flex items-center gap-2 rounded-md bg-[#0B2545] px-4 py-2 text-sm font-semibold text-white hover:bg-[#13315C] transition-colors"
            >
              <FileText className="h-4 w-4" />
              <span>{t('emergency.trackInMyRequests')}</span>
            </Link>
            <button
              type="button"
              onClick={() => {
                setCreatedRequest(null);
                setPhotoFile(null);
                setForm((prev) => ({
                  ...prev,
                  description: '',
                  medical_needs: '',
                  accessibility_needs: '',
                  disclaimerAccepted: false,
                }));
              }}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              {t('emergency.submitAnother')}
            </button>
          </div>
        </section>
      ) : (
        /* Emergency Request Form */
        <form
          onSubmit={handleSubmit}
          noValidate
          className="rounded-lg border border-slate-200 bg-white p-6 space-y-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-lg font-bold text-[#0B2545]">{t('emergency.formTitle')}</h3>
              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                <Lock className="h-3.5 w-3.5 text-[#0E857D]" aria-hidden="true" />
                <span>{t('emergency.rlsPrivateNotice')}</span>
              </p>
            </div>
            <OriginBadge origin="citizen_submitted" />
          </div>

          {errorMsg ? (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-700" />
              <span>{errorMsg}</span>
            </div>
          ) : null}

          {/* Requester Contact */}
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="er-name" className="block text-sm font-semibold text-[#0B2545]">
                {t('emergency.fullNameLabel')} *
              </label>
              <input
                id="er-name"
                type="text"
                required
                value={form.requester_name}
                onChange={(e) => updateField('requester_name', e.target.value)}
                placeholder={t('emergency.fullNamePlaceholder')}
                className="mt-1.5 block w-full rounded-md border border-slate-300 px-3.5 py-2.5 text-sm text-[#0B2545] focus:border-[#13A89E] focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="er-phone" className="block text-sm font-semibold text-[#0B2545]">
                {t('emergency.contactPhoneLabel')}
              </label>
              <input
                id="er-phone"
                type="tel"
                required
                value={form.contact_phone}
                onChange={(e) => updateField('contact_phone', e.target.value)}
                placeholder="+91 98480 XXXXX"
                className="mt-1.5 block w-full rounded-md border border-slate-300 px-3.5 py-2.5 text-sm text-[#0B2545] focus:border-[#13A89E] focus:outline-none"
              />
            </div>
          </div>

          {/* People, Children, Elderly, Urgency */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label htmlFor="er-people" className="block text-sm font-semibold text-[#0B2545]">
                {t('emergency.totalPeopleLabel')} *
              </label>
              <input
                id="er-people"
                type="number"
                min="1"
                max="200"
                required
                value={form.people_count}
                onChange={(e) => updateField('people_count', e.target.value)}
                className="mt-1.5 block w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm text-[#0B2545] tabular-nums focus:border-[#13A89E] focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="er-children" className="block text-sm font-semibold text-[#0B2545]">
                {t('emergency.childrenLabel')}
              </label>
              <input
                id="er-children"
                type="number"
                min="0"
                max="100"
                value={form.children_count}
                onChange={(e) => updateField('children_count', e.target.value)}
                className="mt-1.5 block w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm text-[#0B2545] tabular-nums focus:border-[#13A89E] focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="er-elderly" className="block text-sm font-semibold text-[#0B2545]">
                {t('emergency.elderlyLabel')}
              </label>
              <input
                id="er-elderly"
                type="number"
                min="0"
                max="100"
                value={form.elderly_count}
                onChange={(e) => updateField('elderly_count', e.target.value)}
                className="mt-1.5 block w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm text-[#0B2545] tabular-nums focus:border-[#13A89E] focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="er-severity" className="block text-sm font-semibold text-[#0B2545]">
                {t('emergency.urgencyLabel')} *
              </label>
              <select
                id="er-severity"
                value={form.severity}
                onChange={(e) => updateField('severity', e.target.value)}
                className="mt-1.5 block w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-[#0B2545] focus:border-[#13A89E] focus:outline-none"
              >
                <option value="critical">{t('emergency.urgencyOptionCritical')}</option>
                <option value="high">{t('emergency.urgencyOptionHigh')}</option>
                <option value="medium">{t('emergency.urgencyOptionMedium')}</option>
                <option value="low">{t('emergency.urgencyOptionLow')}</option>
              </select>
            </div>
          </div>

          {/* Medical & Accessibility Needs */}
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label htmlFor="er-medical" className="block text-sm font-semibold text-[#0B2545]">
                {t('emergency.medicalNeedsPrivateLabel')}
              </label>
              <textarea
                id="er-medical"
                rows={2}
                value={form.medical_needs}
                onChange={(e) => updateField('medical_needs', e.target.value)}
                placeholder={t('emergency.medicalNeedsPlaceholder')}
                className="mt-1.5 block w-full rounded-md border border-slate-300 px-3.5 py-2 text-sm text-[#0B2545] focus:border-[#13A89E] focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="er-access" className="block text-sm font-semibold text-[#0B2545]">
                {t('emergency.accessibilityPrivateLabel')}
              </label>
              <textarea
                id="er-access"
                rows={2}
                value={form.accessibility_needs}
                onChange={(e) => updateField('accessibility_needs', e.target.value)}
                placeholder={t('emergency.accessibilityPlaceholder')}
                className="mt-1.5 block w-full rounded-md border border-slate-300 px-3.5 py-2 text-sm text-[#0B2545] focus:border-[#13A89E] focus:outline-none"
              />
            </div>
          </div>

          {/* Trapped Status Flag */}
          <label className="flex items-start gap-3 rounded-md border border-slate-200 bg-[#F4F6F8] px-4 py-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_trapped}
              onChange={(e) => updateField('is_trapped', e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-400 text-red-700 focus:ring-[#13A89E]"
            />
            <span className="text-xs leading-relaxed text-[#0B2545]">
              <strong>{t('emergency.trappedLabelStrong')}</strong> {t('emergency.trappedLabelDetail')}
            </span>
          </label>

          {/* Location + GPS + Map Picker */}
          <div className="space-y-4 border-t border-slate-100 pt-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="text-sm font-bold text-[#0B2545]">
                  {t('emergency.exactLocationTitle')}
                </h4>
                <p className="text-xs text-slate-500">
                  {t('emergency.exactLocationSubtitle')}
                </p>
              </div>
              <button
                type="button"
                onClick={handleCaptureGps}
                disabled={gpsLoading}
                className="inline-flex items-center gap-2 rounded-md border border-[#13A89E] bg-[#ECFAF8] px-3.5 py-2 text-xs font-semibold text-[#0A625C] hover:bg-[#13A89E] hover:text-white transition-colors shrink-0"
              >
                {gpsLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Crosshair className="h-4 w-4" aria-hidden="true" />
                )}
                <span>{gpsLoading ? t('incident.capturingGps') : t('incident.captureGps')}</span>
              </button>
            </div>

            {gpsStatus ? <p className="text-xs font-medium text-[#0E857D]">{gpsStatus}</p> : null}

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="er-locality" className="block text-sm font-semibold text-[#0B2545]">
                  {t('incident.localityLabel')} *
                </label>
                <select
                  id="er-locality"
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
                <label htmlFor="er-address" className="block text-sm font-semibold text-[#0B2545]">
                  {t('emergency.exactAddressLabel')} *
                </label>
                <input
                  id="er-address"
                  type="text"
                  required
                  value={form.location_text}
                  onChange={(e) => updateField('location_text', e.target.value)}
                  placeholder={t('emergency.exactAddressPlaceholder')}
                  className="mt-1.5 block w-full rounded-md border border-slate-300 px-3.5 py-2.5 text-sm text-[#0B2545] focus:border-[#13A89E] focus:outline-none"
                />
              </div>
            </div>

            <LocationPickerMap
              latitude={form.latitude}
              longitude={form.longitude}
              heightClass="h-56"
              onChange={({ lat, lng }) =>
                setForm((prev) => ({ ...prev, latitude: String(lat), longitude: String(lng) }))
              }
            />
          </div>

          {/* Situation Description & Optional Photo */}
          <div className="grid gap-6 border-t border-slate-100 pt-5 md:grid-cols-2">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label htmlFor="er-desc" className="block text-sm font-semibold text-[#0B2545]">
                  {t('emergency.situationDescLabel')} *
                </label>
                <button
                  type="button"
                  disabled={aiPriorityLoading}
                  onClick={handlePreviewAiPriority}
                  className="inline-flex items-center gap-1.5 rounded-md border border-[#13A89E] bg-[#ECFAF8] px-2.5 py-1 text-xs font-semibold text-[#0A625C] hover:bg-[#13A89E] hover:text-white transition-colors disabled:opacity-60"
                >
                  {aiPriorityLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  <span>
                    {aiPriorityLoading
                      ? t('emergency.evaluatingPriority')
                      : t('emergency.aiPriorityButton')}
                  </span>
                </button>
              </div>
              <textarea
                id="er-desc"
                rows={4}
                required
                value={form.description}
                onChange={(e) => updateField('description', e.target.value)}
                placeholder={t('emergency.situationDescPlaceholder')}
                className="block w-full rounded-md border border-slate-300 px-3.5 py-2.5 text-sm text-[#0B2545] focus:border-[#13A89E] focus:outline-none"
              />

              {aiPriorityResult ? (
                <div className="rounded-md border border-slate-200 bg-[#F4F6F8] p-3.5 space-y-2.5 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <OriginBadge origin="ai_suggested" />
                      <SeverityBadge severity={aiPriorityResult.suggestedPriority} />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        updateField('severity', aiPriorityResult.suggestedPriority);
                        showToast({
                          title: t('emergency.toastPriorityAppliedTitle'),
                          message: t('emergency.toastPriorityAppliedMsg'),
                          type: 'info',
                        });
                      }}
                      className="rounded bg-[#0B2545] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[#13315C]"
                    >
                      {t('emergency.applySuggestedUrgency')}
                    </button>
                  </div>
                  <AiFallbackNotice
                    usedFallback={aiPriorityResult.usedFallback}
                    notice={aiPriorityResult.fallbackNotice}
                    compact
                  />
                  <p className="text-slate-700">{aiPriorityResult.rationale}</p>
                  <p className="text-[11px] font-semibold text-slate-600">
                    {t('common.humanReviewRequired')}: {t('common.yes')}
                  </p>
                </div>
              ) : null}
            </div>

            <PhotoUploadField
              label={t('emergency.optionalPhotoLabel')}
              helperText={t('emergency.optionalPhotoHelper')}
              file={photoFile}
              onFileChange={setPhotoFile}
            />
          </div>

          {/* Mandatory Disclaimer Checkbox */}
          <label className="flex items-start gap-3 rounded-md border border-[#F28C28]/45 bg-[#FEF5EC] p-4 cursor-pointer">
            <input
              type="checkbox"
              checked={form.disclaimerAccepted}
              onChange={(e) => updateField('disclaimerAccepted', e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-slate-400 text-[#0B2545] focus:ring-[#13A89E]"
            />
            <span className="text-xs leading-relaxed text-[#9A4D09]">
              <strong>{t('emergency.disclaimerCheckboxLead')}</strong>{' '}
              {t('emergency.disclaimerCheckboxBody')}
            </span>
          </label>

          {cooldown.isLimited ? (
            <div
              role="status"
              aria-live="polite"
              className="flex items-start gap-2.5 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-900"
            >
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
              <span className="tabular-nums">
                {t('emergency.cooldownDangerSuffix', { message: cooldown.message })}
              </span>
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
              className="inline-flex min-h-[42px] items-center gap-2 rounded-md bg-[#F28C28] px-5 py-2.5 text-sm font-bold text-[#0B2545] hover:bg-[#D97316] hover:text-white transition-colors disabled:opacity-60"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Siren className="h-4 w-4" aria-hidden="true" />
              )}
              <span className="tabular-nums">
                {submitting
                  ? t('emergency.loggingRequest')
                  : cooldown.isLimited
                  ? t('incident.cooldownSeconds', {
                      seconds: formatNumber(cooldown.remainingSeconds),
                    })
                  : t('emergency.submitButton')}
              </span>
            </button>
          </div>
        </form>
      )}

      {/* Active Requests Live 6-Status Tracker Preview */}
      {activeRequests.length > 0 ? (
        <section className="rounded-lg border border-slate-200 bg-white p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-bold text-[#0B2545]">
                {t('emergency.yourTrackerHeading')}
              </h3>
              <p className="text-xs text-slate-500">
                {t('emergency.yourTrackerSubtitle')}
              </p>
            </div>
            <Link
              to="/dashboard/citizen/submissions"
              className="text-xs font-semibold text-[#0E857D] hover:underline"
            >
              {t('emergency.viewFullHistory')}
            </Link>
          </div>

          <div className="divide-y divide-slate-200">
            {activeRequests.slice(0, 3).map((req) => (
              <div key={req.id} className="py-4 first:pt-0 last:pb-0 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-bold text-[#0B2545] tabular-nums">
                      {req.request_code}
                    </span>
                    <span className="text-xs text-slate-500">
                      {req.locality} ·{' '}
                      {t('emergency.peopleCountShort', {
                        count: formatNumber(req.people_count),
                      })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <SeverityBadge severity={req.reviewed_priority || req.severity} />
                    <StatusBadge status={req.status} kind="emergency" />
                  </div>
                </div>
                <EmergencyStatusTracker status={req.status} compact />
                <p className="text-xs text-slate-500 tabular-nums">
                  {t('emergency.loggedAt', { time: formatTimestamp(req.created_at) })}
                  {req.assigned_team_name
                    ? ` · ${t('emergency.assignedUnit', { team: req.assigned_team_name })}`
                    : ''}
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
