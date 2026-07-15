/**
 * batchApi.js
 * Batch processing API calls — all go through the shared apiClient.
 */
import apiClient from './apiClient'

// ── Batch Jobs ──────────────────────────────────────────────────────────────

/** Create a new batch job with file upload. POST /api/batch/jobs (multipart) */
export const createBatchJob = (files, metadata = {}, onProgress) => {
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
    .post('/api/batch/jobs', form, {
      headers: { 'Content-Type': undefined },
      onUploadProgress: (e) => {
        if (onProgress && e.total) {
          onProgress(Math.round((e.loaded * 100) / e.total))
        }
      },
    })
    .then(r => r.data)
}

/** List batch jobs with pagination + filters. GET /api/batch/jobs */
export const listBatchJobs = (params = {}) =>
  apiClient.get('/api/batch/jobs', { params }).then(r => r.data ?? { content: [], totalPages: 0, totalElements: 0 })

/** Get a single batch job. GET /api/batch/jobs/{id} */
export const getBatchJob = (id) =>
  apiClient.get(`/api/batch/jobs/${id}`).then(r => r.data)

/** Get items for a batch job. GET /api/batch/jobs/{id}/items */
export const getBatchItems = (jobId, params = {}) =>
  apiClient.get(`/api/batch/jobs/${jobId}/items`, { params }).then(r => r.data ?? { content: [], totalPages: 0, totalElements: 0 })

/** Get batch processing statistics. GET /api/batch/stats */
export const getBatchStats = () =>
  apiClient.get('/api/batch/stats').then(r => r.data)

// ── Review Queue ────────────────────────────────────────────────────────────

/** Get review queue items. GET /api/batch/review */
export const getReviewQueue = (params = {}) =>
  apiClient.get('/api/batch/review', { params }).then(r => r.data ?? { content: [], totalPages: 0, totalElements: 0 })

/** Get a single review item. GET /api/batch/review/{itemId} */
export const getReviewItem = (itemId) =>
  apiClient.get(`/api/batch/review/${itemId}`).then(r => r.data)

/** Approve and file a review item. PUT /api/batch/review/{itemId} */
export const approveReviewItem = (itemId, data) =>
  apiClient.put(`/api/batch/review/${itemId}`, data).then(r => r.data)

/** Flag a review item for further review. POST /api/batch/review/{itemId}/flag */
export const flagReviewItem = (itemId, data) =>
  apiClient.post(`/api/batch/review/${itemId}/flag`, data).then(r => r.data)

/** Retry a failed item (auto-reconcile first, re-queue if needed). POST /api/batch/review/{itemId}/retry */
export const retryReviewItem = (itemId) =>
  apiClient.post(`/api/batch/review/${itemId}/retry`).then(r => r.data)

/** Reconcile a batch item with its document state. POST /api/batch/review/{itemId}/reconcile */
export const reconcileReviewItem = (itemId) =>
  apiClient.post(`/api/batch/review/${itemId}/reconcile`).then(r => r.data)

// ── Auto-processed ──────────────────────────────────────────────────────────

/** Get auto-processed items for spot check. GET /api/batch/auto-processed */
export const getAutoProcessed = (params = {}) =>
  apiClient.get('/api/batch/auto-processed', { params }).then(r => r.data ?? { content: [], totalPages: 0, totalElements: 0 })

// ── Watch Folder Config ─────────────────────────────────────────────────────

/** Get watch folder configuration. GET /api/batch/config/watch-folder */
export const getWatchFolderConfig = () =>
  apiClient.get('/api/batch/config/watch-folder').then(r => r.data)

/** Update watch folder configuration. PUT /api/batch/config/watch-folder */
export const updateWatchFolderConfig = (data) =>
  apiClient.put('/api/batch/config/watch-folder', data).then(r => r.data)

// ── Full Batch Config (all settings) ────────────────────────────────────────

/** Get all batch configuration. GET /api/batch/config/all */
export const getBatchConfig = () =>
  apiClient.get('/api/batch/config/all').then(r => r.data)

/** Save all batch configuration. PUT /api/batch/config/all */
export const saveBatchConfig = (data) =>
  apiClient.put('/api/batch/config/all', data).then(r => r.data)
