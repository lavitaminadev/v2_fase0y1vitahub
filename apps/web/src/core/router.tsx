import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './AppLayout';
import { ProtectedRoute } from './ProtectedRoute';
import { ClientRoute } from './ClientRoute';
import { NotFoundPage } from '../features/not-found/NotFoundPage';
import { LoadingSpinner } from '../shared/LoadingSpinner';
import { useAuth } from './auth';

const LoginPage = lazy(() => import('../features/auth/LoginPage').then(m => ({ default: m.LoginPage })));
const ForgotPasswordPage = lazy(() => import('../features/auth/ForgotPasswordPage').then(m => ({ default: m.ForgotPasswordPage })));
const ResetPasswordPage = lazy(() => import('../features/auth/ResetPasswordPage').then(m => ({ default: m.ResetPasswordPage })));
const ChangePasswordPage = lazy(() => import('../features/auth/ChangePasswordPage').then(m => ({ default: m.ChangePasswordPage })));
const DashboardPage = lazy(() => import('../features/dashboard/DashboardPage').then(m => ({ default: m.DashboardPage })));
const ClientsPage = lazy(() => import('../features/clients/ClientsPage').then(m => ({ default: m.ClientsPage })));
const ClientDetailPage = lazy(() => import('../features/clients/ClientDetailPage').then(m => ({ default: m.ClientDetailPage })));
const LeadsPage = lazy(() => import('../features/crm/LeadsPage').then(m => ({ default: m.LeadsPage })));
const OpportunitiesPage = lazy(() => import('../features/crm/CrmRecordsPage').then(m => ({ default: m.OpportunitiesPage })));
const ContactsPage = lazy(() => import('../features/crm/CrmRecordsPage').then(m => ({ default: m.ContactsPage })));
const InteractionsPage = lazy(() => import('../features/crm/CrmRecordsPage').then(m => ({ default: m.InteractionsPage })));
const ProductionPage = lazy(() => import('../features/production/ProductionPage').then(m => ({ default: m.ProductionPage })));
const ContentGridPage = lazy(() => import('../features/content/ContentGridPage').then(m => ({ default: m.ContentGridPage })));
const ApprovalsPage = lazy(() => import('../features/approvals/ApprovalsPage').then(m => ({ default: m.ApprovalsPage })));
const MeetingsPage = lazy(() => import('../features/meetings/MeetingsPage').then(m => ({ default: m.MeetingsPage })));
const ReportsPage = lazy(() => import('../features/reports/ReportsPage').then(m => ({ default: m.ReportsPage })));
const SettingsPage = lazy(() => import('../features/settings/SettingsPage').then(m => ({ default: m.SettingsPage })));
const IntegrationsPage = lazy(() => import('../features/integrations/IntegrationsPage').then(m => ({ default: m.IntegrationsPage })));
const MetaOAuthCallbackPage = lazy(() => import('../features/integrations/OAuthCallbackPage').then(m => ({ default: () => <m.OAuthCallbackPage provider="meta" /> })));
const GoogleOAuthCallbackPage = lazy(() => import('../features/integrations/OAuthCallbackPage').then(m => ({ default: () => <m.OAuthCallbackPage provider="google" /> })));
const OperationsPage = lazy(() => import('../features/operations/OperationsPage').then(m => ({ default: m.OperationsPage })));
const DirectionPage = lazy(() => import('../features/direction/DirectionPage').then(m => ({ default: m.DirectionPage })));
const BillingPage = lazy(() => import('../features/billing/BillingPage').then(m => ({ default: m.BillingPage })));
const ContractsPage = lazy(() => import('../features/contracts/ContractsPage').then(m => ({ default: m.ContractsPage })));
const GamificationPage = lazy(() => import('../features/gamification/GamificationPage').then(m => ({ default: m.GamificationPage })));
const DocumentsPage = lazy(() => import('../features/documents/DocumentsPage').then(m => ({ default: m.DocumentsPage })));
const BriefsPage = lazy(() => import('../features/briefs/BriefsPage').then(m => ({ default: m.BriefsPage })));
const OnboardingPage = lazy(() => import('../features/onboarding/OnboardingPage').then(m => ({ default: m.OnboardingPage })));
const UsersPage = lazy(() => import('../features/users/UsersPage').then(m => ({ default: m.UsersPage })));
const CatalogPage = lazy(() => import('../features/catalog/CatalogPage').then(m => ({ default: m.CatalogPage })));
const KnowledgePage = lazy(() => import('../features/knowledge/KnowledgePage').then(m => ({ default: m.KnowledgePage })));
const ClientDashboard = lazy(() => import('../features/client-portal/ClientDashboard').then(m => ({ default: m.ClientDashboard })));
const ClientGrid = lazy(() => import('../features/client-portal/ClientGrid').then(m => ({ default: m.ClientGrid })));
const ClientApprovals = lazy(() => import('../features/client-portal/ClientApprovals').then(m => ({ default: m.ClientApprovals })));
const ClientMeetings = lazy(() => import('../features/client-portal/ClientMeetings').then(m => ({ default: m.ClientMeetings })));
const ClientReports = lazy(() => import('../features/client-portal/ClientReports').then(m => ({ default: m.ClientReports })));
const ClientLayout = lazy(() => import('../features/client-portal/ClientLayout').then(m => ({ default: m.ClientLayout })));
const ReservationsPage = lazy(() => import('../features/reservations/ReservationsPage').then(m => ({ default: m.ReservationsPage })));
const ReservationBuilderPage = lazy(() => import('../features/reservations/ReservationBuilderPage').then(m => ({ default: m.ReservationBuilderPage })));
const PublicReservationPage = lazy(() => import('../features/reservations/PublicReservationPage').then(m => ({ default: m.PublicReservationPage })));
const AudiovisualPage = lazy(() => import('../features/audiovisual/AudiovisualPage').then(m => ({ default: m.AudiovisualPage })));
const GovernancePage = lazy(() => import('../features/governance/GovernancePage').then(m => ({ default: m.GovernancePage })));

