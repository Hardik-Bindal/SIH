import { Link } from 'react-router-dom'
import {
  ArrowUpRight, Trophy, Landmark, BarChart3, AlertTriangle,
  ShieldCheck, TrendingUp, Activity,
} from 'lucide-react'
import {
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ComposedChart, Area, Line,
} from 'recharts'
import {
  useKpis, useActivityAnalytics, useDepartmentAnalytics,
  useLsrAnalytics, useSiteAnalytics, useForecast,
} from '../api/queries'
import { useFilterStore } from '../store/filterStore'
import AsyncSection from '../components/common/AsyncSection'
import { SkeletonBlock, SkeletonTable, SkeletonCard } from '../components/common/Skeleton'
import EmptyState from '../components/common/EmptyState'
import RiskBadge from '../components/common/RiskBadge'
import KpiCard from '../components/common/KpiCard'
import {
  CHART, CHART_SERIES, ChartTooltip, axisProps, gridProps,
} from '../components/common/ChartKit'
import { formatNumber, formatPct, rowLabel } from '../lib/format'
import { bandForCompositeIndex, RISK_BAND_STYLES } from '../lib/riskBands'

/* ── Reusable rank table (unchanged from original) ─────────────────────── */

function RankTable({ title, description, query, labelKey, onDrillThrough, icon: Icon }) {
  return (
    <section className="card overflow-hidden bg-gradient-to-br from-surface to-surface-2/10">
      <div className="card-header bg-gradient-to-r from-surface to-surface-2/10">
        <div className="min-w-0">
          <h2 className="card-title text-fg font-bold flex items-center gap-2">
            {Icon && <Icon size={15} className="text-brand-500 animate-pulse-soft" />}
            {title}
          </h2>
          {description && <p className="mt-0.5 text-xs text-fg-3">{description}</p>}
        </div>
      </div>
      <AsyncSection
        query={query}
        componentName={title}
        skeleton={<SkeletonTable rows={6} cols={3} />}
        isEmpty={(data) => !data || data.length === 0}
        empty={
          <div className="p-4">
            <EmptyState title="No data yet" message="This leaderboard populates once matching reports exist." />
          </div>
        }
      >
        {(rows) => (
          <ol className="divide-y divide-line">
            {[...rows]
              .sort((a, b) => b.composite_risk_index - a.composite_risk_index)
              .slice(0, 10)
              .map((row, i) => {
                const name = rowLabel(row, labelKey)
                const band = bandForCompositeIndex(row.composite_risk_index)
                return (
                  <li
                    key={name}
                    className="flex items-center gap-3 px-4 py-3 text-sm transition-colors duration-180 ease-out-standard hover:bg-surface-2/50"
                  >
                    <span
                      aria-hidden="true"
                      className="grid h-6 w-6 shrink-0 place-items-center rounded bg-surface-2 font-mono text-2xs font-extrabold tabular-nums text-fg-2"
                    >
                      {i + 1}
                    </span>
                    {onDrillThrough ? (
                      <Link
                        to="/incidents"
                        onClick={() => onDrillThrough(name)}
                        className="group inline-flex min-w-0 items-center gap-1 truncate font-bold text-fg hover:text-brand-600 transition-colors"
                      >
                        <span className="truncate">{name}</span>
                        <ArrowUpRight
                          size={14}
                          aria-hidden="true"
                          className="shrink-0 text-fg-3 transition-colors duration-180 group-hover:text-brand-600 group-hover:translate-x-0.5"
                        />
                      </Link>
                    ) : (
                      <span className="min-w-0 truncate font-bold text-fg">{name}</span>
                    )}
                    <div className="ml-auto flex shrink-0 items-center gap-3 text-xs text-fg-3">
                      <span className="hidden tabular-nums sm:inline font-semibold">
                        {formatNumber(row.report_count)} report{row.report_count === 1 ? '' : 's'}
                      </span>
                      <span className="tabular-nums font-semibold">{formatPct(row.avg_sif_probability)} avg</span>
                      <RiskBadge band={band} size="sm" />
                    </div>
                  </li>
                )
              })}
          </ol>
        )}
      </AsyncSection>
    </section>
  )
}

/* ── Risk distribution pie chart ────────────────────────────────────────── */

const RISK_COLORS = {
  CRITICAL: CHART_SERIES.critical || '#ef4444',
  HIGH: CHART_SERIES.high || '#f97316',
  MEDIUM: CHART_SERIES.medium || '#eab308',
  LOW: CHART_SERIES.low || '#22c55e',
}

