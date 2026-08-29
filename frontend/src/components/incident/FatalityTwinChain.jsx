import { Skull, ShieldOff, Zap, HeartPulse, Scissors } from 'lucide-react'
import EmptyState from '../common/EmptyState'
import SyntheticBadge from '../common/SyntheticBadge'
import { formatPct } from '../../lib/format'

function stepLabel(step) {
  if (typeof step === 'string') return step
  return step?.label || step?.step || step?.text || step?.name || JSON.stringify(step)
}

const BARRIER_RE = /barrier|control/i

function roleFor(label, i, n) {
  if (i === n - 1) return { role: 'Outcome', icon: Skull }
  if (BARRIER_RE.test(label)) return { role: 'Control', icon: ShieldOff }
  if (i === 0) return { role: 'Initiating event', icon: Zap }
  return { role: 'Harm', icon: HeartPulse }
}

const RAMP = [
  { rail: 'bg-risk-medium-border', dot: 'bg-risk-medium-solid', panel: 'border-risk-medium-border bg-risk-medium-bg', text: 'text-risk-medium' },
  { rail: 'bg-risk-high-border', dot: 'bg-risk-high-solid', panel: 'border-risk-high-border bg-risk-high-bg', text: 'text-risk-high' },
  { rail: 'bg-risk-critical-border', dot: 'bg-risk-critical-solid', panel: 'border-risk-critical-border bg-risk-critical-bg', text: 'text-risk-critical' },
]
const TERMINAL = {
  rail: 'bg-risk-critical-solid',
  dot: 'bg-risk-critical-solid animate-pulse-glow ring-4 ring-risk-critical-solid/20',
  panel: 'border-transparent bg-gradient-to-br from-risk-critical-solid to-risk-critical shadow-[0_8px_32px_-8px_rgb(var(--color-risk-critical-solid)/0.6)]',
  text: 'text-white font-bold',
}

function rampFor(i, n) {
  if (i === n - 1) return TERMINAL
  if (n <= 1) return RAMP[0]
  return RAMP[Math.min(RAMP.length - 1, Math.round((i / (n - 1)) * (RAMP.length - 1)))]
}

function Metric({ label, value, accent = 'text-fg' }) {
  return (
    <div className="min-w-[8rem] flex-1 rounded-xl border border-line bg-gradient-to-br from-surface-2 to-surface px-3.5 py-2.5 transition-all duration-250 hover:border-line-2 hover:shadow-card">
      <p className="eyebrow">{label}</p>
      <p className={`mt-0.5 font-display text-sm font-bold tabular-nums tracking-tight ${accent}`}>{value}</p>
    </div>
  )
}

export default function FatalityTwinChain({ twin }) {
  if (!twin || !twin.chain || twin.chain.length === 0) {
    return (
      <EmptyState
        icon={Skull}
        title="No escalation chain projected"
        message="Not enough matched fatal cases share a common pathway for this report."
      />
    )
  }

  const raw = twin.chain.map(stepLabel)
  const chain = raw.filter((label, i) => !(i < raw.length - 1 && /^fatal(ity|\s+injury)?$/i.test(label.trim())))

  const n = chain.length
  const steps = chain.map((label, i) => ({ label, i, ...roleFor(label, i, n), ...rampFor(i, n) }))
  const breakAt = steps.find((s) => s.role === 'Control')

  return (
    <div>
      <ol className="relative">
        {steps.map((s, i) => (
          <li
            key={i}
            className="relative flex gap-3 pb-3 last:pb-0 animate-fade-up"
            style={{ animationDelay: `${i * 140}ms`, animationFillMode: 'both' }}
          >
            <div className="relative flex w-6 shrink-0 flex-col items-center">
              <span
                className={`z-10 grid h-7 w-7 shrink-0 place-items-center rounded-full text-2xs font-bold tabular-nums text-white ring-2 ring-surface transition-transform duration-250 ${s.dot}`}
                aria-hidden="true"
              >
                {i + 1}
              </span>
              {i < n - 1 && <span className={`w-0.5 flex-1 ${s.rail}`} aria-hidden="true" />}
            </div>

            <div className={`min-w-0 flex-1 rounded-xl border px-3.5 py-3 transition-all duration-250 hover:-translate-y-0.5 ${s.panel}`}>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span
                  className={`inline-flex items-center gap-1 text-2xs font-semibold uppercase tracking-[0.08em] ${
                    i === n - 1 ? 'text-white/90' : 'text-fg-2'
                  }`}
                >
                  <s.icon size={11} aria-hidden="true" />
                  {s.role}
                </span>
                {s.role === 'Control' && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-brand-600 px-2 py-0.5 text-2xs font-semibold uppercase tracking-[0.06em] text-white shadow-[0_2px_8px_-2px_rgb(var(--color-brand-600)/0.6)]">
                    <Scissors size={10} aria-hidden="true" />
                    Break here
                  </span>
                )}
              </div>
              <p className={`mt-1 text-sm font-semibold leading-snug ${s.text}`}>{s.label}</p>
            </div>
          </li>
        ))}
      </ol>

      {breakAt && (
        <p className="mt-4 rounded-xl border border-brand-200 bg-gradient-to-br from-brand-50 to-brand-50/50 px-3.5 py-2.5 text-xs leading-relaxed text-brand-800">
          Every rung below the control stage is consequence. This is the only one a CAPA can act on — restore or verify
          that control and the chain stops before rung {n}.
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-3">
        <Metric label="Matched fatal cases" value={twin.matched ?? '—'} accent="text-risk-critical" />
        <Metric label="Mean similarity" value={formatPct(twin.similarity)} />
        <Metric label="Escalation likelihood" value={formatPct(twin.likelihood)} />
      </div>
      <div className="mt-3">
        <SyntheticBadge
          label="Real matched fatal cases"
          title="Chain narrative is generated; matched_report_ids trace to real OSHA fatality records."
        />
      </div>
    </div>
  )
}