import EmptyState from '../common/EmptyState'

const GROUP_STYLES = {
  hazard: 'bg-risk-high-bg text-risk-high ring-risk-high-border',
  equipment: 'bg-brand-50 text-brand-700 ring-brand-200',
  activity: 'bg-surface-2 text-fg-2 ring-line',
  condition: 'bg-risk-medium-bg text-risk-medium ring-risk-medium-border',
}

const GROUP_ICONS = {
  hazard: '⚠',
  equipment: '⚙',
  activity: '⚡',
  condition: '◈',
}

export default function EntityTags({ entities }) {
  const groups = Object.entries(entities || {}).filter(([, values]) => Array.isArray(values) && values.length > 0)
  if (groups.length === 0) {
    return <EmptyState title="No entities extracted" message="Hazard, equipment, activity or condition terms were not detected in this narrative." />
  }
  return (
    <div className="space-y-4">
      {groups.map(([group, values], gi) => (
        <div
          key={group}
          className="animate-fade-up"
          style={{ animationDelay: `${gi * 80}ms`, animationFillMode: 'both' }}
        >
          <p className="eyebrow mb-2 flex items-center gap-1.5">
            <span aria-hidden="true" className="text-sm">{GROUP_ICONS[group] || '•'}</span>
            {group}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {values.map((v, i) => (
              <span
                key={`${v}-${i}`}
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset transition-all duration-180 hover:scale-105 ${
                  GROUP_STYLES[group] || 'bg-surface-2 text-fg-2 ring-line'
                }`}
                style={{ animationDelay: `${(gi * 100) + (i * 30)}ms` }}
              >
                {v}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}