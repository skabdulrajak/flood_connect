import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CloudRain, Compass, Info, Landmark, RefreshCw, Waves } from 'lucide-react';
import { OriginBadge } from '../common/Badges';
import { ErrorState, LoadingState } from '../common/StateFeedback';
import { dataService } from '../../services/dataService';
import { formatTimestamp } from '../../utils/constants';

export const OFFICIAL_INFO_CATEGORIES = [
  {
    key: 'rainfall',
    i18nKey: 'alerts.officialCategories.rainfall',
    label: 'Rainfall Bulletins',
    icon: CloudRain,
  },
  {
    key: 'forecast',
    i18nKey: 'alerts.officialCategories.forecast',
    label: 'Weather Forecasts',
    icon: Compass,
  },
  {
    key: 'river_level',
    i18nKey: 'alerts.officialCategories.river_level',
    label: 'Godavari River Levels',
    icon: Waves,
  },
];

/**
 * Strictly adheres to Ground Rule 6:
 * NEVER fabricates rainfall, forecasts, or river levels.
 * Displays localized "Live official data is currently unavailable." unless a District Admin
 * has manually published a sourced entry with publication time.
 */
export function OfficialInformationSection({ compact = false, showHeader = true }) {
  const { t } = useTranslation();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadEntries = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const list = await dataService.getOfficialInformation({ includeInactive: false });
      setEntries(list);
    } catch (err) {
      setError(err?.message || t('errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 sm:p-6 space-y-5">
      {showHeader ? (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Landmark className="h-5 w-5 text-[#0B2545]" aria-hidden="true" />
              <h2 className="text-lg font-bold text-[#0B2545]">
                {t('alerts.officialInfoPageTitle')}
              </h2>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              {t('alerts.officialInfoPageSubtitle')}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <OriginBadge origin="official_government" />
            <button
              type="button"
              onClick={loadEntries}
              className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>{t('common.refresh')}</span>
            </button>
          </div>
        </div>
      ) : null}

      {loading ? (
        <LoadingState message={t('common.loading')} />
      ) : error ? (
        <ErrorState message={error} onRetry={loadEntries} />
      ) : (
        <div className={`grid gap-4 ${compact ? 'md:grid-cols-3' : 'lg:grid-cols-3'}`}>
          {OFFICIAL_INFO_CATEGORIES.map((cat) => {
            const IconComp = cat.icon;
            const catLabel = t(cat.i18nKey, { defaultValue: cat.label });
            const catEntries = entries.filter((e) => e.category === cat.key);
            return (
              <div
                key={cat.key}
                className="flex flex-col rounded-lg border border-slate-200 bg-[#F4F6F8] p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="rounded-md bg-white p-1.5 border border-slate-200 text-[#0B2545]">
                      <IconComp className="h-4 w-4" aria-hidden="true" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-[#0B2545]">{catLabel}</h3>
                    </div>
                  </div>
                </div>

                {catEntries.length === 0 ? (
                  <div className="flex-1 rounded-md border border-slate-200 bg-white p-3.5 flex items-start gap-2 text-xs text-slate-600">
                    <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#0B2545]" aria-hidden="true" />
                    <div>
                      <p className="font-semibold text-[#0B2545]">
                        {t('alerts.liveOfficialUnavailable')}
                      </p>
                      <p className="mt-1 leading-relaxed text-slate-500">
                        {t('alerts.liveOfficialUnavailableDetail')}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2.5 flex-1">
                    {catEntries.map((item) => (
                      <article
                        key={item.id}
                        className="rounded-md border border-slate-200 bg-white p-3.5 space-y-1.5"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-1.5">
                          <span className="text-xs font-bold text-[#0B2545]">{item.title}</span>
                          {item.metric_value ? (
                            <span className="rounded border border-[#0B2545]/20 bg-[#F4F6F8] px-2 py-0.5 font-mono text-xs font-bold text-[#0B2545] tabular-nums">
                              {item.metric_value}
                            </span>
                          ) : null}
                        </div>
                        <p className="text-xs leading-relaxed text-slate-700">{item.summary}</p>
                        <div className="border-t border-slate-100 pt-1.5 text-[11px] text-slate-500 space-y-0.5">
                          <p>
                            <strong className="text-slate-700">{t('common.area')}:</strong>{' '}
                            {item.station_or_area}
                          </p>
                          <p>
                            <strong className="text-slate-700">{t('common.source')}:</strong>{' '}
                            {item.source_agency}
                          </p>
                          <p className="font-mono tabular-nums">
                            {t('alerts.lastPublished', { time: formatTimestamp(item.published_at) })}
                          </p>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
