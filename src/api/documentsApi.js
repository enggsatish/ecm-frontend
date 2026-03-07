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
 * Soft-delete a document.
 * DELETE /api/documents/:id
 */
export const deleteDocument = (id) =>
  apiClient.delete(`/api/documents/${id}`).then(r => r.data)