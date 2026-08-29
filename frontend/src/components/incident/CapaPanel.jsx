import { Printer, GraduationCap, Megaphone } from 'lucide-react'
import EmptyState from '../common/EmptyState'

const PRIORITY_STYLES = {
  C1: 'bg-risk-critical-bg text-risk-critical ring-risk-critical-border',
  P1: 'bg-risk-high-bg text-risk-high ring-risk-high-border',
}

function priorityStyle(priority) {
  return PRIORITY_STYLES[priority] || 'bg-surface-2 text-fg-2 ring-line'
}

export function capaToText(reportId, recommendations) {
  if (!recommendations) return ''
  const lines = [`CAPA — ${reportId || ''}`.trim(), '']
  if (recommendations.corrective_actions?.length) {
    lines.push('Corrective actions:')
    recommendations.corrective_actions.forEach((a) => lines.push(`  [${a.priority}] ${a.action} (rule: ${a.rule})`))
    lines.push('')
  }
  if (recommendations.preventive_actions?.length) {
    lines.push('Preventive actions:')
    recommendations.preventive_actions.forEach((a) => lines.push(`  [${a.priority}] ${a.action} (rule: ${a.rule})`))
    lines.push('')
  }
  if (recommendations.training_needs?.length) {
    lines.push('Training needs:')
    recommendations.training_needs.forEach((t) => lines.push(`  - ${t}`))
    lines.push('')
  }
  if (recommendations.toolbox_talk) {
    const tt = recommendations.toolbox_talk
    lines.push(`Toolbox talk: ${tt.title} (${tt.duration_minutes} min)`)
    ;(tt.points || []).forEach((p) => lines.push(`  * ${p}`))
    lines.push('')
  }
  if (recommendations.precedent_note) {
    lines.push(`Precedent: ${recommendations.precedent_note}`)
  }
  return lines.join('\n')
}

function ActionList({ title, actions }) {
  if (!actions || actions.length === 0) return null
  return (
    <div>
      <p className="eyebrow mb-2.5">{title}</p>
      <ul className="space-y-2">
        {actions.map((a, i) => (
          <li
            key={i}
            className="flex items-start gap-2.5 rounded-xl border border-line bg-gradient-to-br from-surface-2 to-surface px-3.5 py-3 text-sm transition-all duration-250 hover:-translate-y-0.5 hover:border-line-2 hover:shadow-card animate-fade-up"
            style={{ animationDelay: `${i * 60}ms`, animationFillMode: 'both' }}
          >
            <span
              className={`mt-px shrink-0 rounded-md px-1.5 py-0.5 text-2xs font-bold uppercase tracking-wide ring-1 ring-inset ${priorityStyle(
                a.priority
              )}`}
            >
              {a.priority}
            </span>
            <span className="leading-relaxed text-fg-2">
              {a.action}
              <span className="ml-1.5 font-mono text-2xs text-fg-3">({a.rule})</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function CapaPanel({ reportId, recommendations, onExport }) {
  if (!recommendations) {
    return <EmptyState title="No CAPA generated" message="Recommendations appear once this report has been scored." />
  }

  function handleExport() {
    if (onExport) return onExport()
    const text = capaToText(reportId, recommendations)
    const win = window.open('', '_blank', 'noopener,noreferrer')
    if (win) {
      win.document.write(
        `<pre style="font-family: ui-monospace, monospace; white-space: pre-wrap; padding:24px; background:#fafafa; color:#111;">${text.replace(/</g, '&lt;')}</pre>`
      )
      win.document.title = `CAPA — ${reportId || ''}`
      win.print()
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-display text-sm font-semibold tracking-tight text-fg">
          Corrective &amp; Preventive Actions
        </p>
        <button type="button" onClick={handleExport} className="btn-secondary px-2.5 py-1.5 text-xs">
          <Printer size={13} aria-hidden="true" />
          Export / Print
        </button>
      </div>

      <ActionList title="Corrective actions" actions={recommendations.corrective_actions} />
      <ActionList title="Preventive actions" actions={recommendations.preventive_actions} />

      {recommendations.training_needs?.length > 0 && (
        <div>
          <p className="eyebrow mb-2.5 flex items-center gap-1.5">
            <GraduationCap size={12} aria-hidden="true" />
            Training needs
          </p>
          <ul className="space-y-1.5">
            {recommendations.training_needs.map((t, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-fg-2">
                <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-line-2" />
                {t}
              </li>
            ))}
          </ul>
        </div>
      )}

      {recommendations.toolbox_talk && (
        <div className="relative overflow-hidden rounded-xl border border-brand-200 bg-gradient-to-br from-brand-50 via-brand-50 to-surface p-4 shadow-card">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-brand-500/10 blur-2xl"
          />
          <p className="relative eyebrow flex items-center gap-1.5 text-brand-700">
            <Megaphone size={12} aria-hidden="true" />
            Toolbox talk · {recommendations.toolbox_talk.duration_minutes} min
          </p>
          <p className="relative mt-1.5 font-display text-sm font-bold tracking-tight text-fg">
            {recommendations.toolbox_talk.title}
          </p>
          <ul className="relative mt-2.5 space-y-1.5">
            {(recommendations.toolbox_talk.points || []).map((p, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-fg-2">
                <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500 shadow-[0_0_6px_0_rgb(var(--color-brand-500)/0.5)]" />
                {p}
              </li>
            ))}
          </ul>
        </div>
      )}

      {recommendations.precedent_note && (
        <p className="rounded-xl border-l-2 border-line-2 bg-surface-2 px-3.5 py-3 text-xs italic leading-relaxed text-fg-2">
          {recommendations.precedent_note}
        </p>
      )}
    </div>
  )
}