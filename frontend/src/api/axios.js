import axios from 'axios'
import { useAuthStore } from '../store/authStore'
import { useUiStore } from '../store/uiStore'

const api = axios.create({ baseURL: 'http://localhost:8000' })

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const isLoginRequest = err.config?.url === '/auth/login'
    const status = err.response?.status
    if (status === 401 && !isLoginRequest) {
      useAuthStore.getState().logout()
      useUiStore.getState().setSessionExpired(true)
    } else if (!err.config?.silent && status !== 401) {
      // Surface non-auth failures as a toast unless the caller opted out via { silent: true }
      const detail = err.response?.data?.detail
      let message
      if (!err.response) {
        message = 'Cannot reach the server. Check your connection.'
      } else if (typeof detail === 'string') {
        message = detail
      } else if (status >= 500) {
        message = 'Something went wrong on the server. Please try again.'
      } else {
        message = err.message || 'Request failed.'
      }
      useUiStore.getState().pushToast({ type: 'error', title: 'Request failed', message })
    }
    return Promise.reject(err)
  }
)

export default api
