# ECM Frontend

React 19 SPA for enterprise content management. Connects to ecm-gateway on port 8080.

## Quick Reference

```bash
# Install dependencies
npm install

# Start dev server (port 3000)
npm run dev

# Production build
npx vite build

# Lint
npm run lint

# Preview production build
npm run preview
```

## Tech Stack

- React 19.2, React Router 6.30
- Vite 7.3 (build tool)
- Tailwind CSS 4.2 (utility-first styling, no component library)
- TanStack Query 5.59 (server state, caching, mutations)
- Zustand 4.5 (client state — user store, UI store, tenant store, eforms store)
- Okta Auth JS 7.14 + okta-react 6.10 (OIDC/PKCE auth with refresh tokens)
- Axios 1.13 (HTTP client)
- lucide-react 0.460 (icons)
- react-hot-toast 2.4 (toast notifications)
- bpmn-js 17.11 (BPMN workflow viewer/editor)
- pdfjs-dist 5.5 (PDF rendering for annotations)
- date-fns 3.6 (date formatting)

## Environment Variables

File: `.env.local`
```
VITE_OKTA_ISSUER=https://integrator-3023444.okta.com/oauth2/ausykohz3k9z4e9Wy697
VITE_OKTA_CLIENT_ID=0oa10itpad6GqchpX698
VITE_API_BASE_URL=http://localhost:8080
```

## Project Structure

```
src/
├── api/              API client functions (one file per domain)
│   ├── apiClient.js      Axios instance, JWT interceptor, 401 handling
│   ├── documentsApi.js   Document CRUD, upload, download, lock
│   ├── adminApi.js       Users, cases, products, categories, customers
│   ├── workflowApi.js    Workflow instances, tasks
│   ├── batchApi.js       Batch jobs, review queue, config
│   ├── eformsApi.js      Form definitions, submissions
│   ├── searchApi.js      Full-text document search
│   └── authApi.js        Auth endpoints
├── hooks/            React Query hooks (one file per domain)
│   ├── useAdmin.js       Admin CRUD hooks (hierarchy, categories, parties, retention)
│   ├── useBatch.js       Batch jobs, review, spot check hooks
│   ├── useSearch.js      Document search hooks
│   └── useCurrentUser.js Auth/user profile hook
├── components/
│   ├── common/       Shared: RequireAuth, RoleGuard, SessionModals, PartySearch
│   ├── documents/    DocumentUpload, DocumentTable, DocumentViewerModal, PdfAnnotationViewer
│   ├── eforms/       Designer (canvas, palette, config panel), Renderer (fields, form)
│   ├── layout/       AppLayout, Header, Sidebar
│   └── workflow/     WorkflowAdmin, BpmnDesignerCanvas
├── pages/
│   ├── admin/        Admin panel (users, products, categories, customers, settings, batch)
│   ├── batch/        Batch jobs, review queue, spot check
│   ├── cases/        Case list, case detail
│   ├── dashboard/    Dashboard with stats
│   ├── documents/    Document management hub
│   ├── eforms/       Form designer, form fill, submissions
│   ├── external/     External participant portal (OTP-based, no Okta)
│   ├── workflow/     Workflow designer, workflow page
│   └── backoffice/   Task queue
├── store/            Zustand stores (userStore, uiStore, tenantStore, eformsStore)
├── utils/            oktaConfig.js, caseStateMachine.js, roles.js
├── App.jsx           Root router with lazy-loaded routes
└── main.jsx          Entry point
```

## Routing & Guards

All routes inside `<RequireAuth>` which:
1. Redirects to Okta if not authenticated
2. Loads user profile from `/api/auth/me`
3. Checks ECM roles — shows NoAccessPage if none assigned

Route guards use `<RoleGuard roles={ROLE_GROUPS.OPERATIONS}>` etc.

## Roles & Permissions

Defined in `src/utils/roles.js`:
- **ROLE_GROUPS.OPERATIONS** — Super Admin, Admin, Backoffice, Reviewer
- **ROLE_GROUPS.DESIGN** — Super Admin, Admin, Designer
- **ROLE_GROUPS.ADMIN_OR_SUPER** — Super Admin, Admin
- **ROLE_GROUPS.SUPER_ONLY** — Super Admin only

