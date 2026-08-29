export default function KpiCard({ label, value, sub, icon: Icon, accent = 'text-fg', badge }) {
  return (
    <div className="card-interactive group relative overflow-hidden p-4">
      {/* Gradient sweep on hover */}
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-0.5 origin-left scale-x-0 bg-gradient-to-r from-brand-500 via-brand-400 to-brand-600 transition-transform duration-400 ease-out-standard group-hover:scale-x-100"
      />
      {/* Ambient glow on hover */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-brand-500/0 blur-2xl transition-all duration-500 group-hover:bg-brand-500/10"
      />
      <div className="relative flex items-center justify-between">
        <span className="eyebrow">{label}</span>
        {Icon && (
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-surface-2 text-fg-3 transition-all duration-250 group-hover:scale-110 group-hover:bg-brand-100 group-hover:text-brand-700">
            <Icon size={15} aria-hidden="true" />
          </span>
        )}
      </div>
      <div className="relative mt-2.5 flex items-baseline gap-2">
        <span className={`font-display text-[1.75rem] font-bold leading-none tabular-nums tracking-tight ${accent}`}>
          {value}
        </span>
        {badge}
      </div>
      {sub && <p className="relative mt-1.5 text-xs text-fg-3">{sub}</p>}
    </div>
  )
}