import apiClient from './apiClient'

export const authApi = {
  getMe:  () => apiClient.get('/api/auth/me'),
  ping:   () => apiClient.get('/api/auth/ping'),
  logout: () => apiClient.post('/api/auth/logout'),
}