function RiskDistributionPie({ kpis }) {
  if (!kpis) return null
  const data = [
    { name: 'Critical', value: kpis.critical_count || 0, color: RISK_COLORS.CRITICAL },
    { name: 'High', value: kpis.high_count || 0, color: RISK_COLORS.HIGH },
    { name: 'Medium', value: kpis.medium_count || 0, color: RISK_COLORS.MEDIUM },
    { name: 'Low', value: kpis.low_count || 0, color: RISK_COLORS.LOW },
  ].filter(d => d.value > 0)
  if (data.length === 0) return null

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={data}
          cx="50%" cy="50%"
          innerRadius={55} outerRadius={85}
          paddingAngle={3}
          dataKey="value"
          strokeWidth={0}
        >
          {data.map((d) => <Cell key={d.name} fill={d.color} />)}
        </Pie>
        <Tooltip
          content={({ payload }) => {
            if (!payload?.[0]) return null
            const d = payload[0].payload
            return (
              <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-lg">
                <span className="font-bold" style={{ color: d.color }}>{d.name}</span>
                <span className="ml-2 text-fg-2">{formatNumber(d.value)} incidents</span>
              </div>
            )
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}

/* ── LSR bar chart ──────────────────────────────────────────────────────── */

function LsrBarChart({ query }) {
  return (
    <AsyncSection
      query={query}
      componentName="LSR chart"
      skeleton={<SkeletonBlock className="h-[220px] w-full" />}
      isEmpty={(d) => !d || d.length === 0}
      empty={<EmptyState title="No LSR data" message="LSR analytics populate after reports are analysed." />}
    >
      {(rows) => {
        const data = [...rows]
          .sort((a, b) => b.trigger_count - a.trigger_count)
          .slice(0, 8)
          .map(r => ({
            name: (r.rule || r.lsr_rule || '').replace(/_/g, ' ').slice(0, 22),
            count: r.trigger_count || r.count || 0,
          }))

        return (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data} layout="vertical" margin={{ left: 4, right: 16, top: 4, bottom: 4 }}>
              <CartesianGrid {...gridProps} horizontal={false} />
              <XAxis type="number" {...axisProps} />
              <YAxis type="category" dataKey="name" width={120} {...axisProps} tick={{ fontSize: 10 }} />
              <Tooltip
                content={({ payload }) => {
                  if (!payload?.[0]) return null
                  return (
                    <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-lg">
                      <span className="font-bold text-fg">{payload[0].payload.name}</span>
                      <span className="ml-2 text-fg-2">{payload[0].value} triggers</span>
                    </div>
                  )
                }}
              />
              <Bar dataKey="count" fill={CHART.brand} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )
      }}
    </AsyncSection>
  )
}

/* ── Main page ──────────────────────────────────────────────────────────── */

export default function HazardAnalytics() {
  const kpisQuery = useKpis()
  const activityQuery = useActivityAnalytics()
  const departmentQuery = useDepartmentAnalytics()
  const lsrQuery = useLsrAnalytics()
  const siteQuery = useSiteAnalytics()
  const forecastQuery = useForecast()
  const setDepartment = useFilterStore((s) => s.setDepartment)

  const kpis = kpisQuery.data

  return (
    <div className="space-y-6">
      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <AsyncSection query={kpisQuery} componentName="KPIs" skeleton={<><SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard /></>}>
          {(kpis) => (
            <>
              <KpiCard
                label="Total Incidents"
                value={formatNumber(kpis.total_reports)}
                icon={BarChart3}
                trend={null}
              />
              <KpiCard
                label="Critical Risk"
                value={formatNumber(kpis.critical_count || 0)}
                icon={AlertTriangle}
                className="ring-1 ring-risk-critical-border/30"
              />
              <KpiCard
                label="High or Above"
                value={formatPct(kpis.high_or_above_pct)}
                icon={Activity}
                className="ring-1 ring-risk-high-border/30"
              />
              <KpiCard
                label="Barrier Failures"
                value={formatNumber(kpis.barrier_failure_count || 0)}
                icon={ShieldCheck}
              />
            </>
          )}
        </AsyncSection>
      </div>

      {/* Risk Distribution + LSR Frequency */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="card overflow-hidden bg-gradient-to-br from-surface to-surface-2/10">
          <div className="card-header">
            <h2 className="card-title text-fg font-bold flex items-center gap-2">
              <AlertTriangle size={15} className="text-brand-500" />
              Risk Distribution
            </h2>
            <p className="text-xs text-fg-3">Incidents by risk band</p>
          </div>
          <div className="p-4">
            <AsyncSection
              query={kpisQuery}
              componentName="Risk pie"
              skeleton={<SkeletonBlock className="h-[220px] w-full" />}
              isEmpty={(d) => !d}
              empty={<EmptyState title="No data" />}
            >
              {(data) => (
                <>
                  <RiskDistributionPie kpis={data} />
                  <div className="mt-2 flex flex-wrap justify-center gap-4">
                    {Object.entries(RISK_COLORS).map(([band, color]) => (
                      <span key={band} className="flex items-center gap-1.5 text-xs text-fg-2 font-medium">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
                        {band}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </AsyncSection>
          </div>
        </section>

        <section className="card overflow-hidden bg-gradient-to-br from-surface to-surface-2/10">
          <div className="card-header">
            <h2 className="card-title text-fg font-bold flex items-center gap-2">
              <ShieldCheck size={15} className="text-brand-500" />
              Life Saving Rule Violations
            </h2>
            <p className="text-xs text-fg-3">Top triggered rules across all incidents</p>
          </div>
          <div className="p-4">
            <LsrBarChart query={lsrQuery} />
          </div>
        </section>
      </div>

      {/* Forecast Trend */}
      <section className="card overflow-hidden bg-gradient-to-br from-surface to-surface-2/10">
        <div className="card-header">
          <h2 className="card-title text-fg font-bold flex items-center gap-2">
            <TrendingUp size={15} className="text-brand-500" />
            Risk Forecast Trend
          </h2>
          <p className="text-xs text-fg-3">Historical and projected incident volume</p>
        </div>
        <div className="p-4">
          <AsyncSection
            query={forecastQuery}
            componentName="Forecast"
            skeleton={<SkeletonBlock className="h-[260px] w-full" />}
            isEmpty={(d) => !d?.history || d.history.length === 0}
            empty={<EmptyState title="No forecast data" message="Forecast requires sufficient historical data." />}
          >
            {(data) => {
              const combined = [
                ...(data.history || []).map(h => ({ ...h, type: 'history' })),
                ...(data.forecast || []).map(f => ({ ...f, type: 'forecast' })),
              ]
              return (
                <ResponsiveContainer width="100%" height={260}>
                  <ComposedChart data={combined} margin={{ left: 0, right: 16, top: 8, bottom: 4 }}>
                    <CartesianGrid {...gridProps} />
                    <XAxis dataKey="period" {...axisProps} />
                    <YAxis {...axisProps} />
                    <Tooltip content={<ChartTooltip />} />
                    <Area
                      dataKey="count"
                      fill={CHART.brand + '20'}
                      stroke={CHART.brand}
                      strokeWidth={2}
                      dot={false}
                      name="Incidents"
                    />
                    <Line
                      dataKey="forecast_count"
                      stroke={CHART_SERIES.critical || '#ef4444'}
                      strokeWidth={2}
                      strokeDasharray="6 3"
                      dot={false}
                      name="Forecast"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              )
            }}
          </AsyncSection>
        </div>
      </section>

      {/* Activity + Department Leaderboards */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <RankTable
          title="Activity risk leaderboard"
          description="Highest composite risk index by work activity."
          query={activityQuery}
          labelKey="activity"
          icon={Trophy}
        />
        <RankTable
          title="Department risk leaderboard"
          description="Open a department to filter the incident explorer."
          query={departmentQuery}
          labelKey="department"
          onDrillThrough={setDepartment}
          icon={Landmark}
        />
      </div>

      {/* Site Risk Table */}
      <section className="card overflow-hidden bg-gradient-to-br from-surface to-surface-2/10">
        <div className="card-header">
          <h2 className="card-title text-fg font-bold flex items-center gap-2">
            <BarChart3 size={15} className="text-brand-500" />
            Site Risk Comparison
          </h2>
          <p className="text-xs text-fg-3">Composite risk index by operational site · <span className="text-brand-400 font-semibold">Demo data</span></p>
        </div>
        <AsyncSection
          query={siteQuery}
          componentName="Site risk"
          skeleton={<SkeletonTable rows={6} cols={4} />}
          isEmpty={(d) => !d || d.length === 0}
          empty={<EmptyState title="No site data" />}
        >
          {(rows) => (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line bg-surface-2/30">
                    <th className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-fg-3">Site</th>
                    <th className="px-4 py-2.5 text-right text-xs font-bold uppercase tracking-wider text-fg-3">Reports</th>
                    <th className="px-4 py-2.5 text-right text-xs font-bold uppercase tracking-wider text-fg-3">Critical</th>
                    <th className="px-4 py-2.5 text-right text-xs font-bold uppercase tracking-wider text-fg-3">Avg SIF</th>
                    <th className="px-4 py-2.5 text-right text-xs font-bold uppercase tracking-wider text-fg-3">Risk</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {[...rows]
                    .sort((a, b) => b.composite_risk_index - a.composite_risk_index)
                    .slice(0, 10)
                    .map((row) => {
                      const name = rowLabel(row, 'site')
                      const band = bandForCompositeIndex(row.composite_risk_index)
                      return (
                        <tr key={name} className="transition-colors hover:bg-surface-2/40">
                          <td className="px-4 py-3 font-bold text-fg">{name}</td>
                          <td className="px-4 py-3 text-right tabular-nums text-fg-2">{formatNumber(row.report_count)}</td>
                          <td className="px-4 py-3 text-right tabular-nums text-fg-2">{formatNumber(row.critical_count)}</td>
                          <td className="px-4 py-3 text-right tabular-nums text-fg-2">{formatPct(row.avg_sif_probability)}</td>
                          <td className="px-4 py-3 text-right"><RiskBadge band={band} size="sm" /></td>
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