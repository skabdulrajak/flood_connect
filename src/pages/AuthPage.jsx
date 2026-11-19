import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { KeyRound, Loader2 } from 'lucide-react';
import { BrandLogo } from '../components/common/BrandLogo';
import { ConfigStatusBanner } from '../components/common/ConfigStatusBanner';
import { DemoDataBadge } from '../components/common/Badges';
import { LanguageSwitcher } from '../components/common/LanguageSwitcher';
import { PWAInstallButton } from '../components/pwa/PWAInstallButton';
import { LoginForm } from '../components/auth/LoginForm';
import { SignupForm } from '../components/auth/SignupForm';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { dataService } from '../services/dataService';
import { getRoleMeta } from '../utils/constants';
import { mapAuthError, resolvePostAuthPath } from '../utils/authRedirect';

export function AuthPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') === 'signup' ? 'signup' : 'login';
  const [activeTab, setActiveTab] = useState(initialTab);
  const [demoLoadingRole, setDemoLoadingRole] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);
  const [demoError, setDemoError] = useState('');

  const { signIn, signInWithGoogle, isDemoMode } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const redirectTarget = location.state?.from || '';
  const demoAccounts = isDemoMode ? dataService.getDemoAccountsList() : [];

  useEffect(() => {
    const paramTab = searchParams.get('tab') === 'signup' ? 'signup' : 'login';
    setActiveTab(paramTab);
  }, [searchParams]);

  const switchTab = (nextTab) => {
    setActiveTab(nextTab);
    setDemoError('');
    if (nextTab === 'signup') {
      setSearchParams({ tab: 'signup' }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
  };

  const handleGoogleSignIn = async () => {
    if (googleLoading || demoLoadingRole) return;
    setDemoError('');
    setGoogleLoading(true);
    try {
      const result = await signInWithGoogle();
      const userRole = result.profile?.role;
      const roleLabel = getRoleMeta(userRole).label;
      const destination = resolvePostAuthPath(userRole, redirectTarget);

      showToast({
        title: t('auth.signedInAs', { role: roleLabel }),
        message: t('dashboard.welcome', {
          name: result.profile?.full_name || result.user?.email,
        }),
        type: 'success',
      });

      navigate(destination, { replace: true });
    } catch (err) {
      if (err?.code === 'auth/popup-closed-by-user') {
        setDemoError(t('auth.googlePopupClosed', { defaultValue: 'Google sign-in popup was closed before completing.' }));
      } else {
        setDemoError(err?.message || mapAuthError(err, t).message);
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleQuickDemoLogin = async (account) => {
    if (demoLoadingRole || googleLoading) return;
    setDemoError('');
    setDemoLoadingRole(account.role);
    try {
      const result = await signIn({ email: account.email, password: account.password });
      const userRole = result.profile?.role;
      const roleLabel = getRoleMeta(userRole).label;
      const destination = resolvePostAuthPath(userRole, redirectTarget);

      showToast({
        title: t('auth.signedInAs', { role: roleLabel }),
        message: t('dashboard.welcome', {
          name: result.profile?.full_name || result.user?.email,
        }),
        type: 'success',
      });

      navigate(destination, { replace: true });
    } catch (err) {
      setDemoError(mapAuthError(err, t).message);
    } finally {
      setDemoLoadingRole('');
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col bg-[#F4F6F8]">
      <ConfigStatusBanner />

      {/* Clean Branded Top Backdrop */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[#0B2545]"
      />

      {/* Top Controls Bar: Language Switcher + Demo Badge */}
      <header className="relative z-10 mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 pt-5 sm:px-6">
        <div className="flex items-center gap-2.5">
          {isDemoMode ? <DemoDataBadge compact /> : <span className="sr-only">FloodConnect</span>}
        </div>
        <div className="flex items-center gap-2">
          <PWAInstallButton variant="dark" />
          <LanguageSwitcher id="auth-page-lang" variant="dark" />
        </div>
      </header>

      {/* Centered Modal-Style Auth Card */}
      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-8 sm:px-6">
        <div className="w-full max-w-[460px] rounded-xl border border-slate-200 bg-white p-6 shadow-md sm:p-8">
          {/* Brand Header */}
          <div className="flex flex-col items-center text-center">
            <BrandLogo size="md" />
            <p className="mt-2.5 text-sm text-slate-600">{t('auth.tagline')}</p>
          </div>

          {/* Primary Firebase Google Sign-In */}
          <div className="mt-6">
            <button
              type="button"
              disabled={googleLoading || Boolean(demoLoadingRole)}
              onClick={handleGoogleSignIn}
              className="flex min-h-[44px] w-full items-center justify-center gap-3 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-[#0B2545] shadow-xs hover:border-[#13A89E] hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#13A89E] transition-colors disabled:opacity-60"
            >
              {googleLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-[#13A89E]" aria-hidden="true" />
              ) : (
                <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h6.45a5.52 5.52 0 0 1-2.39 3.62v3h3.87c2.26-2.08 3.56-5.15 3.56-8.65z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.07 7.93-2.91l-3.87-3c-1.07.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.72-4.95H1.28v3.1A12 12 0 0 0 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.29a7.2 7.2 0 0 1 0-4.58v-3.1H1.28a12 12 0 0 0 0 10.78l4-3.1z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.76c1.76 0 3.34.61 4.58 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.28 6.61l4 3.1C6.23 6.87 8.88 4.76 12 4.76z"
                  />
                </svg>
              )}
              <span>
                {t('auth.continueWithGoogle', { defaultValue: 'Continue with Google (Cloud Sync)' })}
              </span>
            </button>
            <p className="mt-1.5 text-center text-[11px] text-slate-500">
              {t('auth.googleSyncNote', {
                defaultValue: 'Persists your reports, rescue updates, and AI chat history securely in Firestore.',
              })}
            </p>
          </div>

          <div className="relative my-5 flex items-center">
            <div className="flex-1 border-t border-slate-200" />
            <span className="px-3 text-xs font-medium text-slate-400">
              {t('auth.orEmailDivider', { defaultValue: 'or email & password' })}
            </span>
            <div className="flex-1 border-t border-slate-200" />
          </div>

          {/* Segmented Tabs: Log in | Sign up */}
          <div
            role="tablist"
            aria-label={t('auth.tabsAriaLabel')}
            className="grid grid-cols-2 gap-1 rounded-lg bg-[#F4F6F8] p-1 border border-slate-200"
          >
            <button
              type="button"
              role="tab"
              id="tab-login"
              aria-selected={activeTab === 'login'}
              aria-controls="panel-login"
              onClick={() => switchTab('login')}
              className={`min-h-[40px] rounded-md px-3 py-2 text-sm font-semibold whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#13A89E] ${
                activeTab === 'login'
                  ? 'bg-[#0B2545] text-white shadow-xs'
                  : 'text-slate-600 hover:text-[#0B2545]'
              }`}
            >
              {t('auth.tabLogin')}
            </button>
            <button
              type="button"
              role="tab"
              id="tab-signup"
              aria-selected={activeTab === 'signup'}
              aria-controls="panel-signup"
              onClick={() => switchTab('signup')}
              className={`min-h-[40px] rounded-md px-3 py-2 text-sm font-semibold whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#13A89E] ${
                activeTab === 'signup'
                  ? 'bg-[#0B2545] text-white shadow-xs'
                  : 'text-slate-600 hover:text-[#0B2545]'
              }`}
            >
              {t('auth.tabSignup')}
            </button>
          </div>

          {/* Active Form Panel */}
          <div
            role="tabpanel"
            id={activeTab === 'login' ? 'panel-login' : 'panel-signup'}
            aria-labelledby={activeTab === 'login' ? 'tab-login' : 'tab-signup'}
            className="mt-6"
          >
            {activeTab === 'login' ? (
              <LoginForm />
            ) : (
              <SignupForm onSwitchToLogin={() => switchTab('login')} />
            )}
          </div>

          {/* Demo Mode Quick Role Login (STRICTLY rendered only when isDemoMode === true) */}
          {isDemoMode && demoAccounts.length > 0 ? (
            <section
              aria-labelledby="quick-demo-login-heading"
              className="mt-6 border-t border-slate-200 pt-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-[#0B2545]">
                  <KeyRound className="h-3.5 w-3.5 text-[#C06310] shrink-0" aria-hidden="true" />
                  <h2 id="quick-demo-login-heading">{t('auth.demoQuickLoginHeading')}</h2>
                </div>
                <span className="text-[11px] font-medium text-[#9A4E0A]">
                  {t('auth.demoAccountsLabel')}
                </span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">
                {t('auth.demoAccountsNotice')}
              </p>

              {demoError ? (
                <p role="alert" className="mt-2 text-xs font-medium text-red-700">
                  {demoError}
                </p>
              ) : null}

              <div className="mt-3 grid grid-cols-2 gap-2">
                {demoAccounts.map((acct) => {
                  const isBusy = demoLoadingRole === acct.role;
                  return (
                    <button
                      key={acct.role}
                      type="button"
                      disabled={Boolean(demoLoadingRole)}
                      onClick={() => handleQuickDemoLogin(acct)}
                      className="flex min-h-[44px] flex-col items-start justify-center rounded-lg border border-slate-200 bg-[#F4F6F8] px-3 py-2 text-left hover:border-[#13A89E] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#13A89E] transition-colors disabled:opacity-60"
                    >
                      <span className="flex w-full items-center justify-between gap-1 text-xs font-semibold text-[#0B2545]">
                        <span className="truncate">{getRoleMeta(acct.role).label}</span>
                        {isBusy ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-[#13A89E] shrink-0" />
                        ) : null}
                      </span>
                      <span className="mt-0.5 block w-full truncate text-[11px] text-slate-500">
                        {t('auth.demoRoleTag')} · {acct.full_name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}
        </div>

        {/* Emergency Safety Exception: Plain-text, non-interactive emergency helplines strip */}
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
