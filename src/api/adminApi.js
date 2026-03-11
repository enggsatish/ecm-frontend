import api from './apiClient';

const unwrap = (r) => r.data?.data ?? r.data;

// ── Users ──────────────────────────────────────────────────────────────────
export const searchUsers = (params) =>
  api.get('/api/admin/users', { params }).then(unwrap);

/**
 * POST /api/admin/users/invite
 * Invites a new user by email. The backend creates a pending user record;
 * the user activates on first SSO login.
 * Body: { email, displayName, departmentId?, initialRole? }
 */
export const inviteUser = (payload) =>
  api.post('/api/admin/users/invite', payload).then(unwrap);

export const getUser = (id) =>
  api.get(`/api/admin/users/${id}`).then(unwrap);

export const updateUser = (id, payload) =>
  api.put(`/api/admin/users/${id}`, payload).then(unwrap);

export const addRole = (id, roleName) =>
  api.post(`/api/admin/users/${id}/roles`, { roleName }).then(unwrap);

export const removeRole = (id, roleName) =>
  api.delete(`/api/admin/users/${id}/roles/${roleName}`).then(unwrap);

export const deactivateUser = (id) =>
  api.post(`/api/admin/users/${id}/deactivate`).then(unwrap);

export const reactivateUser = (id) =>
  api.post(`/api/admin/users/${id}/reactivate`).then(unwrap);

// ── Departments ────────────────────────────────────────────────────────────
export const getDepartments = (flat = false) =>
  api.get('/api/admin/departments', { params: { flat } }).then(unwrap);

export const createDepartment = (payload) =>
  api.post('/api/admin/departments', payload).then(unwrap);

export const updateDepartment = (id, payload) =>
  api.put(`/api/admin/departments/${id}`, payload).then(unwrap);

export const deactivateDepartment = (id) =>
  api.delete(`/api/admin/departments/${id}`).then(unwrap);

// ── Document Categories ────────────────────────────────────────────────────
export const getCategories = (flat = false) =>
  api.get('/api/admin/categories', { params: { flat } }).then(unwrap);

export const createCategory = (payload) =>
  api.post('/api/admin/categories', payload).then(unwrap);

export const updateCategory = (id, payload) =>
  api.put(`/api/admin/categories/${id}`, payload).then(unwrap);

export const deactivateCategory = (id) =>
  api.delete(`/api/admin/categories/${id}`).then(unwrap);

// ── Products ───────────────────────────────────────────────────────────────
export const getProducts = (params) =>
  api.get('/api/admin/products', { params }).then(unwrap);

export const getProduct = (id) =>
  api.get(`/api/admin/products/${id}`).then(unwrap);

export const createProduct = (payload) =>
  api.post('/api/admin/products', payload).then(unwrap);

export const updateProduct = (id, payload) =>
  api.put(`/api/admin/products/${id}`, payload).then(unwrap);

export const deactivateProduct = (id) =>
  api.delete(`/api/admin/products/${id}`).then(unwrap);

export const linkCategory = (productId, payload) =>
  api.post(`/api/admin/products/${productId}/categories`, payload).then(unwrap);

export const unlinkCategory = (productId, categoryId) =>
  api.delete(`/api/admin/products/${productId}/categories/${categoryId}`).then(unwrap);

export const getWorkflowDefinitions = () =>
  api.get('/api/admin/products/workflow-definitions').then(unwrap);

// ── Retention Policies ─────────────────────────────────────────────────────
export const getRetentionPolicies = () =>
  api.get('/api/admin/retention-policies').then(unwrap);

export const createRetentionPolicy = (payload) =>
  api.post('/api/admin/retention-policies', payload).then(unwrap);

export const updateRetentionPolicy = (id, payload) =>
  api.put(`/api/admin/retention-policies/${id}`, payload).then(unwrap);

export const deactivateRetentionPolicy = (id) =>
  api.delete(`/api/admin/retention-policies/${id}`).then(unwrap);

// ── Tenant Config ──────────────────────────────────────────────────────────
export const getTenantConfig = () =>
  api.get('/api/admin/config').then(unwrap);

export const updateConfigKey = (key, payload) =>
  api.put(`/api/admin/config/${key}`, payload).then(unwrap);

export const bulkUpdateConfig = (configs) =>
  api.put('/api/admin/config', { configs }).then(unwrap);

