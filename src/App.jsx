import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { Security, LoginCallback } from '@okta/okta-react'
import { toRelativeUrl } from '@okta/okta-auth-js'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { Suspense, lazy } from 'react'
import { oktaAuth } from './utils/oktaConfig'
import { ROLES, ROLE_GROUPS } from './utils/roles'

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
const CustomerSchemaPage    = lazy(() => import('./pages/admin/CustomerSchemaPage'))
const SegmentsPage           = lazy(() => import('./pages/admin/SegmentsPage'))
const ProductLinesPage       = lazy(() => import('./pages/admin/ProductLinesPage'))
const AuditLogPage           = lazy(() => import('./pages/admin/AuditLogPage'))
const RolesPage              = lazy(() => import('./pages/admin/RolesPage'))          // Sprint G
const DocuSignSettingsPage   = lazy(() => import('./pages/admin/DocuSignSettingsPage'))
const IntegrationsPage      = lazy(() => import('./pages/admin/IntegrationsPage'))
const NotificationPreferencesPage = lazy(() => import('./pages/admin/NotificationPreferencesPage'))
const EmailTemplatesPage = lazy(() => import('./pages/admin/EmailTemplatesPage'))
const CustomerPortfolioPage = lazy(() => import('./pages/admin/CustomerPortfolioPage'))
const CustomerDetailPage    = lazy(() => import('./pages/customers/CustomerDetailPage'))
const OcrPipelineConfigPage = lazy(() => import('./pages/admin/OcrPipelineConfigPage'))

// ── eForms pages ─────────────────────────────────────────────────────────────
const EFormsPage           = lazy(() => import('./pages/eforms/EFormsPage'))
const FormFillPage         = lazy(() => import('./pages/eforms/FormFillPage'))
const MySubmissionsPage    = lazy(() => import('./pages/eforms/MySubmissionsPage'))
const FormDesignerListPage = lazy(() => import('./pages/eforms/FormDesignerListPage'))
const FormDesignerPage     = lazy(() => import('./pages/eforms/FormDesignerPage'))

// ── Cases ─────────────────────────────────────────────────────────────────────
const CasesPage            = lazy(() => import('./pages/cases/CasesPage'))
const CaseDetailPage       = lazy(() => import('./pages/cases/CaseDetailPage'))

// ── External (no auth) ──────────────────────────────────────────────────────
const ExternalCasePage     = lazy(() => import('./pages/external/ExternalCasePage'))

// ── Batch processing ─────────────────────────────────────────────────────────
const BatchJobsPage      = lazy(() => import('./pages/batch/BatchJobsPage'))
const BatchDetailPage    = lazy(() => import('./pages/batch/BatchDetailPage'))
const BatchSettingsPage  = lazy(() => import('./pages/admin/BatchSettingsPage'))

// ── Review & Tasks ───────────────────────────────────────────────────────────
const ClassificationQueuePage = lazy(() => import('./pages/review/ClassificationQueuePage'))
const SpotCheckPage           = lazy(() => import('./pages/review/SpotCheckPage'))

