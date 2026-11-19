import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ToastProvider } from './context/ToastContext';
import { AuthProvider } from './context/AuthContext';
import { LanguageProvider } from './hooks/useLanguage';
import { useAuth } from './hooks/useAuth';
import { AuthLayout } from './layouts/AuthLayout';
import { DashboardLayout } from './layouts/DashboardLayout';
import { AuthGate } from './components/auth/AuthGate';
import { ProtectedRoute } from './components/common/ProtectedRoute';
import { LoadingState } from './components/common/StateFeedback';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { OfflineStatusBanner } from './components/pwa/OfflineStatusBanner';
import { BackgroundSyncListener } from './components/pwa/BackgroundSyncListener';
import { AuthPage } from './pages/AuthPage';
import { LandingPage } from './pages/LandingPage';
import { PublicMapPage } from './pages/PublicMapPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage';
import { ProfilePage } from './pages/ProfilePage';
import { CitizenDashboard } from './pages/dashboards/CitizenDashboard';
import { VolunteerDashboard } from './pages/dashboards/VolunteerDashboard';
import { RescueDashboard } from './pages/dashboards/RescueDashboard';
import { AdminDashboard } from './pages/dashboards/AdminDashboard';
import { OfficialInfoPage } from './pages/OfficialInfoPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { FloodTwin3DPage } from './pages/FloodTwin3DPage';
import { AssistantPage } from './pages/AssistantPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { getDashboardPathForRole, ROLES } from './utils/constants';
import { getNavItemsForRole } from './utils/dashboardNav';

const ALL_ROLES = [ROLES.CITIZEN, ROLES.VOLUNTEER, ROLES.RESCUE_TEAM, ROLES.ADMIN];

function RoleDashboardRedirect() {
  const { session, isAuthenticated, role, loading } = useAuth();
  const { t } = useTranslation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F4F6F8] p-6">
        <div className="w-full max-w-md">
          <LoadingState message={t('auth.redirectingDashboard')} />
        </div>
      </div>
    );
  }

  if (!session || !isAuthenticated || !role) {
    return <Navigate to="/auth" replace />;
  }

  return <Navigate to={getDashboardPathForRole(role)} replace />;
}

function AuthenticatedShell({ pageTitleKey, children }: { pageTitleKey: string; children: ReactNode }) {
  const { t } = useTranslation();
  const { role } = useAuth();
  const navItems = getNavItemsForRole(role || ROLES.CITIZEN);
  return (
    <DashboardLayout navItems={navItems} pageTitle={t(pageTitleKey)}>
      {children}
    </DashboardLayout>
  );
}

