import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { DemoDataBadge } from '../../components/common/Badges';

export function ResetPasswordPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const demoToken = searchParams.get('token') || '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [completed, setCompleted] = useState(false);

  const { resetPassword, isDemoMode } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (newPassword.length < 8) {
      setErrorMsg(t('validation.passwordMin8'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg(t('validation.passwordMismatch'));
      return;
    }

    setSubmitting(true);
    try {
      await resetPassword({ newPassword, token: demoToken });
      setCompleted(true);
      showToast({
        title: t('auth.passwordUpdatedTitle'),
        message: t('auth.passwordUpdatedSuccess'),
        type: 'success',
      });
    } catch (err) {
      setErrorMsg(err?.message || t('errors.authError'));
    } finally {
      setSubmitting(false);
    }
  };

  if (completed) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
        <div className="inline-flex rounded-md bg-emerald-50 p-2.5 text-emerald-700">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <h2 className="mt-4 text-xl font-bold text-[#0B2545]">
          {t('auth.passwordUpdatedTitle')}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          {t('auth.passwordUpdatedSuccess')}
        </p>
        <button
          type="button"
          onClick={() => navigate('/auth', { replace: true })}
          className="mt-6 w-full rounded-md bg-[#0B2545] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#13315C] transition-colors"
        >
          {t('auth.signInButton')}
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[#0B2545]">
            {t('auth.resetTitle')}
          </h2>
          <p className="mt-1 text-sm text-slate-600">{t('auth.resetSubtitle')}</p>
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
          <label htmlFor="reset-password" className="block text-sm font-semibold text-[#0B2545]">
            {t('auth.newPasswordLabel')}
          </label>
          <input
            id="reset-password"
            type="password"
            required
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder={t('auth.passwordMin8Placeholder')}
            className="mt-1.5 block w-full rounded-md border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-[#0B2545] focus:border-[#13A89E] focus:outline-none"
          />
        </div>

        <div>
          <label htmlFor="reset-confirm" className="block text-sm font-semibold text-[#0B2545]">
            {t('auth.confirmPasswordLabel')}
          </label>
          <input
            id="reset-confirm"
            type="password"
            required
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder={t('auth.confirmPasswordPlaceholder')}
            className="mt-1.5 block w-full rounded-md border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-[#0B2545] focus:border-[#13A89E] focus:outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-[#0B2545] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#13315C] transition-colors disabled:opacity-60"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          <span>{submitting ? t('auth.updatingPassword') : t('auth.updatePasswordButton')}</span>
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-600">
        <Link to="/auth" className="font-semibold text-[#0E857D] hover:text-[#0B2545] hover:underline">
          {t('auth.backToLogin')}
        </Link>
      </p>
    </div>
  );
}
