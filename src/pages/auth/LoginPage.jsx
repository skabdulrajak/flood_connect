import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertCircle, Eye, EyeOff, KeyRound, Loader2 } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { dataService } from '../../services/dataService';
import { getDashboardPathForRole, getRoleMeta } from '../../utils/constants';
import { DemoDataBadge } from '../../components/common/Badges';

export function LoginPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const { signIn, isDemoMode } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const demoAccounts = isDemoMode ? dataService.getDemoAccountsList() : [];
  const redirectTarget = location.state?.from || '';

  const performSignIn = async (targetEmail, targetPassword) => {
    setErrorMsg('');
    if (!targetEmail.trim() || !targetPassword) {
      setErrorMsg(t('validation.emailAndPasswordRequired'));
      return;
    }

    setSubmitting(true);
    try {
      const result = await signIn({ email: targetEmail, password: targetPassword });
      const rolePath = getDashboardPathForRole(result.profile?.role);
      const roleLabel = getRoleMeta(result.profile?.role).label;

      showToast({
        title: t('auth.signedInAs', { role: roleLabel }),
        message: t('dashboard.welcome', {
          name: result.profile?.full_name || result.user?.email,
        }),
        type: 'success',
      });

      if (redirectTarget && redirectTarget.startsWith('/profile')) {
        navigate(redirectTarget, { replace: true });
      } else if (redirectTarget && redirectTarget.startsWith(rolePath)) {
        navigate(redirectTarget, { replace: true });
      } else {
        navigate(rolePath, { replace: true });
      }
    } catch (err) {
      setErrorMsg(err?.message || t('errors.authError'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await performSignIn(email, password);
  };

  const handleQuickDemoFill = (account) => {
    setEmail(account.email);
    setPassword(account.password);
    setErrorMsg('');
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[#0B2545]">
            {t('auth.loginTitle')}
          </h2>
          <p className="mt-1 text-sm text-slate-600">{t('auth.loginSubtitle')}</p>
        </div>
        {isDemoMode ? <DemoDataBadge compact /> : null}
      </div>

      {errorMsg ? (
        <div
          role="alert"
          className="mt-5 flex items-start gap-2.5 rounded-md border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-800"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-700" aria-hidden="true" />
          <span>{errorMsg}</span>
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
        <div>
          <label htmlFor="login-email" className="block text-sm font-semibold text-[#0B2545]">
            {t('auth.emailLabel')}
          </label>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('auth.emailPlaceholder')}
            className="mt-1.5 block w-full rounded-md border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-[#0B2545] placeholder:text-slate-400 focus:border-[#13A89E] focus:outline-none"
          />
        </div>

        <div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label htmlFor="login-password" className="block text-sm font-semibold text-[#0B2545]">
              {t('auth.passwordLabel')}
            </label>
            <Link
              to="/forgot-password"
              className="text-xs font-semibold text-[#0E857D] hover:text-[#0B2545] hover:underline"
            >
              {t('auth.forgotPasswordLink')}
            </Link>
          </div>
          <div className="relative mt-1.5">
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('auth.passwordPlaceholder')}
              className="block w-full rounded-md border border-slate-300 bg-white px-3.5 py-2.5 pr-10 text-sm text-[#0B2545] placeholder:text-slate-400 focus:border-[#13A89E] focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
              className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-500 hover:text-[#0B2545]"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-md bg-[#0B2545] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#13315C] transition-colors disabled:opacity-60"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          <span>{submitting ? t('auth.signingIn') : t('auth.signInButton')}</span>
        </button>
      </form>

      {/* Demo Mode Quick Role Access */}
      {isDemoMode && demoAccounts.length > 0 ? (
        <div className="mt-6 border-t border-slate-200 pt-5">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#0B2545]">
            <KeyRound className="h-4 w-4 text-[#C06310] shrink-0" aria-hidden="true" />
            <span>{t('auth.demoQuickSignIn')}</span>
          </div>
          <p className="mt-1 text-xs text-slate-600">{t('auth.demoQuickSignInDesc')}</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {demoAccounts.map((acct) => (
              <button
                key={acct.email}
                type="button"
                onClick={() => handleQuickDemoFill(acct)}
                className="flex flex-col items-start rounded-md border border-slate-200 bg-[#F4F6F8] px-3 py-2 text-left hover:border-[#13A89E] hover:bg-white transition-colors"
              >
                <span className="text-xs font-semibold text-[#0B2545]">
                  {getRoleMeta(acct.role).label}
                </span>
                <span className="mt-0.5 w-full truncate font-mono text-[11px] text-slate-500">
                  {acct.email}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <p className="mt-6 text-center text-sm text-slate-600">
        {t('auth.noAccountPrompt')}{' '}
        <Link to="/register" className="font-semibold text-[#0E857D] hover:text-[#0B2545] hover:underline">
          {t('auth.createAccountLink')}
        </Link>
      </p>
    </div>
  );
}
