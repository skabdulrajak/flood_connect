import { useEffect, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Bot, ChevronRight, Cloud, LogOut, Menu, UserCircle2, X } from 'lucide-react';
import { BrandLogo } from '../components/common/BrandLogo';
import { ConfigStatusBanner } from '../components/common/ConfigStatusBanner';
import { DemoDataBadge } from '../components/common/Badges';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { ErrorBoundary } from '../components/common/ErrorBoundary';
import { LanguageSwitcher } from '../components/common/LanguageSwitcher';
import { PWAInstallButton } from '../components/pwa/PWAInstallButton';
import { NotificationBellMenu } from '../components/notifications/NotificationBellMenu';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { getDashboardPathForRole, getRoleMeta } from '../utils/constants';

export function DashboardLayout({ navItems = [], pageTitle, children }) {
  const { t } = useTranslation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [signOutDialogOpen, setSignOutDialogOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const { profile, role, isDemoMode, isFirebaseMode, signOut } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const resolvedTitle = pageTitle || t('nav.dashboard');
  const roleInfo = getRoleMeta(role);

  useEffect(() => {
    if (!sidebarOpen) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setSidebarOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [sidebarOpen]);

  const handleConfirmSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      setSignOutDialogOpen(false);
      showToast({
        title: t('common.signedOutTitle'),
        message: t('common.signedOutMessage'),
        type: 'info',
      });
      navigate('/auth', { replace: true });
    } catch (err) {
      showToast({
        title: t('errors.genericTitle'),
        message: err?.message || t('errors.genericMessage'),
        type: 'error',
      });
    } finally {
      setSigningOut(false);
    }
  };

  const renderSidebarContent = () => (
    <div className="flex h-full flex-col bg-[#0B2545] text-white">
      <div className="flex h-16 items-center justify-between border-b border-white/10 px-5">
        <Link to={getDashboardPathForRole(role)} onClick={() => setSidebarOpen(false)}>
          <BrandLogo inverted size="sm" />
        </Link>
        <button
          type="button"
          onClick={() => setSidebarOpen(false)}
          aria-label={t('nav.closeMenu')}
          className="rounded p-1.5 text-slate-300 hover:bg-white/10 hover:text-white lg:hidden"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Role Context Block */}
      <div className="border-b border-white/10 px-5 py-4">
        <p className="text-xs font-medium text-slate-400">{t('nav.dashboard')}</p>
        <p className="mt-0.5 text-sm font-semibold text-white">
          {t('nav.portalSubtitle', { role: roleInfo.label })}
        </p>
        <p className="mt-0.5 text-xs text-slate-300 truncate">
          {profile?.district || 'East Godavari'}
          {profile?.locality ? ` · ${profile.locality}` : ''}
        </p>
      </div>

      {/* Navigation List */}
      <nav aria-label={t('nav.dashboardNav')} className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const IconComp = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={Boolean(item.end)}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center justify-between gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-[#13A89E] text-white'
                    : 'text-slate-200 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <span className="flex items-center gap-3 min-w-0">
                {IconComp ? <IconComp className="h-4 w-4 shrink-0" aria-hidden="true" /> : null}
                <span className="leading-snug">{item.label}</span>
              </span>
              {item.badge ? (
                <span className="font-mono text-[11px] font-semibold opacity-90 tabular-nums shrink-0">
                  {item.badge}
                </span>
              ) : null}
            </NavLink>
          );
        })}
      </nav>

      {/* Account Footer Actions */}
      <div className="border-t border-white/10 p-3 space-y-1">
        <NavLink
          to="/profile"
          onClick={() => setSidebarOpen(false)}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
              isActive
                ? 'bg-white/15 text-white'
                : 'text-slate-200 hover:bg-white/10 hover:text-white'
            }`
          }
        >
          <UserCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium leading-tight">
              {profile?.full_name || t('nav.profile')}
            </p>
            <p className="truncate text-[11px] text-slate-400">{profile?.email}</p>
          </div>
        </NavLink>

        <button
          type="button"
          onClick={() => setSignOutDialogOpen(true)}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-slate-200 hover:bg-red-500/20 hover:text-white transition-colors"
        >
          <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{t('common.signOut')}</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col bg-[#F4F6F8]">
      <a href="#main-content" className="skip-link">
        {t('common.skipToContent')}
      </a>
      <ConfigStatusBanner />

      <div className="flex flex-1">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:block lg:w-64 lg:shrink-0">{renderSidebarContent()}</aside>

        {/* Mobile Drawer Overlay */}
        {sidebarOpen ? (
          <div className="fixed inset-0 z-40 flex lg:hidden">
            <div
              className="fixed inset-0 bg-[#0B2545]/50"
              onClick={() => setSidebarOpen(false)}
              aria-hidden="true"
            />
            <div className="relative z-10 w-72 max-w-[85vw]">{renderSidebarContent()}</div>
          </div>
        ) : null}

        {/* Main Content Column */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex min-h-16 flex-wrap items-center justify-between gap-2 sm:gap-4 border-b border-slate-200 bg-white px-4 py-2 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                aria-label={t('nav.openMenu')}
                aria-expanded={sidebarOpen}
                className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-md border border-slate-300 p-2 text-[#0B2545] hover:bg-slate-50 lg:hidden"
              >
                <Menu className="h-5 w-5" aria-hidden="true" />
              </button>

              <div className="flex min-w-0 items-center gap-2 text-sm">
                <span className="hidden sm:inline text-slate-500 whitespace-nowrap">
                  {roleInfo.label}
                </span>
                <ChevronRight
                  className="hidden sm:inline h-4 w-4 text-slate-400 shrink-0"
                  aria-hidden="true"
                />
                <h1 className="truncate font-display text-base font-bold text-[#0B2545] sm:text-lg">
                  {resolvedTitle}
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {isFirebaseMode ? (
                <span className="hidden xl:inline-flex items-center gap-1 rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-800 whitespace-nowrap">
                  <Cloud className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                  <span>{t('common.cloudSync', { defaultValue: 'Firestore Live' })}</span>
                </span>
              ) : isDemoMode ? (
                <span className="hidden xl:inline-flex">
                  <DemoDataBadge compact />
                </span>
              ) : null}
              <Link
                to="/assistant"
                className="inline-flex items-center gap-1.5 rounded-md border border-[#13A89E]/40 bg-[#13A89E]/10 px-2.5 py-1.5 text-xs font-semibold text-[#0B2545] hover:bg-[#13A89E]/20 transition-colors whitespace-nowrap shrink-0"
              >
                <Bot className="h-3.5 w-3.5 text-[#0E857D]" aria-hidden="true" />
                <span className="hidden md:inline">{t('nav.aiAssistant', { defaultValue: 'AI & Live Voice' })}</span>
              </Link>
              <PWAInstallButton variant="light" />
              <LanguageSwitcher id="dashboard-lang" variant="light" />
              <NotificationBellMenu />
              <Link
                to="/profile"
                className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-[#F4F6F8] px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-[#0B2545] hover:bg-slate-200/70 transition-colors whitespace-nowrap shrink-0"
              >
                <UserCircle2 className="h-4 w-4 text-[#13A89E]" aria-hidden="true" />
                <span className="hidden sm:inline max-w-[130px] truncate">
                  {profile?.full_name || t('nav.profile')}
                </span>
              </Link>
            </div>
          </header>

          <main id="main-content" tabIndex={-1} className="flex-1 px-4 py-6 sm:px-6 lg:px-8 focus:outline-none">
            <div className="mx-auto max-w-6xl">
              <ErrorBoundary sectionName={resolvedTitle} compact>
                {children}
              </ErrorBoundary>
            </div>
          </main>
        </div>
      </div>

      <ConfirmDialog
        open={signOutDialogOpen}
        title={t('common.signOutConfirmTitle')}
        description={t('common.signOutConfirmMessage')}
        confirmLabel={t('common.signOut')}
        cancelLabel={t('common.cancel')}
        tone="danger"
        busy={signingOut}
        onConfirm={handleConfirmSignOut}
        onCancel={() => setSignOutDialogOpen(false)}
      />
    </div>
  );
}
