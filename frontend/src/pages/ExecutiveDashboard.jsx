import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertOctagon, TrendingUp, Gauge, FileWarning, Sparkles, ArrowUpRight } from 'lucide-react'
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { useKpis, useForecast, useSiteAnalytics, useLsrAnalytics } from '../api/queries'
import AsyncSection from '../components/common/AsyncSection'
import { SkeletonCard, SkeletonChart, SkeletonTable } from '../components/common/Skeleton'
import EmptyState from '../components/common/EmptyState'
import KpiCard from '../components/common/KpiCard'
import RiskBadge from '../components/common/RiskBadge'
import SyntheticBadge from '../components/common/SyntheticBadge'
import {
  CHART,
  CHART_SERIES,
  ChartTooltip,
  axisProps,
  gridProps,
  lineTooltipCursor,
} from '../components/common/ChartKit'
import { formatNumber, formatPct, formatPercentValue, rowLabel } from '../lib/format'
import { bandForCompositeIndex } from '../lib/riskBands'
import { useFilterStore } from '../store/filterStore'

function buildSummary(kpis, sites) {
  if (!kpis || !sites || sites.length === 0) return null
  const topSite = sites[0]
  const siteName = rowLabel(topSite, 'site')
  const parts = [
    `${formatNumber(kpis.total_reports)} reports analysed.`,
    `${formatPercentValue(kpis.critical_pct)} are CRITICAL and ${formatPercentValue(kpis.high_or_above_pct)} are HIGH-or-above.`,
  ]
  if (topSite) {
    parts.push(
      `${siteName} is trending highest-risk (composite index ${topSite.composite_risk_index?.toFixed(2) ?? '—'}, ${formatNumber(
        topSite.critical_count
      )} critical reports) — start there.`
    )
  }
  return parts.join(' ')
}

const KPI_GRID = 'grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4'
const TH = 'eyebrow whitespace-nowrap px-4 py-2.5 text-left'
const TD = 'px-4 py-3.5 align-middle'

