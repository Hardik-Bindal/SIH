// Single source of truth for risk-band visual tokens (SRS 14.1: colour is
// never the only signal — every consumer must also render `label`).
// Now theme-aware: chart hex values are read from CSS variables at runtime,
// so charts adapt automatically to dark mode.
export const RISK_BAND_STYLES = {
  LOW: {
    label: 'LOW',
    badge: 'bg-risk-low-bg text-risk-low border border-risk-low-border',
    dot: 'bg-risk-low-solid',
    solid: 'bg-risk-low-solid',
    text: 'text-risk-low',
    chartVar: '--color-risk-low-chart',
  },
  MEDIUM: {
    label: 'MEDIUM',
    badge: 'bg-risk-medium-bg text-risk-medium border border-risk-medium-border',
    dot: 'bg-risk-medium-solid',
    solid: 'bg-risk-medium-solid',
    text: 'text-risk-medium',
    chartVar: '--color-risk-medium-chart',
  },
  HIGH: {
    label: 'HIGH',
    badge: 'bg-risk-high-bg text-risk-high border border-risk-high-border',
    dot: 'bg-risk-high-solid',
    solid: 'bg-risk-high-solid',
    text: 'text-risk-high',
    chartVar: '--color-risk-high-chart',
  },
  CRITICAL: {
    label: 'CRITICAL',
    badge: 'bg-risk-critical-solid text-white border border-risk-critical-solid shadow-[0_0_20px_-4px_rgb(220_38_38/0.5)]',
    dot: 'bg-white',
    solid: 'bg-risk-critical-solid',
    text: 'text-risk-critical',
    chartVar: '--color-risk-critical-chart',
  },
}

export const DEFAULT_BAND_STYLE = {
  label: 'UNKNOWN',
  badge: 'bg-surface-2 text-fg-2 border border-line-2',
  dot: 'bg-fg-3',
  solid: 'bg-fg-3',
  text: 'text-fg-3',
  chartVar: '--color-fg-3',
}

// Read a CSS var at runtime and convert to hex-ish rgb string for chart libs
export function cssVarToRgb(varName) {
  if (typeof window === 'undefined') return '#94a3b8'
  const raw = getComputedStyle(document.documentElement).getPropertyValue(varName).trim()
  if (!raw) return '#94a3b8'
  return `rgb(${raw})`
}

export function riskStyle(band) {
  const base = band ? RISK_BAND_STYLES[String(band).toUpperCase()] : null
  const style = base || DEFAULT_BAND_STYLE
  return { ...style, chart: cssVarToRgb(style.chartVar) }
}

export function bandForCompositeIndex(index) {
  if (index === null || index === undefined || Number.isNaN(index)) return 'LOW'
  if (index >= 3.5) return 'CRITICAL'
  if (index >= 2.5) return 'HIGH'
  if (index >= 1.5) return 'MEDIUM'
  return 'LOW'
}