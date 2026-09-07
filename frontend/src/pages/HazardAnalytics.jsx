import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  MapContainer, TileLayer, CircleMarker, Popup, useMap,
} from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import {
  ArrowUpRight, Trophy, Landmark, BarChart3, AlertTriangle,
  ShieldCheck, TrendingUp, Activity, MapPin, ZoomIn, ZoomOut,
  Maximize2, Radio,
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
import { formatNumber, formatPct, formatPercentValue, rowLabel } from '../lib/format'
import { bandForCompositeIndex, RISK_BAND_STYLES } from '../lib/riskBands'

/* ── Deterministic demo coordinates (Duliajan, Assam — OIL operating area) ── */
/* Matches backend/app/store.py SITE_COORDS exactly */
const SITE_COORDS = {
  'Rig-07 Duliajan': [27.38, 95.34],
  'Rig-12 Moran': [27.28, 95.40],
  'Rig-03 Kumchai': [27.20, 95.55],
  'Refinery Block A': [27.45, 95.30],
  'Refinery Block B': [27.47, 95.33],
  'Pipeline Sector 4': [27.30, 95.60],
  'Pipeline Sector 9': [27.15, 95.20],
  'Central Warehouse': [27.40, 95.25],
  'Field Workshop Duliajan': [27.36, 95.36],
}
const MAP_CENTER = [27.32, 95.38]
const MAP_ZOOM = 12

/* ── Risk color constants ─────────────────────────────────────────────── */
const RISK_COLORS = {
  CRITICAL: '#ef4444',
  HIGH: '#f97316',
  MEDIUM: '#eab308',
  LOW: '#22c55e',
}

const RISK_GLOW = {
  CRITICAL: 'rgba(239,68,68,0.55)',
  HIGH: 'rgba(249,115,22,0.35)',
  MEDIUM: 'rgba(234,179,8,0.25)',
  LOW: 'rgba(34,197,94,0.2)',
}

const RISK_RADIUS = {
  CRITICAL: 22,
  HIGH: 17,
  MEDIUM: 13,
  LOW: 10,
}

/* ── Map controls component ───────────────────────────────────────────── */
function MapControls() {
  const map = useMap()
  return (
    <div className="absolute top-3 right-3 z-[1000] flex flex-col gap-1.5">
      <button
        type="button"
        onClick={() => map.zoomIn()}
        className="grid h-8 w-8 place-items-center rounded-lg border border-line bg-surface/90 text-fg-2 backdrop-blur-sm transition-colors hover:bg-surface-2 hover:text-fg"
        title="Zoom in"
      >
        <ZoomIn size={14} />
      </button>
      <button
        type="button"
        onClick={() => map.zoomOut()}
        className="grid h-8 w-8 place-items-center rounded-lg border border-line bg-surface/90 text-fg-2 backdrop-blur-sm transition-colors hover:bg-surface-2 hover:text-fg"
        title="Zoom out"
      >
        <ZoomOut size={14} />
      </button>
      <button
        type="button"
        onClick={() => map.setView(MAP_CENTER, MAP_ZOOM, { animate: true })}
        className="grid h-8 w-8 place-items-center rounded-lg border border-line bg-surface/90 text-fg-2 backdrop-blur-sm transition-colors hover:bg-surface-2 hover:text-fg"
        title="Reset view"
      >
        <Maximize2 size={14} />
      </button>
    </div>
  )
}

/* ── Geographic Risk Map ──────────────────────────────────────────────── */
function GeographicRiskMap({ siteData, highlightedSite, onSiteClick }) {
  const sites = useMemo(() => {
    if (!siteData) return []
    return siteData
      .filter((s) => SITE_COORDS[s.site])
      .map((s) => {
        const band = bandForCompositeIndex(s.composite_risk_index)
        return {
          ...s,
          coords: SITE_COORDS[s.site],
          band,
          color: RISK_COLORS[band],
          glow: RISK_GLOW[band],
          radius: RISK_RADIUS[band],
        }
      })
      .sort((a, b) => {
        // Render CRITICAL last so they appear on top
        const order = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 }
        return (order[a.band] || 0) - (order[b.band] || 0)
      })
  }, [siteData])

  return (
    <div className="relative h-full w-full" style={{ minHeight: 460 }}>
      <MapContainer
        center={MAP_CENTER}
        zoom={MAP_ZOOM}
        scrollWheelZoom
        zoomControl={false}
        className="h-full w-full rounded-xl"
        style={{ minHeight: 460, background: '#0a0f1a' }}
      >
        {/* Base dark tile — CartoDB Dark Matter with full labels (cities, towns, roads) */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          subdomains="abcd"
          maxZoom={19}
        />
        <MapControls />
        {sites.map((site) => (
          <CircleMarker
            key={site.site}
            center={site.coords}
            radius={highlightedSite === site.site ? site.radius + 4 : site.radius}
            pathOptions={{
              color: site.color,
              fillColor: site.color,
              fillOpacity: highlightedSite === site.site ? 0.6 : 0.35,
              weight: highlightedSite === site.site ? 3 : 2,
              className: site.band === 'CRITICAL' ? 'animate-pulse-soft' : '',
            }}
            eventHandlers={{
              click: () => onSiteClick?.(site.site),
            }}
          >
            <Popup>
              <div className="min-w-[180px] space-y-2 p-1">
                <div className="flex items-center gap-2">
                  <MapPin size={13} style={{ color: site.color }} />
                  <span className="font-display text-sm font-bold">{site.site}</span>
                </div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-fg-3">Risk Level</span>
                    <span
                      className="rounded-full px-2 py-0.5 text-2xs font-bold uppercase"
                      style={{
                        background: site.color + '22',
                        color: site.color,
                      }}
                    >
                      {site.band}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-fg-3">Total Reports</span>
                    <span className="font-bold tabular-nums">{formatNumber(site.report_count)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-fg-3">Critical</span>
                    <span className="font-bold tabular-nums" style={{ color: RISK_COLORS.CRITICAL }}>
                      {formatNumber(site.critical_count)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-fg-3">High</span>
                    <span className="font-bold tabular-nums" style={{ color: RISK_COLORS.HIGH }}>
                      {formatNumber(site.high_count)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-fg-3">Avg SIF</span>
                    <span className="font-bold tabular-nums">{formatPct(site.avg_sif_probability)}</span>
                  </div>
                </div>
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>

      {/* Stats badge */}
      <div className="absolute bottom-3 left-3 z-[1000] flex items-center gap-2 rounded-lg border border-line bg-surface/90 px-3 py-1.5 text-2xs font-semibold text-fg-3 backdrop-blur-sm">
        <MapPin size={11} />
        <span>{sites.length} monitored sites</span>
        <span className="text-line-2">·</span>
        <span className="text-risk-critical" style={{ color: RISK_COLORS.CRITICAL }}>
          {sites.filter((s) => s.band === 'CRITICAL').length} critical
        </span>
      </div>
    </div>
  )
}

/* ── Map Legend Sidebar ───────────────────────────────────────────────── */
function MapLegend({ siteData }) {
  const bandCounts = useMemo(() => {
    if (!siteData) return {}
    const counts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 }
    siteData.forEach((s) => {
      const band = bandForCompositeIndex(s.composite_risk_index)
      counts[band] = (counts[band] || 0) + 1
    })
    return counts
  }, [siteData])

  const legendItems = [
    { band: 'CRITICAL', label: 'Critical', color: RISK_COLORS.CRITICAL, desc: 'Immediate attention required' },
    { band: 'HIGH', label: 'High', color: RISK_COLORS.HIGH, desc: 'Elevated risk level' },
    { band: 'MEDIUM', label: 'Medium', color: RISK_COLORS.MEDIUM, desc: 'Moderate risk observed' },
    { band: 'LOW', label: 'Low', color: RISK_COLORS.LOW, desc: 'Within acceptable limits' },
  ]

  return (
    <div className="space-y-4">
      {/* Risk Legend */}
      <div>
        <h3 className="eyebrow mb-3 text-fg-3">Risk Intensity</h3>
        <div className="space-y-2.5">
          {legendItems.map((item) => (
            <div key={item.band} className="flex items-center gap-2.5">
              <span
                className="h-3.5 w-3.5 shrink-0 rounded-full ring-2"
                style={{
                  background: item.color,
                  boxShadow: `0 0 10px ${item.color}55`,
                  ringColor: item.color + '40',
                }}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs font-bold text-fg">{item.label}</span>
                  <span className="text-2xs font-semibold tabular-nums text-fg-3">
                    {bandCounts[item.band] || 0} site{(bandCounts[item.band] || 0) !== 1 ? 's' : ''}
                  </span>
                </div>
                <p className="text-2xs text-fg-3/70">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Gradient Bar */}
      <div>
        <h3 className="eyebrow mb-2 text-fg-3">Risk Gradient</h3>
        <div
          className="h-2.5 w-full rounded-full"
          style={{
            background: `linear-gradient(to right, ${RISK_COLORS.LOW}, ${RISK_COLORS.MEDIUM}, ${RISK_COLORS.HIGH}, ${RISK_COLORS.CRITICAL})`,
          }}
        />
        <div className="mt-1 flex justify-between text-2xs text-fg-3">
          <span>Low</span>
          <span>Critical</span>
        </div>
      </div>

      {/* Data source note */}
      <div className="rounded-lg border border-line/50 bg-surface-2/30 px-3 py-2">
        <p className="text-2xs text-fg-3 leading-relaxed">
          <span className="font-bold text-brand-400">Demo data</span> — Coordinates represent
          OIL India operational sites in the Duliajan–Moran field area (Assam). Risk values
          are derived from the AI-scored incident corpus.
        </p>
      </div>
    </div>
  )
}

/* ── Reusable rank table ──────────────────────────────────────────────── */

function RankTable({
  title, description, query, labelKey, onDrillThrough, icon: Icon, limit = 10, dense = false,
}) {
  return (
    <section className="card overflow-hidden bg-gradient-to-br from-surface to-surface-2/10">
      <div className="card-header bg-gradient-to-r from-surface to-surface-2/10">
        <div className="min-w-0">
          <h2 className="card-title text-fg font-bold flex items-center gap-2">
            {Icon && <Icon size={15} className="text-brand-500" />}
            {title}
          </h2>
          {description && <p className="mt-0.5 text-xs text-fg-3">{description}</p>}
        </div>
      </div>
      <AsyncSection
        query={query}
        componentName={title}
        skeleton={<SkeletonTable rows={dense ? 5 : 6} cols={3} />}
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
              .slice(0, limit)
              .map((row, i) => {
                const name = rowLabel(row, labelKey)
                const band = bandForCompositeIndex(row.composite_risk_index)
                return (
                  <li
                    key={name}
                    className={`flex items-center gap-3 ${dense ? 'px-4 py-2.5' : 'px-4 py-3'} text-sm transition-colors duration-180 ease-out-standard hover:bg-surface-2/50`}
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
                      {!dense && (
                        <span className="hidden tabular-nums sm:inline font-semibold">
                          {formatNumber(row.report_count)} report{row.report_count === 1 ? '' : 's'}
                        </span>
                      )}
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

/* ── Risk distribution donut chart ────────────────────────────────────── */

function RiskDistributionDonut({ kpis, compact = false }) {
  if (!kpis?.risk_band_distribution) return null
  const dist = kpis.risk_band_distribution
  const data = [
    { name: 'Critical', value: dist.CRITICAL || 0, color: RISK_COLORS.CRITICAL },
    { name: 'High', value: dist.HIGH || 0, color: RISK_COLORS.HIGH },
    { name: 'Medium', value: dist.MEDIUM || 0, color: RISK_COLORS.MEDIUM },
    { name: 'Low', value: dist.LOW || 0, color: RISK_COLORS.LOW },
  ].filter((d) => d.value > 0)
  if (data.length === 0) return null
  const total = data.reduce((s, d) => s + d.value, 0)
  const size = compact ? 160 : 200
  const inner = compact ? 46 : 60
  const outer = compact ? 72 : 90

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <ResponsiveContainer width={size} height={size}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={inner}
              outerRadius={outer}
              paddingAngle={3}
              dataKey="value"
              strokeWidth={0}
            >
              {data.map((d) => (
                <Cell key={d.name} fill={d.color} />
              ))}
            </Pie>
            <Tooltip
              content={({ payload }) => {
                if (!payload?.[0]) return null
                const d = payload[0].payload
                const pct = ((d.value / total) * 100).toFixed(1)
                return (
                  <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-lg">
                    <span className="font-bold" style={{ color: d.color }}>
                      {d.name}
                    </span>
                    <span className="ml-2 text-fg-2">
                      {formatNumber(d.value)} ({pct}%)
                    </span>
                  </div>
                )
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className={`font-display font-bold tabular-nums text-fg ${compact ? 'text-xl' : 'text-2xl'}`}>
            {formatNumber(total)}
          </span>
          <span className="text-2xs font-semibold text-fg-3 uppercase tracking-wider">Total</span>
        </div>
      </div>
      {/* Legend row */}
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-2">
        {data.map((d) => {
          const pct = ((d.value / total) * 100).toFixed(1)
          return (
            <div key={d.name} className="flex items-center gap-1.5 text-xs">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />
              <span className="font-semibold text-fg-2">{d.name}</span>
              <span className="tabular-nums text-fg-3">
                {formatNumber(d.value)} ({pct}%)
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ── LSR bar chart ─────────────────────────────────────────────────────── */

function LsrBarChart({ query, limit = 8, height = 280, yAxisWidth = 160 }) {
  return (
    <AsyncSection
      query={query}
      componentName="LSR chart"
      skeleton={<SkeletonBlock className={height <= 240 ? 'h-[220px] w-full' : 'h-[280px] w-full'} />}
      isEmpty={(d) => !d || d.length === 0}
      empty={<EmptyState title="No LSR data" message="LSR analytics populate after reports are analysed." />}
    >
      {(rows) => {
        const data = [...rows]
          .sort((a, b) => (b.trigger_count || b.count || 0) - (a.trigger_count || a.count || 0))
          .slice(0, limit)
          .map((r) => ({
            name: (r.rule || r.lsr_rule || '').replace(/_/g, ' '),
            shortName: (r.rule || r.lsr_rule || '').replace(/_/g, ' ').slice(0, yAxisWidth < 140 ? 20 : 28),
            count: r.trigger_count || r.count || 0,
          }))

        return (
          <ResponsiveContainer width="100%" height={height}>
            <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
              <CartesianGrid {...gridProps} horizontal={false} />
              <XAxis type="number" {...axisProps} />
              <YAxis type="category" dataKey="shortName" width={yAxisWidth} {...axisProps} tick={{ fontSize: 10 }} />
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

/* ── Main page ─────────────────────────────────────────────────────────── */

export default function HazardAnalytics() {
  const kpisQuery = useKpis()
  const activityQuery = useActivityAnalytics()
  const departmentQuery = useDepartmentAnalytics()
  const lsrQuery = useLsrAnalytics()
  const siteQuery = useSiteAnalytics()
  const forecastQuery = useForecast()
  const setDepartment = useFilterStore((s) => s.setDepartment)
  const [highlightedSite, setHighlightedSite] = useState(null)

  return (
    <div className="space-y-5">
      {/* ── 1. KPI Summary Strip ───────────────────────────────────────── */}
      {/* The grid lives INSIDE AsyncSection's render prop (and inside its
          skeleton), not on a wrapper around AsyncSection — AsyncSection
          renders its own container div, so a grid placed outside it only
          ever gets ONE grid item (that container) and everything inside
          collapses to a single stacked column instead of 4 across. */}
      <AsyncSection
        query={kpisQuery}
        componentName="KPIs"
        skeleton={
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        }
      >
        {(kpis) => (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Total Incidents"
              value={formatNumber(kpis.total_reports)}
              icon={BarChart3}
              sub={`${formatPercentValue(kpis.avg_sif_probability * 100, 1)} avg SIF probability`}
            />
            <KpiCard
              label="Critical Risk"
              value={formatNumber(kpis.risk_band_distribution?.CRITICAL || 0)}
              icon={AlertTriangle}
              accent="text-risk-critical"
              sub={`${formatPercentValue(kpis.critical_pct)} of all incidents`}
              className="ring-1 ring-risk-critical-border/30"
            />
            <KpiCard
              label="High or Above"
              value={formatPercentValue(kpis.high_or_above_pct)}
              icon={Activity}
              accent="text-risk-high"
              sub={`${formatNumber((kpis.risk_band_distribution?.HIGH || 0) + (kpis.risk_band_distribution?.CRITICAL || 0))} incidents`}
              className="ring-1 ring-risk-high-border/30"
            />
            <KpiCard
              label="Avg SIF Probability"
              value={formatPct(kpis.avg_sif_probability)}
              icon={ShieldCheck}
              sub="Across all scored incidents"
            />
          </div>
        )}
      </AsyncSection>

      {/* ── 2. Geographic Risk Map (Hero) ──────────────────────────────── */}
      <section className="card overflow-hidden bg-gradient-to-br from-surface to-surface-2/10">
        <div className="card-header bg-gradient-to-r from-surface to-surface-2/10">
          <div className="min-w-0 flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-500/10 text-brand-500 ring-1 ring-brand-500/20 shadow-sm">
              <MapPin size={18} aria-hidden="true" />
            </span>
            <div>
              <h2 className="font-display text-base font-bold tracking-tight text-fg">
                Geographic Risk Overview
              </h2>
              <p className="mt-0.5 text-xs text-fg-3 font-medium">
                Operational risk concentration across monitored sites
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-2xs font-bold text-emerald-400 ring-1 ring-emerald-500/20">
              <Radio size={10} className="animate-pulse" />
              LIVE
            </span>
            <span className="text-2xs font-semibold text-fg-3">Demo data</span>
          </div>
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_280px]">
          {/* Map */}
          <div className="relative" style={{ minHeight: 460 }}>
            <AsyncSection
              query={siteQuery}
              componentName="Risk map"
              skeleton={<SkeletonBlock className="h-[460px] w-full rounded-none" />}
              isEmpty={(d) => !d || d.length === 0}
              empty={
                <div className="flex h-[460px] items-center justify-center">
                  <EmptyState title="No site data" message="Site data populates when incidents are loaded." />
                </div>
              }
            >
              {(data) => (
                <GeographicRiskMap
                  siteData={data}
                  highlightedSite={highlightedSite}
                  onSiteClick={setHighlightedSite}
                />
              )}
            </AsyncSection>
          </div>
          {/* Legend sidebar */}
          <div className="border-t border-line p-5 xl:border-l xl:border-t-0 bg-surface/50">
            <AsyncSection
              query={siteQuery}
              componentName="Map legend"
              skeleton={<SkeletonBlock className="h-[300px] w-full" />}
            >
              {(data) => <MapLegend siteData={data} />}
            </AsyncSection>
          </div>
        </div>
      </section>

      {/* ── 3. Risk Distribution + LSR Violations ──────────────────────── */}
      {/* Paired side-by-side, not stacked in an asymmetric sidebar: these
          two are naturally similar heights, so an xl:grid-cols-2 row keeps
          both columns even instead of one column running on much longer
          than the other (which is what caused the dead space below). */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <section className="card overflow-hidden bg-gradient-to-br from-surface to-surface-2/10">
          <div className="card-header">
            <div className="min-w-0">
              <h2 className="card-title text-fg font-bold flex items-center gap-2">
                <AlertTriangle size={15} className="text-brand-500" />
                Risk Distribution
              </h2>
              <p className="mt-0.5 text-xs text-fg-3">Incident breakdown by risk band</p>
            </div>
          </div>
          <div className="flex items-center justify-center p-5">
            <AsyncSection
              query={kpisQuery}
              componentName="Risk pie"
              skeleton={<SkeletonBlock className="h-[260px] w-full" />}
              isEmpty={(d) => !d}
              empty={<EmptyState title="No data" />}
            >
              {(data) => <RiskDistributionDonut kpis={data} />}
            </AsyncSection>
          </div>
        </section>

        <section className="card overflow-hidden bg-gradient-to-br from-surface to-surface-2/10">
          <div className="card-header">
            <div className="min-w-0">
              <h2 className="card-title text-fg font-bold flex items-center gap-2">
                <ShieldCheck size={15} className="text-brand-500" />
                Life Saving Rule Violations
              </h2>
              <p className="mt-0.5 text-xs text-fg-3">Most frequently triggered Life Saving Rules</p>
            </div>
          </div>
          <div className="p-4">
            <LsrBarChart query={lsrQuery} />
          </div>
        </section>
      </div>

      {/* ── 4. Forecast Trend ──────────────────────────────────────────── */}
      <section className="card overflow-hidden bg-gradient-to-br from-surface to-surface-2/10">
        <div className="card-header">
          <div className="min-w-0">
            <h2 className="card-title text-fg font-bold flex items-center gap-2">
              <TrendingUp size={15} className="text-brand-500" />
              Risk Forecast Trend
            </h2>
            <p className="mt-0.5 text-xs text-fg-3">Historical and projected incident volume</p>
          </div>
        </div>
        <div className="p-4">
          <AsyncSection
            query={forecastQuery}
            componentName="Forecast"
            skeleton={<SkeletonBlock className="h-[300px] w-full" />}
            isEmpty={(d) => !d?.history || d.history.length === 0}
            empty={<EmptyState title="No forecast data" message="Forecast requires sufficient historical data." />}
          >
            {(data) => {
              const combined = [
                ...(data.history || []).map((h) => ({ ...h, type: 'history' })),
                ...(data.forecast || []).map((f) => ({ ...f, type: 'forecast' })),
              ]
              return (
                <ResponsiveContainer width="100%" height={300}>
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

      {/* ── 5. Activity + Department Leaderboards ──────────────────────── */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <RankTable
          title="Activity Risk Leaderboard"
          description="Highest composite risk index by work activity"
          query={activityQuery}
          labelKey="activity"
          icon={Trophy}
        />
        <RankTable
          title="Department Risk Leaderboard"
          description="Click a department to filter the incident explorer"
          query={departmentQuery}
          labelKey="department"
          onDrillThrough={setDepartment}
          icon={Landmark}
        />
      </div>

      {/* ── 6. Site Risk Comparison Table ──────────────────────────────── */}
      <section className="card overflow-hidden bg-gradient-to-br from-surface to-surface-2/10">
        <div className="card-header bg-gradient-to-r from-surface to-surface-2/10">
          <div className="min-w-0">
            <h2 className="card-title text-fg font-bold flex items-center gap-2">
              <BarChart3 size={15} className="text-brand-500" />
              Site Risk Comparison
            </h2>
            <p className="mt-0.5 text-xs text-fg-3">
              Composite risk index by operational site ·{' '}
              <span className="text-brand-400 font-semibold">Demo data</span>
            </p>
          </div>
        </div>
        <AsyncSection
          query={siteQuery}
          componentName="Site risk"
          skeleton={<SkeletonTable rows={6} cols={5} />}
          isEmpty={(d) => !d || d.length === 0}
          empty={<EmptyState title="No site data" />}
        >
          {(rows) => {
            const sorted = [...rows].sort((a, b) => b.composite_risk_index - a.composite_risk_index)
            const topSite = sorted[0]?.site
            return (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line bg-surface-2/30 sticky top-0">
                      <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-fg-3">
                        #
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-fg-3">
                        Site
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-fg-3">
                        Reports
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-fg-3">
                        Critical
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-fg-3">
                        High
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-fg-3">
                        Avg SIF
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-fg-3">
                        Risk
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {sorted.slice(0, 12).map((row, i) => {
                      const name = rowLabel(row, 'site')
                      const band = bandForCompositeIndex(row.composite_risk_index)
                      const isTop = name === topSite
                      return (
                        <tr
                          key={name}
                          className={`transition-colors duration-150 cursor-pointer ${
                            highlightedSite === name
                              ? 'bg-brand-500/10'
                              : isTop
                              ? 'bg-risk-critical-bg/20'
                              : 'hover:bg-surface-2/40'
                          }`}
                          onClick={() => setHighlightedSite(name)}
                        >
                          <td className="px-4 py-3">
                            <span className="grid h-6 w-6 place-items-center rounded bg-surface-2 font-mono text-2xs font-extrabold tabular-nums text-fg-2">
                              {i + 1}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {SITE_COORDS[name] && (
                                <MapPin size={12} className="text-fg-3 shrink-0" />
                              )}
                              <span className={`font-bold ${isTop ? 'text-risk-critical' : 'text-fg'}`}>
                                {name}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-fg-2 font-semibold">
                            {formatNumber(row.report_count)}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums font-semibold" style={{ color: RISK_COLORS.CRITICAL }}>
                            {formatNumber(row.critical_count)}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums font-semibold" style={{ color: RISK_COLORS.HIGH }}>
                            {formatNumber(row.high_count)}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-fg-2 font-semibold">
                            {formatPct(row.avg_sif_probability)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <RiskBadge band={band} size="sm" />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )
          }}
        </AsyncSection>
      </section>
    </div>
  )
}