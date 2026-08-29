import { useState } from 'react'
import { Link } from 'react-router-dom'
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { MapPinned, ArrowUpRight, Trophy, Landmark } from 'lucide-react'
import { useHeatmap, useActivityAnalytics, useDepartmentAnalytics } from '../api/queries'
import { useFilterStore } from '../store/filterStore'
import AsyncSection from '../components/common/AsyncSection'
import { SkeletonBlock, SkeletonTable } from '../components/common/Skeleton'
import EmptyState from '../components/common/EmptyState'
import RiskBadge from '../components/common/RiskBadge'
import SyntheticBadge from '../components/common/SyntheticBadge'
import { riskStyle, bandForCompositeIndex, RISK_BAND_STYLES } from '../lib/riskBands'
import { formatNumber, formatPct, rowLabel } from '../lib/format'

const DULIAJAN_CENTER = [27.3167, 95.3333]

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

export default function HazardAnalytics() {
  const [tilesFailed, setTilesFailed] = useState(false)
  const heatmapQuery = useHeatmap()
  const activityQuery = useActivityAnalytics()
  const departmentQuery = useDepartmentAnalytics()
  const setDepartment = useFilterStore((s) => s.setDepartment)

  return (
    <div className="space-y-6">
      <section className="card bg-gradient-to-br from-surface to-surface-2/10">
        <div className="card-header flex-wrap">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-brand-500/10 text-brand-500 ring-1 ring-brand-500/20 dark:bg-brand-500/20 dark:text-brand-300 dark:ring-brand-500/30 shadow-sm">
              <MapPinned size={16} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 className="card-title text-fg font-bold">Geospatial hazard heatmap</h2>
            </div>
          </div>
          <SyntheticBadge
            label="Synthetic coordinates"
            title="Site lat/lng are fixed synthetic points around Duliajan, Assam — see docs/DEVIATIONS.md"
          />
        </div>
        <div className="p-4">
          <AsyncSection
            query={heatmapQuery}
            componentName="Hazard heatmap"
            skeleton={<SkeletonBlock className="h-[420px] w-full" />}
            isEmpty={(data) => !data?.features || data.features.length === 0}
            empty={<EmptyState title="No geolocated reports" message="The heatmap populates once analysed reports carry a site." />}
          >
            {(geojson) => (
              <>
                <div
                  className={`relative h-[420px] overflow-hidden rounded-xl border border-line shadow-card ${
                    tilesFailed ? 'no-basemap bg-surface-2' : ''
                  }`}
                  style={
                    tilesFailed
                      ? {
                          backgroundImage:
                            'linear-gradient(to right, rgb(var(--color-line-2) / 0.15) 1px, transparent 1px), linear-gradient(to bottom, rgb(var(--color-line-2) / 0.15) 1px, transparent 1px)',
                          backgroundSize: '48px 48px',
                        }
                      : undefined
                  }
                >
                  {tilesFailed && (
                    <p className="absolute inset-x-0 top-0 z-[500] border-b border-risk-medium-border bg-risk-medium-bg px-3 py-1.5 text-center text-2xs font-bold text-risk-medium">
                      Basemap tiles unreachable — showing marker positions only. Report data is
                      unaffected.
                    </p>
                  )}
                  <MapContainer
                    center={DULIAJAN_CENTER}
                    zoom={9}
                    scrollWheelZoom
                    style={{ height: '100%', width: '100%' }}
                  >
                    {!tilesFailed && (
                      <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        eventHandlers={{ tileerror: () => setTilesFailed(true) }}
                      />
                    )}
                    {geojson.features.map((f) => {
                      const [lng, lat] = f.geometry.coordinates
                      const style = riskStyle(f.properties.risk_band)
                      return (
                        <CircleMarker
                          key={f.properties.report_id}
                          center={[lat, lng]}
                          radius={f.properties.risk_band === 'CRITICAL' ? 9 : 7}
                          pathOptions={{
                            color: '#ffffff',
                            weight: 1.5,
                            fillColor: style.chart,
                            fillOpacity: 0.9,
                          }}
                        >
                          <Popup>
                            <div className="text-xs p-1">
                              <p className="font-mono text-fg-3 font-semibold">{f.properties.report_id}</p>
                              <p className="font-bold text-fg mt-0.5">
                                {f.properties.site} · {f.properties.area}
                              </p>
                              <p className="mt-1 font-extrabold uppercase tracking-wide" style={{ color: style.chart }}>
                                {style.label}
                              </p>
                              <Link
                                to={`/incidents/${encodeURIComponent(f.properties.report_id)}`}
                                className="mt-2 inline-flex items-center gap-1 font-bold text-brand-500 hover:text-brand-600 underline"
                              >
                                View analysis <ArrowUpRight size={11} />
                              </Link>
                            </div>
                          </Popup>
                        </CircleMarker>
                      )
                    })}
                  </MapContainer>
                </div>
                <div className="mt-3.5 flex flex-wrap items-center gap-x-4 gap-y-2">
                  <span className="eyebrow text-fg-3 font-bold">Risk legend</span>
                  {Object.values(RISK_BAND_STYLES).map((band) => (
                    <span key={band.label} className="flex items-center gap-1.5 text-xs text-fg-2 font-medium">
                      <span
                        aria-hidden="true"
                        className="h-2.5 w-2.5 rounded-full ring-2 ring-surface shadow-[0_0_6px_0_currentColor]"
                        style={{ background: band.chart, color: band.chart }}
                      />
                      {band.label}
                    </span>
                  ))}
                  <span className="ml-auto text-xs tabular-nums text-fg-3 font-semibold">
                    {formatNumber(geojson.features.length)} plotted reports
                  </span>
                </div>
              </>
            )}
          </AsyncSection>
        </div>
      </section>

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
    </div>
  )
}