export default function App() {
  const [mapsQuotaExceeded, setMapsQuotaExceeded] = useState(false);

  useEffect(() => {
    const onQuota = () => setMapsQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', onQuota);
    return () => window.removeEventListener('gmp-quota-exceeded', onQuota);
  }, []);

  return (
    <ErrorBoundary sectionName="FloodConnect">
      {mapsQuotaExceeded ? (
        <div
          role="alert"
          className="sticky top-0 z-50 flex items-center justify-between gap-4 border-b border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-950"
        >
          <span>
            This app&apos;s demo Google Maps API key has reached its daily quota. Maps and place
            data are paused until tomorrow.{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium underline"
            >
              Use your own API key to remove this limit
            </a>
            .
          </span>
          <button
            type="button"
            onClick={() => setMapsQuotaExceeded(false)}
            aria-label="Dismiss"
            className="text-amber-900 hover:underline shrink-0"
          >
            Dismiss
          </button>
        </div>
      ) : null}

      <OfflineStatusBanner />

      <BrowserRouter>
        <ToastProvider>
          <AuthProvider>
            <LanguageProvider>
              <BackgroundSyncListener />
              <AuthGate>
                <Routes>
                  {/* Authentication Entry Routes (ONLY routes accessible when logged out) */}
                  <Route path="/auth" element={<AuthPage />} />
                  <Route path="/login" element={<Navigate to="/auth" replace />} />
                  <Route path="/register" element={<Navigate to="/auth?tab=signup" replace />} />

                  <Route element={<AuthLayout />}>
                    <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                    <Route path="/reset-password" element={<ResetPasswordPage />} />
                  </Route>

                  {/* Root & Smart Role Dashboard Redirect */}
                  <Route
                    path="/"
                    element={
                      <ProtectedRoute roles={ALL_ROLES}>
                        <RoleDashboardRedirect />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/dashboard"
                    element={
                      <ProtectedRoute roles={ALL_ROLES}>
                        <RoleDashboardRedirect />
                      </ProtectedRoute>
                    }
                  />

                  {/* Authenticated Overview, Map, Official Info, 3D Basin & AI Assistant */}
                  <Route
                    path="/home"
                    element={
                      <ProtectedRoute roles={ALL_ROLES}>
                        <AuthenticatedShell pageTitleKey="nav.home">
                          <LandingPage />
                        </AuthenticatedShell>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/map"
                    element={
                      <ProtectedRoute roles={ALL_ROLES}>
                        <AuthenticatedShell pageTitleKey="nav.liveMap">
                          <PublicMapPage />
                        </AuthenticatedShell>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/3d-basin"
                    element={
                      <ProtectedRoute roles={ALL_ROLES}>
                        <AuthenticatedShell pageTitleKey="nav.basin3d">
                          <FloodTwin3DPage />
                        </AuthenticatedShell>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/assistant"
                    element={
                      <ProtectedRoute roles={ALL_ROLES}>
                        <AuthenticatedShell pageTitleKey="nav.aiAssistant">
                          <AssistantPage />
                        </AuthenticatedShell>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/official-info"
                    element={
                      <ProtectedRoute roles={ALL_ROLES}>
                        <AuthenticatedShell pageTitleKey="nav.officialInfo">
                          <OfficialInfoPage />
                        </AuthenticatedShell>
                      </ProtectedRoute>
                    }
                  />

                  {/* Shorthand Role-Protected Deep-Link Routes */}
                  <Route
                    path="/report"
                    element={
                      <ProtectedRoute roles={[ROLES.CITIZEN]}>
                        <Navigate to="/dashboard/citizen/report" replace />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/*"
                    element={
                      <ProtectedRoute roles={[ROLES.ADMIN]}>
                        <Navigate to="/dashboard/admin" replace />
                      </ProtectedRoute>
                    }
                  />

                  {/* Shared Authenticated Profile & Notification Centre Pages */}
                  <Route
                    path="/profile"
                    element={
                      <ProtectedRoute roles={ALL_ROLES}>
                        <ProfilePage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/notifications"
                    element={
                      <ProtectedRoute roles={ALL_ROLES}>
                        <NotificationsPage />
                      </ProtectedRoute>
                    }
                  />

                  {/* Role-Protected Dashboard Shells */}
                  <Route
                    path="/dashboard/citizen/*"
                    element={
                      <ProtectedRoute roles={[ROLES.CITIZEN]}>
                        <CitizenDashboard />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/dashboard/volunteer/*"
                    element={
                      <ProtectedRoute roles={[ROLES.VOLUNTEER]}>
                        <VolunteerDashboard />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/dashboard/rescue/*"
                    element={
                      <ProtectedRoute roles={[ROLES.RESCUE_TEAM]}>
                        <RescueDashboard />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/dashboard/admin/*"
                    element={
                      <ProtectedRoute roles={[ROLES.ADMIN]}>
                        <AdminDashboard />
                      </ProtectedRoute>
                    }
                  />

                  {/* Authenticated Fallback */}
                  <Route
                    path="*"
                    element={
                      <ProtectedRoute roles={ALL_ROLES}>
                        <AuthenticatedShell pageTitleKey="errors.notFoundTitle">
                          <NotFoundPage />
                        </AuthenticatedShell>
                      </ProtectedRoute>
                    }
                  />
                </Routes>
              </AuthGate>
            </LanguageProvider>
          </AuthProvider>
        </ToastProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
