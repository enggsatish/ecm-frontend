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

// ── Hierarchy (Sprint-C) ───────────────────────────────────────────────────
/**
 * GET /api/admin/hierarchy
 * Returns the full Segment → ProductLine → Product tree.
 * Used by cascading selects in DocumentUpload.
 */
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

// ── Customers (Parties) — Sprint 1 ────────────────────────────────────────
/**
 * GET /api/admin/customers?q=&page=0&size=20
 * Returns Spring Page: { content, totalElements, totalPages, ... }
 */
export const listCustomers = (params = {}) =>
  api.get('/api/admin/customers', { params }).then(unwrap);

export const getCustomer = (id) =>
  api.get(`/api/admin/customers/${id}`).then(unwrap);

/**
 * POST /api/admin/customers
 * { customerRef, displayName, segment, segmentId?, shortName?,
 *   registrationNo?, notes?, email?, phone?, primaryProductId? }
 */
export const createCustomer = (payload) =>
  api.post('/api/admin/customers', payload).then(unwrap);

/**
 * PUT /api/admin/customers/:id
 * customerRef (external_id) is immutable — include it but backend ignores it on update.
 */
export const updateCustomer = (id, payload) =>
  api.put(`/api/admin/customers/${id}`, payload).then(unwrap);

/**
 * DELETE /api/admin/customers/:id
 * Soft-delete — sets is_active = false.
 */
export const deactivateCustomer = (id) =>
  api.delete(`/api/admin/customers/${id}`).then(unwrap);
// ── DocuSign Integration Config ────────────────────────────────────────────
/**
 * GET /api/admin/integrations/docusign
 * Returns the current DocuSign config for the default tenant.
 * Sensitive fields (rsaPrivateKey, webhookHmacSecret) are returned as
 * '*** saved ***' once set — the backend never echoes raw secrets.
 */
export const getDocuSignConfig = () =>
  api.get('/api/admin/integrations/docusign').then(unwrap);

/**
 * PUT /api/admin/integrations/docusign
 * Save DocuSign configuration.  Fields that equal '*** saved ***' are
 * treated as "no change" by the backend and the existing encrypted value
 * is preserved.
 */
export const saveDocuSignConfig = (payload) =>
  api.put('/api/admin/integrations/docusign', payload).then(unwrap);

/**
 * POST /api/admin/integrations/docusign/test
 * Fires a live JWT-grant call to DocuSign and returns { success, message }.
 * Only callable when enabled = true and credentials are saved.
 */
export const testDocuSignConnection = () =>
  api.post('/api/admin/integrations/docusign/test').then(unwrap);