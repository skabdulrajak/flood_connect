import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, Loader2, Sparkles } from 'lucide-react';
import { EAST_GODAVARI_LOCALITIES, formatNumber } from '../../utils/constants';
import { summarizeAreaReports } from '../../services/aiService';
import { OriginBadge } from '../common/Badges';
import { AiFallbackNotice } from './AiFallbackNotice';
import { TranslateTextBlock } from './TranslateTextBlock';

/**
 * Admin Area Summary panel (Stage 5, Feature 5).
 * Summarizes ONLY real stored incidents & emergency requests in the selected area.
 * Never invents incidents, rainfall totals, or river levels.
 */
export function AdminAreaSummaryPanel({ incidents = [], emergencyRequests = [] }) {
  const { t } = useTranslation();
  const [selectedArea, setSelectedArea] = useState('All East Godavari');
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState(null);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const res = await summarizeAreaReports({
        areaLabel: selectedArea,
        incidents,
        emergencyRequests,
      });
      setSummary(res);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#0E857D]" aria-hidden="true" />
            <h3 className="text-sm font-bold text-[#0B2545]">
              {t('admin.aiAreaSummaryTitle')}
            </h3>
            <OriginBadge origin="ai_suggested" />
          </div>
          <p className="mt-1 text-xs text-slate-600">{t('admin.aiAreaSummaryDesc')}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label={t('admin.selectAreaLabel')}
            value={selectedArea}
            onChange={(e) => setSelectedArea(e.target.value)}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-[#0B2545] focus:border-[#13A89E] focus:outline-none"
          >
            <option value="All East Godavari">{t('admin.allEastGodavari')}</option>
            {EAST_GODAVARI_LOCALITIES.map((loc) => (
              <option key={loc} value={loc}>
                {loc}
              </option>
            ))}
          </select>

          <button
            type="button"
            disabled={loading}
            onClick={handleGenerate}
            className="inline-flex items-center gap-1.5 rounded-md bg-[#0B2545] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#13315C] disabled:opacity-60 transition-colors"
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FileText className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            <span>{loading ? t('admin.generatingSummary') : t('admin.generateSummary')}</span>
          </button>
        </div>
      </div>

      {summary ? (
        <div className="rounded-md border border-slate-200 bg-[#F4F6F8] p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-[#0B2545]">
                {summary.areaLabel === 'All East Godavari'
                  ? t('admin.allEastGodavari')
                  : summary.areaLabel}
              </span>
              <span className="rounded border border-slate-200 bg-white px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-700 tabular-nums">
                {t('admin.summarySourceCount', { count: formatNumber(summary.reportCount) })} ·{' '}
                {formatNumber(summary.verifiedCount)} {t('status.verified')} ·{' '}
                {formatNumber(summary.pendingCount)} {t('status.pending')}
              </span>
              {summary.emergencyCount > 0 ? (
                <span className="rounded border border-[#F28C28]/40 bg-[#FEF5EC] px-2 py-0.5 font-mono text-[11px] font-semibold text-[#9A4D09] tabular-nums">
                  {formatNumber(summary.emergencyCount)} {t('nav.emergencyRequests')}
                </span>
              ) : null}
            </div>
            <span className="text-[11px] font-semibold text-slate-600">
              {t('common.humanReviewRequired')}
            </span>
          </div>

          <AiFallbackNotice
            usedFallback={summary.usedFallback}
            notice={summary.fallbackNotice}
            compact
          />

          <TranslateTextBlock text={summary.summaryText} label={t('admin.aiAreaSummaryTitle')} />

          {summary.referencedCodes && summary.referencedCodes.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px]">
              <span className="font-semibold text-slate-600">{t('common.source')}:</span>
              {summary.referencedCodes.slice(0, 12).map((code) => (
                <span
                  key={code}
                  className="rounded border border-slate-300 bg-white px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[#0B2545] tabular-nums"
                >
                  {code}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
