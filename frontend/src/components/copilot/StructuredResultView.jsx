import { Link } from 'react-router-dom'
import { Filter, HelpCircle, MapPin, ShieldOff, AlertOctagon, Scissors, ArrowUpRight } from 'lucide-react'
import RiskBadge from '../common/RiskBadge'
import { formatNumber, formatPct, formatDate, truncate } from '../../lib/format'

export function normaliseStructured(payload) {
  if (!payload) return null
  return {
    recognised: payload.recognised ?? true,
    appliedFilters: payload.applied_filters || [],
    aggregate: payload.aggregate || null,
    results: payload.results || [],
    relaxation: payload.relaxation || [],
    unrecognised: payload.unrecognised ?? payload.parsed?.unrecognised ?? [],
    answer: payload.answer || '',
  }
}

export function FilterChips({ filters }) {
  if (!filters || filters.length === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="eyebrow inline-flex items-center gap-1.5 text-fg-3">
        <Filter size={11} aria-hidden="true" />
        Understood as
      </span>
      {filters.map((f, i) => (
        <span
          key={`${f}-${i}`}
          className="chip border-brand-200 bg-brand-50/50 dark:border-brand-500/30 dark:bg-brand-500/10 py-0.5 text-2xs font-bold text-brand-700 dark:text-brand-300"
        >
          {f}
        </span>
      ))}
    </div>
  )
}

export function UnrecognisedNote({ terms }) {
  if (!terms || terms.length === 0) return null
  return (
    <p className="flex items-start gap-1.5 text-2xs leading-relaxed text-fg-3">
      <HelpCircle size={12} aria-hidden="true" className="mt-0.5 shrink-0 text-brand-500" />
      <span>
        not interpreted: <span className="italic font-semibold text-fg-2">{terms.join(', ')}</span> — these words were not matched to any filter,
        so they had no effect on the result.
      </span>
    </p>
  )
}

function Stat({ icon: Icon, label, value, accent = 'text-fg' }) {
  return (
    <div className="flex min-w-[7.5rem] flex-1 flex-col gap-0.5 rounded-xl border border-line bg-surface px-3 py-2.5 shadow-sm transition-all duration-250 hover:shadow-md hover:border-line-2">
      <span className="eyebrow inline-flex items-center gap-1 text-fg-3">
        {Icon && <Icon size={11} aria-hidden="true" className="text-brand-500" />}
        {label}
      </span>
      <span className={`font-display text-sm font-extrabold tabular-nums tracking-tight ${accent}`}>{value}</span>
    </div>
  )
}

export function AggregateStats({ aggregate }) {
  if (!aggregate) return null
  const site = aggregate.most_common_site
  const barrier = aggregate.repeated_barrier
  return (
    <div className="flex flex-wrap gap-3.5 rounded-xl border border-line bg-gradient-to-br from-surface-2 to-surface-3/50 p-3.5">
      <Stat icon={Filter} label="Matching reports" value={formatNumber(aggregate.count)} />
      <Stat
        icon={MapPin}
        label="Most common site"
        value={site ? `${site.site} (${formatNumber(site.count)})` : '—'}
      />
      <Stat
        icon={ShieldOff}
        label="Repeated barrier"
        value={barrier ? `${barrier.label} (${formatNumber(barrier.count)})` : '—'}
      />
      <Stat
        icon={AlertOctagon}
        label="Critical count"
        value={formatNumber(aggregate.critical_count ?? 0)}
        accent={aggregate.critical_count > 0 ? 'text-risk-critical' : 'text-fg'}
      />
      {aggregate.avg_sif_probability != null && (
        <Stat label="Avg SIF probability" value={formatPct(aggregate.avg_sif_probability)} />
      )}
      {aggregate.barrier_failure_rate != null && (
        <Stat label="Barrier failure rate" value={formatPct(aggregate.barrier_failure_rate)} />
      )}
    </div>
  )
}

