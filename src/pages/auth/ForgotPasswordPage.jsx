import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertCircle, ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { DemoDataBadge } from '../../components/common/Badges';

export function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [result, setResult] = useState(null);

  const { requestPasswordReset, isDemoMode } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setErrorMsg(t('validation.emailInvalid'));
      return;
    }

    setSubmitting(true);
    try {
      const response = await requestPasswordReset(email);
      setResult(response);
    } catch (err) {
      setErrorMsg(err?.message || t('errors.authError'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[#0B2545]">
            {t('auth.forgotTitle')}
          </h2>
          <p className="mt-1 text-sm text-slate-600">{t('auth.forgotSubtitle')}</p>
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

      {result ? (
        <div className="mt-6 rounded-md border border-emerald-200 bg-emerald-50/70 p-4">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
            <div>
              <p className="text-sm font-semibold text-emerald-900">
                {t('auth.resetProcessedTitle')}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-emerald-800">
                {t('auth.resetEmailSent')}
              </p>
            </div>
          </div>

          {result.demoResetToken ? (
            <div className="mt-4 border-t border-emerald-200 pt-3">
              <p className="text-xs font-medium text-[#0B2545]">
                {t('auth.demoRecoveryLinkLabel')}
              </p>
              <Link
                to={`/reset-password?token=${encodeURIComponent(result.demoResetToken)}`}
                className="mt-2 inline-flex w-full items-center justify-center rounded-md bg-[#13A89E] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0E857D] transition-colors"
              >
                {t('auth.openDemoResetForm')}
              </Link>
            </div>
          ) : null}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
          <div>
            <label htmlFor="forgot-email" className="block text-sm font-semibold text-[#0B2545]">
              {t('auth.emailLabel')}
            </label>
            <input
              id="forgot-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('auth.emailPlaceholder')}
              className="mt-1.5 block w-full rounded-md border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-[#0B2545] focus:border-[#13A89E] focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-[#0B2545] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#13315C] transition-colors disabled:opacity-60"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            <span>{submitting ? t('auth.sendingReset') : t('auth.sendResetLink')}</span>
          </button>
        </form>
      )}

      <div className="mt-6 text-center">
        <Link
          to="/auth"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#0E857D] hover:text-[#0B2545] hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>{t('auth.backToLogin')}</span>
        </Link>
      </div>
    </div>
  );
}
