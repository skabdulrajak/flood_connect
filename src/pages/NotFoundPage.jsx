import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Compass } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { getDashboardPathForRole } from '../utils/constants';

export function NotFoundPage() {
  const { t } = useTranslation();
  const { isAuthenticated, role } = useAuth();

  return (
    <div className="flex min-h-[65vh] items-center justify-center px-4 py-16">
      <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-8 text-center">
        <div className="mx-auto inline-flex rounded-lg bg-[#F4F6F8] p-3 text-[#0B2545]">
          <Compass className="h-6 w-6" aria-hidden="true" />
        </div>
        <p className="mt-4 font-mono text-xs font-semibold text-[#0E857D]">
          {t('errors.notFoundCode')}
        </p>
        <h1 className="mt-1 text-xl font-bold text-[#0B2545]">{t('errors.notFoundTitle')}</h1>
        <p className="mt-2 text-sm text-slate-600">{t('errors.notFoundMessage')}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            to={isAuthenticated ? getDashboardPathForRole(role) : '/auth'}
            className="rounded-md bg-[#0B2545] px-4 py-2 text-sm font-semibold text-white hover:bg-[#13315C] transition-colors"
          >
            {isAuthenticated ? t('landing.ctaGoDashboard') : t('auth.signInButton')}
          </Link>
        </div>
      </div>
    </div>
  );
}
