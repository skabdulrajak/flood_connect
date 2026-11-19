import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, CheckCircle2, Loader2, Lock, Save } from 'lucide-react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../hooks/useLanguage';
import { useToast } from '../hooks/useToast';
import { getNavItemsForRole } from '../utils/dashboardNav';
import {
  DEFAULT_DISTRICT,
  EAST_GODAVARI_LOCALITIES,
  getRoleMeta,
  LANGUAGES,
} from '../utils/constants';

export function ProfilePage() {
  const { t } = useTranslation();
  const { profile, role, updateProfile } = useAuth();
  const { setLanguage } = useLanguage();
  const { showToast } = useToast();

  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    preferred_language: 'en',
    district: DEFAULT_DISTRICT,
    locality: '',
  });
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (profile) {
      setForm({
        full_name: profile.full_name || '',
        phone: profile.phone || '',
        preferred_language: profile.preferred_language || 'en',
        district: profile.district || DEFAULT_DISTRICT,
        locality: profile.locality || EAST_GODAVARI_LOCALITIES[0],
      });
    }
  }, [profile]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!form.full_name.trim()) {
      setErrorMsg(t('validation.nameMinLength'));
      return;
    }

    setSaving(true);
    try {
      await updateProfile(form);
      await setLanguage(form.preferred_language, { persistToProfile: false });
      showToast({
        title: t('profile.saveSuccessTitle'),
        message: t('profile.saveSuccessMessage'),
        type: 'success',
      });
    } catch (err) {
      setErrorMsg(err?.message || t('profile.saveErrorTitle'));
    } finally {
      setSaving(false);
    }
  };

  const navItems = getNavItemsForRole(role);
  const roleInfo = getRoleMeta(role);

  return (
    <DashboardLayout navItems={navItems} pageTitle={t('profile.title')}>
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Editable Profile Form */}
        <section className="lg:col-span-8 rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-bold text-[#0B2545]">{t('profile.accountDetails')}</h2>
          <p className="mt-1 text-sm text-slate-600">{t('profile.subtitle')}</p>

          {errorMsg ? (
            <div
              role="alert"
              className="mt-4 flex items-start gap-2.5 rounded-md border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-800"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-700" />
              <span>{errorMsg}</span>
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="mt-6 space-y-5" noValidate>
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="profile-name" className="block text-sm font-semibold text-[#0B2545]">
                  {t('profile.fullName')}
                </label>
                <input
                  id="profile-name"
                  type="text"
                  required
                  value={form.full_name}
                  onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))}
                  className="mt-1.5 block w-full rounded-md border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-[#0B2545] focus:border-[#13A89E] focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="profile-email" className="block text-sm font-semibold text-[#0B2545]">
                  {t('profile.email')}
                </label>
                <input
                  id="profile-email"
                  type="email"
                  value={profile?.email || ''}
                  disabled
                  className="mt-1.5 block w-full rounded-md border border-slate-200 bg-slate-100 px-3.5 py-2.5 text-sm text-slate-600 cursor-not-allowed"
                />
                <p className="mt-1 text-xs text-slate-500">{t('profile.emailReadOnly')}</p>
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="profile-phone" className="block text-sm font-semibold text-[#0B2545]">
                  {t('profile.phone')}
                </label>
                <input
                  id="profile-phone"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                  placeholder={t('auth.phonePlaceholder')}
                  className="mt-1.5 block w-full rounded-md border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-[#0B2545] focus:border-[#13A89E] focus:outline-none"
                />
                <p className="mt-1 text-xs text-slate-500">
                  {t('emergency.contactPrivacyNote')}
                </p>
              </div>

              <div>
                <label htmlFor="profile-lang" className="block text-sm font-semibold text-[#0B2545]">
                  {t('profile.preferredLanguage')}
                </label>
                <select
                  id="profile-lang"
                  value={form.preferred_language}
                  onChange={(e) => setForm((p) => ({ ...p, preferred_language: e.target.value }))}
                  className="mt-1.5 block w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-[#0B2545] focus:border-[#13A89E] focus:outline-none"
                >
                  {LANGUAGES.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-slate-500">{t('profile.preferredLanguageHint')}</p>
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="profile-district" className="block text-sm font-semibold text-[#0B2545]">
                  {t('profile.district')}
                </label>
                <input
                  id="profile-district"
                  type="text"
                  value={form.district}
                  onChange={(e) => setForm((p) => ({ ...p, district: e.target.value }))}
                  className="mt-1.5 block w-full rounded-md border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-[#0B2545] focus:border-[#13A89E] focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="profile-locality" className="block text-sm font-semibold text-[#0B2545]">
                  {t('profile.locality')}
                </label>
                <select
                  id="profile-locality"
                  value={
                    EAST_GODAVARI_LOCALITIES.includes(form.locality)
                      ? form.locality
                      : EAST_GODAVARI_LOCALITIES[0]
                  }
                  onChange={(e) => setForm((p) => ({ ...p, locality: e.target.value }))}
                  className="mt-1.5 block w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-[#0B2545] focus:border-[#13A89E] focus:outline-none"
                >
                  {EAST_GODAVARI_LOCALITIES.map((loc) => (
                    <option key={loc} value={loc}>
                      {loc}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end border-t border-slate-200 pt-5">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-md bg-[#0B2545] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#13315C] transition-colors disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                <span>{saving ? t('common.saving') : t('profile.saveButton')}</span>
              </button>
            </div>
          </form>
        </section>

        {/* Read-Only Role & Access Summary */}
        <aside className="lg:col-span-4 space-y-5">
          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <div className="flex items-center gap-2 text-sm font-bold text-[#0B2545]">
              <Lock className="h-4 w-4 text-[#13A89E]" aria-hidden="true" />
              <span>{t('profile.roleBadgeLabel')}</span>
            </div>

            <div className="mt-4 space-y-3 text-sm">
              <div>
                <p className="text-xs text-slate-500">{t('common.role')}</p>
                <p className="mt-0.5 font-semibold text-[#0B2545]">{roleInfo.label}</p>
              </div>

              <p className="text-xs leading-relaxed text-slate-600">{roleInfo.description}</p>

              {profile?.volunteer_status && profile.volunteer_status !== 'none' ? (
                <div className="rounded-md border border-slate-200 bg-[#F4F6F8] p-3">
                  <p className="text-xs font-semibold text-[#0B2545]">
                    {t('profile.volunteerStatusLabel')}
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-slate-700">
                    {profile.volunteer_status === 'approved' ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700" />
                    ) : null}
                    <span>{t(`status.${profile.volunteer_status}`, { defaultValue: profile.volunteer_status.replace('_', ' ') })}</span>
                  </p>
                </div>
              ) : null}
            </div>

            <p className="mt-4 border-t border-slate-200 pt-4 text-xs leading-relaxed text-slate-500">
              {t('profile.roleChangeNote')}
            </p>
          </div>
        </aside>
      </div>
    </DashboardLayout>
  );
}
