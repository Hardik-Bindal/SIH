import { riskStyle } from '../../lib/riskBands'

const WEIGHTS = [
  { key: 'sif', label: 'SIF probability', weight: 0.55, className: 'bg-gradient-to-r from-brand-500 to-brand-700' },
  { key: 'lsr', label: 'Life Saving Rule severity', weight: 0.25, className: 'bg-gradient-to-r from-brand-300 to-brand-500' },
  { key: 'barrier', label: 'Barrier failure', weight: 0.1, className: 'bg-gradient-to-r from-risk-medium-solid/80 to-risk-medium-solid' },
  { key: 'similarity', label: 'Fatal-case similarity', weight: 0.1, className: 'bg-gradient-to-r from-risk-high-solid/80 to-risk-high-solid' },
]

export default function RiskFusionBar({ analysis }) {
  if (!analysis) return null

  const pSif = analysis.sif_probability ?? 0
  const topLsr = analysis.lsr_tags?.[0]?.score ?? 0
  const barrier = analysis.barrier_failure ? 1 : 0
  const similarity = analysis.fatality_twin?.similarity ?? analysis.similar_fatalities?.[0]?.similarity ?? 0

  const raw = { sif: pSif, lsr: topLsr, barrier, similarity }
  const parts = WEIGHTS.map((w) => ({ ...w, input: raw[w.key], contribution: raw[w.key] * w.weight }))
  const total = parts.reduce((s, p) => s + p.contribution, 0)
  const style = riskStyle(analysis.risk_band)

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-xs font-medium text-fg-2">How this score was assembled</p>
        <p className="text-xs font-semibold tabular-nums text-fg">
          <span className="font-display text-base font-bold">{total.toFixed(2)}</span>{' '}
          <span className="font-normal text-fg-3">/ 1.00</span>
        </p>
      </div>

      <div
        className="mt-2.5 flex h-3.5 w-full overflow-hidden rounded-full bg-surface-2 ring-1 ring-inset ring-line shadow-inner"
        role="img"
        aria-label={`Risk score ${total.toFixed(2)} of 1.00: ${parts
          .map((p) => `${p.label} contributes ${p.contribution.toFixed(2)}`)
          .join('; ')}`}
      >
        {parts.map((p, i) => (
          <span
            key={p.key}
            className={`${p.className} transition-[width] duration-700 ease-out-expo`}
            style={{ width: `${p.contribution * 100}%`, animationDelay: `${i * 100}ms` }}
          />
        ))}
      </div>

      <ul className="mt-3.5 grid grid-cols-2 gap-x-4 gap-y-2">
        {parts.map((p, i) => (
          <li
            key={p.key}
            className="flex items-center gap-2 text-2xs animate-fade-up"
            style={{ animationDelay: `${i * 60}ms`, animationFillMode: 'both' }}
          >
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${p.className}`} aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate text-fg-2">{p.label}</span>
            <span className="shrink-0 font-semibold tabular-nums text-fg">
              +{p.contribution.toFixed(2)}
            </span>
          </li>
        ))}
      </ul>

      {analysis.escalation_override_applied && (
        <p className="mt-3 rounded-xl border border-risk-high-border bg-risk-high-bg px-3 py-2 text-2xs font-medium text-risk-high">
          <strong className="font-bold uppercase tracking-wider">Escalation override</strong> — matched a fatal case
          above the similarity floor, so the band is floored at HIGH regardless of the computed score.
        </p>
      )}

      <p className="mt-2.5 text-2xs text-fg-3">
        Band <span className={`font-bold ${style.text}`}>{style.label}</span> · thresholds are a
        fixed rule layer, not a model output.
      </p>
    </div>
  )
}