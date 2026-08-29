import apiClient from './client'

// Every function here maps 1:1 to an endpoint in docs/CONTRACT.md — field
// names in request/response bodies are copied verbatim (case-sensitive).
// No endpoint exists here that isn't in the contract.

export const getHealth = () => apiClient.get('/api/v1/health').then((r) => r.data)

// ---- Incidents -------------------------------------------------------

export const submitIncident = (payload) =>
  apiClient.post('/api/v1/incidents', payload).then((r) => r.data)

export const listIncidents = (params = {}) =>
  apiClient.get('/api/v1/incidents', { params }).then((r) => r.data)

export const getIncident = (id) =>
  apiClient.get(`/api/v1/incidents/${encodeURIComponent(id)}`).then((r) => r.data)

export const getSimilarIncidents = (id, params = {}) =>
  apiClient
    .get(`/api/v1/incidents/${encodeURIComponent(id)}/similar`, { params })
    .then((r) => r.data)

// ---- Search ------------------------------------------------------------

export const semanticSearch = (payload) =>
  apiClient.post('/api/v1/search/semantic', payload).then((r) => r.data)

// ---- Analytics -----------------------------------------------------------

export const getSiteAnalytics = () => apiClient.get('/api/v1/analytics/sites').then((r) => r.data)
export const getAreaAnalytics = () => apiClient.get('/api/v1/analytics/areas').then((r) => r.data)
export const getActivityAnalytics = () =>
  apiClient.get('/api/v1/analytics/activities').then((r) => r.data)
export const getDepartmentAnalytics = () =>
  apiClient.get('/api/v1/analytics/departments').then((r) => r.data)
export const getLsrAnalytics = () => apiClient.get('/api/v1/analytics/lsr').then((r) => r.data)
export const getKpis = () => apiClient.get('/api/v1/analytics/kpis').then((r) => r.data)
export const getHeatmap = () => apiClient.get('/api/v1/analytics/heatmap').then((r) => r.data)

// ---- Forecast ------------------------------------------------------------

export const getForecast = (category) =>
  apiClient
    .get('/api/v1/forecast', { params: category ? { category } : {} })
    .then((r) => r.data)

// ---- Recommendations -------------------------------------------------

export const generateRecommendations = (id) =>
  apiClient.post(`/api/v1/recommendations/${encodeURIComponent(id)}`).then((r) => r.data)

// ---- Safety Memory -----------------------------------------------------

// Recall for an already-filed report ("what does the corpus already know
// about events like this one?").
export const getIncidentMemory = (id) =>
  apiClient.get(`/api/v1/incidents/${encodeURIComponent(id)}/memory`).then((r) => r.data)

// Ad-hoc recall for a narrative that has not been filed yet.
export const recallMemory = (payload) =>
  apiClient.post('/api/v1/memory/recall', payload).then((r) => r.data)

export const getMemoryPatterns = (params = {}) =>
  apiClient.get('/api/v1/memory/patterns', { params }).then((r) => r.data)

export const getMemoryPattern = (patternId) =>
  apiClient.get(`/api/v1/memory/patterns/${encodeURIComponent(patternId)}`).then((r) => r.data)

// ---- Copilot -----------------------------------------------------------

export const queryCopilot = (query) =>
  apiClient.post('/api/v1/copilot/query', { query }).then((r) => r.data)

// Multi-constraint natural-language query, called directly (the chat route
// above also delegates to this engine and returns the same payload under a
// `structured` key).
export const structuredQuery = (query) =>
  apiClient.post('/api/v1/copilot/structured-query', { query }).then((r) => r.data)

// ---- Knowledge graph ---------------------------------------------------

export const getGraph = (params = {}) =>
  apiClient.get('/api/v1/graph', { params }).then((r) => r.data)

// ---- Bulletin ------------------------------------------------------------

export const generateBulletin = (payload) =>
  apiClient
    .post('/api/v1/bulletin', payload, { responseType: 'blob' })
    .then((r) => r.data)
