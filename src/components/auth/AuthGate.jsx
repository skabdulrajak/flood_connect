import { Navigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { BrandLogo } from '../common/BrandLogo';
import { resolvePostAuthPath } from '../../utils/authRedirect';

const PUBLIC_AUTH_ROUTES = new Set(['/auth', '/forgot-password', '/reset-password']);
const LEGACY_AUTH_ROUTES = new Set(['/login', '/register']);

/**
 * Mandatory top-level authentication gate wrapping the entire router.
 *
 * Guarantees:
 * 1. Shows a full-screen branded loading state while checking session persistence so
 *    protected screens NEVER flash before redirecting.
 * 2. Unauthenticated visitors can ONLY access /auth, /forgot-password, and /reset-password
 *    (legacy /login and /register funnel immediately to /auth).
 * 3. Any other URL (/, /home, /map, /report, /admin, /dashboard/*, /profile, etc.)
 *    redirects to /auth while preserving valid deep links in location.state.from.
 * 4. Authenticated users visiting /auth, /login, or /register are redirected straight
 *    to their role dashboard (or an authorized deep link).
 */
export function AuthGate({ children }) {
  const { t } = useTranslation();
  const { session, isAuthenticated, role, loading } = useAuth();
  const location = useLocation();

  const pathname = location.pathname;
  const fullPath = `${location.pathname}${location.search || ''}`;
  const isPublicAuthPath = PUBLIC_AUTH_ROUTES.has(pathname);
  const isLegacyAuthPath = LEGACY_AUTH_ROUTES.has(pathname);

  if (loading) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex min-h-screen flex-col items-center justify-center bg-[#F4F6F8] px-4 py-10"
      >
        <div className="flex w-full max-w-sm flex-col items-center rounded-xl border border-slate-200 bg-white px-8 py-10 text-center shadow-sm">
          <BrandLogo size="md" />
          <div className="mt-6 flex items-center gap-2.5 text-sm font-medium text-[#0B2545]">
            <Loader2 className="h-4 w-4 animate-spin text-[#13A89E]" aria-hidden="true" />
            <span>{t('auth.checkingSession')}</span>
          </div>
          <p className="mt-2 text-xs text-slate-500">{t('auth.verifyingAccessNote')}</p>
        </div>
      </div>
    );
  }

  const hasValidSession = Boolean(session && isAuthenticated && role);

  // Unauthenticated visitor gate
  if (!hasValidSession) {
    if (isPublicAuthPath) {
      return children;
    }

    if (pathname === '/register') {
      return <Navigate to="/auth?tab=signup" state={location.state} replace />;
    }

    if (pathname === '/login') {
      return <Navigate to="/auth" state={location.state} replace />;
    }

    if (pathname === '/') {
      return <Navigate to="/auth" replace />;
    }

    // Any protected or unknown URL redirects to /auth with deep-link preserved
    return <Navigate to="/auth" state={{ from: fullPath }} replace />;
  }

  // Authenticated user visiting /auth, /login, or /register -> redirect to dashboard or allowed deep link
  if (pathname === '/auth' || isLegacyAuthPath) {
    const requestedFrom = location.state?.from || '';
    const destination = resolvePostAuthPath(role, requestedFrom);
    return <Navigate to={destination} replace />;
  }

  return children;
}
