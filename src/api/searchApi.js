import apiClient from './apiClient'

const BASE = '/api/documents/search'

export const searchDocuments = (params) =>
  apiClient.get(BASE, { params })

export const searchDocumentsPost = (body) =>
  apiClient.post(BASE, body)

export const suggestDocuments = (q) =>
  apiClient.get(`${BASE}/suggest`, { params: { q } })
