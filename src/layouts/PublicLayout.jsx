import { useEffect, useState } from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Menu, X } from 'lucide-react';
import { BrandLogo } from '../components/common/BrandLogo';
import { ConfigStatusBanner } from '../components/common/ConfigStatusBanner';
import { OriginBadge } from '../components/common/Badges';
import { ErrorBoundary } from '../components/common/ErrorBoundary';
import { LanguageSwitcher } from '../components/common/LanguageSwitcher';
import { useAuth } from '../hooks/useAuth';
import { getDashboardPathForRole } from '../utils/constants';

export function PublicLayout() {
  const { t } = useTranslation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { isAuthenticated, role } = useAuth();
  const navigate = useNavigate();

  const publicNavLinks = [
    { label: t('nav.liveMap'), to: '/map' },
    { label: t('nav.officialInfo'), to: '/official-info' },
    { label: t('landing.howItWorksTitle').split(' ')[0] === 'How' ? t('nav.overview') : t('nav.overview'), href: '/#how-it-works' },
    { label: t('common.contact'), href: '/#contact' },
  ];

  const handlePrimaryAction = () => {
    setMobileMenuOpen(false);
    if (isAuthenticated) {
      navigate(getDashboardPathForRole(role));
    } else {
      navigate('/login');
    }
  };

  useEffect(() => {
    if (!mobileMenuOpen) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setMobileMenuOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileMenuOpen]);

  return (
    <div className="flex min-h-screen flex-col bg-[#F4F6F8] text-[#0B2545]">
      <a href="#main-content" className="skip-link">
        {t('common.skipToContent')}
      </a>
      <ConfigStatusBanner />

      {/* Responsive 3-zone Top Bar with Language Switcher */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-4 py-2 sm:px-6 lg:px-8">
          {/* Zone 1: Brand Wordmark */}
          <Link
            to="/"
            className="whitespace-nowrap shrink-0 focus-visible:rounded"
            aria-label={`${t('common.appName')} ${t('nav.home')}`}
          >
            <BrandLogo />
          </Link>

          {/* Zone 2: Concise nav links */}
          <nav
            aria-label={t('nav.publicNav')}
            className="hidden lg:flex items-center gap-6 text-sm font-medium text-slate-600"
          >
            {publicNavLinks.map((item) =>
              item.to ? (
                <Link
                  key={item.to}
                  to={item.to}
                  className="py-1 hover:text-[#0B2545] hover:underline underline-offset-4 decoration-[#13A89E] decoration-2 transition-colors"
                >
                  {item.label}
                </Link>
              ) : (
                <a
                  key={item.href}
                  href={item.href}
                  className="py-1 hover:text-[#0B2545] hover:underline underline-offset-4 decoration-[#13A89E] decoration-2 transition-colors"
                >
                  {item.label}
                </a>
              )
            )}
          </nav>

          {/* Zone 3: Language Switcher + Primary Action */}
          <div className="hidden lg:flex items-center gap-3 shrink-0">
            <LanguageSwitcher id="public-lang-desktop" variant="light" />
            <button
              type="button"
              onClick={handlePrimaryAction}
              className="rounded-md bg-[#0B2545] px-4 py-2 text-sm font-semibold text-white hover:bg-[#13315C] transition-colors whitespace-nowrap shrink-0"
            >
              {isAuthenticated ? t('landing.ctaGoDashboard') : t('nav.signIn')}
            </button>
          </div>

          {/* Mobile Controls: Language Switcher + Menu Trigger */}
          <div className="flex items-center gap-2 lg:hidden">
            <LanguageSwitcher id="public-lang-mobile" variant="light" />
            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="inline-flex min-h-[38px] min-w-[38px] items-center justify-center rounded-md border border-slate-300 p-2 text-[#0B2545] hover:bg-slate-50"
              aria-label={mobileMenuOpen ? t('nav.closeMenu') : t('nav.openMenu')}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Drawer */}
        {mobileMenuOpen ? (
          <div className="border-t border-slate-200 bg-white px-4 py-4 lg:hidden">
            <nav aria-label={t('nav.publicNav')} className="flex flex-col gap-2.5">
              {publicNavLinks.map((item) =>
                item.to ? (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileMenuOpen(false)}
                    className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 hover:text-[#0B2545]"
                  >
                    {item.label}
                  </Link>
                ) : (
                  <a
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 hover:text-[#0B2545]"
                  >
                    {item.label}
                  </a>
                )
              )}
              <button
                type="button"
                onClick={handlePrimaryAction}
                className="mt-2 w-full rounded-md bg-[#0B2545] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#13315C] transition-colors"
              >
                {isAuthenticated ? t('landing.ctaGoDashboard') : t('nav.signIn')}
              </button>
            </nav>
          </div>
        ) : null}
      </header>

      <main id="main-content" tabIndex={-1} className="flex-1 focus:outline-none">
        <ErrorBoundary sectionName={t('common.appName')} compact>
          <Outlet />
        </ErrorBoundary>
      </main>

      {/* Institutional Footer */}
      <footer className="border-t border-slate-200 bg-[#0B2545] text-slate-200">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid gap-10 md:grid-cols-12">
            <div className="md:col-span-5">
              <BrandLogo inverted />
              <p className="mt-4 max-w-md text-sm leading-relaxed text-slate-300">
                {t('landing.footerTagline')}
              </p>
              <p className="mt-3 text-xs leading-relaxed text-slate-400">
                {t('landing.footerDisclaimer')}
              </p>
            </div>

            <div className="md:col-span-3">
              <h3 className="text-sm font-semibold text-white">{t('landing.footerQuickLinks')}</h3>
              <ul className="mt-3 space-y-2.5 text-sm text-slate-300">
                <li>
                  <Link to="/map" className="hover:text-white transition-colors">
                    {t('nav.liveMap')}
                  </Link>
                </li>
                <li>
                  <Link to="/official-info" className="hover:text-white transition-colors">
                    {t('nav.officialInfo')}
                  </Link>
                </li>
                <li>
                  <Link to="/register" className="hover:text-white transition-colors">
                    {t('nav.register')}
                  </Link>
                </li>
                <li>
                  <Link to="/login" className="hover:text-white transition-colors">
                    {t('nav.signIn')}
                  </Link>
                </li>
              </ul>
            </div>

            <div className="md:col-span-4">
              <h3 className="text-sm font-semibold text-white">{t('landing.footerCoverage')}</h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-300">
                {t('landing.footerCoverageText')}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <OriginBadge origin="citizen_submitted" />
                <OriginBadge origin="admin_verified" />
                <OriginBadge origin="official_government" />
                <OriginBadge origin="ai_suggested" />
              </div>
            </div>
          </div>

          <div className="mt-10 flex flex-col gap-3 border-t border-white/15 pt-6 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
            <p>
              {t('common.appName')} · {t('common.regionFull')}
            </p>
            <p className="font-mono">
              {t('landing.footerHelplines')}: 112 · 108 · 101 · 1070 · 1077
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
