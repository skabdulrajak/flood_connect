import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Building2, MapPin, RefreshCw, Users } from 'lucide-react';
import { DemoDataBadge, OriginBadge } from '../../components/common/Badges';
import { EmptyState, ErrorState, LoadingState } from '../../components/common/StateFeedback';
import { useAuth } from '../../hooks/useAuth';
import { dataService } from '../../services/dataService';
import { formatNumber } from '../../utils/constants';

const STATUS_STYLES = {
  open: 'bg-emerald-50 text-emerald-800 border-emerald-600/30',
  near_capacity: 'bg-amber-50 text-amber-900 border-amber-500/40',
  full: 'bg-red-50 text-red-800 border-red-600/35',
  closed: 'bg-slate-100 text-slate-600 border-slate-300',
};

export function VolunteerSheltersPage() {
  const { t } = useTranslation();
  const { isDemoMode } = useAuth();
  const [shelters, setShelters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [localityFilter, setLocalityFilter] = useState('all');

  const loadShelters = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const list = await dataService.getShelters();
      setShelters(list);
    } catch (err) {
      setError(err.message || t('errors.loadSheltersFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadShelters();
  }, [loadShelters]);

  const localities = useMemo(
    () => Array.from(new Set(shelters.map((s) => s.locality))).sort(),
    [shelters]
  );

  const filtered = useMemo(
    () =>
      localityFilter === 'all'
        ? shelters
        : shelters.filter((s) => s.locality === localityFilter),
    [shelters, localityFilter]
  );

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-[#0E857D]">{t('shelters.volunteerEyebrow')}</p>
          <h2 className="mt-1 text-lg font-bold text-[#0B2545]">{t('shelters.eastGodavariHeading')}</h2>
          <p className="mt-1 text-sm text-slate-600">{t('shelters.volunteerSubtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isDemoMode ? <DemoDataBadge compact /> : null}
          <select
            aria-label={t('shelters.filterByLocality')}
            value={localityFilter}
            onChange={(e) => setLocalityFilter(e.target.value)}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800"
          >
            <option value="all">
              {t('shelters.allLocalitiesCount', { count: formatNumber(shelters.length) })}
            </option>
            {localities.map((loc) => (
              <option key={loc} value={loc}>
                {loc}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={loadShelters}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>{t('common.refresh')}</span>
          </button>
        </div>
      </section>

      {loading ? (
        <LoadingState message={t('shelters.loadingCapacities')} />
      ) : error ? (
        <ErrorState message={error} onRetry={loadShelters} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Building2}
          title={t('shelters.emptyTitle')}
          description={t('shelters.emptyLocalityDesc')}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {filtered.map((s) => {
            const pct =
              s.capacity > 0 ? Math.min(100, Math.round((s.current_occupancy / s.capacity) * 100)) : 0;
            const openSpots = Math.max(0, s.capacity - s.current_occupancy);
            return (
              <article
                key={s.id}
                className="rounded-lg border border-slate-200 bg-white p-5 space-y-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded border px-2 py-0.5 text-xs font-semibold ${
                      STATUS_STYLES[s.status] || STATUS_STYLES.open
                    }`}
                  >
                    {t(`status.shelter.${s.status}`, { defaultValue: s.status.replace('_', ' ') })}
                  </span>
                  <OriginBadge origin={s.info_origin} />
                </div>

                <div>
                  <h3 className="text-base font-bold text-[#0B2545]">{s.name}</h3>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-600">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    <span>
                      {s.address} · {s.locality}
                    </span>
                  </p>
                </div>

                <div className="rounded-md border border-slate-200 bg-[#F4F6F8] p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-[#0B2545] tabular-nums">
                    <span className="inline-flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5" />
                      {t('shelters.occupiedPct', {
                        occupied: formatNumber(s.current_occupancy),
                        capacity: formatNumber(s.capacity),
                        pct: formatNumber(pct),
                      })}
                    </span>
                    <span className="text-emerald-700">
                      {t('shelters.bedsOpenCount', { count: formatNumber(openSpots) })}
                    </span>
                  </div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                    <div
                      className={`h-full rounded-full ${
                        pct >= 90 ? 'bg-red-600' : pct >= 70 ? 'bg-[#F28C28]' : 'bg-[#13A89E]'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                {s.contact_officer_name ? (
                  <p className="text-xs text-slate-600">
                    <strong>{t('shelters.coordinationDeskLabel')}:</strong> {s.contact_officer_name}
                  </p>
                ) : null}

                {Array.isArray(s.amenities) && s.amenities.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {s.amenities.map((a) => (
                      <span
                        key={a}
                        className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-700"
                      >
                        {a}
                      </span>
                    ))}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
