/**
 * Workflow API - ecm-workflow service (port 8083 behind gateway).
 *
 * Routing: frontend :3000 -> Vite proxy /api -> gateway :8080 -> workflow :8083
 *
 * Follows same pattern as documentsApi.js:
 *   - Routes through the gateway (no separate axios instance)
 *   - Reuses the shared apiClient (auth + error interceptors already wired)
 *   - Unwraps ApiResponse<T> envelope
 *
 * NOTE: Requires gateway RouteConfig to have workflow route enabled:
 *   .route("workflow-service", r -> r.path("/api/workflow/**") ...)
 */
import apiClient from './apiClient'

// Unwrap ApiResponse<T> - Spring returns { success, data, message, errorCode, timestamp }
const unwrap = (r) => r.data?.data ?? r.data

// -- Workflow Instances -------------------------------------------------------

/** Start a workflow manually (uploader picks workflow type). */
export const startWorkflow = (req) =>
  apiClient.post('/api/workflow/instances', req).then(unwrap)

/** List all workflow instances (admin/backoffice/reviewer). */
export const listWorkflowInstances = (params = {}) =>
  apiClient.get('/api/workflow/instances', { params }).then(unwrap)

/** List active workflow instances only. */
export const listActiveInstances = (params = {}) =>
  apiClient.get('/api/workflow/instances/active', { params }).then(unwrap)

/** List workflow instances I started. */
export const listMyInstances = (params = {}) =>
  apiClient.get('/api/workflow/instances/mine', { params }).then(unwrap)

/** Get all workflow instances for a specific document. */
export const getDocumentWorkflows = (documentId) =>
  apiClient.get(`/api/workflow/instances/document/${documentId}`).then(unwrap)

/** Get single workflow instance by ID. */
export const getWorkflowInstance = (id) =>
  apiClient.get(`/api/workflow/instances/${id}`).then(unwrap)

/** Cancel a running workflow (admin only). */
export const cancelWorkflow = (id) =>
  apiClient.delete(`/api/workflow/instances/${id}`).then(unwrap)

// -- Tasks --------------------------------------------------------------------

/** My full inbox: tasks I have claimed + unclaimed tasks in my groups. */
export const getMyInbox = () =>
  apiClient.get('/api/workflow/tasks/inbox').then(unwrap)

/** Unclaimed pool tasks available to my candidate groups. */
export const getPendingTasks = () =>
  apiClient.get('/api/workflow/tasks/pending').then(unwrap)

/** Tasks I have claimed. */
export const getMyTasks = () =>
  apiClient.get('/api/workflow/tasks/my').then(unwrap)

/** Get single task detail. */
export const getTask = (taskId) =>
  apiClient.get(`/api/workflow/tasks/${taskId}`).then(unwrap)

/** Claim a task from the pool. */
export const claimTask = (taskId) =>
  apiClient.post(`/api/workflow/tasks/${taskId}/claim`).then(unwrap)

/** Return a claimed task to the pool. */
export const unclaimTask = (taskId) =>
  apiClient.post(`/api/workflow/tasks/${taskId}/unclaim`).then(unwrap)

/** Approve a document. */
export const approveTask = (taskId, comment = '') =>
  apiClient.post(`/api/workflow/tasks/${taskId}/approve`,
    { decision: 'APPROVED', comment }).then(unwrap)

/** Reject a document (comment required). */
export const rejectTask = (taskId, comment) =>
  apiClient.post(`/api/workflow/tasks/${taskId}/reject`,
    { decision: 'REJECTED', comment }).then(unwrap)

/** Request additional information from submitter (comment required). */
export const requestInfo = (taskId, comment) =>
  apiClient.post(`/api/workflow/tasks/${taskId}/request-info`,
    { decision: 'REQUEST_INFO', comment }).then(unwrap)

/** Pass to specialist (dual-review triage only). */
export const passToSpecialist = (taskId, comment = '') =>
  apiClient.post(`/api/workflow/tasks/${taskId}/pass`,
    { decision: 'PASS', comment }).then(unwrap)

/**
 * Provide additional information requested by a reviewer.
 * Only the task's assigned submitter may call this — service returns 403 otherwise.
 * Moves instance status from INFO_REQUESTED → ACTIVE.
 */
export const provideInfo = (taskId, payload) =>
  apiClient.post(`/api/workflow/tasks/${taskId}/provide-info`, payload).then(unwrap)

// -- Definitions (for Start Workflow dropdown) --------------------------------

export const listWorkflowDefinitions = () =>
  apiClient.get('/api/workflow/definitions').then(unwrap)

// -- Admin: Groups ------------------------------------------------------------

export const listWorkflowGroups = () =>
  apiClient.get('/api/workflow/groups').then(unwrap)

export const createWorkflowGroup = (data) =>
  apiClient.post('/api/workflow/groups', data).then(unwrap)

export const addGroupMember = (groupId, userId) =>
  apiClient.post(`/api/workflow/groups/${groupId}/members`, { userId }).then(unwrap)

export const removeGroupMember = (groupId, userId) =>
  apiClient.delete(`/api/workflow/groups/${groupId}/members/${userId}`).then(unwrap)

// -- Admin: Category Mappings -------------------------------------------------

export const listCategoryMappings = () =>
  apiClient.get('/api/workflow/categories/mappings').then(unwrap)

export const createCategoryMapping = (data) =>
  apiClient.post('/api/workflow/categories/mappings', data).then(unwrap)

export const deleteCategoryMapping = (id) =>
  apiClient.delete(`/api/workflow/categories/mappings/${id}`).then(unwrap)
// -- Admin: Definitions (create / update) ------------------------------------

/**
 * Create a new workflow definition.
 * WorkflowDefinitionRequest: { name, description, processKey, assignedRole, assignedGroupId, slaHours, active }
 */
export const createWorkflowDefinition = (payload) =>
  apiClient.post('/api/workflow/definitions', payload).then(unwrap)

/**
 * Update an existing workflow definition.
 * Same WorkflowDefinitionRequest shape as create.
 */
export const updateWorkflowDefinition = (id, payload) =>
  apiClient.put(`/api/workflow/definitions/${id}`, payload).then(unwrap)

// workflowApi.js — add these two functions
export const getSlaSummary = () =>
  apiClient.get('/api/workflow/sla/summary').then(r => r.data ?? {})

export const getSlaOverdue = () =>
  apiClient.get('/api/workflow/sla/overdue').then(r => r.data ?? [])