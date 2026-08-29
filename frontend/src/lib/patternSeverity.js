// Theme-aware severity classification for Safety Memory patterns.
export function severityOf(pattern) {
  const rate = pattern.fatal_rate ?? 0
  if (pattern.fatal_count > 0 && rate >= 0.5) {
    return {
      key: 'FATAL',
      label: 'Fatal-dominant pattern',
      card: 'border-risk-critical-border',
      accent: 'bg-gradient-to-r from-risk-critical-solid to-risk-critical',
      badge: 'bg-risk-critical-solid text-white border border-risk-critical-solid shadow-[0_2px_8px_-2px_rgb(var(--color-risk-critical-solid)/0.5)]',
    }
  }
  if (pattern.fatal_count > 0) {
    return {
      key: 'MIXED',
      label: 'Fatalities present',
      card: 'border-risk-high-border',
      accent: 'bg-gradient-to-r from-risk-high-solid to-risk-high',
      badge: 'bg-risk-high-bg text-risk-high border border-risk-high-border',
    }
  }
  return {
    key: 'NONE',
    label: 'No fatalities in cluster',
    card: 'border-line',
    accent: 'bg-line-2',
    badge: 'bg-surface-2 text-fg-2 border border-line-2',
  }
}

const BASELINE_SHARE = 0.7

export function severityBaseline(patterns) {
  if (!patterns || patterns.length === 0) return null
  const counts = new Map()
  for (const p of patterns) {
    const k = severityOf(p).key
    counts.set(k, (counts.get(k) || 0) + 1)
  }
  let topKey = null
  let topCount = 0
  for (const [k, c] of counts) {
    if (c > topCount) {
      topKey = k
      topCount = c
    }
  }
  return topCount / patterns.length >= BASELINE_SHARE ? topKey : null
}