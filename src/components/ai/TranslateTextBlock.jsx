import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Languages, Loader2 } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useLanguage } from '../../hooks/useLanguage';
import { translateText } from '../../services/aiService';
import { OriginBadge } from '../common/Badges';
import { AiFallbackNotice } from './AiFallbackNotice';

/**
 * Reusable on-demand English <-> Telugu translator for user-generated content.
 * - Respects active UI language & profile.preferred_language.
 * - ALWAYS preserves and displays the original text alongside the AI-suggested translation.
 */
export function TranslateTextBlock({ text, label, compact = false }) {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const { language } = useLanguage();
  const preferredLang = profile?.preferred_language || language || 'en';

  const sourceLooksTelugu = /[\u0C00-\u0C7F]/.test(String(text || ''));
  const defaultTarget = sourceLooksTelugu ? 'en' : 'te';

  const [targetLang, setTargetLang] = useState(defaultTarget);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  if (!text || !String(text).trim()) return null;

  const resolvedLabel = label || t('common.description');

  const runTranslation = async (lang) => {
    setTargetLang(lang);
    setLoading(true);
    try {
      const res = await translateText({ text, targetLanguage: lang });
      setResult(res);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      {/* Original user-generated text is ALWAYS preserved and visible */}
      <p className={compact ? 'text-xs leading-relaxed text-slate-700' : 'text-sm leading-relaxed text-slate-700'}>
        {text}
      </p>

      {/* On-demand Telugu / English controls */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={loading}
          onClick={(e) => {
            e.stopPropagation();
            runTranslation('te');
          }}
          className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-[11px] font-semibold transition-colors disabled:opacity-60 ${
            preferredLang === 'te'
              ? 'border-[#13A89E] bg-[#ECFAF8] text-[#0A625C] hover:bg-[#13A89E] hover:text-white'
              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
          }`}
        >
          {loading && targetLang === 'te' ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Languages className="h-3 w-3" aria-hidden="true" />
          )}
          <span>{t('common.translateToTelugu')}</span>
        </button>

        <button
          type="button"
          disabled={loading}
          onClick={(e) => {
            e.stopPropagation();
            runTranslation('en');
          }}
          className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-[11px] font-semibold transition-colors disabled:opacity-60 ${
            preferredLang === 'en' && sourceLooksTelugu
              ? 'border-[#13A89E] bg-[#ECFAF8] text-[#0A625C] hover:bg-[#13A89E] hover:text-white'
              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
          }`}
        >
          {loading && targetLang === 'en' ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Languages className="h-3 w-3" aria-hidden="true" />
          )}
          <span>{t('common.translateToEnglish')}</span>
        </button>

        {result ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setResult(null);
            }}
            className="text-[11px] font-medium text-slate-500 hover:text-slate-800 underline"
          >
            {t('common.hideTranslation')}
          </button>
        ) : null}
      </div>

      {result ? (
        <div
          onClick={(e) => e.stopPropagation()}
          className="rounded-md border border-slate-200 bg-[#F4F6F8] p-3 space-y-2"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-[#0B2545]">
              {resolvedLabel} · {result.targetLanguageLabel}
            </span>
            <OriginBadge origin="ai_suggested" />
          </div>

          <AiFallbackNotice
            usedFallback={result.usedFallback}
            notice={result.fallbackNotice}
            compact
          />

          <p className="text-xs leading-relaxed text-[#0B2545]">{result.translatedText}</p>

          <div className="border-t border-slate-200 pt-1.5 text-[11px] text-slate-500">
            <strong className="text-slate-600">{t('common.originalPreserved')}</strong>{' '}
            {result.originalText}
          </div>
        </div>
      ) : null}
    </div>
  );
}
