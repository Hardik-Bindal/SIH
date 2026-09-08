import { ClipboardList } from 'lucide-react'
import IncidentExplorer from './IncidentExplorer'
import Recommendations from './Recommendations'

export default function Incidents() {
  return (
    <div className="space-y-8">
      <IncidentExplorer />

      <div className="border-t border-line pt-8 space-y-5">
        <div className="flex items-center gap-2">
          <ClipboardList size={16} className="text-brand-500" aria-hidden="true" />
          <h2 className="text-base font-bold tracking-tight text-fg">AI Recommendations</h2>
        </div>
        <Recommendations />
      </div>
    </div>
  )
}
