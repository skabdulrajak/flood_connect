import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertCircle, CheckCircle2, Info, Loader2 } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useLanguage } from '../../hooks/useLanguage';
import { useToast } from '../../hooks/useToast';
import {
  DEFAULT_DISTRICT,
  EAST_GODAVARI_LOCALITIES,
  getDashboardPathForRole,
  LANGUAGES,
} from '../../utils/constants';
import { DemoDataBadge } from '../../components/common/Badges';

export function RegisterPage() {
  const { t } = useTranslation();
  const { language, setLanguage } = useLanguage();
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    preferredLanguage: language || 'en',
    district: DEFAULT_DISTRICT,
    locality: EAST_GODAVARI_LOCALITIES[0],
    accountType: 'citizen', // Strictly 'citizen' or 'volunteer' (pending admin approval)
    password: '',
    confirmPassword: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [confirmationSent, setConfirmationSent] = useState(false);

  const { signUp, isDemoMode } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const validate = () => {
    if (!form.fullName.trim()) return t('validation.nameMinLength');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      return t('validation.emailInvalid');
    }
    if (form.phone.trim() && form.phone.trim().length < 10) {
      return t('validation.phoneInvalid');
    }
    if (!form.locality.trim()) return t('validation.locationRequired');
    if (form.password.length < 8) return t('validation.passwordMin8');
    if (form.password !== form.confirmPassword) return t('validation.passwordMismatch');
    return '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    const validationError = validate();
    if (validationError) {
      setErrorMsg(validationError);
      return;
    }

    setSubmitting(true);
    try {
      const result = await signUp(form);
      if (result.needsEmailConfirmation) {
        setConfirmationSent(true);
        showToast({
          title: t('auth.registerSuccessTitle'),
          message: t('auth.registerConfirmEmail'),
          type: 'success',
        });
        return;
      }

      await setLanguage(form.preferredLanguage, { persistToProfile: false });
      const targetPath = getDashboardPathForRole(result.profile?.role);
      showToast({
        title: t('auth.registerSuccessTitle'),
        message:
          form.accountType === 'volunteer'
            ? t('auth.volunteerPendingNote')
            : t('auth.registerSuccessMessage'),
        type: 'success',
      });
      navigate(targetPath, { replace: true });
    } catch (err) {
      setErrorMsg(err?.message || t('errors.authError'));
    } finally {
      setSubmitting(false);
    }
  };

  if (confirmationSent) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
        <div className="inline-flex rounded-md bg-emerald-50 p-2.5 text-emerald-700">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <h2 className="mt-4 text-xl font-bold text-[#0B2545]">{t('auth.confirmEmailTitle')}</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          {t('auth.confirmEmailBody', { email: form.email })}
        </p>
        <Link
          to="/login"
          className="mt-6 inline-flex w-full items-center justify-center rounded-md bg-[#0B2545] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#13315C] transition-colors"
        >
          {t('auth.signInButton')}
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[#0B2545]">
            {t('auth.registerTitle')}
          </h2>
          <p className="mt-1 text-sm text-slate-600">{t('auth.registerSubtitle')}</p>
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

      <form onSubmit={handleSubmit} className="mt-5 space-y-4" noValidate>
        {/* Account Type Selector */}
        <fieldset>
          <legend className="block text-sm font-semibold text-[#0B2545]">
            {t('auth.roleSelectLabel')}
          </legend>
          <div className="mt-1.5 grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => updateField('accountType', 'citizen')}
              className={`rounded-md border px-3 py-2.5 text-left transition-colors ${
                form.accountType === 'citizen'
                  ? 'border-[#0B2545] bg-[#0B2545] text-white'
                  : 'border-slate-300 bg-white text-[#0B2545] hover:bg-slate-50'
              }`}
            >
              <span className="block text-sm font-semibold">{t('nav.roles.citizen')}</span>
              <span
                className={`mt-0.5 block text-[11px] ${
                  form.accountType === 'citizen' ? 'text-slate-200' : 'text-slate-500'
                }`}
              >
                {t('auth.immediateAccess')}
              </span>
            </button>
            <button
              type="button"
              onClick={() => updateField('accountType', 'volunteer')}
              className={`rounded-md border px-3 py-2.5 text-left transition-colors ${
                form.accountType === 'volunteer'
                  ? 'border-[#13A89E] bg-[#13A89E] text-white'
                  : 'border-slate-300 bg-white text-[#0B2545] hover:bg-slate-50'
              }`}
            >
              <span className="block text-sm font-semibold">{t('nav.roles.volunteer')}</span>
              <span
                className={`mt-0.5 block text-[11px] ${
                  form.accountType === 'volunteer' ? 'text-teal-50' : 'text-slate-500'
                }`}
              >
                {t('auth.pendingAdminApproval')}
              </span>
            </button>
          </div>
          <p className="mt-2 flex items-start gap-1.5 text-xs text-slate-500">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#0E857D]" aria-hidden="true" />
            <span>{t('auth.registerRoleNote')}</span>
          </p>
        </fieldset>

        <div>
          <label htmlFor="reg-name" className="block text-sm font-semibold text-[#0B2545]">
            {t('auth.fullNameLabel')}
          </label>
          <input
            id="reg-name"
            type="text"
            required
            value={form.fullName}
            onChange={(e) => updateField('fullName', e.target.value)}
            placeholder={t('auth.fullNamePlaceholder')}
            className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3.5 py-2 text-sm text-[#0B2545] focus:border-[#13A89E] focus:outline-none"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="reg-email" className="block text-sm font-semibold text-[#0B2545]">
              {t('auth.emailLabel')}
            </label>
            <input
              id="reg-email"
              type="email"
              required
              autoComplete="email"
              value={form.email}
              onChange={(e) => updateField('email', e.target.value)}
              placeholder={t('auth.emailPlaceholder')}
              className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3.5 py-2 text-sm text-[#0B2545] focus:border-[#13A89E] focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="reg-phone" className="block text-sm font-semibold text-[#0B2545]">
              {t('auth.phoneLabel')}
            </label>
            <input
              id="reg-phone"
              type="tel"
              autoComplete="tel"
              value={form.phone}
              onChange={(e) => updateField('phone', e.target.value)}
              placeholder={t('auth.phonePlaceholder')}
              className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3.5 py-2 text-sm text-[#0B2545] focus:border-[#13A89E] focus:outline-none"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="reg-lang" className="block text-sm font-semibold text-[#0B2545]">
              {t('auth.preferredLanguageLabel')}
            </label>
            <select
              id="reg-lang"
              value={form.preferredLanguage}
              onChange={(e) => updateField('preferredLanguage', e.target.value)}
              className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-[#0B2545] focus:border-[#13A89E] focus:outline-none"
            >
              {LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="reg-district" className="block text-sm font-semibold text-[#0B2545]">
              {t('profile.district')}
            </label>
            <input
              id="reg-district"
              type="text"
              value={form.district}
              onChange={(e) => updateField('district', e.target.value)}
              className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3.5 py-2 text-sm text-[#0B2545] focus:border-[#13A89E] focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label htmlFor="reg-locality" className="block text-sm font-semibold text-[#0B2545]">
            {t('auth.localityLabel')}
          </label>
          <select
            id="reg-locality"
            value={form.locality}
            onChange={(e) => updateField('locality', e.target.value)}
            className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-[#0B2545] focus:border-[#13A89E] focus:outline-none"
          >
            {EAST_GODAVARI_LOCALITIES.map((loc) => (
              <option key={loc} value={loc}>
                {loc}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="reg-password" className="block text-sm font-semibold text-[#0B2545]">
              {t('auth.passwordLabel')}
            </label>
            <input
              id="reg-password"
              type="password"
              required
              autoComplete="new-password"
              value={form.password}
              onChange={(e) => updateField('password', e.target.value)}
              placeholder={t('auth.passwordMin8Placeholder')}
              className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3.5 py-2 text-sm text-[#0B2545] focus:border-[#13A89E] focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="reg-confirm" className="block text-sm font-semibold text-[#0B2545]">
              {t('auth.confirmPasswordLabel')}
            </label>
            <input
              id="reg-confirm"
              type="password"
              required
              autoComplete="new-password"
              value={form.confirmPassword}
              onChange={(e) => updateField('confirmPassword', e.target.value)}
              placeholder={t('auth.confirmPasswordPlaceholder')}
              className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3.5 py-2 text-sm text-[#0B2545] focus:border-[#13A89E] focus:outline-none"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-md bg-[#0B2545] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#13315C] transition-colors disabled:opacity-60"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          <span>
            {submitting
              ? t('auth.registering')
              : form.accountType === 'volunteer'
              ? t('auth.registerVolunteerButton')
              : t('auth.registerButton')}
          </span>
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-slate-600">
        {t('auth.haveAccountPrompt')}{' '}
        <Link to="/login" className="font-semibold text-[#0E857D] hover:text-[#0B2545] hover:underline">
          {t('auth.signInLink')}
        </Link>
      </p>
    </div>
  );
}
