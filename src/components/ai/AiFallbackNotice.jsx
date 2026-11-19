import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';

/**
 * Displays a transparent notice whenever Gemini AI is unavailable (missing
 * VITE_GEMINI_API_KEY or API error) and deterministic basic rules were used.
 */
export function AiFallbackNotice({ usedFallback, compact = false }) {
  const { t } = useTranslation();
  if (!usedFallback) return null;

  return (
    <div
      role="status"
      className={`flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 text-amber-900 ${
        compact ? 'px-2.5 py-1.5 text-[11px]' : 'px-3 py-2 text-xs'
      }`}
    >
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700" aria-hidden="true" />
      <span>
        <strong>{t('common.aiUnavailableTitle')}</strong> — {t('common.aiUnavailableMessage')}
      </span>
    </div>
  );
}
