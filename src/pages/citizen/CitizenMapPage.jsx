import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FilePlus2, Siren } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { dataService } from '../../services/dataService';
import { FloodIncidentMap } from '../../components/map/FloodIncidentMap';
import { ErrorState, LoadingState } from '../../components/common/StateFeedback';

export function CitizenMapPage() {
  const { t } = useTranslation();
  const { user, role, isDemoMode } = useAuth();
  const [searchParams] = useSearchParams();

  const [incidents, setIncidents] = useState([]);
  const [shelters, setShelters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const focusLat = Number(searchParams.get('lat'));
  const focusLng = Number(searchParams.get('lng'));
  const initialFocus =
    Number.isFinite(focusLat) && Number.isFinite(focusLng) && focusLat !== 0 && focusLng !== 0
      ? { lat: focusLat, lng: focusLng, zoom: 14 }
      : null;

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [mapIncidents, shelterList] = await Promise.all([
        dataService.getMapIncidents({ userId: user?.id, role }),
        dataService.getShelters(),
      ]);
      setIncidents(mapIncidents);
      setShelters(shelterList);
    } catch (err) {
      setError(err?.message || t('errors.loadMapFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user?.id, role]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[#0B2545]">
            {t('map.citizenMapTitle')}
          </h2>
          <p className="text-xs text-slate-600">
            {t('map.citizenMapSubtitle')}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            to="/dashboard/citizen/report"
            className="inline-flex items-center gap-1.5 rounded-md bg-[#0B2545] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#13315C] transition-colors shrink-0"
          >
            <FilePlus2 className="h-3.5 w-3.5" />
            <span>{t('nav.reportIncident')}</span>
          </Link>
          <Link
            to="/dashboard/citizen/emergency"
            className="inline-flex items-center gap-1.5 rounded-md bg-[#F28C28] px-3.5 py-2 text-xs font-bold text-[#0B2545] hover:bg-[#D97316] hover:text-white transition-colors shrink-0"
          >
            <Siren className="h-3.5 w-3.5" />
            <span>{t('nav.emergencyHelp')}</span>
          </Link>
        </div>
      </div>

      {loading ? (
        <LoadingState message={t('map.loadingInteractiveMap')} />
      ) : error ? (
        <ErrorState message={error} onRetry={loadData} />
      ) : (
        <FloodIncidentMap
          incidents={incidents}
          shelters={shelters}
          isAuthenticated
          isDemoMode={isDemoMode}
          initialFocus={initialFocus}
          heightClass="h-[540px]"
        />
      )}
    </div>
  );
}
