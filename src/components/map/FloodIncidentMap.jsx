import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  APIProvider,
  AdvancedMarker,
  InfoWindow,
  Map as GoogleMap,
  Pin,
  useMap,
} from '@vis.gl/react-google-maps';
import {
  AlertTriangle,
  Building2,
  Filter,
  Info,
  Layers,
  MapPin,
  RotateCcw,
  Search,
} from 'lucide-react';
import {
  EAST_GODAVARI_CENTER,
  EAST_GODAVARI_COORDS,
  EAST_GODAVARI_LOCALITIES,
  formatNumber,
  formatTimestamp,
  getIncidentCategories,
  getIncidentCategoryLabel,
} from '../../utils/constants';
import {
  DemoDataBadge,
  OriginBadge,
  SeverityBadge,
  StatusBadge,
} from '../common/Badges';
import { ErrorBoundary } from '../common/ErrorBoundary';

const MAPS_API_KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '').trim();
const GMP_ATTRIBUTION_IDS = ['gmp_mcp_codeassist_v1_aistudio'];

const SEVERITY_COLORS = {
  critical: { bg: '#DC2626', border: '#991B1B', glyph: '#FFFFFF' },
  high: { bg: '#F28C28', border: '#9A4E0A', glyph: '#FFFFFF' },
  medium: { bg: '#D97706', border: '#92400E', glyph: '#FFFFFF' },
  low: { bg: '#13A89E', border: '#0E6F68', glyph: '#FFFFFF' },
};

function MapCameraController({ target }) {
  const map = useMap();
  useEffect(() => {
    if (map && target && Number.isFinite(target.lat) && Number.isFinite(target.lng)) {
      map.panTo({ lat: target.lat, lng: target.lng });
      if (Number.isFinite(target.zoom)) {
        map.setZoom(target.zoom);
      }
    }
  }, [target, map]);
  return null;
}

