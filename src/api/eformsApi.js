/**
 * ECM eForms API — all calls to ecm-eforms (port 8084) via gateway (port 8080)
 *
 * apiClient already unwraps the ApiResponse<T> envelope, so response.data
 * here is always the raw payload (Page<T>, List<T>, or a single object).
 *
 * List-returning helpers are marked async and normalise their result to a
 * plain array — handling both Spring Page<T> (has .content) and List<T>.
 * Mutation helpers (create / update / delete / action) return the full
 * axios response so callers can read the saved entity from response.data.
 */
import apiClient from './apiClient'

const BASE = '/api/eforms'

// ─── Shared normaliser ────────────────────────────────────────────────────────
/**
 * Accept either a plain array  (List<T> endpoint)
 * or a Spring Page object      ({ content: T[], totalElements, … })
 * and always return a plain array.
 */
const toArray = (payload) => {
  if (Array.isArray(payload)) return payload
  if (payload && Array.isArray(payload.content)) return payload.content
  return []
}

// ─── Form Definitions (ECM_ADMIN / ECM_DESIGNER) ─────────────────────────────

export const createFormDefinition = (payload) =>
  apiClient.post(`${BASE}/definitions`, payload)

export const getFormDefinitions = async (params = {}) => {
  const res = await apiClient.get(`${BASE}/definitions`, { params })
  return toArray(res.data)
}

export const getFormDefinition = (id) =>
  apiClient.get(`${BASE}/definitions/${id}`)

export const getFormVersionHistory = async (id) => {
  const res = await apiClient.get(`${BASE}/definitions/${id}/versions`)
  return toArray(res.data)
}

export const updateFormDefinition = (id, payload) =>
  apiClient.put(`${BASE}/definitions/${id}`, payload)

export const deleteFormDefinition = (id) =>
  apiClient.delete(`${BASE}/definitions/${id}`)

export const publishForm = (id) =>
  apiClient.post(`${BASE}/definitions/${id}/publish`)

export const archiveForm = (id) =>
  apiClient.post(`${BASE}/definitions/${id}/archive`)

export const cloneForm = (id) =>
  apiClient.post(`${BASE}/definitions/${id}/clone`)

export const deprecateForm = (id) =>
  apiClient.post(`${BASE}/definitions/${id}/deprecate`)

export const previewFormSchema = (id) =>
  apiClient.get(`${BASE}/definitions/${id}/preview`)

// ─── Form Rendering (any authenticated user) ─────────────────────────────────

export const getPublishedForms = async () => {
  const res = await apiClient.get(`${BASE}/render`)
  return toArray(res.data)
}

export const getFormSchema = (formKey) =>
  apiClient.get(`${BASE}/render/${formKey}`)

export const getFormSchemaVersion = (formKey, version) =>
  apiClient.get(`${BASE}/render/${formKey}/v/${version}`)

// ─── Form Submissions (authenticated) ────────────────────────────────────────

/** Submit or save draft. Pass { draft: true } in payload for draft saves. */
export const submitForm = (payload) =>
  apiClient.post(`${BASE}/submissions`, payload)

export const getMySubmissions = async () => {
  const res = await apiClient.get(`${BASE}/submissions/mine`)
  return toArray(res.data)
}

export const getAllSubmissions = async () => {
  const res = await apiClient.get(`${BASE}/submissions`)
  return toArray(res.data)
}

export const getSubmission = (id) =>
  apiClient.get(`${BASE}/submissions/${id}`)

export const withdrawSubmission = (id) =>
  apiClient.post(`${BASE}/submissions/${id}/withdraw`)