export default function ExecutiveDashboard() {
  const setSite = useFilterStore((s) => s.setSite)
  const kpisQuery = useKpis()
  const sitesQuery = useSiteAnalytics()
  const lsrQuery = useLsrAnalytics()

  const [category, setCategory] = useState(null)
  const forecastQuery = useForecast()

  const categories = useMemo(() => {
    const data = forecastQuery.data
    if (!data || data.history || data.forecast) return []
    return Object.keys(data)
  }, [forecastQuery.data])

  const defaultCategory = useMemo(() => {
    const data = forecastQuery.data
    if (!data || data.history || data.forecast) return null
    let best = null
    let bestVolume = -1
    for (const [name, series] of Object.entries(data)) {
      const volume = (series.history || []).reduce((sum, h) => sum + (h.count || 0), 0)
      if (volume > bestVolume) {
        bestVolume = volume
        best = name
      }
    }
    return best
  }, [forecastQuery.data])

  const activeCategory = category || defaultCategory
  const forecastSeries = useMemo(() => {
    const data = forecastQuery.data
    if (!data) return null
    const single = data.history || data.forecast ? data : activeCategory ? data[activeCategory] : null
    if (!single) return null
    const history = (single.history || []).map((h) => ({ date: h.date, count: h.count }))
    const forecast = (single.forecast || []).map((f) => ({
      date: f.date,
      expected: f.expected,
      range: [f.lower, f.upper],
    }))
    return { ...single, chartData: [...history, ...forecast] }
  }, [forecastQuery.data, activeCategory])

  return (
    <div className="space-y-6">
      {/* KPI strip */}
      <section aria-label="Key performance indicators">
        <AsyncSection
          query={kpisQuery}
          componentName="KPI strip"
          skeleton={
            <div className={KPI_GRID}>
              {Array.from({ length: 4 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          }
        >
          {(kpis) => (
            <div className={KPI_GRID}>
              <KpiCard
                label="Total Reports"
                value={formatNumber(kpis.total_reports)}
                sub="Scored by the SIF model"
                icon={FileWarning}
              />
              <KpiCard
                label="% Critical"
                value={formatPercentValue(kpis.critical_pct)}
                sub="Highest band — act first"
                icon={AlertOctagon}
                accent="text-risk-critical"
              />
              <KpiCard
                label="% High-or-above"
                value={formatPercentValue(kpis.high_or_above_pct)}
                sub="Carrying fatal potential"
                icon={TrendingUp}
                accent="text-risk-high"
              />
              <KpiCard
                label="Avg SIF Probability"
                value={formatPct(kpis.avg_sif_probability)}
                sub="Mean across the corpus"
                icon={Gauge}
              />
            </div>
          )}
        </AsyncSection>
      </section>

      {/* AI executive summary */}
      <section className="card-premium relative overflow-hidden border-brand-200 bg-gradient-to-br from-brand-50/50 via-surface to-surface p-5">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-brand-400/10 blur-3xl"
        />
        <div className="relative flex items-start gap-3.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-glow">
            <Sparkles size={17} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="eyebrow text-brand-700 dark:text-brand-300 font-bold">AI Safety Summary</p>
            {kpisQuery.data && sitesQuery.data ? (
              <p className="mt-1.5 max-w-3xl text-balance text-sm font-medium leading-relaxed text-fg-2">
                {buildSummary(kpisQuery.data, sitesQuery.data) || 'Not enough data to summarise yet.'}
              </p>
            ) : (
              <p className="mt-1.5 text-sm text-fg-3">Summarising current risk posture…</p>
            )}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Risk trend / forecast */}
        <section className="card flex flex-col xl:col-span-2 bg-gradient-to-br from-surface to-surface-2/10">
          <div className="card-header flex-wrap">
            <div className="min-w-0">
              <h2 className="card-title text-fg font-bold">Risk trend &amp; 7-day forecast</h2>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {forecastQuery.data?.is_synthetic_timeline && <SyntheticBadge label="Synthetic timeline" />}
              {categories.length > 1 && (
                <>
                  <label className="sr-only" htmlFor="forecast-category">
                    Forecast category
                  </label>
                  <select
                    id="forecast-category"
                    value={activeCategory || ''}
                    onChange={(e) => setCategory(e.target.value)}
                    className="h-8 rounded-lg border border-line bg-surface px-2.5 text-xs font-semibold text-fg-2 transition-all hover:bg-surface-2 focus:outline-none"
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </>
              )}
            </div>
          </div>
          <div className="flex-1 p-4 pr-5">
            <AsyncSection
              query={forecastQuery}
              componentName="Risk trend chart"
              skeleton={<SkeletonChart />}
              isEmpty={() => !forecastSeries || forecastSeries.chartData.length === 0}
              empty={
                <EmptyState
                  title="No forecast data yet"
                  message="The forecast populates once enough recent reports exist for a hazard category."
                />
              }
            >
              {() => (
                <>
                  <ResponsiveContainer width="100%" height={268}>
                    <ComposedChart data={forecastSeries.chartData} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
                      <defs>
                        <linearGradient id="forecastBand" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={CHART.brandSoft} stopOpacity={0.45} />
                          <stop offset="100%" stopColor={CHART.brandSoft} stopOpacity={0.05} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid {...gridProps} />
                      <XAxis dataKey="date" {...axisProps} minTickGap={28} />
                      <YAxis {...axisProps} allowDecimals={false} width={52} />
                      <Tooltip cursor={lineTooltipCursor} content={<ChartTooltip />} />
                      <Area
                        dataKey="range"
                        stroke="none"
                        fill="url(#forecastBand)"
                        name="Confidence range"
                        connectNulls
                      />
                      <Line
                        dataKey="count"
                        stroke={CHART.brandDeep}
                        strokeWidth={2.5}
                        dot={false}
                        activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }}
                        name="History"
                        connectNulls
                      />
                      <Line
                        dataKey="expected"
                        stroke={CHART.critical}
                        strokeWidth={2.5}
                        strokeDasharray="6 4"
                        dot={false}
                        activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }}
                        name="Forecast"
                        connectNulls
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                  <div className="mt-3.5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-3.5">
                    <span className="flex items-center gap-1.5 text-xs text-fg-2 font-medium">
                      <span aria-hidden="true" className="h-0.5 w-4 rounded-full bg-brand-700" />
                      History
                    </span>
                    <span className="flex items-center gap-1.5 text-xs text-fg-2 font-medium">
                      <span aria-hidden="true" className="h-0.5 w-4 rounded-full bg-risk-critical-solid" />
                      Forecast
                    </span>
                    <span className="flex items-center gap-1.5 text-xs text-fg-2 font-medium">
                      <span aria-hidden="true" className="h-2.5 w-4 rounded-md bg-brand-200/60 dark:bg-brand-500/20" />
                      Confidence range
                    </span>
                    {forecastSeries.direction && (
                      <p className="ml-auto text-xs text-fg-2 font-medium">
                        <span className="font-bold text-fg">{activeCategory}</span> is trending{' '}
                        <span
                          className={
                            forecastSeries.direction === 'up'
                              ? 'font-bold text-risk-critical'
                              : 'font-bold text-risk-low'
                          }
                        >
                          {forecastSeries.direction}
                        </span>{' '}
                        <span className="tabular-nums font-semibold">
                          ({formatPercentValue(forecastSeries.pct_change_vs_recent_mean)} vs mean)
                        </span>
                      </p>
                    )}
                  </div>
                </>
              )}
            </AsyncSection>
          </div>
        </section>

        {/* LSR donut */}
        <section className="card flex flex-col bg-gradient-to-br from-surface to-surface-2/10">
          <div className="card-header">
            <h2 className="card-title text-fg font-bold">Life Saving Rule violations</h2>
          </div>
          <div className="flex-1 p-4">
            <AsyncSection
              query={lsrQuery}
              componentName="LSR donut"
              skeleton={<SkeletonChart height={220} />}
              isEmpty={(data) => !data || data.length === 0}
              empty={<EmptyState title="No LSR data" message="Rule-level analytics will appear once reports are scored." />}
            >
              {(lsr) => {
                const top = [...lsr].sort((a, b) => b.count - a.count).slice(0, 6)
                const total = top.reduce((sum, r) => sum + (r.count || 0), 0)
                return (
                  <>
                    <div className="relative flex justify-center">
                      <ResponsiveContainer width="100%" height={208}>
                        <PieChart>
                          <Pie
                            data={top}
                            dataKey="count"
                            nameKey="rule"
                            innerRadius={58}
                            outerRadius={86}
                            paddingAngle={2.5}
                            stroke="rgb(var(--color-surface))"
                            strokeWidth={2}
                          >
                            {top.map((rule, i) => (
                              <Cell key={rule.rule} fill={CHART_SERIES[i % CHART_SERIES.length]} />
                            ))}
                          </Pie>
                          <Tooltip content={<ChartTooltip hideLabel />} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"
                      >
                        <span className="font-display text-2xl font-extrabold tabular-nums leading-none text-fg">
                          {formatNumber(total)}
                        </span>
                        <span className="eyebrow mt-1 text-[10px]">Top 6 rules</span>
                      </div>
                    </div>
                    <ul className="mt-3.5 space-y-1.5 border-t border-line pt-3.5">
                      {top.map((rule, i) => (
                        <li key={rule.rule} className="flex items-center justify-between gap-2 text-xs">
                          <span className="flex min-w-0 items-center gap-2">
                            <span
                              aria-hidden="true"
                              className="h-2 w-2 shrink-0 rounded-full shadow-[0_0_6px_0_currentColor]"
                              style={{ background: CHART_SERIES[i % CHART_SERIES.length], color: CHART_SERIES[i % CHART_SERIES.length] }}
                            />
                            <span className="truncate text-fg-2 font-medium">{rule.rule.replaceAll('_', ' ')}</span>
                          </span>
                          <span className="shrink-0 font-bold tabular-nums text-fg-2">
                            {formatNumber(rule.count)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </>
                )
              }}
            </AsyncSection>
          </div>
        </section>
      </div>

      {/* Site ranking */}
      <section className="card overflow-hidden">
        <div className="card-header bg-gradient-to-r from-surface to-surface-2/10">
          <div>
            <h2 className="card-title text-fg font-bold">Site risk ranking</h2>
            <p className="mt-0.5 text-xs text-fg-3">Mean band weight per report — click a site to apply filters.</p>
          </div>
        </div>
        <AsyncSection
          query={sitesQuery}
          componentName="Site ranking table"
          skeleton={<SkeletonTable rows={5} cols={6} />}
          isEmpty={(data) => !data || data.length === 0}
          empty={
            <div className="p-4">
              <EmptyState title="No site data" message="Site rankings populate once reports carry a site tag." />
            </div>
          }
        >
          {(sites) => (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-line bg-surface-2/40">
                    <th scope="col" className={TH}>Site</th>
                    <th scope="col" className={TH}>Reports</th>
                    <th scope="col" className={TH}>Critical</th>
                    <th scope="col" className={TH}>High</th>
                    <th scope="col" className={TH}>Avg SIF Prob.</th>
                    <th scope="col" className={TH}>Composite Index</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {sites.map((s) => {
                    const name = rowLabel(s, 'site')
                    const band = bandForCompositeIndex(s.composite_risk_index)
                    return (
                      <tr key={name} className="transition-colors duration-180 ease-out-standard hover:bg-surface-2/60">
                        <td className={TD}>
                          <div className="flex flex-wrap items-center gap-2">
                            <Link
                              to="/incidents"
                              onClick={() => setSite(name)}
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
                        <td className={`${TD} tabular-nums text-fg-2 font-medium`}>{formatNumber(s.report_count)}</td>
                        <td className={`${TD} font-bold tabular-nums text-risk-critical`}>
                          {formatNumber(s.critical_count)}
                        </td>
                        <td className={`${TD} font-bold tabular-nums text-risk-high`}>{formatNumber(s.high_count)}</td>
                        <td className={`${TD} tabular-nums text-fg-2 font-medium`}>{formatPct(s.avg_sif_probability)}</td>
                        <td className={TD}>
                          <div className="flex items-center gap-2.5">
                            <span className="font-display font-extrabold tabular-nums text-fg text-sm">
                              {s.composite_risk_index?.toFixed(2)}
                            </span>
                            <RiskBadge band={band} size="sm" />
                          </div>
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