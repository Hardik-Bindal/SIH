import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { ArrowUpRight, BarChart3, SlidersHorizontal } from 'lucide-react'
import { useSiteAnalytics } from '../api/queries'
import AsyncSection from '../components/common/AsyncSection'
import { SkeletonChart, SkeletonTable } from '../components/common/Skeleton'
import EmptyState from '../components/common/EmptyState'
import RiskBadge from '../components/common/RiskBadge'
import SyntheticBadge from '../components/common/SyntheticBadge'
import { CHART, ChartTooltip, axisProps, gridProps, legendProps, tooltipCursor } from '../components/common/ChartKit'
import { formatNumber, formatPct, rowLabel } from '../lib/format'
import { bandForCompositeIndex } from '../lib/riskBands'
import { useFilterStore } from '../store/filterStore'

const TH = 'eyebrow whitespace-nowrap px-4 py-3 text-left'
const TD = 'px-4 py-3.5 align-middle'

export default function SiteIntelligence() {
  const query = useSiteAnalytics()
  const setGlobalSite = useFilterStore((s) => s.setSite)
  const [selected, setSelected] = useState([])

  const rows = query.data || []
  const chartData = useMemo(
    () =>
      rows.map((s) => ({
        site: rowLabel(s, 'site'),
        composite_risk_index: s.composite_risk_index,
        critical_count: s.critical_count,
        high_count: s.high_count,
      })),
    [rows]
  )

  function toggleSite(site) {
    setSelected((prev) => (prev.includes(site) ? prev.filter((s) => s !== site) : prev.length < 5 ? [...prev, site] : prev))
  }

  const comparisonData = selected.length > 0 ? chartData.filter((d) => selected.includes(d.site)) : chartData.slice(0, 8)

  return (
    <div className="space-y-6">
      <section className="card bg-gradient-to-br from-surface to-surface-2/10">
        <div className="card-header flex-wrap">
          <div className="min-w-0">
            <h2 className="card-title text-fg font-bold flex items-center gap-2">
              <BarChart3 size={16} className="text-brand-500" />
              Site-vs-site comparison
            </h2>
            <p className="mt-0.5 text-xs text-fg-3">
              Select up to 5 sites in the table below to compare directly, or leave unselected to see the top 8 by
              composite risk.
            </p>
          </div>
          {selected.length > 0 && (
            <span className="chip shrink-0 tabular-nums border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-500/20 dark:bg-brand-500/10 dark:text-brand-300 font-bold">{selected.length} selected</span>
          )}
        </div>
        <div className="p-4 pr-5">
          <AsyncSection
            query={query}
            componentName="Site comparison chart"
            skeleton={<SkeletonChart height={320} />}
            isEmpty={(data) => !data || data.length === 0}
            empty={<EmptyState title="No site data" message="Site analytics populate once reports carry a site tag." />}
          >
            {() => (
              <>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={comparisonData} margin={{ top: 4, right: 0, left: -8, bottom: 0 }} barCategoryGap="22%">
                    <CartesianGrid {...gridProps} />
                    <XAxis
                      dataKey="site"
                      {...axisProps}
                      interval="preserveStartEnd"
                      angle={-20}
                      tickFormatter={(v) => (String(v).length > 26 ? `${String(v).slice(0, 25)}…` : v)}
                      textAnchor="end"
                      height={72}
                      tick={{ fontSize: 10, fill: CHART.tick, fontWeight: 500 }}
                    />
                    <YAxis yAxisId="count" {...axisProps} width={48} />
                    <YAxis
                      yAxisId="index"
                      orientation="right"
                      {...axisProps}
                      width={38}
                      domain={[0, 4]}
                      ticks={[0, 1, 2, 3, 4]}
                      tick={{ fontSize: 11, fill: CHART.brand }}
                    />
                    <Tooltip cursor={tooltipCursor} content={<ChartTooltip />} />
                    <Legend {...legendProps} />
                    <Bar yAxisId="index" dataKey="composite_risk_index" name="Composite Risk Index" fill={CHART.brand} radius={[5, 5, 0, 0]} maxBarSize={26} />
                    <Bar yAxisId="count" dataKey="critical_count" name="Critical Reports" fill={CHART.critical} radius={[5, 5, 0, 0]} maxBarSize={26} />
                    <Bar yAxisId="count" dataKey="high_count" name="High Reports" fill={CHART.high} radius={[5, 5, 0, 0]} maxBarSize={26} />
                  </BarChart>
                </ResponsiveContainer>
                <p className="mt-2 text-2xs text-fg-3">
                  Left axis: report counts · <span className="text-brand-400">right axis</span>: composite risk index
                  (1–4 band weight).
                </p>
              </>
            )}
          </AsyncSection>
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="card-header bg-gradient-to-r from-surface to-surface-2/10">
          <h2 className="card-title text-fg font-bold flex items-center gap-2">
            <SlidersHorizontal size={15} className="text-brand-500 animate-pulse-soft" />
            Composite risk ranking
          </h2>
          {selected.length > 0 && (
            <button type="button" onClick={() => setSelected([])} className="btn bg-brand-50 hover:bg-brand-100 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300 dark:hover:bg-brand-500/20 px-3 py-1.5 text-xs shadow-sm font-semibold rounded-lg transition-all duration-180">
              Clear selection ({selected.length})
            </button>
          )}
        </div>
        <AsyncSection
          query={query}
          componentName="Site ranking table"
          skeleton={<SkeletonTable rows={6} cols={6} />}
          isEmpty={(data) => !data || data.length === 0}
          empty={<div className="p-4"><EmptyState title="No sites yet" message="Nothing to rank until reports are analysed." /></div>}
        >
          {(sites) => (
            <div className="overflow-x-auto bg-surface">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead>
                  <tr className="border-b border-line bg-surface-2/40">
                    <th scope="col" className={`${TH} w-10 pr-0`}>
                      <span className="sr-only">Select</span>
                    </th>
                    <th scope="col" className={TH}>Site</th>
                    <th scope="col" className={TH}>Reports</th>
                    <th scope="col" className={TH}>Critical</th>
                    <th scope="col" className={TH}>High</th>
                    <th scope="col" className={TH}>Avg SIF Prob.</th>
                    <th scope="col" className={TH}>Composite Index</th>
                    <th scope="col" className={TH}>Band</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {sites.map((s) => {
                    const name = rowLabel(s, 'site')
                    const isSelected = selected.includes(name)
                    return (
                      <tr
                        key={name}
                        className={`transition-colors duration-180 ease-out-standard hover:bg-surface-2/50 ${
                          isSelected ? 'bg-brand-50/40 dark:bg-brand-500/5' : ''
                        }`}
                      >
                        <td className="py-3.5 pl-4 pr-0">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSite(name)}
                            aria-label={`Select ${name} for comparison`}
                            className="h-4.5 w-4.5 cursor-pointer rounded border-line-2 text-brand-500 accent-brand-600 focus:ring-brand-500"
                          />
                        </td>
                        <td className={TD}>
                          <div className="flex flex-wrap items-center gap-2">
                            <Link
                              to="/incidents"
                              onClick={() => setGlobalSite(name)}
                              className="group inline-flex items-center gap-1 font-bold text-fg hover:text-brand-600 transition-colors"
                            >
                              {name}
                              <ArrowUpRight
                                size={14}
                                aria-hidden="true"
                                className="text-fg-3 transition-colors duration-180 group-hover:text-brand-600 group-hover:translate-x-0.5"
                              />
                            </Link>
                            {s.is_synthetic_org_fields && <SyntheticBadge />}
                          </div>
                        </td>
                        <td className={`${TD} tabular-nums text-fg-2 font-semibold`}>{formatNumber(s.report_count)}</td>
                        <td className={`${TD} font-bold tabular-nums text-risk-critical`}>{formatNumber(s.critical_count)}</td>
                        <td className={`${TD} font-bold tabular-nums text-risk-high`}>{formatNumber(s.high_count)}</td>
                        <td className={`${TD} tabular-nums text-fg-2 font-semibold`}>{formatPct(s.avg_sif_probability)}</td>
                        <td className={`${TD} font-display font-extrabold tabular-nums text-fg text-sm`}>
                          {s.composite_risk_index?.toFixed(2)}
                        </td>
                        <td className={TD}>
                          <RiskBadge band={bandForCompositeIndex(s.composite_risk_index)} size="sm" />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </AsyncSection>
      </section>
    </div>
  )
}