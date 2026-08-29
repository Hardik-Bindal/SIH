import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from './endpoints'

// Thin React Query wrappers. Kept in one place so every page consumes the
// same cache keys/staleness policy (SRS NFR-02: cached aggregates).

const STALE_ANALYTICS = 60_000

export function useKpis() {
  return useQuery({ queryKey: ['kpis'], queryFn: api.getKpis, staleTime: STALE_ANALYTICS })
}

export function useSiteAnalytics() {
  return useQuery({ queryKey: ['analytics', 'sites'], queryFn: api.getSiteAnalytics, staleTime: STALE_ANALYTICS })
}

export function useAreaAnalytics() {
  return useQuery({ queryKey: ['analytics', 'areas'], queryFn: api.getAreaAnalytics, staleTime: STALE_ANALYTICS })
}

export function useActivityAnalytics() {
  return useQuery({
    queryKey: ['analytics', 'activities'],
    queryFn: api.getActivityAnalytics,
    staleTime: STALE_ANALYTICS,
  })
}

export function useDepartmentAnalytics() {
  return useQuery({
    queryKey: ['analytics', 'departments'],
    queryFn: api.getDepartmentAnalytics,
    staleTime: STALE_ANALYTICS,
  })
}

export function useLsrAnalytics() {
  return useQuery({ queryKey: ['analytics', 'lsr'], queryFn: api.getLsrAnalytics, staleTime: STALE_ANALYTICS })
}

export function useHeatmap() {
  return useQuery({ queryKey: ['analytics', 'heatmap'], queryFn: api.getHeatmap, staleTime: STALE_ANALYTICS })
}

export function useForecast(category) {
  return useQuery({
    queryKey: ['forecast', category ?? 'all'],
    queryFn: () => api.getForecast(category),
    staleTime: STALE_ANALYTICS,
  })
}

export function useIncidents(params) {
  return useQuery({
    queryKey: ['incidents', params],
    queryFn: () => api.listIncidents(params),
    placeholderData: (prev) => prev,
  })
}

export function useIncident(id) {
  return useQuery({
    queryKey: ['incident', id],
    queryFn: () => api.getIncident(id),
    enabled: Boolean(id),
  })
}

export function useSimilarIncidents(id, params) {
  return useQuery({
    queryKey: ['incident', id, 'similar', params],
    queryFn: () => api.getSimilarIncidents(id, params),
    enabled: Boolean(id),
  })
}

export function useGraph(params) {
  return useQuery({ queryKey: ['graph', params], queryFn: () => api.getGraph(params), staleTime: STALE_ANALYTICS })
}

export function useSemanticSearch() {
  return useMutation({ mutationFn: api.semanticSearch })
}

export function useSubmitIncident() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: api.submitIncident,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incidents'] })
      queryClient.invalidateQueries({ queryKey: ['kpis'] })
    },
  })
}

export function useGenerateRecommendations() {
  return useMutation({ mutationFn: api.generateRecommendations })
}

export function useCopilotQuery() {
  return useMutation({ mutationFn: api.queryCopilot })
}

export function useStructuredQuery() {
  return useMutation({ mutationFn: api.structuredQuery })
}

// ---- Safety Memory -------------------------------------------------------

export function useIncidentMemory(id) {
  return useQuery({
    queryKey: ['incident', id, 'memory'],
    queryFn: () => api.getIncidentMemory(id),
    enabled: Boolean(id),
  })
}

// Ad-hoc recall is a mutation, not a query: it is driven by a form
// submission, not by a URL/param the cache can key on.
export function useMemoryRecall() {
  return useMutation({ mutationFn: api.recallMemory })
}

export function useMemoryPatterns(params) {
  return useQuery({
    queryKey: ['memory', 'patterns', params],
    queryFn: () => api.getMemoryPatterns(params),
    staleTime: STALE_ANALYTICS,
  })
}

export function useMemoryPattern(patternId) {
  return useQuery({
    queryKey: ['memory', 'pattern', patternId],
    queryFn: () => api.getMemoryPattern(patternId),
    enabled: patternId !== null && patternId !== undefined,
    staleTime: STALE_ANALYTICS,
  })
}

export function useGenerateBulletin() {
  return useMutation({ mutationFn: api.generateBulletin })
}
