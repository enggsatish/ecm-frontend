/**
 * documentsApi.js
 * All document calls go through the shared apiClient → gateway (port 8080).
 * apiClient already handles: JWT attachment, ApiResponse<T> unwrapping,
 * 401 redirect to Okta login, and error message extraction.
 *
 * Removed: the legacy standalone docsClient that had duplicate/broken interceptors.
 */
import apiClient from './apiClient'

// ── Documents API ────────────────────────────────────────────────────────────

/**
 * List documents with server-side pagination + sort.
 * GET /api/documents?page=0&size=20&sort=createdAt,desc
 * Returns PagedResponse: { content, totalElements, totalPages, page, size }
 */
export const listDocuments = (params = {}) =>
  apiClient.get('/api/documents', { params }).then(r => r.data ?? { content: [], totalPages: 0, totalElements: 0 })

/**
 * Upload one or more files with metadata.
 * POST /api/documents/upload  (multipart/form-data, part name "files")
 */
export const uploadDocuments = (files, metadata = {}, onProgress) => {
  const form = new FormData()

  files.forEach((f) => {
    const mimeType = f.type || 'application/octet-stream'
    const blob = f.slice(0, f.size, mimeType)
    form.append('files', blob, f.name)
  })

  const filteredMeta = Object.fromEntries(
    Object.entries(metadata).filter(([, v]) => v !== undefined && v !== null && v !== '')
  )
  if (Object.keys(filteredMeta).length > 0) {
    form.append(
      'metadata',
      new Blob([JSON.stringify(filteredMeta)], { type: 'application/json' })
    )
  }

  return apiClient
    .post('/api/documents/upload', form, {
      // Do NOT set Content-Type — browser must generate multipart boundary
      headers: { 'Content-Type': undefined },
      onUploadProgress: (e) => {
        if (onProgress && e.total) {
          onProgress(Math.round((e.loaded * 100) / e.total))
        }
      },
    })
    .then(r => r.data)
}

/**
 * Download a document as a file (triggers browser save dialog).
 * GET /api/documents/:id/download
 */
export const downloadDocument = async (id, filename) => {
  const resp = await apiClient.get(`/api/documents/${id}/download`, {
    responseType: 'blob',
  })
  const url = URL.createObjectURL(resp.data)
  const a = document.createElement('a')
  a.href = url
  a.download = filename ?? `document-${id}`
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Fetch a single document's metadata.
 * GET /api/documents/:id
 */
export const getDocument = (id) =>
  apiClient.get(`/api/documents/${id}`).then(r => r.data)

/**
 * Soft-delete a document (admin only, requires reason).
 * DELETE /api/documents/:id?reason=...
 */
export const deleteDocument = (id, reason) =>
  apiClient.delete(`/api/documents/${id}`, { params: { reason } }).then(r => r.data)

/** Move document to archive bucket. */
export const archiveDocument = (id) =>
  apiClient.post(`/api/documents/${id}/archive`).then(r => r.data)

/** Restore archived document back to active. */
export const restoreDocument = (id) =>
  apiClient.post(`/api/documents/${id}/restore`).then(r => r.data)

/** Check out (lock) document for exclusive review. */
export const checkoutDocument = (id) =>
  apiClient.post(`/api/documents/${id}/checkout`).then(r => r.data)

/** Release document lock. */
export const releaseDocument = (id) =>
  apiClient.post(`/api/documents/${id}/release`).then(r => r.data)

/** List documents needing classification. GET /api/documents?needsClassification=true */
export const listNeedsClassification = (params = {}) =>
  apiClient.get('/api/documents', { params: { ...params, needsClassification: true } })
    .then(r => r.data ?? { content: [], totalPages: 0, totalElements: 0 })

/** List auto-classified documents for spot check. GET /api/documents?autoClassified=true */
export const listAutoClassified = (params = {}) =>
  apiClient.get('/api/documents', { params: { ...params, autoClassified: true } })
    .then(r => r.data ?? { content: [], totalPages: 0, totalElements: 0 })

/** Classify a document — assign category and/or customer. PUT /api/documents/{id}/classify */
export const classifyDocument = (id, data) =>
  apiClient.put(`/api/documents/${id}/classify`, data).then(r => r.data)

/** Approve auto-classification (spot check). POST /api/documents/{id}/approve-classification */
export const approveClassification = (id) =>
  apiClient.post(`/api/documents/${id}/approve-classification`).then(r => r.data)

/** Flag auto-classification as incorrect. POST /api/documents/{id}/flag-classification */
export const flagClassification = (id, reason) =>
  apiClient.post(`/api/documents/${id}/flag-classification`, { reason }).then(r => r.data)

/** Get version history for a document. */
export const getVersionHistory = (id) =>
  apiClient.get(`/api/documents/${id}/versions`).then(r => r.data?.data ?? r.data)

/** Upload a new version of an existing document. */
export const uploadNewVersion = (id, file) => {
  const formData = new FormData()
  formData.append('file', file)
  return apiClient.post(`/api/documents/${id}/versions`, formData, {
    headers: { 'Content-Type': undefined },
  }).then(r => r.data?.data ?? r.data)
}