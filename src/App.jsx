import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { Security, LoginCallback } from '@okta/okta-react'
import { toRelativeUrl } from '@okta/okta-auth-js'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { Suspense, lazy } from 'react'
import { oktaAuth } from './utils/oktaConfig'

// ── Layout & Guards ──────────────────────────────────────────────────────────
const AppLayout   = lazy(() => import('./components/layout/AppLayout'))
const RequireAuth = lazy(() => import('./components/common/RequireAuth'))
const RoleGuard   = lazy(() => import('./components/common/RoleGuard'))

// ── Core pages ───────────────────────────────────────────────────────────────
const DashboardPage    = lazy(() => import('./pages/dashboard/DashboardPage'))
const DocumentsPage    = lazy(() => import('./pages/documents/DocumentsPage'))
const WorkflowPage     = lazy(() => import('./pages/workflow/WorkflowPage'))
const WorkflowDesigner = lazy(() => import('./pages/workflow/WorkflowDesignerPage'))

// ── Admin pages ──────────────────────────────────────────────────────────────
const AdminPage              = lazy(() => import('./pages/admin/AdminPage'))
const UsersAdminPage         = lazy(() => import('./pages/admin/UsersAdminPage'))
const DepartmentsPage        = lazy(() => import('./pages/admin/DepartmentsPage'))
const CategoriesPage         = lazy(() => import('./pages/admin/CategoriesPage'))
const ProductsPage           = lazy(() => import('./pages/admin/ProductsPage'))
const RetentionPage          = lazy(() => import('./pages/admin/RetentionPage'))
const TenantSettingsPage     = lazy(() => import('./pages/admin/TenantSettingsPage'))
const CustomerManagementPage = lazy(() => import('./pages/admin/CustomerManagementPage'))
// Sprint-C additions
const SegmentsPage     = lazy(() => import('./pages/admin/SegmentsPage'))
const ProductLinesPage = lazy(() => import('./pages/admin/ProductLinesPage'))
const AuditLogPage     = lazy(() => import('./pages/admin/AuditLogPage'))

// ── eForms pages ─────────────────────────────────────────────────────────────
const EFormsPage           = lazy(() => import('./pages/eforms/EFormsPage'))
const FormFillPage         = lazy(() => import('./pages/eforms/FormFillPage'))
const MySubmissionsPage    = lazy(() => import('./pages/eforms/MySubmissionsPage'))
const ReviewQueuePage      = lazy(() => import('./pages/eforms/ReviewQueuePage'))
const FormDesignerListPage = lazy(() => import('./pages/eforms/FormDesignerListPage'))
const FormDesignerPage     = lazy(() => import('./pages/eforms/FormDesignerPage'))

// -- Sprint 2 route addition (add to the protected routes section)
const BackofficeQueuePage  = lazy(() => import('./pages/backoffice/BackofficeQueuePage'))
const DocuSignSettingsPage = lazy(() => import('./pages/admin/DocuSignSettingsPage'))
const NotificationPreferencesPage = lazy(() => import('./pages/admin/NotificationPreferencesPage'))


const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5 * 60 * 1000,
    },
  },
})

function PageLoader() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{
        width: '2.5rem',
        height: '2.5rem',
        border: '4px solid #e5e7eb',
        borderTopColor: '#2563eb',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); }}`}</style>
    </div>
  )
}

function AppRoutes() {
  const navigate = useNavigate()

  const restoreOriginalUri = async (_oktaAuth, originalUri) => {
    navigate(
      toRelativeUrl(originalUri || '/dashboard', window.location.origin),
      { replace: true }
    )
  }

  return (
    <Security oktaAuth={oktaAuth} restoreOriginalUri={restoreOriginalUri}>
      <Suspense fallback={<PageLoader />}>
        <Routes>

          {/* ── Public: Okta callback — MUST be outside RequireAuth ── */}
          <Route path="/login/callback" element={<LoginCallback />} />

          {/* ── Protected shell ───────────────────────────────────── */}
          <Route
            element={
              <RequireAuth>
                <AppLayout />
              </RequireAuth>
            }
          >
            {/* ── Core ──────────────────────────────────────────── */}
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/documents" element={<DocumentsPage />} />
            
            <Route path="/backoffice/queue" element={
              <RoleGuard roles={['ECM_ADMIN', 'ECM_BACKOFFICE', 'ECM_REVIEWER']}>
                <BackofficeQueuePage />
              </RoleGuard>
            } />

            <Route path="/workflow" element={
              <RoleGuard roles={['ECM_ADMIN', 'ECM_BACKOFFICE', 'ECM_REVIEWER']}>
                <WorkflowPage />
              </RoleGuard>
            } />
            <Route path="/workflow/designer" element={
              <RoleGuard roles={['ECM_ADMIN', 'ECM_DESIGNER']}>
                <WorkflowDesigner />
              </RoleGuard>
            } />

            {/* ── Admin (ECM_ADMIN only) — nested sub-routes ────── */}
            <Route path="/admin" element={
              <RoleGuard roles={['ECM_ADMIN']}>
                <AdminPage />
              </RoleGuard>
            }>
              {/* Default: redirect /admin → /admin/users */}
              <Route index element={<Navigate to="users" replace />} />
              <Route path="users"         element={<UsersAdminPage />} />
              <Route path="departments"   element={<DepartmentsPage />} />
              <Route path="categories"    element={<CategoriesPage />} />
              <Route path="products"      element={<ProductsPage />} />
              <Route path="customers"     element={<CustomerManagementPage />} />
              <Route path="retention"     element={<RetentionPage />} />
              <Route path="settings"      element={<TenantSettingsPage />} />
              {/* Sprint-C additions */}
              <Route path="segments"      element={<SegmentsPage />} />
              <Route path="product-lines" element={<ProductLinesPage />} />
              <Route path="audit"         element={<AuditLogPage />} />
              <Route path="integrations/docusign" element={<DocuSignSettingsPage />} />
              <Route path="notifications" element={<NotificationPreferencesPage />} />
            </Route>

            {/* ── eForms: all authenticated users ───────────────── */}
            <Route path="/eforms" element={<EFormsPage />} />
            <Route path="/eforms/fill/:formKey" element={<FormFillPage />} />
            <Route path="/eforms/submissions/mine" element={<MySubmissionsPage />} />

            {/* ── eForms: review roles ───────────────────────────── */}
            <Route path="/eforms/submissions/queue" element={
              <RoleGuard roles={['ECM_ADMIN', 'ECM_BACKOFFICE', 'ECM_REVIEWER']}>
                <ReviewQueuePage />
              </RoleGuard>
            } />

            {/* ── eForms: designer roles ─────────────────────────── */}
            <Route path="/eforms/designer/list" element={
              <RoleGuard roles={['ECM_ADMIN', 'ECM_DESIGNER']}>
                <FormDesignerListPage />
              </RoleGuard>
            } />
            <Route path="/eforms/designer/new" element={
              <RoleGuard roles={['ECM_ADMIN', 'ECM_DESIGNER']}>
                <FormDesignerPage />
              </RoleGuard>
            } />
            <Route path="/eforms/designer/:id" element={
              <RoleGuard roles={['ECM_ADMIN', 'ECM_DESIGNER']}>
                <FormDesignerPage />
              </RoleGuard>
            } />
          </Route>

          {/* ── Default redirects ─────────────────────────────────── */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />

        </Routes>
      </Suspense>
    </Security>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AppRoutes />
        <Toaster position="top-right" />
      </BrowserRouter>
    </QueryClientProvider>
  )
}