import axios from 'axios'

// Ground truth: docs/CONTRACT.md. Base URL is overridable per-environment via
// VITE_API_BASE_URL, defaulting to the live cloud backend.
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

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
    // Two envelopes reach us: the global handler in main.py returns
    // { error: {...} } directly, while every HTTPException(detail={...}) is
    // nested by FastAPI as { detail: { error: {...} } }. Read both, or a
    // 404/400 surfaces as the useless "Request failed with status code 404".
    const data = error?.response?.data
    const payload = data?.error || data?.detail?.error
    const apiMessage = payload?.message || (typeof data?.detail === 'string' ? data.detail : null)
    if (apiMessage) {
      const wrapped = new Error(apiMessage)
      wrapped.code = payload?.code
      wrapped.status = error?.response?.status
      return Promise.reject(wrapped)
    }
    return Promise.reject(error)
  }
)

export default apiClient
