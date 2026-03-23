/**
 * Workflow API - ecm-workflow service (port 8083 behind gateway).
 *
 * Routing: frontend :3000 -> Vite proxy /api -> gateway :8080 -> workflow :8083
 */
import apiClient from './apiClient'

// Unwrap ApiResponse<T> - Spring returns { success, data, message, errorCode, timestamp }
const unwrap = (r) => r.data?.data ?? r.data

// -- Workflow Instances -------------------------------------------------------

export const startWorkflow = (req) =>
  apiClient.post('/api/workflow/instances', req).then(unwrap)

export const listWorkflowInstances = (params = {}) =>
  apiClient.get('/api/workflow/instances', { params }).then(unwrap)

export const listActiveInstances = (params = {}) =>
  apiClient.get('/api/workflow/instances/active', { params }).then(unwrap)

export const listMyInstances = (params = {}) =>
  apiClient.get('/api/workflow/instances/mine', { params }).then(unwrap)

export const getDocumentWorkflows = (documentId) =>
  apiClient.get(`/api/workflow/instances/document/${documentId}`).then(unwrap)

export const getWorkflowInstance = (id) =>
  apiClient.get(`/api/workflow/instances/${id}`).then(unwrap)

export const cancelWorkflow = (id) =>
  apiClient.delete(`/api/workflow/instances/${id}`).then(unwrap)

// -- Tasks --------------------------------------------------------------------

export const getMyInbox = () =>
  apiClient.get('/api/workflow/tasks/inbox').then(unwrap)

export const getPendingTasks = () =>
  apiClient.get('/api/workflow/tasks/pending').then(unwrap)

export const getMyTasks = () =>
  apiClient.get('/api/workflow/tasks/my').then(unwrap)

export const getTask = (taskId) =>
  apiClient.get(`/api/workflow/tasks/${taskId}`).then(unwrap)

export const claimTask = (taskId) =>
  apiClient.post(`/api/workflow/tasks/${taskId}/claim`).then(unwrap)

export const unclaimTask = (taskId) =>
  apiClient.post(`/api/workflow/tasks/${taskId}/unclaim`).then(unwrap)

export const approveTask = (taskId, comment = '') =>
  apiClient.post(`/api/workflow/tasks/${taskId}/approve`,
    { decision: 'APPROVED', comment }).then(unwrap)

export const rejectTask = (taskId, comment) =>
  apiClient.post(`/api/workflow/tasks/${taskId}/reject`,
    { decision: 'REJECTED', comment }).then(unwrap)

export const requestInfo = (taskId, comment) =>
  apiClient.post(`/api/workflow/tasks/${taskId}/request-info`,
    { decision: 'REQUEST_INFO', comment }).then(unwrap)

export const passToSpecialist = (taskId, comment = '') =>
  apiClient.post(`/api/workflow/tasks/${taskId}/pass`,
    { decision: 'PASS', comment }).then(unwrap)

export const provideInfo = (taskId, payload) =>
  apiClient.post(`/api/workflow/tasks/${taskId}/provide-info`, payload).then(unwrap)

// -- Definitions (for Start Workflow dropdown) --------------------------------

export const listWorkflowDefinitions = () =>
  apiClient.get('/api/workflow/definitions').then(unwrap)

// -- Templates (Designer) -----------------------------------------------------

export const listTemplates = () =>
  apiClient.get('/api/workflow/templates').then(unwrap)

export const getTemplate = (id) =>
  apiClient.get(`/api/workflow/templates/${id}`).then(unwrap)

export const createTemplate = (body) =>
  apiClient.post('/api/workflow/templates', body).then(unwrap)

export const updateTemplateDsl = (id, dsl) =>
  apiClient.put(`/api/workflow/templates/${id}/dsl`, dsl).then(unwrap)

/**
 * Save raw BPMN 2.0 XML authored in the bpmn.io visual designer.
 * Switches the template to VISUAL authoring mode.
 * @param {number} id      - template id (must be DRAFT)
 * @param {string} bpmnXml - well-formed BPMN 2.0 XML string
 */
export const saveTemplateBpmn = (id, bpmnXml) =>
  apiClient.put(`/api/workflow/templates/${id}/bpmn`, bpmnXml, {
    headers: { 'Content-Type': 'application/xml' },
  }).then(unwrap)

/**
 * Fetch the current deployable BPMN XML for a template.
 * Returns stored XML for VISUAL-source templates; generates from DSL for DSL-source.
 * Used to seed the bpmn.io modeler on load.
 * @returns {string} raw BPMN 2.0 XML
 */
export const getTemplateBpmnXml = (id) =>
  apiClient.get(`/api/workflow/templates/${id}/preview-bpmn`, {
    headers: { Accept: 'application/xml' },
    responseType: 'text',
  }).then((r) => r.data)

export const publishTemplate = (id) =>
  apiClient.post(`/api/workflow/templates/${id}/publish`).then(unwrap)

export const deprecateTemplate = (id) =>
  apiClient.post(`/api/workflow/templates/${id}/deprecate`).then(unwrap)

export const cloneTemplate = (id) =>
  apiClient.post(`/api/workflow/templates/${id}/clone`).then(unwrap)

export const updateTemplateMeta = (id, { name, processKey }) =>
  apiClient.patch(`/api/workflow/templates/${id}/meta`, { name, processKey }).then(unwrap)

export const deleteTemplate = (id) =>
  apiClient.delete(`/api/workflow/templates/${id}`).then(unwrap)

export const getTemplateMappings = (id) =>
  apiClient.get(`/api/workflow/templates/${id}/mappings`).then(unwrap)

export const addTemplateMapping = (id, body) =>
  apiClient.post(`/api/workflow/templates/${id}/mappings`, body).then(unwrap)

export const removeTemplateMapping = (id, mappingId) =>
  apiClient.delete(`/api/workflow/templates/${id}/mappings/${mappingId}`).then(unwrap)

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

// -- Admin: Definitions -------------------------------------------------------

export const createWorkflowDefinition = (payload) =>
  apiClient.post('/api/workflow/definitions', payload).then(unwrap)

export const updateWorkflowDefinition = (id, payload) =>
  apiClient.put(`/api/workflow/definitions/${id}`, payload).then(unwrap)

// -- SLA ----------------------------------------------------------------------

export const getSlaSummary = () =>
  apiClient.get('/api/workflow/sla/summary').then(r => r.data ?? {})

export const getSlaOverdue = () =>
  apiClient.get('/api/workflow/sla/overdue').then(r => r.data ?? [])