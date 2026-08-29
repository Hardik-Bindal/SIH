import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, X, SlidersHorizontal, Sparkles, ArrowRight } from 'lucide-react'
import { useIncidents, useSemanticSearch } from '../api/queries'
import { useFilterStore, AREAS, RISK_BANDS } from '../store/filterStore'
import AsyncSection from '../components/common/AsyncSection'
import { SkeletonTable } from '../components/common/Skeleton'
import EmptyState from '../components/common/EmptyState'
import ErrorState from '../components/common/ErrorState'
import RiskBadge from '../components/common/RiskBadge'
import Pagination from '../components/common/Pagination'
import { formatDate, formatPct, truncate } from '../lib/format'

const PAGE_SIZE = 15

const FILTER = 'h-9 rounded-lg border border-line bg-surface px-2.5 text-xs font-semibold text-fg-2 transition-all duration-180 hover:border-line-2 hover:bg-surface-2 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20'
const FILTER_TEXT = 'h-9 w-36 rounded-lg border border-line bg-surface px-2.5 text-xs font-semibold text-fg-2 placeholder:text-fg-3 transition-all duration-180 hover:border-line-2 hover:bg-surface-2 focus:border-brand-500 focus:outline-none'
const TH = 'eyebrow whitespace-nowrap px-4 py-3 text-left'

