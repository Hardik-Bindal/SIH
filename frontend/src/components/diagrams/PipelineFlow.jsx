import { Database, Layers, Cpu, Server, Monitor } from 'lucide-react'

const STAGES = [
  { icon: Database, name: 'Sources', detail: 'OSHA corpora + live entry' },
  { icon: Layers, name: 'ETL', detail: 'Clean · dedupe · label' },
  { icon: Cpu, name: 'AI Engine', detail: 'Score · map · retrieve · explain', primary: true },
  { icon: Server, name: 'Service', detail: 'API + vector index' },
  { icon: Monitor, name: 'Dashboards', detail: 'Decide and act' },
]

function Connector({ vertical = false }) {
  return vertical ? (
    <svg width="14" height="26" viewBox="0 0 14 26" aria-hidden="true" className="mx-auto text-line-2">
      <path d="M7 0 V18" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 3" />
      <path d="M3 17 L7 23 L11 17" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ) : (
    <svg width="32" height="14" viewBox="0 0 32 14" aria-hidden="true" className="shrink-0 text-line-2">
      <defs>
        <linearGradient id="conn-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.2" />
          <stop offset="50%" stopColor="currentColor" stopOpacity="1" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.2" />
        </linearGradient>
      </defs>
      <path d="M0 7 H22" stroke="url(#conn-grad)" strokeWidth="1.5" strokeDasharray="3 3" />
      <path d="M21 3 L27 7 L21 11" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function PipelineFlow() {
  return (
    <div>
      <ol className="flex flex-col items-stretch gap-0 lg:flex-row lg:items-center lg:gap-0">
        {STAGES.map((s, i) => (
          <li key={s.name} className="contents">
            <div
              className={`group relative flex-1 overflow-hidden rounded-2xl border p-4 text-center transition-all duration-250 ease-out-standard hover:-translate-y-1 animate-fade-up ${
                s.primary
                  ? 'border-brand-300 bg-gradient-to-br from-brand-50 via-brand-100/50 to-surface shadow-glow'
                  : 'border-line bg-surface shadow-card hover:shadow-card-hover'
              }`}
              style={{ animationDelay: `${i * 100}ms`, animationFillMode: 'both' }}
            >
              {s.primary && (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-brand-500/20 blur-2xl"
                />
              )}
              <span
                className={`relative mx-auto grid h-11 w-11 place-items-center rounded-xl transition-transform duration-250 group-hover:scale-110 ${
                  s.primary
                    ? 'bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-[0_4px_16px_-4px_rgb(var(--color-brand-600)/0.6)]'
                    : 'bg-surface-2 text-fg-2'
                }`}
              >
                <s.icon size={20} aria-hidden="true" />
              </span>
              <p className={`relative mt-3 text-sm font-bold tracking-tight ${s.primary ? 'text-brand-800' : 'text-fg'}`}>
                {s.name}
              </p>
              <p className="relative mt-1 text-xs leading-snug text-fg-3">{s.detail}</p>
            </div>
            {i < STAGES.length - 1 && (
              <>
                <span className="lg:hidden"><Connector vertical /></span>
                <span className="hidden lg:block"><Connector /></span>
              </>
            )}
          </li>
        ))}
      </ol>
    </div>
  )
}