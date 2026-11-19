import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  APIProvider,
  AdvancedMarker,
  Map as GoogleMap,
  Pin,
  useMap,
} from '@vis.gl/react-google-maps';
import { LocateFixed } from 'lucide-react';
import { EAST_GODAVARI_CENTER } from '../../utils/constants';

const MAPS_API_KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '').trim();
const GMP_ATTRIBUTION_IDS = ['gmp_mcp_codeassist_v1_aistudio'];

function PickerCameraSync({ lat, lng }) {
  const map = useMap();
  useEffect(() => {
    if (map && Number.isFinite(lat) && Number.isFinite(lng)) {
      map.panTo({ lat, lng });
      if ((map.getZoom() || 10) < 13) {
        map.setZoom(13);
      }
    }
  }, [lat, lng, map]);
  return null;
}

export function LocationPickerMap({ latitude, longitude, onChange, heightClass = 'h-64' }) {
  const { t, i18n } = useTranslation();
  const [locating, setLocating] = useState(false);

  const latNum = Number(latitude);
  const lngNum = Number(longitude);
  const hasValidCoords =
    Number.isFinite(latNum) &&
    Number.isFinite(lngNum) &&
    latNum !== 0 &&
    lngNum !== 0;

  const activeLang = ['en', 'hi', 'te'].includes(i18n.language) ? i18n.language : 'en';

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation || locating) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onChange({
          lat: Number(pos.coords.latitude.toFixed(6)),
          lng: Number(pos.coords.longitude.toFixed(6)),
        });
        setLocating(false);
      },
      () => {
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  return (
    <div className="overflow-hidden rounded-lg border border-slate-300 bg-white">
      <div className={`w-full ${heightClass} min-h-[240px]`}>
        {MAPS_API_KEY ? (
          <APIProvider apiKey={MAPS_API_KEY} language={activeLang} region="IN">
            <GoogleMap
              mapId="DEMO_MAP_ID"
              defaultCenter={
                hasValidCoords
                  ? { lat: latNum, lng: lngNum }
                  : { lat: EAST_GODAVARI_CENTER.lat, lng: EAST_GODAVARI_CENTER.lng }
              }
              defaultZoom={hasValidCoords ? 13 : EAST_GODAVARI_CENTER.zoom}
              gestureHandling="greedy"
              streetViewControl={false}
              internalUsageAttributionIds={GMP_ATTRIBUTION_IDS}
              onClick={(ev) => {
                const ll = ev.detail?.latLng;
                if (ll && Number.isFinite(ll.lat) && Number.isFinite(ll.lng)) {
                  onChange({
                    lat: Number(ll.lat.toFixed(6)),
                    lng: Number(ll.lng.toFixed(6)),
                  });
                }
              }}
              style={{ width: '100%', height: '100%' }}
            >
              {hasValidCoords ? (
                <>
                  <PickerCameraSync lat={latNum} lng={lngNum} />
                  <AdvancedMarker position={{ lat: latNum, lng: lngNum }} title="Selected location">
                    <Pin background="#0B2545" borderColor="#13A89E" glyphColor="#FFFFFF" />
                  </AdvancedMarker>
                </>
              ) : null}
            </GoogleMap>
          </APIProvider>
        ) : (
          <div className="flex h-full items-center justify-center bg-[#F4F6F8] p-4 text-xs text-slate-600">
            Configure <code className="mx-1 font-mono">VITE_GOOGLE_MAPS_API_KEY</code> to pick coordinates on Google Maps.
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-[#F4F6F8] px-3 py-2 text-xs text-slate-600">
        <span>{t('map.clickToPickPin')}</span>
        <div className="flex items-center gap-3">
          {hasValidCoords ? (
            <span className="font-mono font-semibold text-[#0B2545] tabular-nums">
              {latNum.toFixed(5)}, {lngNum.toFixed(5)}
            </span>
          ) : (
            <span className="text-slate-500">{t('common.notProvided')}</span>
          )}
          <button
            type="button"
            onClick={handleUseCurrentLocation}
            disabled={locating}
            className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-[#0B2545] hover:border-[#13A89E] transition-colors disabled:opacity-60"
          >
            <LocateFixed className="h-3.5 w-3.5 text-[#13A89E]" aria-hidden="true" />
            <span>{locating ? t('common.loading') : t('incident.detectGps', { defaultValue: 'GPS' })}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
