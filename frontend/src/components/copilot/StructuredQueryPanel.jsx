import { useId, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Filter, Search, SlidersHorizontal, X, ArrowUpRight } from 'lucide-react'
import { useStructuredQuery } from '../../api/queries'
import SectionErrorBoundary from '../common/SectionErrorBoundary'
import ErrorState from '../common/ErrorState'
import EmptyState from '../common/EmptyState'
import RiskBadge from '../common/RiskBadge'
import { SkeletonBlock, SkeletonTable } from '../common/Skeleton'
import {
  normaliseStructured,
  FilterChips,
  UnrecognisedNote,
  AggregateStats,
  RelaxationCallout,
} from './StructuredResultView'
import { formatDate, formatNumber, formatPct, truncate } from '../../lib/format'

const EXAMPLES = [
  'Show all confined space incidents during monsoon having SIF > 90 where gas detector failed.',
  'Show all work at height incidents during monsoon having SIF > 90',
  'critical lifting incidents at Refinery Block B',
  'hot work incidents at Refinery Block A with SIF > 80',
]

const FILTER = 'h-9 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-semibold text-fg-2 transition-all duration-180 hover:border-line-2 hover:bg-surface-2 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20'
const TH = 'eyebrow whitespace-nowrap px-4 py-3 text-left'

