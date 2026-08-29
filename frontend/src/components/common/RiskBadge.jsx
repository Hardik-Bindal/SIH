import { riskStyle } from '../../lib/riskBands'

export default function RiskBadge({ band, size = 'md', className = '', pulse = false }) {
  const style = riskStyle(band)
  const sizing = size === 'sm' ? 'gap-1.5 px-2 py-0.5 text-2xs' : 'gap-1.5 px-2.5 py-1 text-xs'
  const dot = !band ? 'bg-fg-3' : style.label === 'CRITICAL' ? 'bg-white' : style.dot
  const shouldPulse = pulse && style.label === 'CRITICAL'

  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full font-semibold uppercase tracking-[0.06em] transition-all duration-180
        ${sizing} ${style.badge} ${shouldPulse ? 'animate-pulse-glow' : ''} ${className}`}
    >
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot} ${shouldPulse ? 'animate-pulse-soft' : ''}`}
      />
      {style.label !== 'UNKNOWN' ? style.label : band || 'UNKNOWN'}
    </span>
  )
}