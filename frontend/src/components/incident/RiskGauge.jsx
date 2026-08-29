import { useEffect, useState } from 'react'
import { riskStyle } from '../../lib/riskBands'
import { formatPct } from '../../lib/format'
import RiskBadge from '../common/RiskBadge'
import { cssVarToRgb } from '../../lib/riskBands'

export default function RiskGauge({ probability, band, confidence }) {
  const style = riskStyle(band)
  const pct = Math.max(0, Math.min(1, probability ?? 0))
  const radius = 70
  const circumference = Math.PI * radius
  const offset = circumference * (1 - pct)

  // Track color adapts to theme
  const [trackColor, setTrackColor] = useState('#eef2f7')
  useEffect(() => {
    setTrackColor(cssVarToRgb('--color-surface-3'))
  }, [])

  const isCritical = String(band).toUpperCase() === 'CRITICAL'

  return (
    <div className="relative flex flex-col items-center gap-2 rounded-2xl border border-line bg-gradient-to-br from-surface to-surface-2/50 p-5 shadow-card">
      {/* Ambient glow for critical */}
      {isCritical && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-2xl"
          style={{
            background: 'radial-gradient(circle at 50% 30%, rgb(var(--color-risk-critical-solid) / 0.15), transparent 60%)',
          }}
        />
      )}

      <svg
        viewBox="0 0 180 104"
        className="relative w-52"
        role="img"
        aria-label={`SIF probability ${formatPct(probability)}`}
      >
        <defs>
          <linearGradient id={`gauge-grad-${band}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={style.chart} stopOpacity="0.7" />
            <stop offset="100%" stopColor={style.chart} stopOpacity="1" />
          </linearGradient>
          <filter id="gauge-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Background track */}
        <path
          d="M 20 90 A 70 70 0 0 1 160 90"
          fill="none"
          stroke={trackColor}
          strokeWidth="14"
          strokeLinecap="round"
        />

        {/* Value arc with gradient + glow for critical */}
        <path
          d="M 20 90 A 70 70 0 0 1 160 90"
          fill="none"
          stroke={`url(#gauge-grad-${band})`}
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          filter={isCritical ? 'url(#gauge-glow)' : undefined}
          style={{ transition: 'stroke-dashoffset 700ms cubic-bezier(0.16, 1, 0.3, 1)' }}
        />

        <text
          x="90"
          y="82"
          textAnchor="middle"
          fill={cssVarToRgb('--color-fg')}
          className="font-display"
          style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.03em' }}
        >
          {formatPct(probability)}
        </text>
        <text
          x="90"
          y="99"
          textAnchor="middle"
          fill={cssVarToRgb('--color-fg-3')}
          style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.12em' }}
        >
          SIF PROBABILITY
        </text>
      </svg>

      <RiskBadge band={band} pulse />

      {confidence !== undefined && (
        <p className="relative text-xs tabular-nums text-fg-3">
          Model confidence: <span className="font-semibold text-fg-2">{formatPct(confidence)}</span>
        </p>
      )}
    </div>
  )
}