export function RelaxationCallout({ relaxation, filterCount }) {
  if (!relaxation || relaxation.length === 0) return null
  const sorted = [...relaxation].sort((a, b) => (b.would_match || 0) - (a.would_match || 0))
  const binding = sorted[0]
  const rest = sorted.slice(1)
  return (
    <div className="rounded-xl border border-risk-medium-border bg-gradient-to-br from-risk-medium-bg to-risk-medium-bg/30 p-4">
      <p className="eyebrow flex items-center gap-1.5 text-risk-medium font-bold">
        <Scissors size={12} aria-hidden="true" />
        Binding constraint
      </p>
      <p className="mt-1.5 text-sm leading-relaxed text-fg-2">
        <strong className="font-extrabold text-fg">0</strong> reports matched
        {filterCount ? ` all ${filterCount} filters` : ''} — dropping{' '}
        <strong className="text-risk-medium font-bold">{binding.dropped_filter}</strong> alone would return{' '}
        <strong className="tabular-nums text-fg font-extrabold">{formatNumber(binding.would_match)}</strong> matches.
      </p>
      {rest.length > 0 && (
        <ul className="mt-2.5 space-y-1.5 border-t border-risk-medium-border/30 pt-2.5">
          {rest.map((r, i) => (
            <li key={`${r.dropped_filter}-${i}`} className="text-xs text-fg-2 flex justify-between">
              <span>dropping <span className="font-semibold text-fg-2">{r.dropped_filter}</span> alone</span>
              <span className="tabular-nums font-bold text-fg">{formatNumber(r.would_match)} report(s)</span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-2xs text-fg-3/80 font-medium italic">
        The query was not quietly widened — this is what the corpus actually holds.
      </p>
    </div>
  )
}

export function ResultLinkList({ results, limit }) {
  if (!results || results.length === 0) return null
  const shown = limit ? results.slice(0, limit) : results
  return (
    <div className="space-y-2">
      <p className="eyebrow">
        Top matching reports ({shown.length}
        {limit && results.length > limit ? ` of ${results.length} returned` : ''})
      </p>
      <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface shadow-sm">
        {shown.map((r, i) => (
          <li key={`${r.report_id}-${i}`}>
            <Link
              to={`/incidents/${encodeURIComponent(r.report_id)}`}
              className="group flex items-start justify-between gap-3 p-3.5 transition-colors duration-180 ease-out-standard hover:bg-surface-2"
            >
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-mono text-2xs text-fg-3 font-semibold">{r.report_id}</span>
                  {r.risk_band && <RiskBadge band={r.risk_band} size="sm" />}
                  {r.site && <span className="text-2xs font-bold text-fg-3">{r.site}</span>}
                  {r.reported_on && <span className="text-2xs text-fg-3">· {formatDate(r.reported_on)}</span>}
                </span>
                <span className="mt-1.5 block text-sm leading-relaxed text-fg-2 group-hover:text-brand-600 transition-colors duration-180">
                  {truncate(r.narrative, 160)}
                </span>
              </span>
              <span className="shrink-0 flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-bold tabular-nums text-brand-700 ring-1 ring-inset ring-brand-200/70 shadow-sm dark:bg-brand-500/10 dark:text-brand-300 dark:ring-brand-500/20">
                {formatPct(r.sif_probability, 0)}
                <ArrowUpRight size={12} className="opacity-0 group-hover:opacity-100 transition-all duration-180 group-hover:translate-x-0.5" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function StructuredResultView({ payload, resultLimit = 10 }) {
  const s = normaliseStructured(payload)
  if (!s) return null

  return (
    <div className="space-y-4.5">
      <FilterChips filters={s.appliedFilters} />
      {s.aggregate && <AggregateStats aggregate={s.aggregate} />}
      {s.results.length === 0 && s.relaxation.length > 0 && (
        <RelaxationCallout relaxation={s.relaxation} filterCount={s.appliedFilters.length} />
      )}
      {s.results.length === 0 && s.relaxation.length === 0 && s.appliedFilters.length > 0 && (
        <p className="rounded-xl border border-dashed border-line bg-surface-2 px-3.5 py-2.5 text-sm text-fg-2">
          No report matched these filters, and no single filter could be identified as the binding one.
        </p>
      )}
      <ResultLinkList results={s.results} limit={resultLimit} />
      <UnrecognisedNote terms={s.unrecognised} />
    </div>
  )
}