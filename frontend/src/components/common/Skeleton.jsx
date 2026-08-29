function Shimmer() {
  return (
    <span
      aria-hidden="true"
      className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/50 to-transparent dark:via-white/10"
    />
  )
}

export function SkeletonBlock({ className = '', style }) {
  return (
    <div className={`relative overflow-hidden rounded-lg bg-surface-3 ${className}`} style={style}>
      <Shimmer />
    </div>
  )
}

export function SkeletonText({ lines = 3, className = '' }) {
  return (
    <div className={`space-y-2.5 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="relative h-3 overflow-hidden rounded-full bg-surface-3"
          style={{ width: `${100 - i * 12}%` }}
        >
          <Shimmer />
        </div>
      ))}
    </div>
  )
}

export function SkeletonCard({ className = '' }) {
  return (
    <div className={`card p-4 ${className}`}>
      <SkeletonBlock className="mb-3.5 h-3 w-1/3" />
      <SkeletonBlock className="h-7 w-1/2" />
      <SkeletonBlock className="mt-3 h-2.5 w-2/5" />
    </div>
  )
}

export function SkeletonTable({ rows = 5, cols = 4 }) {
  return (
    <div className="w-full overflow-hidden">
      <div
        className="grid gap-x-4 gap-y-3.5 px-4 py-4"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: rows * cols }).map((_, i) => (
          <SkeletonBlock key={i} className={i < cols ? 'h-2.5 w-3/5' : 'h-3 w-4/5'} />
        ))}
      </div>
    </div>
  )
}

export function SkeletonChart({ height = 260 }) {
  return (
    <div className="flex w-full items-end gap-2.5" style={{ height }} aria-hidden="true">
      {[62, 84, 48, 96, 71, 58, 88, 44, 78, 66].map((h, i) => (
        <SkeletonBlock key={i} className="flex-1 rounded-t-lg" style={{ height: `${h}%` }} />
      ))}
    </div>
  )
}