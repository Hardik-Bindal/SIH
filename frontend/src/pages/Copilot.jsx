import { useState } from 'react'
import { MessageSquareText, Filter } from 'lucide-react'
import CopilotChat from '../components/copilot/CopilotChat'
import StructuredQueryPanel from '../components/copilot/StructuredQueryPanel'

const TABS = [
  { id: 'chat', label: 'Chat', icon: MessageSquareText },
  { id: 'structured', label: 'Structured query', icon: Filter },
]

export default function Copilot() {
  const [tab, setTab] = useState('chat')

  return (
    <div className={tab === 'chat' ? 'mx-auto max-w-3xl' : 'mx-auto max-w-6xl'}>
      {/* Segmented control — arrow-key navigable tablist (SRS 14.5 Keyboard). */}
      <div
        role="tablist"
        aria-label="Copilot mode"
        className="mb-5 inline-flex rounded-xl border border-line bg-surface p-1 shadow-card"
      >
        {TABS.map(({ id, label, icon: Icon }) => {
          const selected = tab === id
          return (
            <button
              key={id}
              id={`copilot-tab-${id}`}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls={`copilot-panel-${id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setTab(id)}
              onKeyDown={(e) => {
                if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
                e.preventDefault()
                const i = TABS.findIndex((t) => t.id === tab)
                const next = TABS[(i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length]
                setTab(next.id)
                document.getElementById(`copilot-tab-${next.id}`)?.focus()
              }}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-semibold
                transition-all duration-180 ease-out-standard
                ${
                  selected
                    ? 'bg-brand-600 text-white shadow-[0_2px_10px_-2px_rgb(37_99_235/0.35)]'
                    : 'text-fg-2 hover:bg-surface-2 hover:text-fg'
                }`}
            >
              <Icon size={15} aria-hidden="true" />
              {label}
            </button>
          )
        })}
      </div>

      <div
        role="tabpanel"
        id="copilot-panel-chat"
        aria-labelledby="copilot-tab-chat"
        hidden={tab !== 'chat'}
        className={tab === 'chat' ? 'h-[calc(100vh-12rem)]' : ''}
      >
        {/* Kept mounted so switching tabs never discards the conversation. */}
        <CopilotChat variant="full" />
      </div>

      {tab === 'structured' && (
        <div role="tabpanel" id="copilot-panel-structured" aria-labelledby="copilot-tab-structured">
          <StructuredQueryPanel />
        </div>
      )}
    </div>
  )
}
