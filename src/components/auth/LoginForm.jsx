import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertCircle, CheckCircle2, Eye, EyeOff, Loader2, MailCheck } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { getRoleMeta } from '../../utils/constants';
import { mapAuthError, resolvePostAuthPath } from '../../utils/authRedirect';

export function LoginForm() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorState, setErrorState] = useState({ message: '', kind: '' });
  const [resending, setResending] = useState(false);
  const [resentOk, setResentOk] = useState(false);

  const { signIn, resendConfirmationEmail, isDemoMode } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const redirectTarget = location.state?.from || '';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorState({ message: '', kind: '' });
    setResentOk(false);

    if (!email.trim() || !password) {
      setErrorState({ message: t('validation.emailAndPasswordRequired'), kind: 'validation' });
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setErrorState({ message: t('validation.emailInvalid'), kind: 'validation' });
      return;
    }

    setSubmitting(true);
    try {
      const result = await signIn({ email: email.trim(), password });
      const userRole = result.profile?.role;
      const destination = resolvePostAuthPath(userRole, redirectTarget);
      const roleLabel = getRoleMeta(userRole).label;

      showToast({
        title: t('auth.signedInAs', { role: roleLabel }),
        message: t('dashboard.welcome', {
          name: result.profile?.full_name || result.user?.email,
        }),
        type: 'success',
      });

      navigate(destination, { replace: true });
    } catch (err) {
      setErrorState(mapAuthError(err, t));
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendVerification = async () => {
    if (!email.trim() || resending) return;
    setResending(true);
    setResentOk(false);
    try {
      await resendConfirmationEmail(email.trim());
      setResentOk(true);
      showToast({
        title: t('auth.resendSuccessTitle'),
        message: t('auth.resendSuccessMessage', { email: email.trim() }),
        type: 'success',
      });
    } catch (err) {
      setErrorState(mapAuthError(err, t));
    } finally {
      setResending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {errorState.message ? (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-800 space-y-2"
        >
          <div className="flex items-start gap-2.5">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-700" aria-hidden="true" />
            <span>{errorState.message}</span>
          </div>
          {errorState.kind === 'unverified_email' && !isDemoMode ? (
            <div className="pl-6">
              <button
                type="button"
                onClick={handleResendVerification}
                disabled={resending}
                className="inline-flex items-center gap-1.5 rounded-md border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-800 hover:bg-red-100/60 transition-colors disabled:opacity-60"
              >
                {resending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <MailCheck className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                <span>{resending ? t('auth.resendingEmail') : t('auth.resendEmailButton')}</span>
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {resentOk ? (
        <div
          role="status"
          className="flex items-start gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-xs text-emerald-900"
        >
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
          <span>{t('auth.resendSuccessMessage', { email: email.trim() })}</span>
        </div>
      ) : null}

      <div>
        <label htmlFor="auth-login-email" className="block text-sm font-semibold text-[#0B2545]">
          {t('auth.emailLabel')}
        </label>
        <input
          id="auth-login-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('auth.emailPlaceholder')}
          className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-[#0B2545] placeholder:text-slate-400 focus:border-[#13A89E] focus:outline-none focus:ring-2 focus:ring-[#13A89E]/20"
        />
      </div>

      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label htmlFor="auth-login-password" className="block text-sm font-semibold text-[#0B2545]">
            {t('auth.passwordLabel')}
          </label>
          <Link
            to="/forgot-password"
            className="text-xs font-semibold text-[#0E857D] hover:text-[#0B2545] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#13A89E] rounded"
          >
            {t('auth.forgotPasswordLink')}
          </Link>
        </div>
        <div className="relative mt-1.5">
          <input
            id="auth-login-password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t('auth.passwordPlaceholder')}
            className="block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 pr-11 text-sm text-[#0B2545] placeholder:text-slate-400 focus:border-[#13A89E] focus:outline-none focus:ring-2 focus:ring-[#13A89E]/20"
          />
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
            className="absolute inset-y-0 right-0 flex min-w-[40px] items-center justify-center px-3 text-slate-500 hover:text-[#0B2545] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#13A89E] rounded-r-lg"
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Eye className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="mt-2 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg bg-[#0B2545] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#13315C] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#13A89E] focus-visible:ring-offset-2 transition-colors disabled:opacity-60"
      >
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
        <span>{submitting ? t('auth.signingIn') : t('auth.tabLogin')}</span>
      </button>
    </form>
  );
}
