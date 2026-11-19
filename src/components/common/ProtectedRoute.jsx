import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { getDashboardPathForRole, getRoleMeta } from '../../utils/constants';
import { LoadingState } from './StateFeedback';

/**
 * Role-based route guard enforcing session + RBAC verification on the frontend
 * alongside Supabase RLS in PostgreSQL.
 * @param {{ roles?: string[], children: React.ReactNode }} props
 */
export function ProtectedRoute({ roles = [], children }) {
  const { t } = useTranslation();
  const { session, isAuthenticated, role, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F4F6F8] p-6">
        <div className="w-full max-w-md">
          <LoadingState message={t('auth.checkingSession')} />
        </div>
      </div>
    );
  }

  if (!session || !isAuthenticated || !role) {
    return (
      <Navigate
        to="/auth"
        state={{ from: `${location.pathname}${location.search || ''}` }}
        replace
      />
    );
  }

  if (roles.length > 0 && !roles.includes(role)) {
    const allowedLabels = roles.map((r) => getRoleMeta(r).label).join(', ');
    const currentLabel = getRoleMeta(role).label;
    const homeDashboard = getDashboardPathForRole(role);

    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F4F6F8] p-6">
        <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="inline-flex rounded-lg bg-red-50 p-3 text-red-700">
            <ShieldAlert className="h-6 w-6" aria-hidden="true" />
          </div>
          <h1 className="mt-4 text-xl font-bold text-[#0B2545]">{t('auth.unauthorizedTitle')}</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            {t('auth.unauthorizedMessage')}
          </p>
          <p className="mt-2 text-xs leading-relaxed text-slate-500">
            {t('common.role')}: <strong className="text-[#0B2545]">{currentLabel}</strong> ·{' '}
            {allowedLabels}
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => navigate(homeDashboard, { replace: true })}
              className="min-h-[42px] rounded-lg bg-[#0B2545] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#13315C] transition-colors shrink-0"
            >
              {t('landing.ctaGoDashboard')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return children;
}
