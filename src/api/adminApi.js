import api from './apiClient';

const unwrap = (r) => r.data?.data ?? r.data;

// ── Users ──────────────────────────────────────────────────────────────────
export const searchUsers = (params) =>
  api.get('/api/admin/users', { params }).then(unwrap);

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

// ══════════════════════════════════════════════════════════════════
// Sprint-C additions: Hierarchy and Audit
// ══════════════════════════════════════════════════════════════════

// ── Hierarchy ──────────────────────────────────────────────────────────────

/**
 * GET /api/admin/hierarchy
 * Returns the full Segment → ProductLine → Product tree.
 * Used by cascading selects in DocumentUpload.
 */
export const getHierarchy = () =>
  api.get('/api/admin/hierarchy').then(unwrap);

/**
 * GET /api/admin/segments
 * Returns all segments (including inactive) for admin management.
 */
export const getSegments = () =>
  api.get('/api/admin/segments').then(unwrap);

export const createSegment = (payload) =>
  api.post('/api/admin/segments', payload).then(unwrap);

export const updateSegment = (id, payload) =>
  api.put(`/api/admin/segments/${id}`, payload).then(unwrap);

/**
 * GET /api/admin/product-lines
 * Optional segmentId filter to get lines for a specific segment.
 */
export const getProductLines = (segmentId) =>
  api.get('/api/admin/product-lines', {
    params: segmentId ? { segmentId } : {},
  }).then(unwrap);

export const createProductLine = (payload) =>
  api.post('/api/admin/product-lines', payload).then(unwrap);

export const updateProductLine = (id, payload) =>
  api.put(`/api/admin/product-lines/${id}`, payload).then(unwrap);

// ── Audit Log ──────────────────────────────────────────────────────────────

/**
 * GET /api/admin/audit
 * Params: userId, event, resourceType, severity, from, to, page, size
 * Returns paginated audit log records.
 */
export const getAuditLog = (params) =>
  api.get('/api/admin/audit', { params }).then(unwrap);