export default function IncidentExplorer() {
  const { site, area, department, setSite, setArea, setDepartment } = useFilterStore()
  const [riskBand, setRiskBand] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)

  const [semanticQuery, setSemanticQuery] = useState('')
  const [activeSemanticQuery, setActiveSemanticQuery] = useState('')
  const semanticSearch = useSemanticSearch()

  const listParams = {
    site: site || undefined,
    area: area || undefined,
    department: department || undefined,
    risk_band: riskBand || undefined,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
    page,
    page_size: PAGE_SIZE,
  }
  const incidentsQuery = useIncidents(listParams)

  const isSemanticMode = activeSemanticQuery.trim().length > 0

  function runSemanticSearch(e) {
    e.preventDefault()
    const q = semanticQuery.trim()
    if (!q) return
    setActiveSemanticQuery(q)
    semanticSearch.mutate({ query: q, top_k: 20, site: site || undefined, area: area || undefined })
  }

  function clearSemanticSearch() {
    setActiveSemanticQuery('')
    setSemanticQuery('')
  }

  const filterChips = useMemo(
    () =>
      [
        site && ['Site', site, () => setSite('')],
        area && ['Area', area, () => setArea('')],
        department && ['Dept.', department, () => setDepartment('')],
        riskBand && ['Risk', riskBand, () => setRiskBand('')],
        dateFrom && ['From', dateFrom, () => setDateFrom('')],
        dateTo && ['To', dateTo, () => setDateTo('')],
      ].filter(Boolean),
    [site, area, department, riskBand, dateFrom, dateTo, setSite, setArea, setDepartment]
  )

  return (
    <div className="space-y-6">
      <section className="card p-5 relative overflow-hidden bg-gradient-to-br from-surface to-surface-2/40">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -left-20 -top-20 h-48 w-48 rounded-full bg-brand-500/5 blur-3xl"
        />
        <form onSubmit={runSemanticSearch} className="flex flex-wrap gap-2.5 relative">
          <div className="relative min-w-[16rem] flex-1">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-3"
              size={16}
              aria-hidden="true"
            />
            <input
              value={semanticQuery}
              onChange={(e) => setSemanticQuery(e.target.value)}
              placeholder="Semantic search — e.g. “pressure released while opening line”"
              className="input pl-10 shadow-sm"
              aria-label="Semantic search"
            />
          </div>
          <button type="submit" className="btn-primary shrink-0 px-5 shadow-sm">
            Search
          </button>
          {isSemanticMode && (
            <button type="button" onClick={clearSemanticSearch} className="btn-secondary h-9 shrink-0 gap-1 px-3">
              <X size={14} aria-hidden="true" /> Clear
            </button>
          )}
        </form>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
          <span className="eyebrow flex items-center gap-1.5 pr-2 text-fg-3">
            <SlidersHorizontal size={12} aria-hidden="true" className="text-brand-500 animate-pulse-soft" />
            Quick Filters
          </span>
          <label className="sr-only" htmlFor="explorer-area">
            Filter by area
          </label>
          <select id="explorer-area" value={area} onChange={(e) => setArea(e.target.value)} className={FILTER}>
            <option value="">All areas</option>
            {AREAS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor="explorer-band">
            Filter by risk band
          </label>
          <select
            id="explorer-band"
            value={riskBand}
            onChange={(e) => {
              setRiskBand(e.target.value)
              setPage(1)
            }}
            className={FILTER}
          >
            <option value="">All risk bands</option>
            {RISK_BANDS.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor="explorer-department">
            Filter by department
          </label>
          <input
            id="explorer-department"
            value={department}
            onChange={(e) => {
              setDepartment(e.target.value)
              setPage(1)
            }}
            placeholder="Department"
            className={FILTER_TEXT}
          />
          <label className="sr-only" htmlFor="explorer-from">
            Reported from
          </label>
          <input
            id="explorer-from"
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value)
              setPage(1)
            }}
            className={FILTER}
          />
          <span className="text-xs text-fg-3">→</span>
          <label className="sr-only" htmlFor="explorer-to">
            Reported to
          </label>
          <input
            id="explorer-to"
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value)
              setPage(1)
            }}
            className={FILTER}
          />
        </div>

        {filterChips.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5 animate-fade-up">
            {filterChips.map(([k, v, clear]) => (
              <button
                key={k}
                onClick={clear}
                type="button"
                className="chip border-line bg-surface hover:border-line-2 hover:bg-surface-2 shadow-sm font-semibold"
              >
                <span className="text-fg-3">{k}:</span> {v}
                <X size={11} aria-hidden="true" className="text-brand-500" />
              </button>
            ))}
          </div>
        )}
      </section>

      {isSemanticMode ? (
        <section className="card overflow-hidden bg-gradient-to-b from-surface to-surface-2/10">
          <div className="card-header bg-gradient-to-r from-surface to-surface-2/10">
            <div className="flex min-w-0 items-center gap-2">
              <Sparkles size={15} className="shrink-0 text-brand-500 animate-pulse-soft" aria-hidden="true" />
              <h2 className="card-title truncate text-fg font-bold">Semantic matches for “{activeSemanticQuery}”</h2>
            </div>
            {semanticSearch.isSuccess && (
              <span className="shrink-0 text-xs font-bold tabular-nums text-brand-600 bg-brand-50/50 dark:bg-brand-500/10 px-2.5 py-0.5 rounded-lg border border-brand-200/50 dark:border-brand-500/20">
                {(semanticSearch.data.results || []).length} matches
              </span>
            )}
          </div>
          {semanticSearch.isPending && <SkeletonTable rows={6} cols={4} />}
          {semanticSearch.isError && (
            <div className="p-4">
              <ErrorState componentName="Semantic search" error={semanticSearch.error} onRetry={runSemanticSearch} />
            </div>
          )}
          {semanticSearch.isSuccess &&
            ((semanticSearch.data.results || []).length === 0 ? (
              <div className="p-4">
                <EmptyState title="No semantic matches" message="Try a broader description of the hazard or condition." />
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {semanticSearch.data.results.map((r, idx) => (
                  <li key={r.report_id} className="animate-fade-up" style={{ animationDelay: `${idx * 40}ms` }}>
                    <Link
                      to={`/incidents/${encodeURIComponent(r.report_id)}`}
                      className="group flex items-start justify-between gap-4 p-4 transition-colors duration-180 ease-out-standard hover:bg-surface-2/60"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="font-mono text-xs text-fg-3 font-semibold">{r.report_id}</span>
                          <span className="eyebrow">{r.source_type}</span>
                          {r.site && <span className="text-xs text-fg-3">· {r.site}</span>}
                          {r.area && <span className="text-xs text-fg-3">· {r.area}</span>}
                        </div>
                        <p className="mt-1.5 text-sm font-semibold leading-relaxed text-fg-2 group-hover:text-brand-600 transition-colors">
                          {truncate(r.narrative, 180)}
                        </p>
                      </div>
                      <span className="shrink-0 flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-bold tabular-nums text-brand-700 ring-1 ring-inset ring-brand-200/70 shadow-sm dark:bg-brand-500/10 dark:text-brand-300 dark:ring-brand-500/20">
                        {formatPct(r.similarity)}
                        <ArrowRight size={13} className="opacity-0 group-hover:opacity-100 transition-all group-hover:translate-x-0.5" />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ))}
        </section>
      ) : (
        <section className="card overflow-hidden">
          <AsyncSection
            query={incidentsQuery}
            componentName="Incident list"
            skeleton={<SkeletonTable rows={8} cols={6} />}
            isEmpty={(data) => !data || data.items.length === 0}
            empty={
              <div className="p-4">
                <EmptyState
                  title="No incidents match these filters"
                  message="Widen the site, area, department, risk band or date range to see more reports."
                />
              </div>
            }
          >
            {(data) => (
              <>
                <div className="overflow-x-auto bg-surface">
                  <table className="w-full min-w-[860px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-line bg-surface-2/40">
                        <th scope="col" className={TH}>Report</th>
                        <th scope="col" className={TH}>Site / Area</th>
                        <th scope="col" className={TH}>Department</th>
                        <th scope="col" className={TH}>Reported</th>
                        <th scope="col" className={TH}>SIF Prob.</th>
                        <th scope="col" className={TH}>Risk</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {data.items.map((inc, idx) => (
                        <tr
                          key={inc.report_id}
                          className="transition-colors duration-180 ease-out-standard hover:bg-surface-2/50"
                        >
                          <td className="px-4 py-3.5">
                            <Link to={`/incidents/${encodeURIComponent(inc.report_id)}`} className="group block">
                              <span className="font-mono text-2xs text-fg-3 font-semibold">{inc.report_id}</span>
                              <p className="mt-0.5 max-w-md truncate text-sm font-bold text-fg group-hover:text-brand-600 transition-colors">
                                {truncate(inc.narrative, 120)}
                              </p>
                            </Link>
                          </td>
                          <td className="px-4 py-3.5 text-xs">
                            <span className="block font-bold text-fg-2">{inc.site}</span>
                            <span className="block text-fg-3">{inc.area}</span>
                          </td>
                          <td className="px-4 py-3.5 text-xs text-fg-2 font-medium">{inc.department || '—'}</td>
                          <td className="whitespace-nowrap px-4 py-3.5 text-xs tabular-nums text-fg-2 font-medium">
                            {formatDate(inc.reported_on)}
                          </td>
                          <td className="px-4 py-3.5 text-xs font-bold tabular-nums text-fg-2">
                            {formatPct(inc.sif_probability)}
                          </td>
                          <td className="px-4 py-3.5">
                            <RiskBadge band={inc.risk_band} size="sm" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination page={data.page} pageSize={data.page_size} total={data.total} onPageChange={setPage} />
              </>
            )}
          </AsyncSection>
        </section>
      )}
    </div>
  )
}