// ── Hierarchy ──────────────────────────────────────────────────────────────
export const getHierarchy = () =>
  api.get('/api/admin/hierarchy').then(unwrap);

// ── Segments ───────────────────────────────────────────────────────────────
export const getSegments = () =>
  api.get('/api/admin/segments').then(unwrap);

export const createSegment = (payload) =>
  api.post('/api/admin/segments', payload).then(unwrap);

export const updateSegment = (id, payload) =>
  api.put(`/api/admin/segments/${id}`, payload).then(unwrap);

// ── Product Lines ──────────────────────────────────────────────────────────
export const getProductLines = (segmentId) =>
  api.get('/api/admin/product-lines', {
    params: segmentId ? { segmentId } : {},
  }).then(unwrap);

export const createProductLine = (payload) =>
  api.post('/api/admin/product-lines', payload).then(unwrap);

export const updateProductLine = (id, payload) =>
  api.put(`/api/admin/product-lines/${id}`, payload).then(unwrap);

// ── Audit Log ──────────────────────────────────────────────────────────────
export const getAuditLog = (params) =>
  api.get('/api/admin/audit', { params }).then(unwrap);

// ── Customers (Parties) ────────────────────────────────────────────────────
export const listCustomers = (params = {}) =>
  api.get('/api/admin/customers', { params }).then(unwrap);

export const getCustomer = (id) =>
  api.get(`/api/admin/customers/${id}`).then(unwrap);

export const createCustomer = (payload) =>
  api.post('/api/admin/customers', payload).then(unwrap);

export const updateCustomer = (id, payload) =>
  api.put(`/api/admin/customers/${id}`, payload).then(unwrap);

export const deactivateCustomer = (id) =>
  api.delete(`/api/admin/customers/${id}`).then(unwrap);

// ── DocuSign Integration Config ────────────────────────────────────────────
export const getDocuSignConfig = () =>
  api.get('/api/admin/integrations/docusign').then(unwrap);

export const saveDocuSignConfig = (payload) =>
  api.put('/api/admin/integrations/docusign', payload).then(unwrap);

export const testDocuSignConnection = () =>
  api.post('/api/admin/integrations/docusign/test').then(unwrap);

// ── Roles & Permissions (Sprint G) ────────────────────────────────────────

/** GET /api/admin/roles — list all roles with permission counts */
export const getRoles = () =>
  api.get('/api/admin/roles').then(unwrap);

/** GET /api/admin/roles/:id — get role with full permission list */
export const getRole = (id) =>
  api.get(`/api/admin/roles/${id}`).then(unwrap);

/**
 * POST /api/admin/roles
 * { name: "ECM_CUSTOM_ROLE", description: "..." }
 */
export const createRole = (payload) =>
  api.post('/api/admin/roles', payload).then(unwrap);

/**
 * PUT /api/admin/roles/:id
 * { name?, description? }
 */
export const updateRole = (id, payload) =>
  api.put(`/api/admin/roles/${id}`, payload).then(unwrap);

/** DELETE /api/admin/roles/:id — soft-delete (is_active = false) */
export const deleteRole = (id) =>
  api.delete(`/api/admin/roles/${id}`).then(unwrap);

/**
 * POST /api/admin/roles/:id/permissions
 * Body: { permissionCode: "documents:export" }
 * permissionCode is the string code (e.g. "documents:export"), NOT a UUID.
 */
export const addPermissionToRole = (roleId, permissionCode) =>
  api.post(`/api/admin/roles/${roleId}/permissions`, { permissionCode }).then(unwrap);

/**
 * DELETE /api/admin/roles/:id/permissions/:code
 * permissionCode is the string code (e.g. "documents:export"), NOT a UUID.
 */
export const removePermissionFromRole = (roleId, permissionCode) =>
  api.delete(`/api/admin/roles/${roleId}/permissions/${permissionCode}`).then(unwrap);

/**
 * POST /api/admin/roles/:id/bundles/:bundleId
 * Applies a capability bundle to a role (expands to individual permissions)
 */
export const applyBundleToRole = (roleId, bundleId) =>
  api.post(`/api/admin/roles/${roleId}/bundles/${bundleId}`).then(unwrap);

/** GET /api/admin/permissions — list all 24 permissions grouped by module */
export const getPermissions = () =>
  api.get('/api/admin/permissions').then(unwrap);

/** GET /api/admin/bundles — list all capability bundles with permissions */
export const getBundles = () =>
  api.get('/api/admin/bundles').then(unwrap);