## Coding Conventions

### Components
- Functional components with `export default function ComponentName()`
- No class components
- lucide-react for all icons (never emoji in code unless user requests)
- Tailwind CSS classes directly on elements (no CSS modules, no styled-components)
- Toast notifications via `react-hot-toast` (`toast.success()`, `toast.error()`)

### API Layer
- One file per domain in `src/api/`
- All calls go through `apiClient` (shared Axios instance with JWT interceptor)
- Return `r.data` from response (ApiResponse unwrapping handled by interceptor)
- Upload functions use `FormData` with `Content-Type: undefined` (let browser set boundary)

### React Query Hooks
- One file per domain in `src/hooks/`
- `useQuery` for reads, `useMutation` for writes
- `staleTime` varies: 5min for admin data, 30s for operational data, 15s for queues
- Mutations invalidate relevant query keys on success
- `placeholderData: (prev) => prev` for pagination (no flicker)

### State Management
- Server state: TanStack Query (never duplicate in Zustand)
- Client state: Zustand (user profile, UI preferences, tenant branding)
- URL state: React Router `useParams`, `useSearchParams`

### Table Pattern
- Wrap in `rounded-xl border border-gray-100 bg-white shadow-sm`
- `SortButton` component for sortable columns
- Pagination: Previous/Next buttons with page X of Y
- Empty state: icon + message + optional action
- Loading state: centered `Loader2` spinner

### Modal Pattern
- Fixed overlay with `bg-black/40 backdrop-blur-sm`
- White card with `rounded-2xl shadow-2xl`
- Close button (X) top-right
- State-driven: `const [viewingId, setViewingId] = useState(null)`

### Status Badges
- `rounded-full px-2.5 py-0.5 text-xs font-medium`
- Color coding: emerald=active, blue=processing, amber=warning, red=error, gray=inactive

## Auth & Session Management

- Okta OIDC/PKCE with refresh tokens (`offline_access` scope)
- `autoRenew: true` — SDK handles token renewal via refresh token
- SessionWarningModal shows only when idle 10+ min AND token expiring
- "Stay Logged In" uses refresh token (fast, no iframe) with fallback to full Okta redirect
- apiClient 401 interceptor: one shared renewal attempt, then fires session-expired event
- Login grace period: 3 minutes (no session warnings right after login)

## Backend Requirements

The frontend expects these services running:
- ecm-gateway (8080) — routes all API calls
- ecm-identity (8081) — auth, user profile
- ecm-document (8082) — documents
- ecm-admin (8086) — cases, products, customers
- ecm-workflow (8083) — workflows, tasks
- ecm-eforms (8084) — forms, DocuSign
- ecm-batch (8089) — batch processing
- ecm-notification (8088) — notifications
- PostgreSQL, Redis, MinIO, RabbitMQ (via docker compose)

## Key Files

| File | What it does |
|------|-------------|
| `src/App.jsx` | All routes, lazy imports, Okta Security wrapper |
| `src/api/apiClient.js` | Axios instance, JWT attach, 401 handler, session expired |
| `src/utils/oktaConfig.js` | OktaAuth instance, token manager config, event handlers |
| `src/utils/roles.js` | ROLES, ROLE_GROUPS, PERMISSIONS constants |
| `src/components/common/RequireAuth.jsx` | Auth guard, user loading, role check |
| `src/components/layout/Sidebar.jsx` | Navigation with collapsible groups, role-based visibility |
| `src/store/userStore.js` | Zustand: user, roles, permissions, helper methods |
| `src/store/tenantStore.js` | Zustand: branding, theme CSS variables |

## Known Issues

- **Session auth** — Okta access token TTL may be short (5 min in dev). Refresh tokens (`offline_access`) must be enabled in Okta authorization server access policy for reliable auto-renewal.
- **PDF annotations** — Click-to-place not working reliably in some cases
- **bpmn-js 18.x** — ContextPad#getPad deprecated, causes crash. Staying on 17.x.
- **Vite chunk warning** — PdfAnnotationViewer and bpmn-js produce large chunks (>500KB). Acceptable for now.
- **ESLint** — Zero errors as of 2026-03-27. Keep it that way.
