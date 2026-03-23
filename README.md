# 🖥️ Servus ECM — Frontend

> **React 19 SPA for the Servus Enterprise Content Management Platform**
> White-label · Okta OIDC/PKCE · Low-code eForm Designer · Workflow Inbox

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-7-646CFF?logo=vite)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-06B6D4?logo=tailwindcss)](https://tailwindcss.com/)
[![TanStack Query](https://img.shields.io/badge/TanStack%20Query-v5-FF4154)](https://tanstack.com/query)
[![Okta](https://img.shields.io/badge/Okta-OIDC%2FPKCE-007DC1?logo=okta)](https://developer.okta.com/)

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Architecture Patterns](#architecture-patterns)
- [Authentication (Okta OIDC)](#authentication-okta-oidc)
- [State Management](#state-management)
- [API Layer](#api-layer)
- [Routing & Role Guards](#routing--role-guards)
- [Modules & Pages](#modules--pages)
  - [Dashboard](#dashboard)
  - [Documents](#documents-module)
  - [Workflow](#workflow-module)
  - [eForms](#eforms-module)
  - [Admin](#admin-module)
- [eForm Designer Deep Dive](#eform-designer-deep-dive)
- [Component Library](#component-library)
- [Known Issues & Bugs](#known-issues--bugs)
- [Local Development Setup](#local-development-setup)
- [Environment Variables](#environment-variables)
- [Build & Deployment](#build--deployment)

---

## Overview

The ECM frontend is a React 19 single-page application. It provides:

- **Document management**: upload, browse, search, view, and download documents
- **Workflow inbox**: approve/reject/request-info on assigned review tasks
- **Low-code eForm Designer**: drag-and-drop builder for dynamic forms with conditional logic
- **Form renderer**: fills and submits eForms from the published schema
- **Admin panel**: full platform administration — users, departments, products, retention, tenant branding
- **SSO via Okta/Entra ID**: OIDC/PKCE login with role-based navigation

All API calls go through the ECM Gateway on port 8080. No service is called directly.

---

## Tech Stack

| Technology | Version | Role |
|---|---|---|
| **React** | 19 | UI framework. Functional components + hooks throughout. |
| **Vite** | 7 | Dev server + build tool. `/api` proxy to gateway in dev. |
| **Tailwind CSS** | v4 (`@tailwindcss/vite` plugin) | Utility-first styling. No config file needed in v4. |
| **Okta React SDK** | 6.10 | OIDC/PKCE login flow, token management, callback handling. |
| **okta-auth-js** | 7.14 | Core Okta JS SDK used by the React SDK. |
| **React Router** | 6 | Client-side routing with nested routes (`<Outlet>`). |
| **TanStack Query** | v5 | Server state: fetch, cache, background refresh. `staleTime` 5 min. |
| **Zustand** | Latest | Client state: current user (`useUserStore`) and form designer (`useEFormsDesignerStore`). |
| **Axios** | Latest | HTTP client with request/response interceptors. |
| **Lucide React** | 0.263.1 | Icon set used throughout the UI. |
| **react-hot-toast** | Latest | Toast notifications for API feedback. |
| **vite-plugin-terminal** | Dev only | Logs to terminal during development. Should be dev-only. |

---

## Project Structure

```
ecm-frontend/
├── package.json
├── vite.config.js              ← Dev server config + /api proxy to :8080
├── index.html
└── src/
    ├── main.jsx                ← Entry point: QueryClientProvider + BrowserRouter
    ├── App.jsx                 ← Route definitions + Okta Security wrapper
    ├── index.css               ← Tailwind v4 base import
    │
    ├── api/                    ← Layer 1: Raw Axios calls (no React hooks)
    │   ├── apiClient.js        ← Axios instance + JWT interceptor + 401 handler
    │   ├── authApi.js          ← getMe(), ping(), logout()
    │   ├── documentsApi.js     ← upload(), list(), get(), download(), delete()
    │   ├── workflowApi.js      ← instances, tasks, definitions, groups, templates, clone
    │   ├── eformsApi.js        ← definitions, submissions, render, designer CRUD
    │   ├── adminApi.js         ← users, departments, categories, products, config
    │   └── searchApi.js        ← full-text search
    │
    ├── hooks/                  ← Layer 2: TanStack Query wrappers (data + mutations)
    │   ├── useCurrentUser.js   ← useQuery → GET /api/auth/me
    │   ├── useWorkflow.js      ← useInstances, useTasks, useDefinitions, useGroups
    │   ├── useEForms.js        ← useFormDefinitions, useSubmissions, useReviewQueue
    │   ├── useAdmin.js         ← useUsers, useDepartments, useProducts, etc.
    │   └── useSearch.js        ← useDocumentSearch
    │
    ├── store/                  ← Client-only state (Zustand)
    │   ├── userStore.js        ← Default export: user, roles, hasRole(), hasAnyRole()
    │   ├── eformsStore.js      ← Named export: live form schema being designed
    │   ├── tenantStore.js      ← Tenant branding config (name, logo, colour)
    │   └── uiStore.js          ← UI state: sidebar collapsed
    │
    ├── components/
    │   ├── common/
    │   │   ├── RequireAuth.jsx         ← Okta auth gate (redirects to login)
    │   │   ├── RoleGuard.jsx           ← Role-based route guard
    │   │   └── ErrorBoundary.jsx       ← Catches render errors gracefully
    │   ├── layout/
    │   │   ├── AppLayout.jsx           ← Sidebar + header shell; <Outlet> for pages
    │   │   ├── Sidebar.jsx             ← Nav links, user info, logout
    │   │   └── Header.jsx              ← Page title (longest-prefix PAGE_META match)
    │   ├── documents/
    │   │   ├── DocumentTable.jsx       ← Paginated document list
    │   │   ├── DocumentUpload.jsx      ← Drag-and-drop file uploader
    │   │   ├── DocumentViewerModal.jsx ← PDF viewer + metadata panel
    │   │   └── DocumentSearchPanel.jsx ← OpenSearch full-text query UI
    │   ├── workflow/
    │   │   ├── InstanceList.jsx        ← Workflow instances with status badges
    │   │   ├── TaskInbox.jsx           ← My tasks: approve/reject/request-info
    │   │   └── WorkflowAdmin.jsx       ← Admin: create workflow definitions
    │   └── eforms/
    │       ├── StatusBadge.jsx         ← Coloured pill badge for form/submission status
    │       ├── designer/
    │       │   ├── DesignerCanvas.jsx      ← Drop target + field layout grid
    │       │   ├── FieldPalette.jsx        ← Drag source: available field types
    │       │   ├── FieldConfigPanel.jsx    ← Right panel: selected field properties
    │       │   ├── FormSettingsPanel.jsx   ← Form-level: layout, labels, draft behaviour
    │       │   └── RuleBuilder.jsx         ← Point-and-click conditional rule editor
    │       └── renderer/
    │           ├── FormRenderer.jsx        ← Renders live form from JSON schema
    │           └── FieldRenderer.jsx       ← Renders individual field by type
    │
    ├── pages/
    │   ├── dashboard/
    │   │   └── DashboardPage.jsx
    │   ├── documents/
    │   │   └── DocumentsPage.jsx
    │   ├── workflow/
    │   │   ├── WorkflowPage.jsx
    │   │   └── WorkflowDesignerPage.jsx
    │   ├── eforms/
    │   │   ├── EFormsPage.jsx              ← Published form catalogue
    │   │   ├── FormFillPage.jsx            ← Fill + submit a form
    │   │   ├── MySubmissionsPage.jsx       ← Submitter's history
    │   │   ├── ReviewQueuePage.jsx         ← Backoffice review queue
    │   │   ├── FormDesignerListPage.jsx    ← Designer: list of forms
    │   │   └── FormDesignerPage.jsx        ← Designer: full editor
    │   └── admin/
    │       ├── AdminPage.jsx               ← Admin shell with nested <Outlet>
    │       ├── UsersAdminPage.jsx
    │       ├── DepartmentsPage.jsx
    │       ├── CategoriesPage.jsx
    │       ├── ProductsPage.jsx
    │       ├── ProductLinesPage.jsx
    │       ├── SegmentsPage.jsx
    │       ├── RetentionPage.jsx
    │       ├── TenantSettingsPage.jsx
    │       ├── CustomerManagementPage.jsx
    │       ├── AuditLogPage.jsx
    │       ├── NotificationPreferencesPage.jsx
    │       ├── EmailTemplatesPage.jsx
    │       └── CustomerPortfolioPage.jsx
    │
    └── utils/
        ├── oktaConfig.js       ← OktaAuth singleton instance
        └── ruleEngine.js       ← Client-side conditional rule evaluator
```

---

## Architecture Patterns

### Three-Layer Data Pattern

All data fetching follows a strict three-layer separation:

```
[module]Api.js         →   use[Module].js hook   →   Page/Component
(raw Axios call)           (TanStack Query)           (render only)

Example:
documentsApi.list()    →   useDocuments() hook    →   DocumentsPage.jsx
```

**Layer 1 — `api/`**: Pure functions that call Axios. No hooks, no React, no state. Returns raw responses. Easy to test in isolation.

**Layer 2 — `hooks/`**: TanStack Query wrappers. `useQuery` for reads, `useMutation` for writes. Handles loading/error states, caching, and background re-fetching.

**Layer 3 — Pages/Components**: Consume hooks. No `fetch`, no `axios.get`. Only rendering logic.

### API Response Unwrapping

The backend wraps all responses in `{ success, data, message }`. The `apiClient.js` response interceptor automatically unwraps this:

```javascript
// Before interceptor: response.data = { success: true, data: [...], message: "ok" }
// After interceptor:  response.data = [...]   ← already unwrapped
```

Hooks then access `response.data` directly without needing `.data?.data` chaining.

### Full-Height Layout Detection

`AppLayout.jsx` detects whether a route needs full-height layout (e.g. the Form Designer needs to fill the viewport without a scroll wrapper). It does this by prefix-matching the current pathname against `FULL_HEIGHT_ROUTES`:

```javascript
const FULL_HEIGHT_ROUTES = ['/eforms/designer']
// Matches: routes that need overflow:hidden + flex column layout
// All other routes: overflow-y:auto + p-6 padding
```

### Page Title Resolution

`Header.jsx` resolves page titles by **longest-prefix matching** against a `PAGE_META` map. This handles dynamic route segments like `/eforms/fill/:formKey` or `/admin/users`:

```javascript
const PAGE_META = {
  '/dashboard':             { title: 'Dashboard' },
  '/documents':             { title: 'Documents' },
  '/eforms/designer':       { title: 'Form Designer' },
  '/eforms/fill':           { title: 'Fill Form' },
  '/admin/users':           { title: 'User Management' },
  // etc.
}
// /admin/users/123 → matches /admin/users (longest prefix)
```

---

## Authentication (Okta OIDC)

### Setup

The `OktaAuth` singleton is created once in `utils/oktaConfig.js` and shared across the app. The `<Security>` wrapper in `App.jsx` provides auth context.

```javascript
// utils/oktaConfig.js
export const oktaAuth = new OktaAuth({
  issuer:       'https://your-domain/oauth2/your-auth-server',
  clientId:     'your-spa-client-id',
  redirectUri:  `${window.location.origin}/login/callback`,
  scopes:       ['openid', 'profile', 'email', 'groups'],
  pkce:         true,
})
```

### Login Flow

```
1. User visits any protected route
2. RequireAuth.jsx detects: !isAuthenticated && !isPending
3. oktaAuth.signInWithRedirect() → browser to Okta login page
4. User authenticates → Okta redirects to /login/callback
5. <LoginCallback /> exchanges code for tokens (PKCE — no client secret)
6. Tokens stored in OktaAuth token manager (sessionStorage)
7. restoreOriginalUri() redirects to /dashboard
8. useCurrentUser() fires GET /api/auth/me → populates useUserStore
```

### Token Attachment

Every Axios request goes through the interceptor in `apiClient.js`:

```javascript
apiClient.interceptors.request.use(async (config) => {
  const token = await oktaAuth.getAccessToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})
```

On 401, the response interceptor triggers `oktaAuth.signInWithRedirect()`. The pending HTTP request is abandoned (never-resolving Promise) so no error UI appears.

### `RequireAuth` Component

```jsx
// components/common/RequireAuth.jsx
export default function RequireAuth({ children }) {
  const { authState } = useOktaAuth()
  if (!authState || authState.isPending) return <Spinner />
  if (!authState.isAuthenticated) {
    oktaAuth.signInWithRedirect()
    return null
  }
  return children
}
```

---

## State Management

### `useUserStore` (Zustand — default export)

```javascript
import useUserStore from '../store/userStore'

// Usage in component:
const { user, hasRole, hasAnyRole } = useUserStore()

// CRITICAL: Always import as default, never named
// ✅ import useUserStore from '../store/userStore'
// ❌ import { useUserStore } from '../store/userStore'
```

**Store shape:**

| Field | Type | Description |
|---|---|---|
| `user` | `UserSessionDto \| null` | Populated after `GET /api/auth/me` |
| `isLoading` | `boolean` | True while fetching user |
| `hasRole(role)` | `(string) => boolean` | True if user has the given role |
| `hasAnyRole(roles)` | `(string[]) => boolean` | True if user has any of the given roles |
| `setUser(user)` | action | Set user (called by `useCurrentUser` hook) |
| `clearUser()` | action | Clear on logout |

### `useEFormsDesignerStore` (Zustand — named export)

```javascript
import { useEFormsDesignerStore } from '../store/eformsStore'
```

Holds the entire live form being designed in the Form Designer. Separate from server state — this is the local working copy.

**Store shape:**

| Field | Type | Description |
|---|---|---|
| `definitionId` | `string \| null` | `null` for new forms |
| `meta` | `FormMeta` | `name`, `description`, `formKey`, `productType`, `formType`, `tags` |
| `schema` | `FormSchema` | Live schema: `sections[]`, `globalRules[]`, layout settings |
| `selectedFieldId` | `string \| null` | Currently selected field in the designer canvas |
| `isDirty` | `boolean` | True if unsaved changes exist |
| `activePanel` | `'canvas' \| 'settings' \| 'rules'` | Which right panel is shown |

**Key actions:**

```javascript
initFromDefinition(definition)   // Load existing form from server
addSection()                     // Add new section, returns sectionId
addField(sectionId, fieldType)   // Add field to section, returns fieldId
updateField(sectionId, fieldId, partial) // Update field properties
removeField(sectionId, fieldId)
reorderFields(sectionId, fromIndex, toIndex)
addGlobalRule(rule)              // Add cross-field conditional rule
selectField(fieldId)             // Update selection (triggers FieldConfigPanel)
markClean()                      // Called after successful save
reset()                          // Clear everything (new form)
```

**Critical rules:**
- Never call `getState()` inside JSX — always subscribe via the hook
- `eformsStore` is a **named** export; `userStore` is a **default** export

---

## API Layer

### `apiClient.js`

Base Axios instance with:
- `baseURL: 'http://localhost:8080'` — ⚠️ hardcoded; should be `''` or `import.meta.env.VITE_API_URL` for production
- 30-second timeout
- Request interceptor: attaches `Authorization: Bearer <token>`
- Response interceptor: unwraps `ApiResponse<T>` envelope, handles 401

### Per-module API files

Each file exports pure async functions. No hooks, no React state.

```javascript
// api/documentsApi.js
export const uploadDocument = (file, metadata) => {
  const form = new FormData()
  form.append('file', file)
  if (metadata) form.append('metadata', JSON.stringify(metadata))
  return apiClient.post('/api/documents/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
}

export const listDocuments = (params) =>
  apiClient.get('/api/documents', { params })

export const downloadDocument = (id) =>
  apiClient.get(`/api/documents/${id}/download`, { responseType: 'blob' })
```

### `hooks/` — TanStack Query wrappers

```javascript
// hooks/useWorkflow.js
export function useWorkflowInstances(filters) {
  return useQuery({
    queryKey: ['workflow', 'instances', filters],
    queryFn: () => workflowApi.listInstances(filters),
    staleTime: 30_000,  // ← 30s for volatile data
  })
}

export function useCompleteTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ taskId, payload }) => workflowApi.completeTask(taskId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflow', 'tasks'] })
      queryClient.invalidateQueries({ queryKey: ['workflow', 'instances'] })
      toast.success('Task completed')
    },
    onError: (err) => toast.error(err.message),
  })
}
```

---

## Routing & Role Guards

### Route Tree

```
/                          → redirect to /dashboard
/login/callback            → <LoginCallback /> (Okta — must be outside RequireAuth)

<RequireAuth>
  <AppLayout>              ← Persistent sidebar + header
    /dashboard
    /documents
    /workflow              [ECM_ADMIN, ECM_BACKOFFICE, ECM_REVIEWER]
    /workflow/designer     [ECM_ADMIN, ECM_DESIGNER]

    /admin                 [ECM_ADMIN only]
      /admin/users
      /admin/departments
      /admin/categories
      /admin/products
      /admin/product-lines
      /admin/segments
      /admin/customers
      /admin/retention
      /admin/settings
      /admin/audit

    /eforms                ← All authenticated users
    /eforms/fill/:formKey
    /eforms/submissions/mine
    /eforms/submissions/queue   [ECM_ADMIN, ECM_BACKOFFICE, ECM_REVIEWER]
    /eforms/designer/list       [ECM_ADMIN, ECM_DESIGNER]
    /eforms/designer/new        [ECM_ADMIN, ECM_DESIGNER]
    /eforms/designer/:id        [ECM_ADMIN, ECM_DESIGNER]
```

### `RoleGuard` Component

```jsx
// Renders children if user has any of the required roles
// Renders 'Not Authorised' UI otherwise (does NOT redirect)
<RoleGuard roles={['ECM_ADMIN', 'ECM_BACKOFFICE']}>
  <WorkflowPage />
</RoleGuard>
```

Role values are checked against `useUserStore().user.roles` (the array of role strings from the `GET /api/auth/me` response).

---

## Modules & Pages

### Dashboard

**Path:** `/dashboard`
**Access:** All authenticated users

Displays a personalised landing page with the user's name, current roles, and summary statistics (documents pending OCR, active workflows, forms pending review). Data sourced from API queries. Statistics tiles link to the relevant module.

---

### Documents Module

**Path:** `/documents`
**Access:** All authenticated users (filtered by department)

#### DocumentsPage

Main document list. Contains:
- `DocumentTable` — paginated table with columns: Name, Category, Status, Uploaded By, Date, Actions
- `DocumentUpload` — collapsible drag-and-drop upload panel
- `DocumentSearchPanel` — full-text search via OpenSearch

#### DocumentUpload

```
Drag a file here  OR  click to browse
Category: [Dropdown ▼]     Display name: [___________]
[Upload]
```

- Accepts: PDF, images (JPG, PNG, TIFF), Office documents (DOCX, XLSX)
- After upload: row appears immediately in table with status `PENDING_OCR`
- OCR completion updates status to `OCR_COMPLETED` → `ACTIVE` (requires page refresh or polling)

#### DocumentViewerModal

Opens when clicking the eye icon on a document row.
- Left panel: PDF viewer (currently metadata-only; PDF.js integration planned)
- Right panel: metadata (name, category, status, uploaded by, dates, tags)
- Download button: streams binary from MinIO via gateway

#### Status badges

| Status | Colour |
|---|---|
| `PENDING_OCR` | Orange |
| `OCR_COMPLETED` | Blue |
| `ACTIVE` | Green |
| `ARCHIVED` | Grey |

---

### Workflow Module

**Path:** `/workflow`
**Access:** `ECM_ADMIN`, `ECM_BACKOFFICE`, `ECM_REVIEWER`

#### WorkflowPage

Tab-based layout with three sections:

**1. Task Inbox (My Tasks)**
Lists all Flowable tasks assigned to the current user's role or group.

For each task:

| Action | Button | Requirement | Outcome |
|---|---|---|---|
| Approve | Green ✓ | — | Task complete; if final step → `COMPLETED_APPROVED` |
| Reject | Red ✗ | Comment required | Workflow → `COMPLETED_REJECTED` |
| Request Info | Amber ℹ | — | Status → `INFO_REQUESTED`; inline form shown to submitter |
| Pass (triage) | Grey → | — | Forward without decision |

When a task is in `INFO_REQUESTED` state, an inline `ProvideInfoForm` is rendered directly in `TaskInbox` for the submitter to respond.

**2. Instance List**
All workflow instances (not just current user's tasks). Filterable by status.

`InstanceList` columns: Document Name · Status · Started By · Start Date · SLA Deadline · Actions

Status colour coding:

| Status | Colour |
|---|---|
| `ACTIVE` | Blue |
| `INFO_REQUESTED` | Amber |
| `COMPLETED_APPROVED` | Green |
| `COMPLETED_REJECTED` | Red |
| `CANCELLED` | Grey |

**3. Workflow Admin** (`WorkflowAdmin.jsx`)
Create and manage workflow definition configs (name, process key, assigned role, SLA hours). Available to `ECM_ADMIN`.

#### WorkflowDesignerPage

**Path:** `/workflow/designer`
**Access:** `ECM_ADMIN`, `ECM_DESIGNER`

Visual BPMN 2.0 workflow designer using bpmn-js. Features:
- **Template list** grouped by status: Published, Drafts, Deprecated
- **New Template** modal → creates a DRAFT with starter BPMN (Start → Review → Decision → End)
- **Full-screen editor** with bpmn-js canvas, ECM palette (left), and properties panel (right)
- **Clone**: Any Published or Deprecated template can be cloned into a new DRAFT via "Clone as Draft" button
- **Read-only mode**: Opening a Published or Deprecated template shows the designer in view-only mode (Save button hidden, "Read-only — clone to edit" banner)
- **Publish**: DRAFT → Published deploys BPMN XML to Flowable engine
- **Deprecate**: Published → Deprecated (prevents new instances, running instances unaffected)

On publish, the backend post-processes the BPMN XML to inject `taskCreatedListener` (notification events) and `processEndListener` (status updates) if missing.

---

### eForms Module

**Path:** `/eforms`
**Access:** Varies by sub-route

#### EFormsPage — Form Catalogue

Lists all `PUBLISHED` form definitions. Cards show: form name, product type, form type, description. "Fill" button links to `/eforms/fill/:formKey`.

#### FormFillPage

**Path:** `/eforms/fill/:formKey`

Loads the published form schema and renders it via `FormRenderer`. Features:
- All field types rendered appropriately (text, dropdown, date picker, radio buttons, checkboxes)
- Conditional fields: rules evaluated in real time by `ruleEngine.js` as fields change
- Save Draft: creates a `DRAFT` submission; can return later
- Submit: validates required fields client-side → calls submission API → shows confirmation

#### MySubmissionsPage

History of current user's form submissions. Shows: form name, submission date, status, DocuSign signing status. Submissions are read-only after submission.

#### ReviewQueuePage

**Access:** `ECM_ADMIN`, `ECM_BACKOFFICE`, `ECM_REVIEWER`

Lists all `SUBMITTED` form submissions awaiting review. Reviewer can approve or reject each with a note. Approved submissions trigger downstream processing (PDF generation, DocuSign).

#### FormDesignerListPage

**Access:** `ECM_ADMIN`, `ECM_DESIGNER`

Lists all form definitions (all statuses). Buttons: Edit (→ `/eforms/designer/:id`), Publish, Archive. "New Form" button → `/eforms/designer/new`.

#### FormDesignerPage

**Access:** `ECM_ADMIN`, `ECM_DESIGNER`

The full low-code form builder. See [eForm Designer Deep Dive](#eform-designer-deep-dive) below.

---

### Admin Module

**Path:** `/admin/**`
**Access:** `ECM_ADMIN` only

`AdminPage` is a nested layout — it renders the sidebar sub-navigation and an `<Outlet>` for the active sub-page.

| Sub-path | Component | What it manages |
|---|---|---|
| `/admin/users` | `UsersAdminPage` | List users, activate/deactivate, assign ECM roles |
| `/admin/departments` | `DepartmentsPage` | Department hierarchy (parent/child) |
| `/admin/categories` | `CategoriesPage` | Admin-enriched document category hierarchy |
| `/admin/products` | `ProductsPage` | Product catalogue with custom `product_schema` |
| `/admin/product-lines` | `ProductLinesPage` | Product line groupings |
| `/admin/segments` | `SegmentsPage` | Customer segments |
| `/admin/customers` | `CustomerManagementPage` | Customer management (placeholder for CRM) |
| `/admin/retention` | `RetentionPage` | Retention policies: archive/purge thresholds |
| `/admin/settings` | `TenantSettingsPage` | Tenant branding: name, logo, brand colour, timezone |
| `/admin/audit` | `AuditLogPage` | Searchable, filterable audit event log |
| `/admin/notifications` | `NotificationPreferencesPage` | User notification preferences (IN_APP / EMAIL per category) |
| `/admin/email-templates` | `EmailTemplatesPage` | Email template editor (HTML subject + body) |
| `/admin/customer-portfolio` | `CustomerPortfolioPage` | Customer portfolio and enrollments |

Default redirect: `/admin` → `/admin/users`

---

## eForm Designer Deep Dive

The Form Designer (`FormDesignerPage`) is a three-panel layout powered by `useEFormsDesignerStore`.

```
┌─────────────────────────────────────────────────────────────┐
│  [Save Draft]  [Publish]   Form Name ___________  [✗ isDirty]│
├──────────────┬──────────────────────────┬───────────────────┤
│  Field       │     Design Canvas        │  Config / Settings│
│  Palette     │                          │  Panel            │
│              │  Section 1               │                   │
│  Text Input  │  ┌────────┬────────┐    │  (Field selected) │
│  Text Area   │  │ Name   │ Email  │    │  Label: _______   │
│  Number      │  └────────┴────────┘    │  Key:   _______   │
│  Email       │  + Add field            │  Required: ☐      │
│  Phone       │                          │  Placeholder: ___ │
│  Date        │  Section 2               │  Options: + Add   │
│  Dropdown    │  ┌────────────────┐     │                   │
│  Option Btn  │  │ Loan Amount    │     │  [Rules tab]      │
│  Checkbox    │  └────────────────┘     │  [Settings tab]   │
│  Divider     │  + Add section          │                   │
└──────────────┴──────────────────────────┴───────────────────┘
```

### Field Palette (`FieldPalette.jsx`)

Drag source for available field types. Each type renders a labelled tile. Drag onto the canvas to add to the active section.

Available field types and their defaults:

| Type | Default `colSpan` | Has Options | Has Validation |
|---|---|---|---|
| `TEXT_INPUT` | 6 | No | minLength, maxLength |
| `TEXT_AREA` | 12 | No | maxLength, rows |
| `NUMBER` | 6 | No | min, max |
| `EMAIL` | 6 | No | format validation |
| `PHONE` | 6 | No | format validation |
| `DATE` | 6 | No | — |
| `DROPDOWN` | 6 | Yes (value/label pairs) | — |
| `OPTION_BUTTON` | 12 | Yes (value/label pairs) | — |
| `CHECKBOX` | 6 | No | — |
| `CHECKBOX_GROUP` | 12 | Yes | — |
| `SECTION_HEADER` | 12 | No | — |
| `PARAGRAPH` | 12 | No | — |
| `DIVIDER` | 12 | No | — |

### Design Canvas (`DesignerCanvas.jsx`)

- 12-column grid layout (`colSpan` on each field = column width)
- Click a field → selects it → `FieldConfigPanel` populates
- Drag field handle → `reorderFields(sectionId, from, to)` in store
- "+ Add Section" button → `addSection()` in store
- "+ Add Field" button per section → `addField(sectionId, type)` in store

### Field Config Panel (`FieldConfigPanel.jsx`)

Right panel. Renders when a field is selected (`selectedFieldId` in store). Shows:
- Label (text input)
- Field key (identifier, used in rules and submission data)
- Required toggle
- Placeholder text
- Help text
- Validation settings (based on field type)
- Options editor (for `DROPDOWN`, `OPTION_BUTTON`, `CHECKBOX_GROUP`) — add/remove/reorder value-label pairs

Changes call `updateField(sectionId, fieldId, partial)` and set `isDirty = true`.

### Rule Builder (`RuleBuilder.jsx`)

The Rules tab in the Config Panel. Allows creating conditional rules without code.

A rule has:
```
WHEN  [field: loanType]  [equals]  [REFINANCE]
THEN  [show/hide/require/disable]  [field: propertyAddress]
```

Supported operators: `equals` · `not_equals` · `contains` · `greater_than` · `less_than` · `is_empty` · `is_not_empty`

Supported actions: `SHOW` · `HIDE` · `REQUIRE` · `DISABLE`

Rules are stored in the `rules[]` array on the `FormField`. Global rules (spanning multiple fields) are in `schema.globalRules[]` and managed via the Form Settings panel.

### Form Settings Panel (`FormSettingsPanel.jsx`)

Top-level form configuration:
- `layout`: `SINGLE_PAGE` (all sections at once) or `WIZARD` (step-by-step navigation)
- `allowSaveDraft`: toggle
- `confirmOnSubmit`: show confirmation dialog before submit
- `submitButtonLabel`: customise button text
- `productType` / `formType`: classification for the catalogue

### Rule Engine (`utils/ruleEngine.js`)

Client-side rule evaluation. Called by `FormRenderer` on every field change.

```javascript
// ruleEngine.js
export function evaluateRules(rules, allFieldValues) {
  // Returns: { [fieldId]: { visible: bool, required: bool, disabled: bool } }
}
```

The same rules are also evaluated server-side (`RuleEngineService.java`) before accepting a submission. Client-side evaluation is for UX only; server-side is authoritative.

---

## Component Library

### Layout Components

**`AppLayout.jsx`**
- Persistent sidebar + header shell
- Detects full-height routes via `FULL_HEIGHT_ROUTES` prefix matching
- Full-height routes: `overflow-hidden flex-col` (no scroll wrapper around page)
- Standard routes: `overflow-y-auto p-6` (scrollable page with padding)

**`Sidebar.jsx`**
- Navigation links grouped by module
- Role-based link visibility (checks `useUserStore().hasAnyRole()`)
- User display name + role badges at bottom
- Logout button calls `oktaAuth.signOut()`

**`Header.jsx`**
- Resolves page title from current pathname using longest-prefix `PAGE_META` matching
- Handles dynamic segments: `/admin/users/123` → title "User Management"
- **Notification bell**: Polls `GET /api/notifications/count` every 30s. Badge shows unread count (99+ cap). Dropdown lists recent notifications with mark-as-read. Clicking a notification navigates to its `link` (e.g., `/backoffice/queue`)

### Common Components

**`RequireAuth.jsx`** — Okta auth gate. Redirects unauthenticated users to login. Shows spinner while auth state is loading.

**`RoleGuard.jsx`** — Role-based visibility. Accepts `roles` prop (array). Shows "Not Authorised" if user lacks all listed roles.

**`ErrorBoundary.jsx`** — React error boundary. Catches render-time errors, shows fallback UI instead of a blank crash screen.

### eForm Components

**`StatusBadge.jsx`**

```jsx
<StatusBadge status="SUBMITTED" />
// Renders a coloured pill: "Submitted" (blue)
```

Status → colour mapping:

| Status | Colour |
|---|---|
| `DRAFT` | Grey |
| `SUBMITTED` | Blue |
| `PENDING_SIGNATURE` | Amber |
| `SIGNED` | Teal |
| `IN_REVIEW` | Purple |
| `APPROVED` | Green |
| `REJECTED` | Red |
| `COMPLETED` | Dark green |

**`FormRenderer.jsx`**

Renders a complete form from a `FormSchema` JSON object. Features:
- Iterates `schema.sections[]` → renders each section heading and its `fields[]`
- Calls `evaluateRules()` after each field change to show/hide conditional fields
- Manages form values in local `useState`
- Exposes `onSubmit(values)` and `onSaveDraft(values)` callbacks

**`FieldRenderer.jsx`**

Renders a single field based on its `type`. Switch-based dispatch:
- `TEXT_INPUT`, `EMAIL`, `PHONE` → `<input type="text">`
- `NUMBER` → `<input type="number">` with min/max
- `DATE` → `<input type="date">`
- `TEXT_AREA` → `<textarea rows={field.rows}>`
- `DROPDOWN` → `<select>`
- `OPTION_BUTTON` → `<input type="radio">` group
- `CHECKBOX` → `<input type="checkbox">`
- `CHECKBOX_GROUP` → multiple `<input type="checkbox">`
- `SECTION_HEADER` → styled `<h3>`
- `PARAGRAPH` → `<p>`
- `DIVIDER` → `<hr>`

---

## Known Issues & Bugs

### 🔴 High Priority

**`apiClient.js` has a hardcoded `baseURL: 'http://localhost:8080'`**

In any deployed environment (staging, production), all API calls will fail because the browser tries to reach `localhost:8080` on the _user's machine_, not the server.

*Fix:*
```javascript
// api/apiClient.js
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  timeout: 30000,
})
```
Then add `VITE_API_URL=https://api.your-domain.com` to `.env.production`.

---

### 🟡 Medium Priority

**~~`NotificationPreferencesPage` calls non-existent backend~~ — FIXED**
The `ecm-notification` module is now fully implemented (port 8088). Notification preferences (IN_APP / EMAIL per category), email templates, and in-app notification bell are all working.

**Global `staleTime: 5 * 60 * 1000` is too long for volatile data**
Workflow task inbox data can change within seconds (another reviewer completing a task). The global 5-minute stale time means users may see stale task lists.

*Fix:* Override per-query for time-sensitive data:
```javascript
// hooks/useWorkflow.js
export function useMyTasks() {
  return useQuery({
    queryKey: ['workflow', 'tasks', 'mine'],
    queryFn: workflowApi.getMyTasks,
    staleTime: 30_000,  // 30 seconds for task inbox
  })
}
```

**`window._debugOkta` exposes token state in the browser console**
`App.jsx` registers `window._debugOkta()` in development. While guarded by `import.meta.env.DEV`, it logs full Okta auth state and tokens. Remove before any shared dev environment is accessible to others.

---

### 🟢 Low Priority

**`vite-plugin-terminal` loaded in all environments**
`vite.config.js` includes `vite-plugin-terminal` unconditionally. It should only run in development:
```javascript
// vite.config.js
plugins: [
  react(),
  tailwindcss(),
  ...(process.env.NODE_ENV !== 'production' ? [Terminal({...})] : []),
]
```

**Old proxy config left as commented-out block**
`vite.config.js` has a large commented-out alternative proxy config pointing to `:8081` (the old direct-to-identity setup). Remove to reduce confusion.

**Inconsistent route guard pattern**
Some routes use `<RoleGuard>` inline in `App.jsx`; others rely on page-level role checks. Standardise on the `App.jsx` guard pattern so access control is visible in one place.

---

## Local Development Setup

### Prerequisites

- Node.js 20+ and npm 10+
- ECM backend services running (at minimum: `ecm-gateway` on `:8080`, `ecm-identity` on `:8081`)
- Okta SPA application configured (see below)

### 1. Install dependencies

```bash
cd ecm-frontend
npm install
```

### 2. Configure Okta

Update `src/utils/oktaConfig.js`:

```javascript
export const oktaAuth = new OktaAuth({
  issuer:      'https://your-okta-domain/oauth2/your-auth-server-id',
  clientId:    'your-spa-client-id',
  redirectUri: `${window.location.origin}/login/callback`,
  scopes:      ['openid', 'profile', 'email', 'groups'],
  pkce:        true,
})
```

Or drive from environment variables (recommended):
```bash
# .env.local
VITE_OKTA_ISSUER=https://your-domain/oauth2/your-server
VITE_OKTA_CLIENT_ID=your-client-id
```

Okta SPA app requirements:
- Grant type: Authorization Code + PKCE
- Login redirect URI: `http://localhost:3000/login/callback`
- Logout redirect URI: `http://localhost:3000`
- Trusted origins: `http://localhost:3000`
- Custom auth server with `groups` claim returning `ECM_ADMIN`, `ECM_BACKOFFICE`, etc.

### 3. Start the dev server

```bash
npm run dev
# App at: http://localhost:3000
# All /api requests proxied to: http://localhost:8080 (gateway)
```

### Vite Proxy

The proxy in `vite.config.js` forwards all `/api/**` requests to the gateway:

```javascript
server: {
  port: 3000,
  proxy: {
    '/api': {
      target: 'http://localhost:8080',
      changeOrigin: true,
    }
  }
}
```

This means API calls appear as same-origin from the browser's perspective — no CORS issues in development.

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `VITE_OKTA_ISSUER` | ✅ | — | Okta auth server issuer URI |
| `VITE_OKTA_CLIENT_ID` | ✅ | — | SPA application client ID |
| `VITE_API_URL` | ⚠️ | `''` | API base URL for production (must add — see Known Issues) |
| `VITE_OKTA_REDIRECT_URI` | Optional | `window.location.origin + /login/callback` | Override callback URI |

Create `.env.local` for local overrides (gitignored):
```bash
VITE_OKTA_ISSUER=https://dev-123456.okta.com/oauth2/aus1y234
VITE_OKTA_CLIENT_ID=0oa1abc2def
```

Create `.env.production` for production builds:
```bash
VITE_OKTA_ISSUER=https://your-tenant.okta.com/oauth2/aus...
VITE_OKTA_CLIENT_ID=0oa...
VITE_API_URL=https://api.your-ecm-domain.com
```

---

## Build & Deployment

### Development

```bash
npm run dev         # Start dev server with HMR on :3000
npm run lint        # ESLint check
```

### Production Build

```bash
npm run build       # Outputs to /dist
npm run preview     # Preview production build locally
```

The production build:
- Code-splits every page (lazy loading in `App.jsx`)
- Minifies and tree-shakes
- Generates content-hashed assets for CDN caching

### Deployment Options

**Static hosting (recommended):** Deploy `/dist` to Azure Static Web Apps, AWS CloudFront + S3, or Vercel. Configure:
- All paths to serve `index.html` (SPA routing)
- `VITE_API_URL` pointing to your production gateway

**Nginx example config:**
```nginx
server {
  root /usr/share/nginx/html;
  location / {
    try_files $uri $uri/ /index.html;  # SPA routing
  }
  location /api/ {
    proxy_pass https://api.your-domain.com/api/;
  }
}
```

### Production Checklist

- [ ] `VITE_API_URL` set to production gateway URL (fix hardcoded `localhost:8080`)
- [ ] `VITE_OKTA_ISSUER` and `VITE_OKTA_CLIENT_ID` set to production Okta app
- [ ] Okta app has production domain in trusted origins and redirect URIs
- [ ] `vite-plugin-terminal` excluded from production build
- [ ] `window._debugOkta` removed from `App.jsx`
- [ ] Remove commented-out proxy config from `vite.config.js`
- [ ] Set appropriate Content-Security-Policy headers on the hosting platform

---

*Servus ECM Platform — Frontend | React 19 · Vite 7 · Tailwind v4 | © 2026*