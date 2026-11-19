import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  AlertCircle,
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock,
  Info,
  LifeBuoy,
  Loader2,
  Lock,
  MapPin,
  PhoneCall,
  Send,
  ShieldCheck,
  Siren,
  Users,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { useSubmissionCooldown } from '../hooks/useSubmissionCooldown';
import { dataService } from '../services/dataService';
import {
  DemoDataBadge,
  OriginBadge,
  SeverityBadge,
  StatusBadge,
} from '../components/common/Badges';
import { ErrorState, LoadingState } from '../components/common/StateFeedback';
import {
  EAST_GODAVARI_LOCALITIES,
  formatNumber,
  getDashboardPathForRole,
  HERO_MEDIA,
} from '../utils/constants';
import { validateContactForm } from '../utils/validation';

function EditorialImage({ src, alt, fallbackLabel, fallbackSublabel, className = '' }) {
  const [failed, setFailed] = useState(false);

  if (failed || !src) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-[#0B2545] px-6 py-10 text-center text-white ${className}`}
      >
        <MapPin className="h-8 w-8 text-[#13A89E]" aria-hidden="true" />
        <p className="mt-3 text-sm font-semibold">{fallbackLabel}</p>
        <p className="mt-1 text-xs text-slate-300">{fallbackSublabel}</p>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}

export function LandingPage() {
  const { t } = useTranslation();
  const { isAuthenticated, role, isDemoMode } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState('');

  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    locality: EAST_GODAVARI_LOCALITIES[0],
    topic: 'District Coordination Inquiry',
    message: '',
  });
  const [contactSubmitting, setContactSubmitting] = useState(false);
  const [contactSubmitted, setContactSubmitted] = useState(false);
  const [contactError, setContactError] = useState('');
  const contactCooldown = useSubmissionCooldown('contact_inquiry', 'public');

  const workflowSteps = [
    {
      number: '01',
      title: t('landing.workflowStep1Title'),
      summary: t('landing.workflowStep1Summary'),
      detail: t('landing.workflowStep1Detail'),
    },
    {
      number: '02',
      title: t('landing.workflowStep2Title'),
      summary: t('landing.workflowStep2Summary'),
      detail: t('landing.workflowStep2Detail'),
    },
    {
      number: '03',
      title: t('landing.workflowStep3Title'),
      summary: t('landing.workflowStep3Summary'),
      detail: t('landing.workflowStep3Detail'),
    },
    {
      number: '04',
      title: t('landing.workflowStep4Title'),
      summary: t('landing.workflowStep4Summary'),
      detail: t('landing.workflowStep4Detail'),
    },
  ];

  const roleConnections = [
    {
      role: t('landing.roleCitizenTitle'),
      access: t('landing.roleCitizenAccess'),
      responsibilities: [
        t('landing.roleCitizenPoint1'),
        t('landing.roleCitizenPoint2'),
        t('landing.roleCitizenPoint3'),
      ],
    },
    {
      role: t('landing.roleVolunteerTitle'),
      access: t('landing.roleVolunteerAccess'),
      responsibilities: [
        t('landing.roleVolunteerPoint1'),
        t('landing.roleVolunteerPoint2'),
        t('landing.roleVolunteerPoint3'),
      ],
    },
    {
      role: t('landing.roleRescueTitle'),
      access: t('landing.roleRescueAccess'),
      responsibilities: [
        t('landing.roleRescuePoint1'),
        t('landing.roleRescuePoint2'),
        t('landing.roleRescuePoint3'),
      ],
    },
    {
      role: t('landing.roleAdminTitle'),
      access: t('landing.roleAdminAccess'),
      responsibilities: [
        t('landing.roleAdminPoint1'),
        t('landing.roleAdminPoint2'),
        t('landing.roleAdminPoint3'),
      ],
    },
  ];

  const loadSummary = async () => {
    setSummaryLoading(true);
    setSummaryError('');
    try {
      const data = await dataService.getPublicSummary();
      setSummary(data);
    } catch (err) {
      setSummaryError(err?.message || t('errors.loadFailed'));
    } finally {
      setSummaryLoading(false);
    }
  };

  useEffect(() => {
    loadSummary();
  }, []);

  const handleEmergencyCta = () => {
    if (isAuthenticated) {
      navigate(role === 'citizen' ? '/dashboard/citizen/emergency' : getDashboardPathForRole(role));
    } else {
      navigate('/login', { state: { from: '/dashboard/citizen/emergency' } });
    }
  };

  const handleReportCta = () => {
    if (isAuthenticated) {
      navigate(role === 'citizen' ? '/dashboard/citizen/report' : getDashboardPathForRole(role));
    } else {
      navigate('/register');
    }
  };

  const handleContactSubmit = async (e) => {
    e.preventDefault();
    setContactError('');

    const limitCheck = contactCooldown.checkNow();
    if (!limitCheck.allowed) {
      setContactError(limitCheck.message);
      return;
    }

    const validation = validateContactForm(contactForm);
    if (!validation.isValid) {
      setContactError(validation.firstError);
      return;
    }

    setContactSubmitting(true);
    try {
      await dataService.submitContactInquiry(validation.sanitized);
      contactCooldown.markSubmitted();
      setContactSubmitted(true);
      setContactForm({
        name: '',
        email: '',
        locality: EAST_GODAVARI_LOCALITIES[0],
        topic: 'District Coordination Inquiry',
        message: '',
      });
      showToast({
        title: t('landing.inquiryLoggedTitle'),
        message: t('landing.inquiryLoggedMessage'),
        type: 'success',
      });
    } catch (err) {
      setContactError(err?.message || t('errors.saveFailed'));
    } finally {
      setContactSubmitting(false);
    }
  };

  return (
    <div>
      {/* 1. HERO SECTION */}
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
          <div className="grid gap-10 lg:grid-cols-12 lg:items-stretch">
            {/* Left Proposition Column */}
            <div className="flex flex-col justify-center lg:col-span-6">
              <p className="text-sm font-semibold text-[#0E857D]">
                {t('landing.eyebrow')}
              </p>

              <h1
                className="mt-3 font-display font-bold tracking-tight text-[#0B2545]"
                style={{
                  fontSize: 'clamp(2.1rem, 3.6vw, 3.1rem)',
                  lineHeight: 1.18,
                  textWrap: 'balance',
                }}
              >
                {t('landing.heroTitle')}
              </h1>

              <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg">
                {t('landing.heroSubtitle')}
              </p>

              {/* Emergency + Report CTAs */}
              <div className="mt-8 flex flex-wrap items-center gap-3.5">
                <button
                  type="button"
                  onClick={handleEmergencyCta}
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-[#F28C28] px-5 py-3 text-sm font-bold text-[#0B2545] hover:bg-[#D97316] hover:text-white transition-colors"
                >
                  <Siren className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{t('landing.ctaRequestHelp')}</span>
                </button>

                <button
                  type="button"
                  onClick={handleReportCta}
                  className="inline-flex items-center justify-center gap-2 rounded-md border border-[#0B2545] bg-white px-5 py-3 text-sm font-semibold text-[#0B2545] hover:bg-[#0B2545] hover:text-white transition-colors"
                >
                  <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{t('landing.ctaReport')}</span>
                </button>
              </div>

              <p className="mt-5 text-xs leading-relaxed text-slate-500">
                {t('landing.heroHelplineNote')}
              </p>
            </div>

            {/* Right Documentary Media Anchor */}
            <div className="lg:col-span-6">
              <div className="flex h-full flex-col overflow-hidden rounded-lg border border-slate-200 bg-[#0B2545]">
                <div className="relative flex-1 min-h-[280px] sm:min-h-[340px]">
                  <EditorialImage
                    src={HERO_MEDIA.hero}
                    alt={t('landing.heroMediaAlt')}
                    fallbackLabel={t('landing.heroMediaFallback')}
                    fallbackSublabel={t('common.regionFull')}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 bg-[#0B2545] px-4 py-3 text-xs text-slate-200">
                  <span>{t('landing.heroMediaCaption')}</span>
                  <span className="font-mono text-slate-300">{t('landing.heroMediaLocations')}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Official Data Transparency Strip */}
          <div className="mt-10 grid gap-4 rounded-lg border border-slate-200 bg-[#F4F6F8] p-5 lg:grid-cols-12 lg:items-center">
            <div className="lg:col-span-5">
              <div className="flex items-start gap-2.5">
                <Info className="mt-0.5 h-5 w-5 shrink-0 text-[#0B2545]" aria-hidden="true" />
                <div>
                  <p className="text-sm font-bold text-[#0B2545]">
                    {summary?.liveOfficialDataAvailable && summary?.officialDataMessage
                      ? summary.officialDataMessage
                      : t('alerts.liveOfficialUnavailable')}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">
                    {t('landing.officialTransparencyNote')}
                  </p>
                </div>
              </div>
            </div>

            <div className="lg:col-span-7 lg:border-l lg:border-slate-200 lg:pl-6">
              <p className="text-xs font-semibold text-slate-600">
                {t('landing.originStandardTitle')}
              </p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                <OriginBadge origin="citizen_submitted" />
                <OriginBadge origin="admin_verified" />
                <OriginBadge origin="official_government" />
                <OriginBadge origin="ai_suggested" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. HOW IT WORKS */}
      <section id="how-it-works" className="border-b border-slate-200 bg-[#F4F6F8] py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-[#0E857D]">{t('landing.workflowEyebrow')}</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-[#0B2545] sm:text-3xl">
              {t('landing.howItWorksTitle')}
            </h2>
            <p className="mt-3 text-base leading-relaxed text-slate-600">
              {t('landing.workflowSubtitle')}
            </p>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {workflowSteps.map((step) => (
              <div
                key={step.number}
                className="flex flex-col justify-between rounded-lg border border-slate-200 bg-white p-6"
              >
                <div>
                  <span className="font-mono text-sm font-semibold text-[#13A89E] tabular-nums">
                    {step.number}.
                  </span>
                  <h3 className="mt-2 text-base font-bold text-[#0B2545]">{step.title}</h3>
                  <p className="mt-2.5 text-sm leading-relaxed text-slate-600">{step.summary}</p>
                </div>
                <p className="mt-5 border-t border-slate-100 pt-3.5 text-xs font-medium text-slate-500">
                  {step.detail}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3. CORE CAPABILITIES */}
      <section id="capabilities" className="border-b border-slate-200 bg-white py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-[#0E857D]">{t('landing.capabilitiesEyebrow')}</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-[#0B2545] sm:text-3xl">
              {t('landing.capabilitiesTitle')}
            </h2>
          </div>

          <div className="mt-10 grid gap-6 lg:grid-cols-12">
            {/* Wide Feature 1 */}
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-[#F4F6F8] lg:col-span-7 flex flex-col">
              <div className="aspect-[16/9] w-full overflow-hidden bg-[#0B2545]">
                <EditorialImage
                  src={HERO_MEDIA.fieldBridge}
                  alt={t('landing.cap1ImageAlt')}
                  fallbackLabel={t('landing.cap1ImageFallback')}
                  fallbackSublabel={t('common.regionFull')}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="flex flex-1 flex-col justify-between p-6">
                <div>
                  <h3 className="text-lg font-bold text-[#0B2545]">
                    {t('landing.cap1Title')}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    {t('landing.cap1Desc')}
                  </p>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-600">
                  <OriginBadge origin="citizen_submitted" />
                  <span>{t('landing.reviewedTo')}</span>
                  <OriginBadge origin="admin_verified" />
                </div>
              </div>
            </div>

            {/* Right Stacked Capabilities */}
            <div className="flex flex-col gap-6 lg:col-span-5">
              <div className="flex-1 rounded-lg border border-slate-200 bg-white p-6">
                <Lock className="h-5 w-5 text-[#0B2545]" aria-hidden="true" />
                <h3 className="mt-3 text-lg font-bold text-[#0B2545]">
                  {t('landing.cap2Title')}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  {t('landing.cap2Desc')}
                </p>
              </div>

              <div className="flex-1 rounded-lg border border-slate-200 bg-white p-6">
                <ShieldCheck className="h-5 w-5 text-[#13A89E]" aria-hidden="true" />
                <h3 className="mt-3 text-lg font-bold text-[#0B2545]">
                  {t('landing.cap3Title')}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  {t('landing.cap3Desc')}
                </p>
              </div>
            </div>

            {/* Bottom Row: Multilingual Readiness + Shelter Ops */}
            <div className="flex flex-col justify-between rounded-lg border border-slate-200 bg-white p-6 lg:col-span-5">
              <div>
                <Users className="h-5 w-5 text-[#13A89E]" aria-hidden="true" />
                <h3 className="mt-3 text-lg font-bold text-[#0B2545]">
                  {t('landing.cap4Title')}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  {t('landing.cap4Desc')}
                </p>
              </div>
              <div className="mt-6 border-t border-slate-200 pt-4">
                <Link
                  to="/register"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#0E857D] hover:text-[#0B2545]"
                >
                  <span>{t('landing.cap4Cta')}</span>
                  <ArrowRight className="h-4 w-4 shrink-0" />
                </Link>
              </div>
            </div>

            <div className="overflow-hidden rounded-lg border border-slate-200 bg-[#F4F6F8] lg:col-span-7 grid sm:grid-cols-12">
              <div className="sm:col-span-6 min-h-[220px] bg-[#0B2545]">
                <EditorialImage
                  src={HERO_MEDIA.shelterOps}
                  alt={t('landing.cap5ImageAlt')}
                  fallbackLabel={t('landing.cap5ImageFallback')}
                  fallbackSublabel={t('common.regionFull')}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="sm:col-span-6 flex flex-col justify-center p-6">
                <h3 className="text-lg font-bold text-[#0B2545]">
                  {t('landing.cap5Title')}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  {t('landing.cap5Desc')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. ROLE-BASED COORDINATION */}
      <section id="coordination" className="border-b border-slate-200 bg-[#F4F6F8] py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold text-[#0E857D]">{t('landing.rolesEyebrow')}</p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-[#0B2545] sm:text-3xl">
                {t('landing.rolesTitle')}
              </h2>
              <p className="mt-2 text-base text-slate-600">
                {t('landing.rolesSubtitle')}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/register"
                className="rounded-md bg-[#0B2545] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#13315C] transition-colors"
              >
                {t('auth.registerButton')}
              </Link>
              <Link
                to="/login"
                className="rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-[#0B2545] hover:bg-slate-50 transition-colors"
              >
                {t('landing.responderSignIn')}
              </Link>
            </div>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {roleConnections.map((item) => (
              <div
                key={item.role}
                className="rounded-lg border border-slate-200 bg-white p-6"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-100 pb-3">
                  <h3 className="text-lg font-bold text-[#0B2545]">{item.role}</h3>
                  <span className="text-xs font-medium text-slate-500">{item.access}</span>
                </div>
                <ul className="mt-4 space-y-2.5 text-sm text-slate-700">
                  {item.responsibilities.map((point) => (
                    <li key={point} className="flex items-start gap-2.5">
                      <CheckCircle2
                        className="mt-0.5 h-4 w-4 shrink-0 text-[#13A89E]"
                        aria-hidden="true"
                      />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. PLATFORM ACTIVITY SNAPSHOT */}
      <section className="border-b border-slate-200 bg-white py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-[#0E857D]">
                {t('landing.snapshotEyebrow')}
              </p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight text-[#0B2545] sm:text-3xl">
                {t('landing.snapshotTitle')}
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {isDemoMode || summary?.isDemo ? <DemoDataBadge /> : null}
              <Link
                to="/map"
                className="inline-flex items-center gap-1.5 rounded-md border border-[#0B2545] bg-white px-3.5 py-2 text-xs font-semibold text-[#0B2545] hover:bg-[#0B2545] hover:text-white transition-colors"
              >
                <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>{t('landing.ctaOpenMap')}</span>
              </Link>
            </div>
          </div>

          {isDemoMode || summary?.isDemo ? (
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-[#9A4D09] rounded-md border border-[#F28C28]/40 bg-[#FEF5EC] px-4 py-3">
              <strong>{t('demo.badgeLabel')}:</strong> {t('demo.bannerDescription')}
            </p>
          ) : null}

          <div className="mt-8">
            {summaryLoading ? (
              <LoadingState message={t('common.loading')} />
            ) : summaryError ? (
              <ErrorState message={summaryError} onRetry={loadSummary} />
            ) : summary ? (
              <>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-lg border border-slate-200 bg-[#F4F6F8] p-5">
                    <p className="text-xs font-semibold text-slate-600">
                      {t('landing.statsVerifiedIncidents')}
                    </p>
                    <p className="mt-2 font-mono text-3xl font-bold text-[#0B2545] tabular-nums">
                      {formatNumber(summary.verifiedIncidents)}
                    </p>
                    <p className="mt-1.5 text-xs text-slate-500">
                      {summary.isDemo
                        ? t('landing.statSimulatedPending', {
                            count: formatNumber(summary.pendingIncidents),
                          })
                        : t('landing.statPublicVerified')}
                    </p>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-[#F4F6F8] p-5">
                    <p className="text-xs font-semibold text-slate-600">
                      {t('landing.statsOpenShelters')}
                    </p>
                    <p className="mt-2 font-mono text-3xl font-bold text-[#0B2545] tabular-nums">
                      {formatNumber(summary.openShelters)}
                    </p>
                    <p className="mt-1.5 text-xs text-slate-500 tabular-nums">
                      {t('shelters.occupancyText', {
                        occupied: formatNumber(summary.totalShelterOccupancy),
                        capacity: formatNumber(summary.totalShelterCapacity),
                      })}
                    </p>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-[#F4F6F8] p-5">
                    <p className="text-xs font-semibold text-slate-600">
                      {t('landing.statsRescueTeams')}
                    </p>
                    <p className="mt-2 font-mono text-3xl font-bold text-[#0B2545] tabular-nums">
                      {summary.activeRescueTeams !== null
                        ? formatNumber(summary.activeRescueTeams)
                        : t('landing.restricted')}
                    </p>
                    <p className="mt-1.5 text-xs text-slate-500">
                      {summary.isDemo
                        ? t('landing.statSimulatedTeams')
                        : t('landing.statAuthorizedResponders')}
                    </p>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-[#F4F6F8] p-5">
                    <p className="text-xs font-semibold text-slate-600">
                      {t('landing.statsOfficialBulletins')}
                    </p>
                    <p className="mt-2 font-mono text-3xl font-bold text-[#0B2545] tabular-nums">
                      {formatNumber(summary.activeOfficialAlerts)}
                    </p>
                    <p className="mt-1.5 text-xs text-slate-500">
                      {summary.liveOfficialDataAvailable
                        ? t('landing.statPublishedWithSource')
                        : t('alerts.liveOfficialUnavailable')}
                    </p>
                  </div>
                </div>

                {/* Preview of Verified Reports & Shelters */}
                <div className="mt-8 grid gap-6 lg:grid-cols-2">
                  <div className="rounded-lg border border-slate-200 bg-white p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                      <h3 className="text-sm font-bold text-[#0B2545]">
                        {t('landing.mapPreviewTitle')}
                      </h3>
                      <OriginBadge origin="admin_verified" />
                    </div>
                    <div className="mt-4 divide-y divide-slate-100">
                      {summary.sampleRecordsPreview.verifiedIncidents.length === 0 ? (
                        <p className="py-4 text-sm text-slate-500">
                          {t('dashboard.noNearbyIncidents')}
                        </p>
                      ) : (
                        summary.sampleRecordsPreview.verifiedIncidents.map((inc) => (
                          <div key={inc.id} className="py-3 first:pt-0 last:pb-0">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-mono text-xs font-semibold text-[#0E857D] tabular-nums">
                                {inc.incident_code}
                              </span>
                              <div className="flex flex-wrap items-center gap-2">
                                <SeverityBadge severity={inc.severity} />
                                <StatusBadge status={inc.status} kind="incident" />
                              </div>
                            </div>
                            <p className="mt-1.5 text-sm font-semibold text-[#0B2545]">
                              {inc.title}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {inc.locality} · {t('map.legendReportsNote')}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-white p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                      <h3 className="text-sm font-bold text-[#0B2545]">
                        {t('landing.sheltersTitle')}
                      </h3>
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500">
                        <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
                        {t('common.regionTagline')}
                      </span>
                    </div>
                    <div className="mt-4 divide-y divide-slate-100">
                      {summary.sampleRecordsPreview.shelters.length === 0 ? (
                        <p className="py-4 text-sm text-slate-500">
                          {t('landing.sheltersEmpty')}
                        </p>
                      ) : (
                        summary.sampleRecordsPreview.shelters.map((sh) => (
                          <div key={sh.id} className="py-3 first:pt-0 last:pb-0">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="text-sm font-semibold text-[#0B2545]">{sh.name}</p>
                              <OriginBadge origin={sh.info_origin} />
                            </div>
                            <p className="mt-1 text-xs text-slate-600 tabular-nums">
                              {sh.locality} ·{' '}
                              {t('shelters.occupancyText', {
                                occupied: formatNumber(sh.current_occupancy),
                                capacity: formatNumber(sh.capacity),
                              })}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </section>

      {/* 6. CONTACT & EMERGENCY OPERATIONS INFO */}
      <section id="contact" className="bg-[#F4F6F8] py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-12">
            {/* Emergency Contacts & District Desk */}
            <div className="lg:col-span-5">
              <p className="text-sm font-semibold text-[#0E857D]">
                {t('landing.contactEyebrow')}
              </p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-[#0B2545] sm:text-3xl">
                {t('landing.contactTitle')}
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                {t('landing.contactDesc')}
              </p>

              <div className="mt-6 space-y-3">
                <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-4">
                  <PhoneCall className="mt-0.5 h-5 w-5 shrink-0 text-[#C06310]" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-bold text-[#0B2545]">
                      {t('landing.footerHelplines')}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600 tabular-nums">
                      112 — {t('common.helplineNationalEmergency')} · 108 —{' '}
                      {t('common.helplineMedicalAmbulance')} · 101 —{' '}
                      {t('common.helplineFireRescue')} · 1077 —{' '}
                      {t('common.helplineDistrictControl')}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-4">
                  <LifeBuoy className="mt-0.5 h-5 w-5 shrink-0 text-[#13A89E]" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-bold text-[#0B2545]">
                      {t('landing.footerCoverage')}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600">
                      {t('landing.footerCoverageText')}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Working Coordination Form */}
            <div className="lg:col-span-7">
              <div className="rounded-lg border border-slate-200 bg-white p-6 sm:p-8">
                <h3 className="text-lg font-bold text-[#0B2545]">
                  {t('landing.inquiryFormTitle')}
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  {t('landing.inquiryFormDisclaimer')}
                </p>

                {contactError ? (
                  <div
                    role="alert"
                    className="mt-4 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-800"
                  >
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-700" />
                    <span>{contactError}</span>
                  </div>
                ) : null}

                {contactSubmitted ? (
                  <div className="mt-5 rounded-md border border-emerald-200 bg-emerald-50/70 p-4">
                    <div className="flex items-start gap-2.5">
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
                      <div>
                        <p className="text-sm font-semibold text-emerald-900">
                          {t('landing.inquirySuccessTitle')}
                        </p>
                        <p className="mt-1 text-xs text-emerald-800">
                          {t('landing.inquirySuccessBody')}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setContactSubmitted(false)}
                      className="mt-3 text-xs font-semibold text-[#0B2545] underline"
                    >
                      {t('landing.sendAnotherInquiry')}
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleContactSubmit} className="mt-5 space-y-4" noValidate>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label
                          htmlFor="contact-name"
                          className="block text-sm font-semibold text-[#0B2545]"
                        >
                          {t('auth.fullNameLabel')}
                        </label>
                        <input
                          id="contact-name"
                          type="text"
                          required
                          value={contactForm.name}
                          onChange={(e) =>
                            setContactForm((p) => ({ ...p, name: e.target.value }))
                          }
                          placeholder={t('landing.inquiryNamePlaceholder')}
                          className="mt-1 block w-full rounded-md border border-slate-300 px-3.5 py-2 text-sm text-[#0B2545] focus:border-[#13A89E] focus:outline-none"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="contact-email"
                          className="block text-sm font-semibold text-[#0B2545]"
                        >
                          {t('auth.emailLabel')}
                        </label>
                        <input
                          id="contact-email"
                          type="email"
                          required
                          value={contactForm.email}
                          onChange={(e) =>
                            setContactForm((p) => ({ ...p, email: e.target.value }))
                          }
                          placeholder={t('auth.emailPlaceholder')}
                          className="mt-1 block w-full rounded-md border border-slate-300 px-3.5 py-2 text-sm text-[#0B2545] focus:border-[#13A89E] focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label
                          htmlFor="contact-locality"
                          className="block text-sm font-semibold text-[#0B2545]"
                        >
                          {t('auth.localityLabel')}
                        </label>
                        <select
                          id="contact-locality"
                          value={contactForm.locality}
                          onChange={(e) =>
                            setContactForm((p) => ({ ...p, locality: e.target.value }))
                          }
                          className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-[#0B2545] focus:border-[#13A89E] focus:outline-none"
                        >
                          {EAST_GODAVARI_LOCALITIES.map((loc) => (
                            <option key={loc} value={loc}>
                              {loc}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label
                          htmlFor="contact-topic"
                          className="block text-sm font-semibold text-[#0B2545]"
                        >
                          {t('landing.inquiryTopicLabel')}
                        </label>
                        <select
                          id="contact-topic"
                          value={contactForm.topic}
                          onChange={(e) =>
                            setContactForm((p) => ({ ...p, topic: e.target.value }))
                          }
                          className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-[#0B2545] focus:border-[#13A89E] focus:outline-none"
                        >
                          <option value="District Coordination Inquiry">
                            {t('landing.topicCoordination')}
                          </option>
                          <option value="Rescue Unit Provisioning">
                            {t('landing.topicRescueProvisioning')}
                          </option>
                          <option value="Volunteer Group Partnership">
                            {t('landing.topicVolunteerPartner')}
                          </option>
                          <option value="Shelter Listing Update">
                            {t('landing.topicShelterUpdate')}
                          </option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="contact-message"
                        className="block text-sm font-semibold text-[#0B2545]"
                      >
                        {t('landing.inquiryMessageLabel')}
                      </label>
                      <textarea
                        id="contact-message"
                        rows={3}
                        required
                        value={contactForm.message}
                        onChange={(e) =>
                          setContactForm((p) => ({ ...p, message: e.target.value }))
                        }
                        placeholder={t('landing.inquiryMessagePlaceholder')}
                        className="mt-1 block w-full rounded-md border border-slate-300 px-3.5 py-2 text-sm text-[#0B2545] focus:border-[#13A89E] focus:outline-none"
                      />
                    </div>

                    {contactCooldown.isLimited ? (
                      <div
                        role="status"
                        aria-live="polite"
                        className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900"
                      >
                        <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
                        <span className="tabular-nums">{contactCooldown.message}</span>
                      </div>
                    ) : null}

                    <button
                      type="submit"
                      disabled={contactSubmitting || contactCooldown.isLimited}
                      className="inline-flex min-h-[42px] items-center gap-2 rounded-md bg-[#0B2545] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#13315C] transition-colors disabled:opacity-60"
                    >
                      {contactSubmitting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" aria-hidden="true" />
                      )}
                      <span className="tabular-nums">
                        {contactSubmitting
                          ? t('common.submitting')
                          : contactCooldown.isLimited
                          ? t('landing.cooldownButton', {
                              seconds: contactCooldown.remainingSeconds,
                            })
                          : t('landing.submitInquiry')}
                      </span>
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
