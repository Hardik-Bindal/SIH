import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/layout/Layout'
import { SkeletonBlock } from './components/common/Skeleton'

const Landing = lazy(() => import('./pages/Landing'))
const ExecutiveDashboard = lazy(() => import('./pages/ExecutiveDashboard'))
const Incidents = lazy(() => import('./pages/Incidents'))
const IncidentDetail = lazy(() => import('./pages/IncidentDetail'))
const ReportIncident = lazy(() => import('./pages/ReportIncident'))
const RiskIntelligence = lazy(() => import('./pages/RiskIntelligence'))
const HazardLsrAnalytics = lazy(() => import('./pages/HazardLsrAnalytics'))
const Knowledge = lazy(() => import('./pages/Knowledge'))
const Settings = lazy(() => import('./pages/Settings'))

function PageFallback() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="w-full max-w-4xl space-y-4">
        <SkeletonBlock className="h-12 w-1/3" />
        <SkeletonBlock className="h-64 w-full" />
        <div className="grid grid-cols-3 gap-4">
          <SkeletonBlock className="h-32" />
          <SkeletonBlock className="h-32" />
          <SkeletonBlock className="h-32" />
        </div>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<ExecutiveDashboard />} />
          <Route path="/incidents" element={<Incidents />} />
          <Route path="/incidents/:id" element={<IncidentDetail />} />
          <Route path="/report" element={<ReportIncident />} />
          <Route path="/risk" element={<RiskIntelligence />} />
          <Route path="/hazards-lsr" element={<HazardLsrAnalytics />} />
          <Route path="/knowledge" element={<Knowledge />} />
          <Route path="/settings" element={<Settings />} />

          {/* Redirects for old routes */}
          <Route path="/sites" element={<Navigate to="/risk" replace />} />
          <Route path="/areas" element={<Navigate to="/risk" replace />} />
          <Route path="/hazards" element={<Navigate to="/hazards-lsr" replace />} />
          <Route path="/lsr" element={<Navigate to="/hazards-lsr" replace />} />
          <Route path="/recommendations" element={<Navigate to="/incidents" replace />} />
          <Route path="/copilot" element={<Navigate to="/dashboard" replace />} />
          <Route path="/memory" element={<Navigate to="/knowledge" replace />} />
          <Route path="/graph" element={<Navigate to="/knowledge" replace />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
