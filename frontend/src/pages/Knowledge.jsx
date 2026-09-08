import { useState } from 'react'
import { BrainCircuit, Share2 } from 'lucide-react'

import SafetyMemory from './SafetyMemory'
import KnowledgeGraph from './KnowledgeGraph'

const TABS = [
  { id: 'memory', label: 'Safety Memory', icon: BrainCircuit },
  { id: 'graph', label: 'Knowledge Graph', icon: Share2 },
]

export default function Knowledge() {
  const [tab, setTab] = useState('memory')

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-1 rounded-xl border border-line bg-surface p-1 w-fit">
        {TABS.map((t) => {
          const Icon = t.icon
          const active = tab === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-all duration-200 ${
                active
                  ? 'bg-brand-500/10 text-brand-400 shadow-sm ring-1 ring-brand-500/20'
                  : 'text-fg-3 hover:text-fg-2 hover:bg-surface-2'
              }`}
            >
              <Icon size={14} aria-hidden="true" />
              {t.label}
            </button>
          )
        })}
      </div>

      {tab === 'memory' && <SafetyMemory />}
      {tab === 'graph' && <KnowledgeGraph />}
    </div>
  )
}