function SuspenseWrapper({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<LoadingSpinner text="Preparando tu espacio..." />}>{children}</Suspense>;
}

function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingSpinner />;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === 'client' ? '/portal' : '/dashboard'} replace />;
}

function LoginRoute() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingSpinner text="Restaurando tu sesión..." />;
  if (user) return <Navigate to={user.role === 'client' ? '/portal' : '/dashboard'} replace />;
  return <SuspenseWrapper><LoginPage /></SuspenseWrapper>;
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginRoute />} />
        <Route path="/forgot-password" element={<SuspenseWrapper><ForgotPasswordPage /></SuspenseWrapper>} />
        <Route path="/reset-password" element={<SuspenseWrapper><ResetPasswordPage /></SuspenseWrapper>} />
        <Route path="/change-password" element={<ProtectedRoute path="/change-password"><SuspenseWrapper><ChangePasswordPage /></SuspenseWrapper></ProtectedRoute>} />
        <Route path="/book/:slug" element={<SuspenseWrapper><PublicReservationPage /></SuspenseWrapper>} />
        <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
          <Route path="/dashboard" element={<ProtectedRoute path="/dashboard"><SuspenseWrapper><DashboardPage /></SuspenseWrapper></ProtectedRoute>} />
          <Route path="/clients" element={<ProtectedRoute path="/clients"><SuspenseWrapper><ClientsPage /></SuspenseWrapper></ProtectedRoute>} />
          <Route path="/clients/:id" element={<ProtectedRoute path="/clients"><SuspenseWrapper><ClientDetailPage /></SuspenseWrapper></ProtectedRoute>} />
          <Route path="/crm/leads" element={<ProtectedRoute path="/crm/leads"><SuspenseWrapper><LeadsPage /></SuspenseWrapper></ProtectedRoute>} />
          <Route path="/crm/opportunities" element={<ProtectedRoute path="/crm/leads"><SuspenseWrapper><OpportunitiesPage /></SuspenseWrapper></ProtectedRoute>} />
          <Route path="/crm/contacts" element={<ProtectedRoute path="/crm/leads"><SuspenseWrapper><ContactsPage /></SuspenseWrapper></ProtectedRoute>} />
          <Route path="/crm/interactions" element={<ProtectedRoute path="/crm/leads"><SuspenseWrapper><InteractionsPage /></SuspenseWrapper></ProtectedRoute>} />
          <Route path="/production" element={<ProtectedRoute path="/production"><SuspenseWrapper><ProductionPage /></SuspenseWrapper></ProtectedRoute>} />
          <Route path="/audiovisual" element={<ProtectedRoute path="/audiovisual"><SuspenseWrapper><AudiovisualPage /></SuspenseWrapper></ProtectedRoute>} />
          <Route path="/content" element={<ProtectedRoute path="/content"><SuspenseWrapper><ContentGridPage /></SuspenseWrapper></ProtectedRoute>} />
          <Route path="/approvals" element={<ProtectedRoute path="/approvals"><SuspenseWrapper><ApprovalsPage /></SuspenseWrapper></ProtectedRoute>} />
          <Route path="/meetings" element={<ProtectedRoute path="/meetings"><SuspenseWrapper><MeetingsPage /></SuspenseWrapper></ProtectedRoute>} />
          <Route path="/reports" element={<ProtectedRoute path="/reports"><SuspenseWrapper><ReportsPage /></SuspenseWrapper></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute path="/settings"><SuspenseWrapper><SettingsPage /></SuspenseWrapper></ProtectedRoute>} />
          <Route path="/integrations" element={<ProtectedRoute path="/integrations"><SuspenseWrapper><IntegrationsPage /></SuspenseWrapper></ProtectedRoute>} />
          <Route path="/integrations/meta/callback" element={<ProtectedRoute path="/integrations"><SuspenseWrapper><MetaOAuthCallbackPage /></SuspenseWrapper></ProtectedRoute>} />
          <Route path="/integrations/google/callback" element={<ProtectedRoute path="/integrations"><SuspenseWrapper><GoogleOAuthCallbackPage /></SuspenseWrapper></ProtectedRoute>} />
          <Route path="/operations" element={<ProtectedRoute path="/operations"><SuspenseWrapper><OperationsPage /></SuspenseWrapper></ProtectedRoute>} />
          <Route path="/direction" element={<ProtectedRoute path="/direction"><SuspenseWrapper><DirectionPage /></SuspenseWrapper></ProtectedRoute>} />
          <Route path="/billing" element={<ProtectedRoute path="/billing"><SuspenseWrapper><BillingPage /></SuspenseWrapper></ProtectedRoute>} />
          <Route path="/contracts" element={<ProtectedRoute path="/contracts"><SuspenseWrapper><ContractsPage /></SuspenseWrapper></ProtectedRoute>} />
          <Route path="/gamification" element={<ProtectedRoute path="/gamification"><SuspenseWrapper><GamificationPage /></SuspenseWrapper></ProtectedRoute>} />
          <Route path="/documents" element={<ProtectedRoute path="/documents"><SuspenseWrapper><DocumentsPage /></SuspenseWrapper></ProtectedRoute>} />
          <Route path="/briefs" element={<ProtectedRoute path="/briefs"><SuspenseWrapper><BriefsPage /></SuspenseWrapper></ProtectedRoute>} />
          <Route path="/onboarding" element={<ProtectedRoute path="/onboarding"><SuspenseWrapper><OnboardingPage /></SuspenseWrapper></ProtectedRoute>} />
          <Route path="/users" element={<ProtectedRoute path="/users"><SuspenseWrapper><UsersPage /></SuspenseWrapper></ProtectedRoute>} />
          <Route path="/governance" element={<ProtectedRoute path="/governance"><SuspenseWrapper><GovernancePage /></SuspenseWrapper></ProtectedRoute>} />
          <Route path="/catalog" element={<ProtectedRoute path="/catalog"><SuspenseWrapper><CatalogPage /></SuspenseWrapper></ProtectedRoute>} />
          <Route path="/knowledge" element={<ProtectedRoute path="/knowledge"><SuspenseWrapper><KnowledgePage /></SuspenseWrapper></ProtectedRoute>} />
          <Route path="/reservations" element={<ProtectedRoute path="/reservations"><SuspenseWrapper><ReservationsPage /></SuspenseWrapper></ProtectedRoute>} />
          <Route path="/reservations/forms/:id" element={<ProtectedRoute path="/reservations"><SuspenseWrapper><ReservationBuilderPage /></SuspenseWrapper></ProtectedRoute>} />
        </Route>
        <Route path="/portal" element={<ClientRoute><SuspenseWrapper><ClientLayout /></SuspenseWrapper></ClientRoute>}>
          <Route index element={<SuspenseWrapper><ClientDashboard /></SuspenseWrapper>} />
          <Route path="grid" element={<SuspenseWrapper><ClientGrid /></SuspenseWrapper>} />
          <Route path="approvals" element={<SuspenseWrapper><ClientApprovals /></SuspenseWrapper>} />
          <Route path="meetings" element={<SuspenseWrapper><ClientMeetings /></SuspenseWrapper>} />
          <Route path="reports" element={<SuspenseWrapper><ClientReports /></SuspenseWrapper>} />
          <Route path="reservations" element={<SuspenseWrapper><ReservationsPage clientView /></SuspenseWrapper>} />
          <Route path="reservations/forms/:id" element={<SuspenseWrapper><ReservationBuilderPage /></SuspenseWrapper>} />
        </Route>
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/404" element={<NotFoundPage />} />
        <Route path="*" element={<Navigate to="/404" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

// Register feature manifests
import '../features/dashboard/feature.manifest';
import '../features/clients/feature.manifest';
import '../features/reservations/feature.manifest';
import '../features/contracts/feature.manifest';
import '../features/catalog/feature.manifest';
import '../features/crm/feature.manifest';
import '../features/briefs/feature.manifest';
import '../features/production/feature.manifest';
import '../features/gamification/feature.manifest';
import '../features/content/feature.manifest';
import '../features/documents/feature.manifest';
import '../features/knowledge/feature.manifest';
import '../features/approvals/feature.manifest';
import '../features/meetings/feature.manifest';
import '../features/reports/feature.manifest';
import '../features/billing/feature.manifest';
import '../features/operations/feature.manifest';
import '../features/direction/feature.manifest';
import '../features/integrations/feature.manifest';
import '../features/onboarding/feature.manifest';
import '../features/users/feature.manifest';
import '../features/settings/feature.manifest';
import '../features/audiovisual/feature.manifest';
import '../features/governance/feature.manifest';
