import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { ChevronDown, ChevronRight, Search } from 'lucide-react'
import { useLsrAnalytics, useDepartmentAnalytics, useSemanticSearch } from '../api/queries'
import AsyncSection from '../components/common/AsyncSection'
import { SkeletonChart, SkeletonTable } from '../components/common/Skeleton'
import EmptyState from '../components/common/EmptyState'
import RiskBadge from '../components/common/RiskBadge'
import { CHART, ChartTooltip, axisProps, tooltipCursor } from '../components/common/ChartKit'
import { formatNumber, formatPct, truncate, rowLabel } from '../lib/format'

const TH = 'eyebrow whitespace-nowrap px-4 py-2.5 text-left'
const TD = 'px-4 py-3 align-middle'

function ruleLabel(rule) {
  return rule.replaceAll('_', ' ')
}

function RuleDrillThrough({ rule }) {
  const search = useSemanticSearch()
  const [opened, setOpened] = useState(false)

  function open() {
    setOpened(true)
    if (!search.data && !search.isPending) {
      search.mutate({ query: rule.replaceAll('_', ' '), top_k: 5 })
    }
  }

  return (
    <div className="border-t border-line bg-surface-2">
      <button
        type="button"
        onClick={() => (opened ? setOpened(false) : open())}
        className="flex w-full items-center gap-1.5 px-4 py-2.5 text-left text-xs font-semibold text-brand-700
          transition-colors duration-180 ease-out-standard hover:bg-brand-50"
      >
        {opened ? <ChevronDown size={13} aria-hidden="true" /> : <ChevronRight size={13} aria-hidden="true" />}
        <Search size={12} aria-hidden="true" />
        Drill through via semantic search
      </button>
      {opened && (
        <div className="px-4 pb-3.5">
          {search.isPending && <p className="text-xs text-fg-3">Searching corpus…</p>}
          {search.isError && <p className="text-xs font-medium text-risk-critical">{search.error.message}</p>}
          {search.data && (search.data.results || []).length === 0 && (
            <p className="text-xs text-fg-3">No reports semantically matched this rule's phrasing.</p>
          )}
          {search.data && search.data.results?.length > 0 && (
            <ul className="space-y-1.5">
              {search.data.results.map((r) => (
                <li key={r.report_id}>
                  <Link
                    to={`/incidents/${encodeURIComponent(r.report_id)}`}
                    className="block rounded-lg bg-surface px-3 py-2 text-xs leading-relaxed text-fg-2 ring-1 ring-slate-200/80
                      transition-colors duration-180 ease-out-standard hover:text-brand-700 hover:ring-brand-200"
                  >
                    <span className="font-mono text-fg-3">{r.report_id}</span> — {truncate(r.narrative, 100)}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

export default function LsrDashboard() {
  const lsrQuery = useLsrAnalytics()
  const departmentQuery = useDepartmentAnalytics()
  const [expandedRule, setExpandedRule] = useState(null)

  return (
    <div className="space-y-6">
      <section className="card">
        <div className="card-header">
          <div className="min-w-0">
            <h2 className="card-title text-fg">Rule violation ranking</h2>
            
          </div>
        </div>
        <div className="p-4 pr-5">
          <AsyncSection
            query={lsrQuery}
            componentName="LSR violation chart"
            skeleton={<SkeletonChart height={300} />}
            isEmpty={(data) => !data || data.length === 0}
            empty={<EmptyState title="No Life Saving Rule data" message="Rule analytics populate once reports are scored against the nine rules." />}
          >
            {(rules) => {
              const sorted = [...rules]
                .sort((a, b) => b.count - a.count)
                .map((r) => ({ ...r, label: ruleLabel(r.rule) }))
              const max = Math.max(...sorted.map((r) => r.count || 0), 1)
              return (
                <ResponsiveContainer width="100%" height={Math.max(300, sorted.length * 42)}>
                  <BarChart data={sorted} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }} barCategoryGap="28%">
                    <CartesianGrid strokeDasharray="4 4" stroke={CHART.grid} horizontal={false} />
                    <XAxis type="number" {...axisProps} allowDecimals={false} />
                    <YAxis
                      dataKey="label"
                      type="category"
                      {...axisProps}
                      width={176}
                      tick={{ fontSize: 11, fill: '#64748b' }}
                    />
                    <Tooltip cursor={tooltipCursor} content={<ChartTooltip />} />
                    {/* One hue, varying intensity: lightness encodes magnitude,
                        so a lighter bar never reads as a different risk band. */}
                    <Bar dataKey="count" name="Violations" radius={[0, 5, 5, 0]} maxBarSize={20}>
                      {sorted.map((r) => (
                        <Cell
                          key={r.rule}
                          fill={CHART.critical}
                          fillOpacity={0.4 + 0.6 * ((r.count || 0) / max)}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )
            }}
          </AsyncSection>
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="card-header">
          <div className="min-w-0">
            <h2 className="card-title text-fg">Rules — count, average score &amp; drill-through</h2>
            <p className="mt-0.5 text-xs text-fg-2">Open a rule to search the corpus for reports matching its phrasing.</p>
          </div>
        </div>
        <AsyncSection
          query={lsrQuery}
          componentName="LSR rule table"
          skeleton={<SkeletonTable rows={6} cols={3} />}
          isEmpty={(data) => !data || data.length === 0}
          empty={<div className="p-4"><EmptyState title="No rules scored yet" message="Nothing to rank until reports are analysed." /></div>}
        >
          {(rules) => (
            <ul className="divide-y divide-line">
              {[...rules]
                .sort((a, b) => b.count - a.count)
                .map((r) => {
                  const isOpen = expandedRule === r.rule
                  return (
                    <li key={r.rule} className={isOpen ? 'bg-surface-2' : ''}>
                      <button
                        type="button"
                        onClick={() => setExpandedRule(isOpen ? null : r.rule)}
                        aria-expanded={isOpen}
                        className="flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3.5 text-left
                          transition-colors duration-180 ease-out-standard hover:bg-surface-2"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <span aria-hidden="true" className="shrink-0 text-fg-3">
                            {isOpen ? <ChevronDown size={15} aria-hidden="true" /> : <ChevronRight size={15} aria-hidden="true" />}
                          </span>
                          <span className="truncate font-semibold text-fg">{ruleLabel(r.rule)}</span>
                        </span>
                        <span className="flex items-center gap-4 text-xs text-fg-3">
                          <span className="tabular-nums">
                            <span className="font-semibold text-fg-2">{formatNumber(r.count)}</span> violations
                          </span>
                          <span className="hidden tabular-nums sm:inline">
                            avg score <span className="font-semibold text-fg-2">{formatPct(r.avg_score)}</span>
                          </span>
                          <RiskBadge
                            band={r.avg_score >= 0.75 ? 'CRITICAL' : r.avg_score >= 0.5 ? 'HIGH' : 'MEDIUM'}
                            size="sm"
                          />
                        </span>
                      </button>
                      {isOpen && <RuleDrillThrough rule={r.rule} />}
                    </li>
                  )
                })}
            </ul>
          )}
        </AsyncSection>
      </section>

      <section className="card overflow-hidden">
        <div className="card-header">
          <div className="min-w-0">
            <h2 className="card-title text-fg">Department risk overview</h2>
            <p className="mt-0.5 max-w-3xl text-xs leading-relaxed text-fg-2">
              CONTRACT.md doesn't expose a rule-by-department cross-tab, so this is each department's overall risk
              profile (not filtered to a single rule) as the closest honest cut available.
            </p>
          </div>
        </div>
        <AsyncSection
          query={departmentQuery}
          componentName="Department breakdown"
          skeleton={<SkeletonTable rows={5} cols={4} />}
          isEmpty={(data) => !data || data.length === 0}
          empty={<div className="p-4"><EmptyState title="No department data" message="Populates once reports carry a department tag." /></div>}
        >
          {(departments) => (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead>
                  <tr className="border-b border-line bg-surface-2">
                    <th scope="col" className={TH}>Department</th>
                    <th scope="col" className={TH}>Reports</th>
                    <th scope="col" className={TH}>Critical</th>
                    <th scope="col" className={TH}>Composite Index</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {[...departments]
                    .sort((a, b) => b.composite_risk_index - a.composite_risk_index)
                    .map((d) => (
                      <tr
                        key={rowLabel(d, 'department')}
                        className="transition-colors duration-180 ease-out-standard hover:bg-surface-2"
                      >
                        <td className={`${TD} font-semibold text-fg`}>{rowLabel(d, 'department')}</td>
                        <td className={`${TD} tabular-nums text-fg-2`}>{formatNumber(d.report_count)}</td>
                        <td className={`${TD} font-semibold tabular-nums text-risk-critical`}>
                          {formatNumber(d.critical_count)}
                        </td>
                        <td className={`${TD} font-display font-bold tabular-nums text-fg`}>
                          {d.composite_risk_index?.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </AsyncSection>
      </section>
    </div>
  )
}