export function FloodIncidentMap({
  incidents = [],
  shelters = [],
  isAuthenticated = false,
  isDemoMode = false,
  initialFocus = null,
  heightClass = 'h-[400px] sm:h-[480px] lg:h-[540px]',
}) {
  const { t, i18n } = useTranslation();
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showShelters, setShowShelters] = useState(true);
  const [mapTypeId, setMapTypeId] = useState('roadmap');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFeedback, setSearchFeedback] = useState('');
  const [cameraTarget, setCameraTarget] = useState(initialFocus);
  const [selectedItem, setSelectedItem] = useState(null);

  const categories = getIncidentCategories();
  const activeLang = ['en', 'hi', 'te'].includes(i18n.language) ? i18n.language : 'en';

  useEffect(() => {
    if (initialFocus) {
      setCameraTarget(initialFocus);
    }
  }, [initialFocus]);

  const filteredIncidents = useMemo(() => {
    return incidents.filter((inc) => {
      const effectiveSeverity = inc.reviewed_priority || inc.severity;
      if (categoryFilter !== 'all' && inc.category !== categoryFilter) return false;
      if (severityFilter !== 'all' && effectiveSeverity !== severityFilter) return false;
      if (statusFilter === 'verified' && inc.status !== 'verified') return false;
      if (statusFilter === 'pending_verification' && inc.status !== 'pending_verification') {
        return false;
      }
      if (statusFilter === 'own' && !inc.isOwnReport) return false;
      return true;
    });
  }, [incidents, categoryFilter, severityFilter, statusFilter]);

  const handleLocationSearch = (e) => {
    e.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;
    setSearchFeedback('');

    const matchedLocality = EAST_GODAVARI_LOCALITIES.find((loc) =>
      loc.toLowerCase().includes(query.toLowerCase())
    );
    if (matchedLocality && EAST_GODAVARI_COORDS[matchedLocality]) {
      const coords = EAST_GODAVARI_COORDS[matchedLocality];
      setCameraTarget({ lat: coords.lat, lng: coords.lng, zoom: 13, ts: Date.now() });
      setSearchFeedback(`${matchedLocality}, East Godavari`);
      return;
    }

    const matchedIncident = incidents.find(
      (i) =>
        i.incident_code?.toLowerCase().includes(query.toLowerCase()) ||
        i.title?.toLowerCase().includes(query.toLowerCase()) ||
        i.location_text?.toLowerCase().includes(query.toLowerCase())
    );
    if (matchedIncident) {
      const lat = Number(matchedIncident.latitude);
      const lng = Number(matchedIncident.longitude);
      setCameraTarget({ lat, lng, zoom: 14, ts: Date.now() });
      setSelectedItem({ kind: 'incident', data: matchedIncident, lat, lng });
      setSearchFeedback(`${matchedIncident.incident_code} (${matchedIncident.locality})`);
      return;
    }

    const matchedShelter = shelters.find(
      (s) =>
        s.name?.toLowerCase().includes(query.toLowerCase()) ||
        s.locality?.toLowerCase().includes(query.toLowerCase())
    );
    if (matchedShelter) {
      const lat = Number(matchedShelter.latitude);
      const lng = Number(matchedShelter.longitude);
      setCameraTarget({ lat, lng, zoom: 14, ts: Date.now() });
      setSelectedItem({ kind: 'shelter', data: matchedShelter, lat, lng });
      setSearchFeedback(matchedShelter.name);
      return;
    }

    setSearchFeedback(t('map.noMatchingMarkers'));
  };

  const handleResetView = () => {
    setCategoryFilter('all');
    setSeverityFilter('all');
    setStatusFilter('all');
    setShowShelters(true);
    setMapTypeId('roadmap');
    setSearchQuery('');
    setSearchFeedback('');
    setSelectedItem(null);
    setCameraTarget({
      lat: EAST_GODAVARI_CENTER.lat,
      lng: EAST_GODAVARI_CENTER.lng,
      zoom: EAST_GODAVARI_CENTER.zoom,
      ts: Date.now(),
    });
  };

  return (
    <div className="space-y-4">
      {/* Mandatory Point-Report & Visibility Disclaimer */}
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3">
        <div className="flex items-start gap-2.5 text-xs leading-relaxed text-slate-700">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#0B2545]" aria-hidden="true" />
          <p>
            <strong className="text-[#0B2545]">{t('map.disclaimerTitle')}:</strong>{' '}
            {t('map.disclaimerText')}{' '}
            {isAuthenticated ? t('map.citizenSubtitle') : t('map.publicSubtitle')}
          </p>
        </div>
        {isDemoMode ? <DemoDataBadge compact /> : null}
      </div>

      {/* Controls & Filters Panel */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {/* Location Search */}
          <form onSubmit={handleLocationSearch} className="flex flex-1 max-w-md items-center gap-2">
            <div className="relative flex-1">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('map.searchPlaceholder')}
                aria-label={t('common.search')}
                className="w-full rounded-md border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-[#0B2545] placeholder:text-slate-400 focus:border-[#13A89E] focus:outline-none"
              />
            </div>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-md bg-[#0B2545] px-3.5 py-2 text-sm font-semibold text-white hover:bg-[#13315C] transition-colors shrink-0"
            >
              <span>{t('common.search')}</span>
            </button>
          </form>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 mr-1">
              <Filter className="h-3.5 w-3.5" aria-hidden="true" />
              {t('common.filter')}:
            </span>

            <select
              aria-label={t('map.filterType')}
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-[#0B2545] focus:border-[#13A89E] focus:outline-none"
            >
              <option value="all">{t('map.allTypes')}</option>
              {categories.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>

            <select
              aria-label={t('map.filterSeverity')}
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-[#0B2545] focus:border-[#13A89E] focus:outline-none"
            >
              <option value="all">{t('map.allSeverities')}</option>
              <option value="critical">{t('severity.critical')}</option>
              <option value="high">{t('severity.high')}</option>
              <option value="medium">{t('severity.moderate')}</option>
              <option value="low">{t('severity.low')}</option>
            </select>

            {isAuthenticated ? (
              <select
                aria-label={t('map.filterStatus')}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-[#0B2545] focus:border-[#13A89E] focus:outline-none"
              >
                <option value="all">{t('map.allStatuses')}</option>
                <option value="verified">{t('status.verified')}</option>
                <option value="pending_verification">{t('status.pending_verification')}</option>
                <option value="own">{t('map.popupYourReport')}</option>
              </select>
            ) : null}

            <div className="inline-flex items-center rounded-md border border-slate-300 bg-white p-0.5 text-xs">
              <Layers className="ml-1.5 mr-1 h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
              {['roadmap', 'terrain', 'hybrid'].map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setMapTypeId(mode)}
                  className={`rounded px-2 py-1 text-xs font-medium capitalize transition-colors ${
                    mapTypeId === mode
                      ? 'bg-[#0B2545] text-white'
                      : 'text-slate-600 hover:text-[#0B2545]'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>

            <button
              type="button"
              aria-pressed={showShelters}
              onClick={() => setShowShelters((prev) => !prev)}
              className={`inline-flex min-h-[34px] items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-semibold transition-colors shrink-0 ${
                showShelters
                  ? 'border-[#0B2545] bg-[#0B2545] text-white'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{t('map.toggleShelters', { count: shelters.length })}</span>
            </button>

            <button
              type="button"
              onClick={handleResetView}
              className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors shrink-0"
              title={t('map.resetView')}
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{t('common.reset')}</span>
            </button>
          </div>
        </div>

        {/* Quick Locality Jump + Visible Count */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2.5 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-slate-500 font-medium">{t('common.area')}:</span>
            {['Rajahmundry Urban', 'Dowleswaram', 'Kadiam', 'Korukonda', 'Kovvur'].map((loc) => (
              <button
                key={loc}
                type="button"
                onClick={() => {
                  const c = EAST_GODAVARI_COORDS[loc];
                  setCameraTarget({ lat: c.lat, lng: c.lng, zoom: 13, ts: Date.now() });
                  setSearchFeedback(`${loc}, East Godavari`);
                }}
                className="rounded border border-slate-200 bg-[#F4F6F8] px-2 py-0.5 text-xs font-medium text-[#0B2545] hover:border-[#13A89E] hover:bg-white transition-colors"
              >
                {loc.replace(' Urban', '')}
              </button>
            ))}
          </div>

          <span className="text-slate-600 tabular-nums">
            {t('map.visibleSummary', {
              incidents: formatNumber(filteredIncidents.length),
              shelters: formatNumber(showShelters ? shelters.length : 0),
            })}
          </span>
        </div>

        {searchFeedback ? (
          <p className="text-xs font-medium text-[#0E857D]">{searchFeedback}</p>
        ) : null}
      </div>

      {/* Interactive Google Maps Platform Container */}
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <ErrorBoundary sectionName={t('nav.liveMap')} compact>
          <div className={`w-full ${heightClass} min-h-[380px] relative`}>
            {MAPS_API_KEY ? (
              <APIProvider apiKey={MAPS_API_KEY} language={activeLang} region="IN">
                <GoogleMap
                  mapId="DEMO_MAP_ID"
                  defaultCenter={{ lat: EAST_GODAVARI_CENTER.lat, lng: EAST_GODAVARI_CENTER.lng }}
                  defaultZoom={EAST_GODAVARI_CENTER.zoom}
                  mapTypeId={mapTypeId}
                  gestureHandling="greedy"
                  streetViewControl={false}
                  fullscreenControl
                  internalUsageAttributionIds={GMP_ATTRIBUTION_IDS}
                  onClick={() => setSelectedItem(null)}
                  style={{ width: '100%', height: '100%' }}
                >
                  <MapCameraController target={cameraTarget} />

                  {/* Flood Incident Advanced Markers */}
                  {filteredIncidents.map((inc) => {
                    const lat = Number(inc.latitude);
                    const lng = Number(inc.longitude);
                    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
                    const effectiveSeverity = inc.reviewed_priority || inc.severity || 'medium';
                    const palette = SEVERITY_COLORS[effectiveSeverity] || SEVERITY_COLORS.medium;

                    return (
                      <AdvancedMarker
                        key={inc.id}
                        position={{ lat, lng }}
                        title={`${inc.incident_code || ''} ${inc.title || ''}`.trim()}
                        onClick={() => setSelectedItem({ kind: 'incident', data: inc, lat, lng })}
                      >
                        <Pin
                          background={palette.bg}
                          borderColor={palette.border}
                          glyphColor={palette.glyph}
                          scale={effectiveSeverity === 'critical' ? 1.18 : 1.0}
                        />
                      </AdvancedMarker>
                    );
                  })}

                  {/* Relief Shelter Advanced Markers */}
                  {showShelters
                    ? shelters.map((sh) => {
                        const lat = Number(sh.latitude);
                        const lng = Number(sh.longitude);
                        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

                        return (
                          <AdvancedMarker
                            key={sh.id}
                            position={{ lat, lng }}
                            title={sh.name}
                            onClick={() => setSelectedItem({ kind: 'shelter', data: sh, lat, lng })}
                          >
                            <div className="flex h-8 w-8 items-center justify-center rounded-md border-2 border-[#13A89E] bg-[#0B2545] text-white shadow-md">
                              <Building2 className="h-4 w-4" aria-hidden="true" />
                            </div>
                          </AdvancedMarker>
                        );
                      })
                    : null}

                  {/* Anchored InfoWindow for Selected Incident or Shelter */}
                  {selectedItem ? (
                    <InfoWindow
                      position={{ lat: selectedItem.lat, lng: selectedItem.lng }}
                      maxWidth={310}
                      onCloseClick={() => setSelectedItem(null)}
                    >
                      {selectedItem.kind === 'incident' ? (
                        <div className="space-y-2 py-0.5 text-[#0B2545] max-w-[280px]">
                          <div className="flex flex-wrap items-center justify-between gap-1.5">
                            <span className="font-mono text-xs font-semibold text-[#0E857D] tabular-nums">
                              {selectedItem.data.incident_code}
                            </span>
                            <OriginBadge origin={selectedItem.data.info_origin} />
                          </div>

                          <p className="text-sm font-bold leading-snug text-[#0B2545]">
                            {selectedItem.data.title}
                          </p>

                          <div className="flex flex-wrap items-center gap-1.5">
                            <SeverityBadge
                              severity={selectedItem.data.reviewed_priority || selectedItem.data.severity}
                            />
                            <StatusBadge status={selectedItem.data.status} kind="incident" />
                          </div>

                          <div className="space-y-1 border-t border-slate-200 pt-2 text-xs text-slate-700">
                            <p>
                              <strong>{t('common.type')}:</strong>{' '}
                              {getIncidentCategoryLabel(selectedItem.data.category)}
                            </p>
                            <p>
                              <strong>{t('map.popupLocation')}:</strong>{' '}
                              {selectedItem.data.location_text}, {selectedItem.data.locality}
                            </p>
                            <p>
                              <strong>{t('map.popupReportedAt')}:</strong>{' '}
                              <span className="tabular-nums">
                                {formatTimestamp(
                                  selectedItem.data.observed_at || selectedItem.data.created_at
                                )}
                              </span>
                            </p>
                            <p className="mt-1.5 leading-relaxed text-slate-600">
                              {selectedItem.data.description}
                            </p>
                          </div>

                          {Array.isArray(selectedItem.data.photo_urls) &&
                          selectedItem.data.photo_urls[0] ? (
                            <img
                              src={selectedItem.data.photo_urls[0]}
                              alt={selectedItem.data.incident_code}
                              referrerPolicy="no-referrer"
                              className="mt-2 h-28 w-full rounded border border-slate-200 object-cover"
                            />
                          ) : null}

                          <p className="border-t border-slate-100 pt-1.5 text-[11px] text-slate-500">
                            {t('map.legendReportsNote')}
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2 py-0.5 text-[#0B2545] max-w-[270px]">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-semibold uppercase tracking-wide text-[#0E857D]">
                              {t('map.legendShelter')}
                            </span>
                            <OriginBadge origin={selectedItem.data.info_origin} />
                          </div>
                          <p className="text-sm font-bold leading-snug">{selectedItem.data.name}</p>
                          <p className="text-xs text-slate-600">
                            {selectedItem.data.address} ({selectedItem.data.locality})
                          </p>
                          {(() => {
                            const sh = selectedItem.data;
                            const pct =
                              sh.capacity > 0
                                ? Math.min(100, Math.round((sh.current_occupancy / sh.capacity) * 100))
                                : 0;
                            return (
                              <div className="pt-1">
                                <div className="flex justify-between text-xs font-medium tabular-nums">
                                  <span>{t('map.popupShelterCapacity')}</span>
                                  <span>
                                    {formatNumber(sh.current_occupancy)} / {formatNumber(sh.capacity)} ({pct}%)
                                  </span>
                                </div>
                                <div className="mt-1 h-1.5 w-full rounded bg-slate-200 overflow-hidden">
                                  <div
                                    className="h-full bg-[#13A89E]"
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })()}
                          {Array.isArray(selectedItem.data.amenities) &&
                          selectedItem.data.amenities.length > 0 ? (
                            <p className="text-xs text-slate-600">
                              <strong>{t('map.popupShelterFacilities')}:</strong>{' '}
                              {selectedItem.data.amenities.join(' · ')}
                            </p>
                          ) : null}
                          {selectedItem.data.contact_officer_name ? (
                            <p className="text-[11px] text-slate-500">
                              {t('map.popupShelterContact')}: {selectedItem.data.contact_officer_name}
                            </p>
                          ) : null}
                        </div>
                      )}
                    </InfoWindow>
                  ) : null}
                </GoogleMap>
              </APIProvider>
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center bg-[#F4F6F8] p-6 text-center">
                <AlertTriangle className="h-8 w-8 text-[#C06310]" aria-hidden="true" />
                <p className="mt-2 text-sm font-semibold text-[#0B2545]">
                  Google Maps Platform API key is not available in this environment.
                </p>
                <p className="mt-1 max-w-md text-xs text-slate-600">
                  Set <code className="font-mono">VITE_GOOGLE_MAPS_API_KEY</code> to load interactive East Godavari flood maps.
                </p>
              </div>
            )}
          </div>
        </ErrorBoundary>

        {/* Map Legend Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-[#F4F6F8] px-4 py-2.5 text-xs text-slate-700">
          <div className="flex flex-wrap items-center gap-4">
            <span className="font-semibold text-[#0B2545]">{t('map.legendTitle')}:</span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-sm bg-[#DC2626] inline-block" /> {t('severity.critical')}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-sm bg-[#F28C28] inline-block" /> {t('severity.high')}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-sm bg-[#D97706] inline-block" /> {t('severity.moderate')}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-sm bg-[#13A89E] inline-block" /> {t('severity.low')}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-sm bg-[#0B2545] border border-[#13A89E] inline-block" />{' '}
              {t('map.legendShelter')}
            </span>
            {isAuthenticated ? (
              <span className="inline-flex items-center gap-1.5 text-slate-600">
                <MapPin className="h-3.5 w-3.5 text-slate-500" />
                {t('map.popupYourReport')}
              </span>
            ) : null}
          </div>
          <span className="text-[11px] text-slate-500">Google Maps Platform · East Godavari</span>
        </div>
      </div>
    </div>
  );
}
