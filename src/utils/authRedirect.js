import { getDashboardPathForRole, ROLES } from './constants';

const AUTH_PUBLIC_PREFIXES = ['/auth', '/login', '/register', '/forgot-password', '/reset-password'];

/**
 * Checks whether an authenticated user with `role` is allowed to return to a requested deep link.
 * Never returns an unauthenticated auth path or a route restricted to another role.
 */
export function canRoleAccessPath(role, rawPath) {
  if (!role || !rawPath || typeof rawPath !== 'string') return false;
  const pathname = rawPath.split('?')[0].split('#')[0];

  if (!pathname || pathname === '/') return false;
  if (AUTH_PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return false;
  }

  // Shared authenticated routes accessible to all 4 roles
  if (
    pathname === '/profile' ||
    pathname === '/notifications' ||
    pathname === '/home' ||
    pathname === '/map' ||
    pathname === '/official-info'
  ) {
    return true;
  }

  // Role-restricted dashboard & shorthand paths
  if (pathname === '/admin' || pathname.startsWith('/admin/') || pathname.startsWith('/dashboard/admin')) {
    return role === ROLES.ADMIN;
  }
  if (pathname === '/report' || pathname.startsWith('/dashboard/citizen')) {
    return role === ROLES.CITIZEN;
  }
  if (pathname.startsWith('/dashboard/volunteer')) {
    return role === ROLES.VOLUNTEER;
  }
  if (pathname.startsWith('/dashboard/rescue')) {
    return role === ROLES.RESCUE_TEAM;
  }

  return false;
}

/**
 * Resolves the post-login / post-signup navigation target.
 * Returns the original deep link if the user's role is authorized to access it;
 * otherwise returns the role's primary dashboard route.
 */
export function resolvePostAuthPath(role, deepLink) {
  const defaultPath = getDashboardPathForRole(role);
  if (!deepLink) return defaultPath;

  const pathname = deepLink.split('?')[0];
  if (!canRoleAccessPath(role, deepLink)) {
    return defaultPath;
  }

  // Normalize shorthand deep links to canonical authenticated routes
  if (pathname === '/admin' && role === ROLES.ADMIN) {
    return '/dashboard/admin';
  }
  if (pathname === '/report' && role === ROLES.CITIZEN) {
    return '/dashboard/citizen/report';
  }

  return deepLink;
}

/**
 * Maps Supabase / demo auth errors to clear, localized user-facing messages.
 */
export function mapAuthError(err, t) {
  const code = String(err?.code || '').toLowerCase();
  const msg = String(err?.message || '').toLowerCase();

  if (
    code === 'invalid_credentials' ||
    msg.includes('invalid login credentials') ||
    msg.includes('invalid email or password')
  ) {
    return { message: t('auth.errorInvalidCredentials'), kind: 'credentials' };
  }

  if (
    code === 'email_not_confirmed' ||
    msg.includes('email not confirmed') ||
    msg.includes('confirm your email')
  ) {
    return { message: t('auth.errorUnverifiedEmail'), kind: 'unverified_email' };
  }

  if (
    code === 'user_already_exists' ||
    msg.includes('already registered') ||
    msg.includes('already exists')
  ) {
    return { message: t('auth.errorEmailAlreadyExists'), kind: 'duplicate_email' };
  }

  if (
    msg.includes('failed to fetch') ||
    msg.includes('network') ||
    msg.includes('load failed') ||
    msg.includes('timeout')
  ) {
    return { message: t('auth.errorNetwork'), kind: 'network' };
  }

  return { message: err?.message || t('errors.authError'), kind: 'generic' };
}
