import EmptyState from '../common/EmptyState'

export default function ExplanationPanel({ explanation }) {
  if (!explanation) {
    return <EmptyState title="No explanation available" message="This report has not been scored with attribution yet." />
  }
  const tokens = explanation.tokens || []
  const maxAbs = Math.max(1e-6, ...tokens.map((t) => Math.abs(t.weight)))

  return (
    <div>
      {explanation.summary && (
        <p className="mb-4 rounded-xl border border-line bg-gradient-to-br from-surface-2 to-surface p-3.5 text-sm leading-relaxed text-fg-2">
          {explanation.summary}
        </p>
      )}
      {tokens.length === 0 ? (
        <EmptyState title="No attributed phrases" message="No terms crossed the attribution threshold for this report." />
      ) : (
        <ul className="space-y-2.5">
          {tokens
            .slice()
            .sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight))
            .map((t, i) => {
              const isPositive = t.weight >= 0
              const widthPct = (Math.abs(t.weight) / maxAbs) * 100
              return (
                <li
                  key={t.term}
                  className="group flex items-center gap-3 animate-fade-up"
                  style={{ animationDelay: `${i * 40}ms`, animationFillMode: 'both' }}
                >
                  <span
                    className="w-32 shrink-0 truncate text-xs font-medium text-fg-2 group-hover:text-fg transition-colors duration-180"
                    title={t.term}
                  >
                    {t.term}
                  </span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                    <div
                      className={`h-full rounded-full transition-[width] duration-500 ease-out-expo ${
                        isPositive
                          ? 'bg-gradient-to-r from-risk-critical-solid/70 to-risk-critical-solid shadow-[0_0_6px_-1px_rgb(var(--color-risk-critical-solid)/0.5)]'
                          : 'bg-gradient-to-r from-brand-400 to-brand-600'
                      }`}
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                  <span
                    className={`w-12 shrink-0 text-right text-xs font-bold tabular-nums ${
                      isPositive ? 'text-risk-critical' : 'text-brand-700'
                    }`}
                  >
                    {t.weight.toFixed(2)}
                  </span>
                </li>
              )
            })}
        </ul>
      )}
      <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-line pt-3 text-2xs leading-relaxed text-fg-3">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="h-2 w-2 rounded-full bg-risk-critical-solid shadow-[0_0_6px_0_rgb(var(--color-risk-critical-solid)/0.6)]" />
          increases predicted risk
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="h-2 w-2 rounded-full bg-brand-500 shadow-[0_0_6px_0_rgb(var(--color-brand-500)/0.6)]" />
          decreases it
        </span>
        <span className="basis-full sm:basis-auto">
          linear-model coefficient × TF-IDF attribution (see <span className="font-mono">docs/DEVIATIONS.md</span>).
        </span>
      </p>
    </div>
  )
}