import { useTranslation } from 'react-i18next';
import { Check, XCircle } from 'lucide-react';
import { getEmergencyTrackerSteps } from '../../utils/constants';

/**
 * Displays the 6-status lifecycle of an Emergency Assistance Request:
 * pending -> verified -> assigned -> rescue_in_progress -> resolved -> closed
 * Also handles the 'cancelled' state transparently.
 */
export function EmergencyStatusTracker({ status = 'pending', compact = false }) {
  const { t } = useTranslation();
  const steps = getEmergencyTrackerSteps();

  if (status === 'cancelled') {
    return (
      <div className="flex items-center gap-2 rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700">
        <XCircle className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
        <span>{t('status.cancelled')}</span>
      </div>
    );
  }

  const currentIdx = Math.max(
    0,
    steps.findIndex((step) => step.key === status)
  );

  return (
    <div aria-label={t('emergency.trackerTitle')} className="w-full">
      <ol className={`grid grid-cols-2 gap-2 ${compact ? 'sm:grid-cols-6' : 'sm:grid-cols-3 lg:grid-cols-6'}`}>
        {steps.map((step, idx) => {
          const isCompleted = idx < currentIdx || (idx === currentIdx && (status === 'resolved' || status === 'closed'));
          const isCurrent = idx === currentIdx;

          return (
            <li
              key={step.key}
              className={`rounded-md border px-2.5 py-2 transition-colors ${
                isCurrent
                  ? 'border-[#0B2545] bg-[#0B2545] text-white'
                  : isCompleted
                  ? 'border-emerald-600/35 bg-emerald-50 text-emerald-900'
                  : 'border-slate-200 bg-[#F4F6F8] text-slate-500'
              }`}
            >
              <div className="flex items-center justify-between gap-1.5">
                <span className="font-mono text-[11px] font-semibold tabular-nums">
                  {idx + 1}/6
                </span>
                {isCompleted ? (
                  <Check
                    className={`h-3.5 w-3.5 shrink-0 ${isCurrent ? 'text-[#13A89E]' : 'text-emerald-700'}`}
                    aria-hidden="true"
                  />
                ) : null}
              </div>
              <p className="mt-1 text-xs font-bold leading-snug">{step.label}</p>
              {!compact ? (
                <p
                  className={`mt-0.5 text-[11px] leading-snug ${
                    isCurrent ? 'text-slate-200' : isCompleted ? 'text-emerald-800/90' : 'text-slate-500'
                  }`}
                >
                  {step.description}
                </p>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
