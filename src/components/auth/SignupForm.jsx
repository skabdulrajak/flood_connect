import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertCircle, CheckCircle2, Eye, EyeOff, Info, Loader2, MailCheck } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useLanguage } from '../../hooks/useLanguage';
import { useToast } from '../../hooks/useToast';
import {
  DEFAULT_DISTRICT,
  EAST_GODAVARI_LOCALITIES,
  LANGUAGES,
} from '../../utils/constants';
import { mapAuthError, resolvePostAuthPath } from '../../utils/authRedirect';

export function SignupForm({ onSwitchToLogin }) {
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
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [confirmationSent, setConfirmationSent] = useState(false);
  const [resending, setResending] = useState(false);
  const [resentMessage, setResentMessage] = useState('');

  const { signUp, resendConfirmationEmail } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTarget = location.state?.from || '';

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const validate = () => {
    if (form.fullName.trim().length < 2) return t('validation.nameMinLength');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      return t('validation.emailInvalid');
    }
    const phoneDigits = form.phone.replace(/\D/g, '');
    if (phoneDigits.length < 10) {
      return t('validation.phoneRequired');
    }
    if (!form.district.trim()) return t('validation.districtRequired');
    if (!form.locality.trim()) return t('validation.locationRequired');
    if (form.accountType !== 'citizen' && form.accountType !== 'volunteer') {
      return t('auth.registerRoleNote');
    }
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
        setResentMessage('');
        showToast({
          title: t('auth.confirmAccountHeading'),
          message: t('auth.confirmEmailBody', { email: form.email.trim() }),
          type: 'success',
        });
        return;
      }

      await setLanguage(form.preferredLanguage, { persistToProfile: false });
      const destination = resolvePostAuthPath(result.profile?.role, redirectTarget);
      showToast({
        title: t('auth.registerSuccessTitle'),
        message:
          form.accountType === 'volunteer'
            ? t('auth.volunteerPendingNote')
            : t('auth.registerSuccessMessage'),
        type: 'success',
      });
      navigate(destination, { replace: true });
    } catch (err) {
      setErrorMsg(mapAuthError(err, t).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (resending || !form.email.trim()) return;
    setResending(true);
    setResentMessage('');
    setErrorMsg('');
    try {
      await resendConfirmationEmail(form.email.trim());
      setResentMessage(t('auth.resendSuccessMessage', { email: form.email.trim() }));
      showToast({
        title: t('auth.resendSuccessTitle'),
        message: t('auth.resendSuccessMessage', { email: form.email.trim() }),
        type: 'success',
      });
    } catch (err) {
      setErrorMsg(mapAuthError(err, t).message);
    } finally {
      setResending(false);
    }
  };

  if (confirmationSent) {
    return (
      <div className="space-y-4 py-2 text-center">
        <div className="mx-auto inline-flex rounded-lg bg-emerald-50 p-3 text-emerald-700">
          <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
        </div>
        <div className="space-y-1.5">
          <h3 className="text-lg font-bold text-[#0B2545]">{t('auth.confirmAccountHeading')}</h3>
          <p className="text-sm leading-relaxed text-slate-600">
            {t('auth.confirmEmailBody', { email: form.email.trim() })}
          </p>
        </div>

        {errorMsg ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-left text-xs text-red-800"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-700" aria-hidden="true" />
            <span>{errorMsg}</span>
          </div>
        ) : null}

        {resentMessage ? (
          <div
            role="status"
            className="rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs text-emerald-900"
          >
            {resentMessage}
          </div>
        ) : null}

        <div className="flex flex-col gap-2.5 pt-2">
          <button
            type="button"
            onClick={handleResend}
            disabled={resending}
            className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-[#0B2545] hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#13A89E] transition-colors disabled:opacity-60"
          >
            {resending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <MailCheck className="h-4 w-4 text-[#0E857D]" aria-hidden="true" />
            )}
            <span>{resending ? t('auth.resendingEmail') : t('auth.resendEmailButton')}</span>
          </button>

          <button
            type="button"
            onClick={() => onSwitchToLogin?.()}
            className="inline-flex min-h-[44px] w-full items-center justify-center rounded-lg bg-[#0B2545] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#13315C] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#13A89E] transition-colors"
          >
            {t('auth.backToLogin')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3.5" noValidate>
      {errorMsg ? (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-800"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-700" aria-hidden="true" />
          <span>{errorMsg}</span>
        </div>
      ) : null}

      {/* Account Type Selector: STRICTLY Citizen or Volunteer (pending admin approval) */}
      <fieldset>
        <legend className="block text-sm font-semibold text-[#0B2545]">
          {t('auth.roleSelectLabel')}
        </legend>
        <div className="mt-1.5 grid grid-cols-2 gap-2.5">
          <button
            type="button"
            aria-pressed={form.accountType === 'citizen'}
            onClick={() => updateField('accountType', 'citizen')}
            className={`min-h-[44px] rounded-lg border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#13A89E] ${
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
            aria-pressed={form.accountType === 'volunteer'}
            onClick={() => updateField('accountType', 'volunteer')}
            className={`min-h-[44px] rounded-lg border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#13A89E] ${
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
        <p className="mt-1.5 flex items-start gap-1.5 text-xs text-slate-500">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#0E857D]" aria-hidden="true" />
          <span>{t('auth.registerRoleNote')}</span>
        </p>
      </fieldset>

      <div>
        <label htmlFor="auth-reg-name" className="block text-sm font-semibold text-[#0B2545]">
          {t('auth.fullNameLabel')}
        </label>
        <input
          id="auth-reg-name"
          name="fullName"
          type="text"
          required
          autoComplete="name"
          value={form.fullName}
          onChange={(e) => updateField('fullName', e.target.value)}
          placeholder={t('auth.fullNamePlaceholder')}
          className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-[#0B2545] placeholder:text-slate-400 focus:border-[#13A89E] focus:outline-none focus:ring-2 focus:ring-[#13A89E]/20"
        />
      </div>

      <div className="grid gap-3.5 sm:grid-cols-2">
        <div>
          <label htmlFor="auth-reg-email" className="block text-sm font-semibold text-[#0B2545]">
            {t('auth.emailLabel')}
          </label>
          <input
            id="auth-reg-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            value={form.email}
            onChange={(e) => updateField('email', e.target.value)}
            placeholder={t('auth.emailPlaceholder')}
            className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-[#0B2545] placeholder:text-slate-400 focus:border-[#13A89E] focus:outline-none focus:ring-2 focus:ring-[#13A89E]/20"
          />
        </div>

        <div>
          <label htmlFor="auth-reg-phone" className="block text-sm font-semibold text-[#0B2545]">
            {t('auth.phoneLabel')}
          </label>
          <input
            id="auth-reg-phone"
            name="phone"
            type="tel"
            required
            autoComplete="tel"
            value={form.phone}
            onChange={(e) => updateField('phone', e.target.value)}
            placeholder={t('auth.phonePlaceholder')}
            className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-[#0B2545] placeholder:text-slate-400 focus:border-[#13A89E] focus:outline-none focus:ring-2 focus:ring-[#13A89E]/20"
          />
        </div>
      </div>

      <div className="grid gap-3.5 sm:grid-cols-2">
        <div>
          <label htmlFor="auth-reg-lang" className="block text-sm font-semibold text-[#0B2545]">
            {t('auth.preferredLanguageLabel')}
          </label>
          <select
            id="auth-reg-lang"
            name="preferredLanguage"
            value={form.preferredLanguage}
            onChange={(e) => updateField('preferredLanguage', e.target.value)}
            className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-[#0B2545] focus:border-[#13A89E] focus:outline-none focus:ring-2 focus:ring-[#13A89E]/20"
          >
            {LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="auth-reg-district" className="block text-sm font-semibold text-[#0B2545]">
            {t('profile.district')}
          </label>
          <input
            id="auth-reg-district"
            name="district"
            type="text"
            required
            value={form.district}
            onChange={(e) => updateField('district', e.target.value)}
            className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-[#0B2545] focus:border-[#13A89E] focus:outline-none focus:ring-2 focus:ring-[#13A89E]/20"
          />
        </div>
      </div>

      <div>
        <label htmlFor="auth-reg-locality" className="block text-sm font-semibold text-[#0B2545]">
          {t('auth.localityLabel')}
        </label>
        <select
          id="auth-reg-locality"
          name="locality"
          required
          value={form.locality}
          onChange={(e) => updateField('locality', e.target.value)}
          className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-[#0B2545] focus:border-[#13A89E] focus:outline-none focus:ring-2 focus:ring-[#13A89E]/20"
        >
          {EAST_GODAVARI_LOCALITIES.map((loc) => (
            <option key={loc} value={loc}>
              {loc}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-3.5 sm:grid-cols-2">
        <div>
          <label htmlFor="auth-reg-password" className="block text-sm font-semibold text-[#0B2545]">
            {t('auth.passwordLabel')}
          </label>
          <div className="relative mt-1">
            <input
              id="auth-reg-password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              required
              autoComplete="new-password"
              value={form.password}
              onChange={(e) => updateField('password', e.target.value)}
              placeholder={t('auth.passwordMin8Placeholder')}
              className="block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 pr-10 text-sm text-[#0B2545] placeholder:text-slate-400 focus:border-[#13A89E] focus:outline-none focus:ring-2 focus:ring-[#13A89E]/20"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
              className="absolute inset-y-0 right-0 flex items-center px-2.5 text-slate-500 hover:text-[#0B2545]"
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Eye className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        <div>
          <label htmlFor="auth-reg-confirm" className="block text-sm font-semibold text-[#0B2545]">
            {t('auth.confirmPasswordLabel')}
          </label>
          <div className="relative mt-1">
            <input
              id="auth-reg-confirm"
              name="confirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              required
              autoComplete="new-password"
              value={form.confirmPassword}
              onChange={(e) => updateField('confirmPassword', e.target.value)}
              placeholder={t('auth.confirmPasswordPlaceholder')}
              className="block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 pr-10 text-sm text-[#0B2545] placeholder:text-slate-400 focus:border-[#13A89E] focus:outline-none focus:ring-2 focus:ring-[#13A89E]/20"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((prev) => !prev)}
              aria-label={showConfirmPassword ? t('auth.hidePassword') : t('auth.showPassword')}
              className="absolute inset-y-0 right-0 flex items-center px-2.5 text-slate-500 hover:text-[#0B2545]"
            >
              {showConfirmPassword ? (
                <EyeOff className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Eye className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="mt-2 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg bg-[#0B2545] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#13315C] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#13A89E] focus-visible:ring-offset-2 transition-colors disabled:opacity-60"
      >
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
        <span>
          {submitting
            ? t('auth.registering')
            : form.accountType === 'volunteer'
            ? t('auth.registerVolunteerButton')
            : t('auth.tabSignup')}
        </span>
      </button>
    </form>
  );
}
