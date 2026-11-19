import { Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../../hooks/useLanguage';

/**
 * Accessible dropdown language switcher supporting English, Hindi (हिन्दी), and Telugu (తెలుగు).
 * Works across public navbar, auth pages, and all dashboard topbars on both desktop and mobile.
 */
export function LanguageSwitcher({ variant = 'light', className = '', id = 'language-switcher' }) {
  const { t } = useTranslation();
  const { language, setLanguage, languages } = useLanguage();

  const isDark = variant === 'dark';

  return (
    <div className={`inline-flex items-center gap-1.5 ${className}`}>
      <label htmlFor={id} className="sr-only">
        {t('common.selectLanguage')}
      </label>
      <div className="relative inline-flex items-center">
        <Globe
          className={`pointer-events-none absolute left-2.5 h-3.5 w-3.5 ${
            isDark ? 'text-slate-300' : 'text-[#13A89E]'
          }`}
          aria-hidden="true"
        />
        <select
          id={id}
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          aria-label={t('common.selectLanguage')}
          className={`min-h-[34px] cursor-pointer appearance-none rounded-md border py-1 pl-7 pr-6 text-xs font-semibold transition focus:outline-none ${
            isDark
              ? 'border-white/20 bg-white/10 text-white hover:bg-white/15 focus:border-[#13A89E]'
              : 'border-slate-300 bg-white text-[#0B2545] hover:border-slate-400 focus:border-[#13A89E]'
          }`}
        >
          {languages.map((lang) => (
            <option
              key={lang.code}
              value={lang.code}
              className="bg-white text-[#0B2545]"
            >
              {lang.nativeLabel}
            </option>
          ))}
        </select>
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute right-2 text-[10px] ${
            isDark ? 'text-slate-300' : 'text-slate-500'
          }`}
        >
          ▾
        </span>
      </div>
    </div>
  );
}
