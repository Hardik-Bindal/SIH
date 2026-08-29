import EmptyState from '../common/EmptyState'
import { formatPct } from '../../lib/format'

export default function LsrMapping({ lsrTags }) {
  if (!lsrTags || lsrTags.length === 0) {
    return <EmptyState title="No Life Saving Rule matched" message="No rule crossed the confidence threshold for this report." />
  }
  const sorted = [...lsrTags].sort((a, b) => b.score - a.score)
  return (
    <ul className="space-y-3.5">
      {sorted.map((tag, i) => (
        <li
          key={tag.rule}
          className="group animate-fade-up"
          style={{ animationDelay: `${i * 60}ms`, animationFillMode: 'both' }}
        >
          <div className="flex items-baseline justify-between gap-3">
            <span
              className={`min-w-0 truncate text-xs font-semibold uppercase tracking-[0.04em] transition-colors duration-180 ${
                i === 0 ? 'text-risk-critical' : 'text-fg-2 group-hover:text-fg'
              }`}
              title={tag.rule}
            >
              {tag.rule.replaceAll('_', ' ')}
            </span>
            <span className="shrink-0 text-xs font-semibold tabular-nums text-fg-2">{formatPct(tag.score)}</span>
          </div>
          <div className="relative mt-1.5 h-2 overflow-hidden rounded-full bg-surface-2">
            <div
              className={`h-full rounded-full transition-[width] duration-700 ease-out-expo ${
                i === 0
                  ? 'bg-gradient-to-r from-risk-critical-solid to-risk-high-solid shadow-[0_0_8px_-1px_rgb(var(--color-risk-critical-solid)/0.6)]'
                  : 'bg-gradient-to-r from-brand-400 to-brand-600'
              }`}
              style={{ width: `${Math.min(100, tag.score * 100)}%` }}
            />
            {/* Subtle shine on hover */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent transition-transform duration-700 group-hover:translate-x-full"
            />
          </div>
        </li>
      ))}
    </ul>
  )
}