function ResultTable({ results, totalMatched }) {
  const [text, setText] = useState('')
  const [site, setSite] = useState('')
  const [band, setBand] = useState('')
  const textId = useId()

  const sites = useMemo(
    () => Array.from(new Set(results.map((r) => r.site).filter(Boolean))).sort(),
    [results]
  )
  const bands = useMemo(
    () => Array.from(new Set(results.map((r) => r.risk_band).filter(Boolean))),
    [results]
  )

  const filtered = useMemo(() => {
    const needle = text.trim().toLowerCase()
    return results.filter((r) => {
      if (site && r.site !== site) return false
      if (band && r.risk_band !== band) return false
      if (!needle) return true
      return (
        (r.narrative || '').toLowerCase().includes(needle) ||
        (r.report_id || '').toLowerCase().includes(needle) ||
        (r.department || '').toLowerCase().includes(needle)
      )
    })
  }, [results, text, site, band])

  const hasTableFilter = Boolean(text || site || band)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="eyebrow inline-flex items-center gap-1.5">
          <SlidersHorizontal size={12} aria-hidden="true" className="text-brand-500 animate-pulse-soft" />
          Refine these results
        </span>
        <label className="sr-only" htmlFor={textId}>
          Filter results by text
        </label>
        <input
          id={textId}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Filter by text, report id or department"
          className="input w-64 h-9 px-3 text-xs shadow-sm"
        />
        <label className="sr-only" htmlFor={`${textId}-site`}>
          Filter results by site
        </label>
        <select id={`${textId}-site`} value={site} onChange={(e) => setSite(e.target.value)} className={FILTER}>
          <option value="">All sites</option>
          {sites.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor={`${textId}-band`}>
          Filter results by risk band
        </label>
        <select id={`${textId}-band`} value={band} onChange={(e) => setBand(e.target.value)} className={FILTER}>
          <option value="">All risk bands</option>
          {bands.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
        {hasTableFilter && (
          <button
            type="button"
            onClick={() => {
              setText('')
              setSite('')
              setBand('')
            }}
            className="btn-secondary h-9 gap-1 px-2.5 text-xs shadow-sm"
          >
            <X size={13} aria-hidden="true" /> Clear
          </button>
        )}
        <span className="ml-auto text-xs tabular-nums text-fg-3">
          showing <strong className="font-semibold text-fg-2">{formatNumber(filtered.length)}</strong> of{' '}
          <strong className="font-semibold text-fg-2">{formatNumber(results.length)}</strong> returned
          {totalMatched != null && totalMatched > results.length && (
            <> · <strong className="font-semibold text-brand-600">{formatNumber(totalMatched)}</strong> matched in the corpus</>
          )}
        </span>
      </div>

      {totalMatched != null && totalMatched > results.length && (
        <p className="text-2xs text-fg-3">
          The API returns the top {formatNumber(results.length)} matching reports; the aggregate above is computed over
          all {formatNumber(totalMatched)}.
        </p>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          title="No rows match this refinement"
          message="Clear the text, site or risk-band filter above to see the full result set returned for this query."
        />
      ) : (
        <div className="scrollbar-slim max-h-[32rem] overflow-auto rounded-xl border border-line shadow-card bg-surface/50 backdrop-blur-md">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="sticky top-0 z-10 bg-surface-2/95 backdrop-blur-md shadow-sm">
              <tr className="border-b border-line">
                <th scope="col" className={TH}>Report</th>
                <th scope="col" className={TH}>Site / Area</th>
                <th scope="col" className={TH}>Department</th>
                <th scope="col" className={TH}>Reported</th>
                <th scope="col" className={TH}>SIF prob.</th>
                <th scope="col" className={TH}>Risk</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line bg-surface/20">
              {filtered.map((r, i) => (
                <tr
                  key={`${r.report_id}-${i}`}
                  className="transition-colors duration-180 ease-out-standard hover:bg-surface-2/70"
                >
                  <td className="px-4 py-3">
                    <Link to={`/incidents/${encodeURIComponent(r.report_id)}`} className="group block">
                      <span className="font-mono text-2xs text-fg-3">{r.report_id}</span>
                      <span className="mt-0.5 flex items-center gap-1 text-sm font-semibold text-fg group-hover:text-brand-600 transition-colors duration-180">
                        {truncate(r.narrative, 130)}
                        <ArrowUpRight size={13} className="shrink-0 text-fg-3 opacity-0 transition-all duration-180 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                      </span>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <span className="block font-bold text-fg-2">{r.site}</span>
                    <span className="block text-fg-3">{r.area}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-fg-2 font-medium">{r.department || '—'}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs tabular-nums text-fg-2 font-medium">
                    {formatDate(r.reported_on)}
                  </td>
                  <td className="px-4 py-3 text-xs font-bold tabular-nums text-fg-2">
                    {formatPct(r.sif_probability)}
                  </td>
                  <td className="px-4 py-3">
                    <RiskBadge band={r.risk_band} size="sm" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default function StructuredQueryPanel() {
  const [query, setQuery] = useState('')
  const [ranQuery, setRanQuery] = useState('')
  const mutation = useStructuredQuery()
  const inputId = useId()

  function run(q) {
    const text = (q ?? query).trim()
    if (!text || mutation.isPending) return
    setQuery(text)
    setRanQuery(text)
    mutation.mutate(text)
  }

  const s = mutation.isSuccess ? normaliseStructured(mutation.data) : null

  return (
    <div className="space-y-6">
      <section className="card p-5 relative overflow-hidden bg-gradient-to-br from-surface to-surface-2/40">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-brand-500/10 blur-3xl"
        />
        <div className="relative flex items-start gap-3.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-500/10 text-brand-500 ring-1 ring-brand-500/20 dark:bg-brand-500/20 dark:text-brand-300 dark:ring-brand-500/30 shadow-sm">
            <Filter size={18} aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-display text-base font-bold tracking-tight text-fg">Structured query</h2>
            <p className="mt-0.5 max-w-3xl text-xs leading-relaxed text-fg-2">
              Ask in one sentence with as many constraints as you need — hazard, season, SIF threshold, failed control,
              risk band, site. Every filter the parser understood is shown back to you, and anything it could not read is
              named rather than ignored.
            </p>
          </div>
        </div>

        <form
          className="mt-5 flex flex-wrap gap-2.5 relative"
          onSubmit={(e) => {
            e.preventDefault()
            run()
          }}
        >
          <label className="sr-only" htmlFor={inputId}>
            Structured natural-language query
          </label>
          <div className="relative min-w-[16rem] flex-1">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-3"
              size={16}
              aria-hidden="true"
            />
            <input
              id={inputId}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Show all confined space incidents during monsoon having SIF > 90 where gas detector failed."
              className="input pl-10 shadow-sm"
            />
          </div>
          <button type="submit" disabled={mutation.isPending || !query.trim()} className="btn-primary shrink-0 px-5 shadow-md">
            {mutation.isPending ? 'Running…' : 'Run query'}
          </button>
        </form>

        <div className="mt-3.5 flex flex-wrap gap-1.5">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => run(ex)}
              className="chip border-line bg-surface hover:border-brand-300 dark:hover:border-brand-500/40 hover:bg-brand-50/50 dark:hover:bg-brand-500/5 hover:text-brand-800 dark:hover:text-brand-300 shadow-sm"
            >
              {truncate(ex, 72)}
            </button>
          ))}
        </div>
      </section>

      <SectionErrorBoundary componentName="Structured query">
        {mutation.isIdle && (
          <EmptyState
            icon={Filter}
            title="No query run yet"
            message="Run one of the examples above, or type your own multi-constraint question. The parsed filters, the aggregate over every matching report, and the full result table appear here."
          />
        )}

        {mutation.isPending && (
          <div className="card space-y-4 p-5 bg-gradient-to-br from-surface to-surface-2/20">
            <SkeletonBlock className="h-6 w-2/3" />
            <SkeletonBlock className="h-16 w-full" />
            <SkeletonTable rows={6} cols={6} />
          </div>
        )}

        {mutation.isError && (
          <ErrorState componentName="Structured query" error={mutation.error} onRetry={() => run(ranQuery)} />
        )}

        {s && (
          <section className="card space-y-4.5 p-5 bg-gradient-to-br from-surface to-surface-2/30 animate-fade-up">
            <p className="text-xs text-fg-3">
              Query string: <span className="font-semibold text-fg-2">“{ranQuery}”</span>
            </p>

            {!s.recognised ? (
              <div className="rounded-xl border border-dashed border-line bg-surface-2/40 p-4">
                <p className="font-display text-sm font-bold tracking-tight text-fg">
                  Nothing filterable was recognised in that question
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-fg-2">{s.answer}</p>
                <div className="mt-3">
                  <UnrecognisedNote terms={s.unrecognised} />
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <FilterChips filters={s.appliedFilters} />
                <p className="text-sm leading-relaxed text-fg-2">{s.answer}</p>
                {s.aggregate && <AggregateStats aggregate={s.aggregate} />}
                {s.results.length === 0 && (
                  <RelaxationCallout relaxation={s.relaxation} filterCount={s.appliedFilters.length} />
                )}
                {s.results.length === 0 && s.relaxation.length === 0 && (
                  <EmptyState
                    title="No reports matched"
                    message="These filters are valid but nothing in the corpus satisfies all of them, and no single binding constraint was identified."
                  />
                )}
                {s.results.length > 0 && <ResultTable results={s.results} totalMatched={s.aggregate?.count} />}
                <UnrecognisedNote terms={s.unrecognised} />
              </div>
            )}
          </section>
        )}
      </SectionErrorBoundary>
    </div>
  )
}