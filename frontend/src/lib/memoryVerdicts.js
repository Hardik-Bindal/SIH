// Theme-aware verdict styles. Uses semantic tokens so light and dark themes
// both render clean, consistent verdicts.
export const VERDICT_STYLES = {
  REPEAT_FATAL_PATTERN: {
    label: 'Repeat fatal pattern',
    severity: 'CRITICAL',
    badge: 'bg-risk-critical-solid text-white border border-risk-critical-solid shadow-[0_2px_8px_-2px_rgb(var(--color-risk-critical-solid)/0.5)]',
    panel: 'border-risk-critical-border bg-risk-critical-bg',
    text: 'text-risk-critical',
    dot: 'bg-risk-critical-solid',
    icon: 'Skull',
  },
  REPEAT_PATTERN: {
    label: 'Repeat pattern',
    severity: 'HIGH',
    badge: 'bg-risk-high-bg text-risk-high border border-risk-high-border',
    panel: 'border-risk-high-border bg-risk-high-bg',
    text: 'text-risk-high',
    dot: 'bg-risk-high-solid',
    icon: 'Repeat',
  },
  RELATED_FATAL_PRECEDENT: {
    label: 'Related fatal precedent',
    severity: 'MEDIUM',
    badge: 'bg-risk-medium-bg text-risk-medium border border-risk-medium-border',
    panel: 'border-risk-medium-border bg-risk-medium-bg',
    text: 'text-risk-medium',
    dot: 'bg-risk-medium-solid',
    icon: 'AlertTriangle',
  },
  WEAK_PRECEDENT: {
    label: 'Weak precedent',
    severity: 'LOW',
    badge: 'bg-surface-2 text-fg-2 border border-line-2',
    panel: 'border-line-2 bg-surface-2',
    text: 'text-fg-2',
    dot: 'bg-fg-3',
    icon: 'HelpCircle',
  },
  NO_PRECEDENT: {
    label: 'No precedent found',
    severity: 'NONE',
    badge: 'bg-brand-50 text-brand-700 border border-brand-200',
    panel: 'border-brand-200 bg-brand-50',
    text: 'text-brand-700',
    dot: 'bg-brand-500',
    icon: 'Info',
  },
}

export const DEFAULT_VERDICT_STYLE = {
  label: 'Unknown verdict',
  severity: 'NONE',
  badge: 'bg-surface-2 text-fg-2 border border-line-2',
  panel: 'border-line-2 bg-surface-2',
  text: 'text-fg-2',
  dot: 'bg-fg-3',
  icon: 'Info',
}

export function verdictStyle(verdict) {
  if (!verdict) return DEFAULT_VERDICT_STYLE
  return VERDICT_STYLES[String(verdict).toUpperCase()] || DEFAULT_VERDICT_STYLE
}