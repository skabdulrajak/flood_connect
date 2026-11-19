import { Link, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { BrandLogo } from '../components/common/BrandLogo';
import { ConfigStatusBanner } from '../components/common/ConfigStatusBanner';
import { DemoDataBadge } from '../components/common/Badges';
import { LanguageSwitcher } from '../components/common/LanguageSwitcher';
import { useAuth } from '../hooks/useAuth';

/**
 * Centered authentication layout for /forgot-password and /reset-password.
 * Matches AuthPage aesthetic without exposing any public portal routes or flood data.
 */
export function AuthLayout() {
  const { t } = useTranslation();
  const { isDemoMode } = useAuth();

  return (
    <div className="relative flex min-h-screen flex-col bg-[#F4F6F8]">
      <ConfigStatusBanner />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[#0B2545]"
      />

      <header className="relative z-10 mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 pt-5 sm:px-6">
        <div className="flex items-center gap-3">
          <Link
            to="/auth"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-200 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>{t('auth.backToLogin')}</span>
          </Link>
          {isDemoMode ? <DemoDataBadge compact /> : null}
        </div>
        <LanguageSwitcher id="auth-layout-lang" variant="dark" />
      </header>

      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-8 sm:px-6">
        <div className="mb-5 flex flex-col items-center text-center">
          <BrandLogo inverted size="md" />
        </div>

        <div className="w-full max-w-[460px]">
          <Outlet />
        </div>

        {/* Emergency Safety Exception: Plain-text non-interactive emergency helplines strip */}
        <footer className="mt-5 w-full max-w-[460px] text-center">
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-xs text-slate-700">
            <p className="font-semibold text-[#0B2545]">{t('auth.emergencyHelplinesTitle')}</p>
            <p className="mt-1 font-mono tabular-nums text-slate-700">
              {t('auth.emergencyHelplinesStrip')}
            </p>
          </div>
        </footer>
      </main>
    </div>
  );
}
