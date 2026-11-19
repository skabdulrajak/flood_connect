import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CheckCircle2,
  Compass,
  LocateFixed,
  MapPin,
  RefreshCw,
  Send,
} from 'lucide-react';
import {
  DemoDataBadge,
  OriginBadge,
  SeverityBadge,
  StatusBadge,
} from '../../components/common/Badges';
import { PhotoUploadField } from '../../components/common/PhotoUploadField';
import { EmptyState, LoadingState } from '../../components/common/StateFeedback';
import { LocationPickerMap } from '../../components/map/LocationPickerMap';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { dataService } from '../../services/dataService';
import {
  OFFLINE_QUEUE_EVENT,
  OFFLINE_SYNC_COMPLETE_EVENT,
} from '../../utils/offlineIncidentQueue';
import {
  EAST_GODAVARI_COORDS,
  EAST_GODAVARI_LOCALITIES,
  formatNumber,
  formatTimestamp,
  getIncidentCategories,
  getIncidentCategoryLabel,
} from '../../utils/constants';

export function VolunteerFieldSupportPage() {
  const { t } = useTranslation();
  const { user, profile, isDemoMode } = useAuth();
  const { showToast } = useToast();
  const submittingLockRef = useRef(false);

  const categories = getIncidentCategories();
  const defaultLocality = profile?.locality || EAST_GODAVARI_LOCALITIES[0];
  const defaultCoords =
    EAST_GODAVARI_COORDS[defaultLocality] || EAST_GODAVARI_COORDS['Rajahmundry Urban'];

  const [form, setForm] = useState({
    category: 'road_waterlogging',
    title: '',
    description: '',
    locality: defaultLocality,
    location_text: '',
    latitude: defaultCoords.lat,
    longitude: defaultCoords.lng,
    severity: 'medium',
  });
  const [photoFile, setPhotoFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);

  const [myObservations, setMyObservations] = useState([]);
  const [loadingList, setLoadingList] = useState(true);

  const loadObservations = useCallback(async () => {
    if (!user) return;
    setLoadingList(true);
    try {
      const list = await dataService.getMyIncidents(user.id);
      setMyObservations(list);
    } finally {
      setLoadingList(false);
    }
  }, [user]);

  useEffect(() => {
    loadObservations();
    const handleRefresh = () => {
      loadObservations();
    };
    window.addEventListener(OFFLINE_SYNC_COMPLETE_EVENT, handleRefresh);
    window.addEventListener(OFFLINE_QUEUE_EVENT, handleRefresh);
    return () => {
      window.removeEventListener(OFFLINE_SYNC_COMPLETE_EVENT, handleRefresh);
      window.removeEventListener(OFFLINE_QUEUE_EVENT, handleRefresh);
    };
  }, [loadObservations]);

  const handleUseGps = () => {
    if (!navigator.geolocation) {
      showToast(t('incident.gpsNotSupported'), 'error');
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((prev) => ({
          ...prev,
          latitude: Number(pos.coords.latitude.toFixed(6)),
          longitude: Number(pos.coords.longitude.toFixed(6)),
        }));
        setGpsLoading(false);
        showToast(t('volunteer.gpsCapturedToast'), 'success');
      },
      () => {
        setGpsLoading(false);
        showToast(t('incident.gpsPermissionError'), 'error');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSubmitObservation = async (e) => {
    e.preventDefault();
    if (submittingLockRef.current || !user) return;

    if (form.title.trim().length < 6 || form.description.trim().length < 15) {
      showToast(t('volunteer.validationTitleDesc'), 'error');
      return;
    }
    if (!form.location_text.trim()) {
      showToast(t('volunteer.validationLandmark'), 'error');
      return;
    }

    submittingLockRef.current = true;
    setSubmitting(true);
    try {
      let photoUrls = [];
      let deferredPhotoFile = null;
      if (photoFile) {
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
          deferredPhotoFile = photoFile;
        } else {
          const uploadedRes = await dataService.uploadIncidentPhoto(user.id, photoFile);
          const resolvedUrl =
            typeof uploadedRes === 'string' ? uploadedRes : uploadedRes?.url || null;
          if (resolvedUrl) photoUrls = [resolvedUrl];
        }
      }

      const created = await dataService.createIncident(
        user.id,
        {
          ...form,
          title: `[Field Obs] ${form.title.trim()}`,
          photo_urls: photoUrls,
          observed_at: new Date().toISOString(),
          reporter_contact_phone: profile?.phone || '',
        },
        { photoFile: deferredPhotoFile || photoFile }
      );

      if (created.queuedOffline) {
        showToast(
          t('pwa.reportQueuedToastMessage', {
            code: created.incident_code,
            defaultValue:
              'Stored in IndexedDB ({{code}}). Background Sync will submit it automatically once connection returns.',
          }),
          'info'
        );
      } else {
        showToast(
          t('volunteer.toastObsSubmitted', { code: created.incident_code }),
          'success'
        );
      }
      setForm((prev) => ({
        ...prev,
        title: '',
        description: '',
        location_text: '',
      }));
      setPhotoFile(null);
      await loadObservations();
    } catch (err) {
      showToast(err.message || t('errors.submitFieldObsFailed'), 'error');
    } finally {
      setSubmitting(false);
      submittingLockRef.current = false;
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-[#0E857D]">{t('volunteer.fieldObsEyebrow')}</p>
            <h2 className="mt-1 text-lg font-bold text-[#0B2545]">
              {t('volunteer.fieldObsHeading')}
            </h2>
            <p className="mt-1 text-sm text-slate-600">{t('volunteer.fieldObsSubtitle')}</p>
          </div>
          {isDemoMode ? <DemoDataBadge compact /> : null}
        </div>

        <form onSubmit={handleSubmitObservation} className="mt-5 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                {t('volunteer.hazardTypeLabel')} *
              </label>
              <select
                value={form.category}
                onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
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
                {t('incident.localityLabel')} *
              </label>
              <select
                value={form.locality}
                onChange={(e) => {
                  const loc = e.target.value;
                  const c = EAST_GODAVARI_COORDS[loc];
                  setForm((p) => ({
                    ...p,
                    locality: loc,
                    ...(c ? { latitude: c.lat, longitude: c.lng } : {}),
                  }));
                }}
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
                {t('volunteer.observedSeverityLabel')} *
              </label>
              <select
                value={form.severity}
                onChange={(e) => setForm((p) => ({ ...p, severity: e.target.value }))}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option value="low">{t('severity.low')}</option>
                <option value="medium">{t('severity.moderate')}</option>
                <option value="high">{t('severity.high')}</option>
                <option value="critical">{t('severity.critical')}</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700">
                {t('volunteer.shortHeadlineLabel')} *
              </label>
              <input
                type="text"
                required
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                placeholder={t('volunteer.shortHeadlinePlaceholder')}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                {t('volunteer.landmarkRoadLabel')} *
              </label>
              <input
                type="text"
                required
                value={form.location_text}
                onChange={(e) => setForm((p) => ({ ...p, location_text: e.target.value }))}
                placeholder={t('volunteer.landmarkRoadPlaceholder')}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div className="sm:col-span-2 lg:col-span-3">
              <label className="block text-xs font-semibold text-slate-700">
                {t('volunteer.groundObsDetailsLabel')} *
              </label>
              <textarea
                rows={3}
                required
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                placeholder={t('volunteer.groundObsDetailsPlaceholder')}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-700">
                {t('volunteer.pinExactPointLabel')}
              </span>
              <button
                type="button"
                disabled={gpsLoading}
                onClick={handleUseGps}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-[#0B2545] hover:bg-slate-50"
              >
                <LocateFixed className="h-3.5 w-3.5 text-[#13A89E]" />
                <span>{gpsLoading ? t('incident.capturingGps') : t('volunteer.useCurrentGps')}</span>
              </button>
            </div>
            <LocationPickerMap
              latitude={form.latitude}
              longitude={form.longitude}
              onChange={({ lat, lng }) =>
                setForm((p) => ({ ...p, latitude: lat, longitude: lng }))
              }
              heightClass="h-52"
            />
          </div>

          <PhotoUploadField file={photoFile} onFileChange={setPhotoFile} />

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-md bg-[#0B2545] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#13315C] disabled:opacity-60"
            >
              <Send className="h-4 w-4" />
              <span>
                {submitting ? t('common.submitting') : t('volunteer.submitFieldObsBtn')}
              </span>
            </button>
          </div>
        </form>
      </section>

      {/* Submitted Observations List */}
      <section className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-[#0B2545]">
              {t('volunteer.mySubmittedObsHeading', { count: formatNumber(myObservations.length) })}
            </h3>
            <p className="text-xs text-slate-500">{t('volunteer.mySubmittedObsSubtitle')}</p>
          </div>
          <button
            type="button"
            onClick={loadObservations}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>{t('common.refresh')}</span>
          </button>
        </div>

        {loadingList ? (
          <LoadingState message={t('volunteer.loadingSubmittedObs')} />
        ) : myObservations.length === 0 ? (
          <EmptyState
            icon={Compass}
            title={t('volunteer.emptyObsTitle')}
            description={t('volunteer.emptyObsDesc')}
          />
        ) : (
          <div className="space-y-3">
            {myObservations.map((obs) => (
              <article
                key={obs.id}
                className="rounded-md border border-slate-200 bg-[#F4F6F8] p-4 space-y-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold text-[#0B2545]">
                      {obs.incident_code}
                    </span>
                    <StatusBadge status={obs.status} kind="incident" />
                    <OriginBadge origin={obs.info_origin} />
                    <SeverityBadge severity={obs.reviewed_priority || obs.severity} />
                  </div>
                  <span className="text-[11px] text-slate-500 tabular-nums">
                    {formatTimestamp(obs.created_at)}
                  </span>
                </div>
                <p className="text-sm font-bold text-[#0B2545]">{obs.title}</p>
                <p className="text-xs text-slate-700">{obs.description}</p>
                <p className="flex flex-wrap items-center gap-1 text-xs text-slate-500">
                  <MapPin className="h-3.5 w-3.5" />
                  <span>
                    {getIncidentCategoryLabel(obs.category)} · {obs.location_text}, {obs.locality}
                  </span>
                  {obs.status === 'verified' ? (
                    <span className="ml-2 inline-flex items-center gap-1 font-semibold text-emerald-700">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {t('volunteer.confirmedByAdmin')}
                    </span>
                  ) : null}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
