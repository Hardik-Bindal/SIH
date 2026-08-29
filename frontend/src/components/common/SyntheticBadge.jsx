import { FlaskConical } from 'lucide-react'

export default function SyntheticBadge({ label = 'Demo data', title, className = '' }) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-risk-medium-border/70 bg-risk-medium-bg/70
        px-2 py-0.5 text-2xs font-semibold uppercase tracking-[0.08em] text-risk-medium transition-colors duration-180 ${className}`}
      title={title || 'This field is synthesised for the prototype and disclosed rather than hidden — see docs/DEVIATIONS.md'}
    >
      <FlaskConical size={11} aria-hidden="true" />
      {label}
    </span>
  )
}