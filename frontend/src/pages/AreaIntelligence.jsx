import { Link } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { ArrowUpRight, Building2, LayoutGrid } from 'lucide-react'
import { useAreaAnalytics } from '../api/queries'
import { useFilterStore } from '../store/filterStore'
import AsyncSection from '../components/common/AsyncSection'
import { SkeletonChart, SkeletonTable } from '../components/common/Skeleton'
import EmptyState from '../components/common/EmptyState'
import RiskBadge from '../components/common/RiskBadge'
import { CHART, ChartTooltip, axisProps, gridProps, legendProps, tooltipCursor } from '../components/common/ChartKit'
import { formatNumber, formatPct, rowLabel } from '../lib/format'
import { bandForCompositeIndex } from '../lib/riskBands'

const TH = 'eyebrow whitespace-nowrap px-4 py-3 text-left'
const TD = 'px-4 py-3.5 align-middle'

export default function AreaIntelligence() {
  const query = useAreaAnalytics()
  const setArea = useFilterStore((s) => s.setArea)

  return (
    <div className="space-y-6">
      <section className="card bg-gradient-to-br from-surface to-surface-2/10">
        <div className="card-header">
          <div className="min-w-0">
            <h2 className="card-title text-fg font-bold flex items-center gap-2">
              <Building2 size={16} className="text-brand-500" />
              Area risk comparison
            </h2>
            <p className="mt-0.5 text-xs text-fg-3">
              RIG · REFINERY · PIPELINE · WAREHOUSE · WORKSHOP — composite index against critical and high volumes.
            </p>
          </div>
        </div>
        <div className="p-4 pr-5">
          <AsyncSection
            query={query}
            componentName="Area comparison chart"
            skeleton={<SkeletonChart height={320} />}
            isEmpty={(data) => !data || data.length === 0}
            empty={<EmptyState title="No area data" message="Area analytics populate once reports carry an area tag." />}
          >
            {(areas) => (
              <>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart
                    data={areas.map((a) => ({ ...a, area: rowLabel(a, 'area') }))}
                    margin={{ top: 4, right: 0, left: 0, bottom: 0 }}
                    barCategoryGap="26%"
                  >
                    <CartesianGrid {...gridProps} />
                    <XAxis dataKey="area" {...axisProps} tick={{ fontSize: 11, fill: CHART.tick, fontWeight: 500 }} />
                    <YAxis yAxisId="count" {...axisProps} width={56} />
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
                    <Bar yAxisId="index" dataKey="composite_risk_index" name="Composite Risk Index" fill={CHART.brand} radius={[5, 5, 0, 0]} maxBarSize={34} />
                    <Bar yAxisId="count" dataKey="critical_count" name="Critical" fill={CHART.critical} radius={[5, 5, 0, 0]} maxBarSize={34} />
                    <Bar yAxisId="count" dataKey="high_count" name="High" fill={CHART.high} radius={[5, 5, 0, 0]} maxBarSize={34} />
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
            <LayoutGrid size={15} className="text-brand-500 animate-pulse-soft" />
            Area detail
          </h2>
        </div>
        <AsyncSection
          query={query}
          componentName="Area detail table"
          skeleton={<SkeletonTable rows={5} cols={6} />}
          isEmpty={(data) => !data || data.length === 0}
          empty={<div className="p-4"><EmptyState title="No areas yet" message="Nothing to compare until reports are analysed." /></div>}
        >
          {(areas) => (
            <div className="overflow-x-auto bg-surface">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-line bg-surface-2/40">
                    <th scope="col" className={TH}>Area</th>
                    <th scope="col" className={TH}>Reports</th>
                    <th scope="col" className={TH}>Critical</th>
                    <th scope="col" className={TH}>High</th>
                    <th scope="col" className={TH}>Avg SIF Prob.</th>
                    <th scope="col" className={TH}>Band</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {areas.map((a) => {
                    const name = rowLabel(a, 'area')
                    return (
                      <tr key={name} className="transition-colors duration-180 ease-out-standard hover:bg-surface-2/50">
                        <td className={TD}>
                          <Link
                            to="/incidents"
                            onClick={() => setArea(name)}
                            className="group inline-flex items-center gap-1 font-bold text-fg hover:text-brand-600 transition-colors"
                          >
                            {name}
                            <ArrowUpRight
                              size={14}
                              aria-hidden="true"
                              className="text-fg-3 transition-colors duration-180 group-hover:text-brand-600 group-hover:translate-x-0.5"
                            />
                          </Link>
                        </td>
                        <td className={`${TD} tabular-nums text-fg-2 font-semibold`}>{formatNumber(a.report_count)}</td>
                        <td className={`${TD} font-bold tabular-nums text-risk-critical`}>{formatNumber(a.critical_count)}</td>
                        <td className={`${TD} font-bold tabular-nums text-risk-high`}>{formatNumber(a.high_count)}</td>
                        <td className={`${TD} tabular-nums text-fg-2 font-semibold`}>{formatPct(a.avg_sif_probability)}</td>
                        <td className={TD}>
                          <RiskBadge band={bandForCompositeIndex(a.composite_risk_index)} size="sm" />
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