import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FilePlus2, Siren } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { dataService } from '../services/dataService';
import { FloodIncidentMap } from '../components/map/FloodIncidentMap';
import { ErrorState, LoadingState } from '../components/common/StateFeedback';

export function PublicMapPage() {
  const { t } = useTranslation();
  const { user, role, isAuthenticated, isDemoMode } = useAuth();
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

  const loadMapData = async () => {
    setLoading(true);
    setError('');
    try {
      const [mapIncidents, shelterList] = await Promise.all([
        dataService.getMapIncidents({
          userId: isAuthenticated ? user?.id : null,
          role: isAuthenticated ? role : null,
        }),
        dataService.getShelters(),
      ]);
      setIncidents(mapIncidents);
      setShelters(shelterList);
    } catch (err) {
      setError(err?.message || t('errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMapData();
  }, [isAuthenticated, user?.id, role]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-semibold text-[#0E857D]">
            {t('map.publicEyebrow')}
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#0B2545] sm:text-3xl">
            {t('map.publicTitle')}
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm text-slate-600">
            {t('map.publicSubtitle')}
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5 shrink-0">
          <Link
            to={isAuthenticated ? '/dashboard/citizen/emergency' : '/login'}
            className="inline-flex items-center gap-2 rounded-md bg-[#F28C28] px-4 py-2.5 text-sm font-bold text-[#0B2545] hover:bg-[#D97316] hover:text-white transition-colors"
          >
            <Siren className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{t('landing.ctaRequestHelp')}</span>
          </Link>
          <Link
            to={isAuthenticated ? '/dashboard/citizen/report' : '/register'}
            className="inline-flex items-center gap-2 rounded-md bg-[#0B2545] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#13315C] transition-colors"
          >
            <FilePlus2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{t('landing.ctaReport')}</span>
          </Link>
        </div>
      </div>

      {loading ? (
        <LoadingState message={t('common.loading')} />
      ) : error ? (
        <ErrorState message={error} onRetry={loadMapData} />
      ) : (
        <FloodIncidentMap
          incidents={incidents}
          shelters={shelters}
          isAuthenticated={isAuthenticated}
          isDemoMode={isDemoMode}
          initialFocus={initialFocus}
          heightClass="h-[540px]"
        />
      )}
    </div>
  );
}
