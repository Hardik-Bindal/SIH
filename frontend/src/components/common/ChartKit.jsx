import { cssVarToRgb } from '../../lib/riskBands'

// Theme-aware chart tokens. These functions read CSS vars at call time,
// so switching themes updates chart colors on next render.
// Recharts needs real strings, so we resolve variables to rgb() strings.

export function getChartTokens() {
  return {
    grid: cssVarToRgb('--color-line'),
    tick: cssVarToRgb('--color-fg-3'),
    brand: cssVarToRgb('--color-brand-600'),
    brandDeep: cssVarToRgb('--color-brand-800'),
    brandMid: cssVarToRgb('--color-brand-400'),
    brandSoft: cssVarToRgb('--color-brand-300'),
    brandFaint: cssVarToRgb('--color-brand-200'),
    critical: cssVarToRgb('--color-risk-critical-chart'),
    high: cssVarToRgb('--color-risk-high-chart'),
    medium: cssVarToRgb('--color-risk-medium-chart'),
    low: cssVarToRgb('--color-risk-low-chart'),
    neutral: cssVarToRgb('--color-fg-3'),
  }
}

// Static export kept for compatibility with existing imports.
// Values are resolved lazily via a Proxy so they re-read on each access.
export const CHART = new Proxy(
  {},
  {
    get(_target, prop) {
      const tokens = getChartTokens()
      return tokens[prop]
    },
  }
)

export const CHART_SERIES = new Proxy([], {
  get(_target, prop) {
    const t = getChartTokens()
    const series = [t.brandDeep, t.brand, t.brandMid, t.brandSoft, t.brandFaint, cssVarToRgb('--color-fg-3')]
    if (prop === 'length') return series.length
    if (typeof prop === 'string' && !isNaN(Number(prop))) return series[Number(prop)]
    return series[prop]
  },
})

export const axisProps = {
  tick: { fontSize: 11, fill: cssVarToRgb('--color-fg-3') },
  tickLine: false,
  axisLine: false,
}

export const gridProps = {
  strokeDasharray: '4 4',
  stroke: cssVarToRgb('--color-line'),
  vertical: false,
}

export const tooltipCursor = { fill: 'rgb(var(--color-fg) / 0.04)' }
export const lineTooltipCursor = { stroke: cssVarToRgb('--color-line-2'), strokeWidth: 1, strokeDasharray: '4 4' }

export const legendProps = {
  iconType: 'circle',
  iconSize: 8,
  wrapperStyle: { fontSize: 11, color: cssVarToRgb('--color-fg-3'), paddingTop: 8 },
}

function renderValue(value, valueFormatter) {
  const fmt = valueFormatter || ((v) => (typeof v === 'number' ? v.toLocaleString('en-IN') : v))
  if (Array.isArray(value)) {
    const [lo, hi] = value
    if (lo == null && hi == null) return '—'
    return `${fmt(lo)} – ${fmt(hi)}`
  }
  if (value === null || value === undefined) return '—'
  return fmt(value)
}

function swatchColor(entry) {
  return entry?.color || entry?.payload?.fill || entry?.payload?.payload?.fill || cssVarToRgb('--color-fg-3')
}

export function ChartTooltip({ active, payload, label, labelFormatter, valueFormatter, hideLabel = false }) {
  if (!active || !payload || payload.length === 0) return null
  const rows = payload.filter((entry) => entry && entry.value !== undefined && entry.value !== null)
  if (rows.length === 0) return null

  return (
    <div className="pointer-events-none min-w-[9rem] rounded-xl border border-line bg-surface/95 px-3 py-2.5 shadow-lifted backdrop-blur-md">
      {!hideLabel && label !== undefined && label !== null && label !== '' && (
        <p className="eyebrow mb-1.5 text-fg-3">{labelFormatter ? labelFormatter(label) : label}</p>
      )}
      <ul className="space-y-1">
        {rows.map((entry, i) => (
          <li key={`${entry.dataKey ?? entry.name ?? 'series'}-${i}`} className="flex items-center gap-2.5 text-xs">
            <span
              aria-hidden="true"
              className="h-2 w-2 shrink-0 rounded-full shadow-[0_0_6px_0_currentColor]"
              style={{ background: swatchColor(entry), color: swatchColor(entry) }}
            />
            <span className="mr-auto whitespace-nowrap text-fg-2">{entry.name}</span>
            <span className="whitespace-nowrap font-semibold tabular-nums text-fg">
              {renderValue(entry.value, valueFormatter)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}