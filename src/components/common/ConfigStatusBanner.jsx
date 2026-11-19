import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Info } from 'lucide-react';
import { envConfig, getConfigDiagnosticItems } from '../../utils/envConfig';
import { dataService } from '../../services/dataService';
import { DemoDataBadge } from './Badges';

/**
 * Displays a transparent operational banner whenever Demo Mode is active
 * (hidden when live Firebase Auth + Firestore session is active).
 */
export function ConfigStatusBanner() {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  if (dataService.isFirebaseMode()) return null;

  const shouldShow = envConfig.isDemoMode;
  if (!shouldShow) return null;

  const diagnosticItems = getConfigDiagnosticItems();
  const hasMissingSupabase = envConfig.missingSupabaseVars.length > 0;
  const hasMissingAi = false;

  return (
    <div
      role="region"
      aria-label={t('demo.missingConfigTitle')}
      className="border-b border-[#F28C28]/35 bg-[#FFFBF5] text-[#0B2545]"
    >
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-2 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center gap-2.5 text-xs sm:text-sm">
          {envConfig.isDemoMode ? <DemoDataBadge compact /> : null}

          <span className="inline-flex items-center gap-1.5 text-slate-800">
            {hasMissingSupabase ? (
              <>
                <AlertTriangle className="h-4 w-4 shrink-0 text-[#C06310]" aria-hidden="true" />
                <span>
                  {t('demo.missingEnvPrefix')}{' '}
                  <code className="font-mono text-xs font-semibold text-[#0B2545]">
                    {envConfig.missingSupabaseVars.join(', ')}
                  </code>{' '}
                  — {t('demo.bannerDescription')}
                </span>
              </>
            ) : envConfig.explicitDemoMode ? (
              <>
                <Info className="h-4 w-4 shrink-0 text-[#0E857D]" aria-hidden="true" />
                <span>
                  <code className="font-mono text-xs font-semibold">VITE_DEMO_MODE=true</code> —{' '}
                  {t('demo.bannerDescription')}
                </span>
              </>
            ) : hasMissingAi ? (
              <>
                <Info className="h-4 w-4 shrink-0 text-[#C06310]" aria-hidden="true" />
                <span>
                  {t('demo.missingEnvPrefix')}{' '}
                  <code className="font-mono text-xs font-semibold">VITE_GEMINI_API_KEY</code> —{' '}
                  {t('common.aiUnavailableTitle')}
                </span>
              </>
            ) : null}
          </span>
        </div>

        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-[#0B2545] hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
          aria-expanded={expanded}
        >
          <span>{expanded ? t('demo.hideDiagnostics') : t('demo.viewDiagnostics')}</span>
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
      </div>

      {expanded ? (
        <div className="border-t border-[#F28C28]/25 bg-white">
          <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-sm font-semibold text-[#0B2545]">
                  {t('demo.missingConfigTitle')}
                </p>
                <p className="mt-1 text-xs text-slate-600 max-w-2xl">
                  {t('demo.bannerDescription')}
                </p>
              </div>
              <div className="text-xs text-slate-600 font-mono">
                <strong className="text-[#0B2545]">{envConfig.activeDataLayer}</strong>
              </div>
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {diagnosticItems.map((item) => (
                <div
                  key={item.name}
                  className="rounded-md border border-slate-200 bg-[#F4F6F8] p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <code className="font-mono text-xs font-semibold text-[#0B2545] truncate">
                      {item.name}
                    </code>
                    {item.configured ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 whitespace-nowrap shrink-0">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {t('demo.configured')}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#C06310] whitespace-nowrap shrink-0">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        {t('demo.missing')}
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-600">{item.purpose}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
