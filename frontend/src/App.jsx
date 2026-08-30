import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import Layout from './components/layout/Layout'
import { SkeletonBlock } from './components/common/Skeleton'

const Landing = lazy(() => import('./pages/Landing'))
const ExecutiveDashboard = lazy(() => import('./pages/ExecutiveDashboard'))
const IncidentExplorer = lazy(() => import('./pages/IncidentExplorer'))
const IncidentDetail = lazy(() => import('./pages/IncidentDetail'))
const ReportIncident = lazy(() => import('./pages/ReportIncident'))
const SafetyMemory = lazy(() => import('./pages/SafetyMemory'))
const SiteIntelligence = lazy(() => import('./pages/SiteIntelligence'))
const AreaIntelligence = lazy(() => import('./pages/AreaIntelligence'))
const HazardAnalytics = lazy(() => import('./pages/HazardAnalytics'))
const LsrDashboard = lazy(() => import('./pages/LsrDashboard'))
const Recommendations = lazy(() => import('./pages/Recommendations'))
const Copilot = lazy(() => import('./pages/Copilot'))
const KnowledgeGraph = lazy(() => import('./pages/KnowledgeGraph'))

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
          <Route path="/incidents" element={<IncidentExplorer />} />
          <Route path="/incidents/:id" element={<IncidentDetail />} />
          <Route path="/report" element={<ReportIncident />} />
          <Route path="/memory" element={<SafetyMemory />} />
          <Route path="/sites" element={<SiteIntelligence />} />
          <Route path="/areas" element={<AreaIntelligence />} />
          <Route path="/hazards" element={<HazardAnalytics />} />
          <Route path="/lsr" element={<LsrDashboard />} />
          <Route path="/recommendations" element={<Recommendations />} />
          <Route path="/copilot" element={<Copilot />} />
          <Route path="/graph" element={<KnowledgeGraph />} />
        </Route>
      </Routes>
    </Suspense>
  )
}