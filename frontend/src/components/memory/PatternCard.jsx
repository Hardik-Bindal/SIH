import { Link } from 'react-router-dom'
import { ChevronDown, ChevronRight, Skull, MapPin, CalendarRange, ShieldOff } from 'lucide-react'
import { formatDate, formatNumber, formatPct, truncate } from '../../lib/format'
import { severityOf } from '../../lib/patternSeverity'

function Fact({ icon: Icon, label, children }) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      {Icon && <Icon size={11} aria-hidden="true" className="translate-y-px text-fg-3" />}
      {label && <span className="eyebrow">{label}</span>}
      <span className="text-xs text-fg-2">{children}</span>
    </span>
  )
}

function MiniBreakdown({ title, rows, labelKey }) {
  if (!rows || rows.length === 0) return null
  const max = Math.max(...rows.map((r) => r.count || 0), 1)
  return (
    <div>
      <p className="eyebrow mb-2">{title}</p>
      <ul className="space-y-1.5">
        {rows.map((r, i) => (
          <li key={`${r[labelKey]}-${i}`} className="flex items-center gap-2.5 text-xs">
            <span className="w-36 shrink-0 truncate text-fg-2" title={r[labelKey]}>
              {r[labelKey]}
            </span>
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3">
              <span
                className="block h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-600 transition-[width] duration-500 ease-out-expo"
                style={{ width: `${((r.count || 0) / max) * 100}%` }}
              />
            </span>
            <span className="w-10 shrink-0 text-right font-semibold tabular-nums text-fg-2">
              {formatNumber(r.count)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function PatternCard({
  pattern,
  expanded,
  onToggle,
  rank,
  panelId,
  maxFatalCount,
  baselineKey,
}) {
  const sev = severityOf(pattern)
  const fatalShareOfMax = maxFatalCount ? Math.max((pattern.fatal_count || 0) / maxFatalCount, 0.02) : 1
  const isBaseline = baselineKey != null && sev.key === baselineKey

  return (
    <article
      id={`pattern-${pattern.pattern_id}`}
      className={`card scroll-mt-24 overflow-hidden transition-all duration-250 ease-out-standard hover:-translate-y-0.5 ${
        isBaseline ? 'border-line' : sev.card
      } ${expanded ? 'shadow-card-hover' : 'hover:shadow-card-hover'}`}
    >
      <span className="block h-1 w-full bg-surface-2" aria-hidden="true">
        <span
          className={`block h-full transition-[width] duration-700 ease-out-expo ${sev.accent}`}
          style={{ width: `${fatalShareOfMax * 100}%` }}
        />
      </span>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={panelId}
        className="flex w-full items-start gap-3 p-4 text-left transition-colors duration-180 ease-out-standard hover:bg-surface-2/50"
      >
        <span className={`mt-0.5 shrink-0 text-fg-3 transition-transform duration-250 ${expanded ? 'rotate-0' : ''}`}>
          {expanded ? <ChevronDown size={16} aria-hidden="true" /> : <ChevronRight size={16} aria-hidden="true" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            {rank != null && (
              <span className="rounded-md bg-surface-2 px-1.5 py-0.5 font-mono text-2xs font-bold tabular-nums text-fg-2">
                #{rank}
              </span>
            )}
            <span className="font-display text-sm font-bold tracking-tight text-fg">{pattern.label}</span>
            {!isBaseline && (
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-semibold uppercase tracking-[0.06em] ${sev.badge}`}
              >
                {sev.key !== 'NONE' && <Skull size={10} aria-hidden="true" />}
                {sev.label}
              </span>
            )}
          </span>

          <span className="mt-2.5 flex flex-wrap gap-x-5 gap-y-2">
            <Fact label="Size">
              <strong className="font-semibold tabular-nums text-fg">{formatNumber(pattern.size)}</strong>
            </Fact>
            <Fact label="Fatal">
              <strong
                className={`font-semibold tabular-nums ${
                  pattern.fatal_count > 0 ? 'text-risk-critical' : 'text-fg'
                }`}
              >
                {formatNumber(pattern.fatal_count)}
              </strong>
              {pattern.fatal_rate != null && (
                <span className="tabular-nums text-fg-3"> ({formatPct(pattern.fatal_rate, 0)})</span>
              )}
            </Fact>
            <Fact icon={MapPin}>
              <strong className="font-semibold tabular-nums text-fg">{formatNumber(pattern.site_spread)}</strong>{' '}
              sites
            </Fact>
            <Fact label="Dominant rule">
              <strong className="font-mono text-2xs font-semibold text-fg">{pattern.dominant_rule || '—'}</strong>
              {pattern.dominant_rule_rate != null && (
                <span className="tabular-nums text-fg-3">
                  {' '}({formatPct(pattern.dominant_rule_rate, 0)} of cluster)
                </span>
              )}
            </Fact>
            <Fact icon={ShieldOff}>
              barrier failure{' '}
              <strong className="font-semibold tabular-nums text-fg">
                {formatPct(pattern.barrier_failure_rate, 0)}
              </strong>
            </Fact>
            <Fact icon={CalendarRange}>
              <span className="tabular-nums">
                {formatDate(pattern.first_seen)} → {formatDate(pattern.last_seen)}
              </span>
            </Fact>
          </span>
        </span>
      </button>

      {expanded && (
        <div id={panelId} className="space-y-4 border-t border-line bg-surface-2/50 p-4 animate-slide-down">
          {pattern.top_terms?.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="eyebrow">Cluster terms</span>
              {pattern.top_terms.map((t, i) => (
                <span
                  key={`${t}-${i}`}
                  className="rounded-full bg-surface px-2 py-0.5 text-2xs font-medium text-fg-2 ring-1 ring-line transition-transform duration-180 hover:scale-105"
                >
                  {t}
                </span>
              ))}
            </div>
          )}

          <div>
            <p className="eyebrow mb-2">Example reports ({pattern.examples?.length || 0})</p>
            {pattern.examples?.length > 0 ? (
              <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
                {pattern.examples.map((ex, i) => (
                  <li key={`${ex.report_id}-${i}`}>
                    <Link
                      to={`/incidents/${encodeURIComponent(ex.report_id)}`}
                      className="block p-3 transition-colors duration-180 ease-out-standard hover:bg-surface-2"
                    >
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-2xs text-fg-3">{ex.report_id}</span>
                        <span className="eyebrow">{ex.source_type}</span>
                        {ex.site && <span className="text-xs text-fg-3">· {ex.site}</span>}
                      </span>
                      <span className="mt-1 block text-sm leading-relaxed text-fg-2">
                        {truncate(ex.narrative, 200)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-fg-3">No example reports returned for this pattern.</p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <MiniBreakdown title="Sites" rows={pattern.sites} labelKey="site" />
            <MiniBreakdown title="Departments" rows={pattern.departments} labelKey="department" />
          </div>

          <p className="border-t border-line pt-3 text-2xs leading-relaxed text-fg-3">
            Cluster of {formatNumber(pattern.size)} reports ({formatNumber(pattern.incident_count)} incidents,{' '}
            {formatNumber(pattern.fatal_count)} fatalities). Labels come from cluster top-terms, so they describe what the
            cluster contains rather than naming an official hazard category — see{' '}
            <span className="font-mono">docs/DEVIATIONS.md</span>.
          </p>
        </div>
      )}
    </article>
  )
}