// ── Other pages ───────────────────────────────────────────────────────────────
const BackofficeQueuePage  = lazy(() => import('./pages/backoffice/BackofficeQueuePage'))
const SessionExpiredModal  = lazy(() => import('./components/common/SessionExpiredModal'))
const SessionWarningModal  = lazy(() => import('./components/common/SessionWarningModal'))

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

  // Override default auth-required behavior.
  // Default: Security component calls signInWithRedirect() when auth expires.
  // Our override: do nothing — let SessionWarningModal handle the UX.
  // This prevents the surprise redirect to Okta mid-session.
  const onAuthRequired = () => {
    // Intentionally empty — SessionWarningModal / SessionExpiredModal handle this.
    // Only log for debugging.
    console.warn('[Security] onAuthRequired fired — SessionWarningModal will handle')
  }

  return (
    <Security oktaAuth={oktaAuth} restoreOriginalUri={restoreOriginalUri} onAuthRequired={onAuthRequired}>
      <Suspense fallback={<PageLoader />}>
        <Routes>

          {/* ── Public: Okta callback ──────────────────────────────────── */}
          <Route path="/login/callback" element={<LoginCallback />} />

          {/* ── External: no auth required (OTP-based) ────────────────── */}
          <Route path="/external/case/:inviteToken" element={<ExternalCasePage />} />

          {/* ── Protected shell ───────────────────────────────────────── */}
          <Route
            element={
              <RequireAuth>
                <AppLayout />
              </RequireAuth>
            }
          >
            {/* ── Core ─────────────────────────────────────────────── */}
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/documents" element={<DocumentsPage />} />

            <Route path="/review/documents" element={
              <RoleGuard roles={ROLE_GROUPS.OPERATIONS}>
                <BackofficeQueuePage />
              </RoleGuard>
            } />
            {/* Redirect old bookmarks/email links */}
            <Route path="/backoffice/queue" element={<Navigate to="/review/documents" replace />} />

            <Route path="/customers/:id/portfolio" element={
              <RoleGuard roles={ROLE_GROUPS.OPERATIONS}>
                <CustomerPortfolioPage />
              </RoleGuard>
            } />
            <Route path="/customers/:id" element={
              <RoleGuard roles={ROLE_GROUPS.OPERATIONS}>
                <CustomerDetailPage />
              </RoleGuard>
            } />

            <Route path="/cases" element={
              <RoleGuard roles={ROLE_GROUPS.OPERATIONS}>
                <CasesPage />
              </RoleGuard>
            } />
            <Route path="/cases/:id" element={
              <RoleGuard roles={ROLE_GROUPS.OPERATIONS}>
                <CaseDetailPage />
              </RoleGuard>
            } />

            {/* ── Batch Processing ─────────────────────────────────── */}
            <Route path="/batch/jobs" element={
              <RoleGuard roles={ROLE_GROUPS.OPERATIONS}>
                <BatchJobsPage />
              </RoleGuard>
            } />
            <Route path="/batch/jobs/:id" element={
              <RoleGuard roles={ROLE_GROUPS.OPERATIONS}>
                <BatchDetailPage />
              </RoleGuard>
            } />

            {/* ── Review & Tasks ──────────────────────────────────── */}
            <Route path="/review/classification" element={
              <RoleGuard roles={ROLE_GROUPS.OPERATIONS}>
                <ClassificationQueuePage />
              </RoleGuard>
            } />
            <Route path="/review/spot-check" element={
              <RoleGuard roles={ROLE_GROUPS.OPERATIONS}>
                <SpotCheckPage />
              </RoleGuard>
            } />

            <Route path="/workflow" element={
              <RoleGuard roles={ROLE_GROUPS.OPERATIONS}>
                <WorkflowPage />
              </RoleGuard>
            } />
            <Route path="/workflow/designer" element={
              <RoleGuard roles={ROLE_GROUPS.DESIGN}>
                <WorkflowDesigner />
              </RoleGuard>
            } />

            {/* ── Admin (ECM_ADMIN or ECM_SUPER_ADMIN) ────────────────── */}
            <Route path="/admin" element={
              <RoleGuard roles={ROLE_GROUPS.ADMIN_OR_SUPER}>
                <AdminPage />
              </RoleGuard>
            }>
              <Route index element={<Navigate to="customers" replace />} />
              <Route path="users"         element={<RoleGuard roles={ROLE_GROUPS.SUPER_ONLY}><UsersAdminPage /></RoleGuard>} />
              <Route path="departments"   element={<RoleGuard roles={ROLE_GROUPS.SUPER_ONLY}><DepartmentsPage /></RoleGuard>} />
              <Route path="roles"         element={<RoleGuard roles={ROLE_GROUPS.SUPER_ONLY}><RolesPage /></RoleGuard>} />
              <Route path="categories"    element={<CategoriesPage />} />
              <Route path="products"      element={<ProductsPage />} />
              <Route path="customers"     element={<CustomerManagementPage />} />
              <Route path="customer-schema" element={<CustomerSchemaPage />} />
              <Route path="retention"     element={<RetentionPage />} />
              <Route path="settings"      element={<RoleGuard roles={ROLE_GROUPS.SUPER_ONLY}><TenantSettingsPage /></RoleGuard>} />
              <Route path="segments"      element={<SegmentsPage />} />
              <Route path="product-lines" element={<ProductLinesPage />} />
              <Route path="audit"         element={<AuditLogPage />} />
              <Route path="ocr-pipeline" element={<OcrPipelineConfigPage />} />
              <Route path="integrations" element={<IntegrationsPage />} />
              <Route path="integrations/docusign" element={<DocuSignSettingsPage />} />
              <Route path="notifications" element={<NotificationPreferencesPage />} />
              <Route path="email-templates" element={<EmailTemplatesPage />} />
              <Route path="batch-settings" element={<BatchSettingsPage />} />
            </Route>

            {/* ── eForms ───────────────────────────────────────────── */}
            <Route path="/eforms"                      element={<EFormsPage />} />
            <Route path="/eforms/fill/:formKey"        element={<FormFillPage />} />
            <Route path="/eforms/submissions/mine"     element={<MySubmissionsPage />} />

            <Route path="/eforms/designer/list" element={
              <RoleGuard roles={ROLE_GROUPS.DESIGN}>
                <FormDesignerListPage />
              </RoleGuard>
            } />
            <Route path="/eforms/designer/new" element={
              <RoleGuard roles={ROLE_GROUPS.DESIGN}>
                <FormDesignerPage />
              </RoleGuard>
            } />
            <Route path="/eforms/designer/:id" element={
              <RoleGuard roles={ROLE_GROUPS.DESIGN}>
                <FormDesignerPage />
              </RoleGuard>
            } />
          </Route>

          {/* ── Default redirects ─────────────────────────────────────── */}
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
        <Suspense fallback={null}>
          <SessionWarningModal />
          <SessionExpiredModal />
        </Suspense>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
