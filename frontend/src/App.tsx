import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuthStore } from './store/auth.store';
import { UserRole } from '@shared/types';
import { AppShell } from './components/layout/AppShell';
import { LoginPage, RegisterPage } from './pages/AuthPages';
import { DashboardPage } from './pages/DashboardPage';
import { CreateAdPage } from './pages/CreateAdPage';
import { MyAdsPage } from './pages/MyAdsPage';
import { AdDetailPage } from './pages/AdDetailPage';
import { PerformancePage } from './pages/PerformancePage';
import { ApprovalsPage } from './pages/ApprovalsPage';
import { AllCampaignsPage } from './pages/AllCampaignsPage';
import { SettingsPage } from './pages/SettingsPage';
import { ToastProvider } from './components/ui/Toast';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== UserRole.ADMIN) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function RedirectIfAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated ? <Navigate to="/" replace /> : <>{children}</>;
}

export default function App() {
  return (
    <ToastProvider>
      <Routes>
        {/* Public */}
        <Route path="/login"    element={<RedirectIfAuth><LoginPage /></RedirectIfAuth>} />
        <Route path="/register" element={<RedirectIfAuth><RegisterPage /></RedirectIfAuth>} />

        {/* Protected */}
        <Route element={<RequireAuth><AppShell /></RequireAuth>}>
          <Route index element={<DashboardPage />} />
          <Route path="ads">
            <Route index element={<MyAdsPage />} />
            <Route path="create" element={<CreateAdPage />} />
            <Route path=":id" element={<AdDetailPage />} />
          </Route>
          <Route path="performance" element={<PerformancePage />} />
          <Route path="settings" element={<SettingsPage />} />

          {/* Admin only */}
          <Route path="admin">
            <Route path="approvals"  element={<RequireAdmin><ApprovalsPage /></RequireAdmin>} />
            <Route path="campaigns"  element={<RequireAdmin><AllCampaignsPage /></RequireAdmin>} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ToastProvider>
  );
}
