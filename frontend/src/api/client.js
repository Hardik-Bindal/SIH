import axios from 'axios'

// Ground truth: docs/CONTRACT.md. Base URL is overridable per-environment via
// VITE_API_BASE_URL, defaulting to the live cloud backend.
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://sih-iigu.onrender.com'

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000,
  headers: {
    'X-Tunnel-Skip-AntiPhishing-Page': 'true'
  }
})

// Normalises the contract's { error: { code, message } } shape into a
// regular Error so React Query's `error.message` works everywhere without
// each call site needing to know the response envelope.
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const apiMessage = error?.response?.data?.error?.message
    if (apiMessage) {
      const wrapped = new Error(apiMessage)
      wrapped.code = error?.response?.data?.error?.code
      wrapped.status = error?.response?.status
      return Promise.reject(wrapped)
    }
    return Promise.reject(error)
  }
)

export default apiClient
