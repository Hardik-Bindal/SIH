import { Inbox } from 'lucide-react'

export default function EmptyState({ icon: Icon = Inbox, title, message, action }) {
  return (
    <div className="relative flex flex-col items-center justify-center overflow-hidden rounded-xl border border-dashed border-line bg-surface-2/50 px-6 py-12 text-center">
      {/* Subtle radial glow */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage: 'radial-gradient(circle at 50% 30%, rgb(var(--color-brand-500) / 0.06), transparent 60%)',
        }}
      />
      <span className="relative grid h-12 w-12 place-items-center rounded-xl border border-line bg-surface text-fg-3 shadow-card">
        <Icon size={22} aria-hidden="true" />
      </span>
      <p className="relative mt-4 font-display text-sm font-semibold tracking-tight text-fg">{title}</p>
      {message && <p className="relative mt-1.5 max-w-sm text-sm leading-relaxed text-fg-2">{message}</p>}
      {action && <div className="relative mt-4">{action}</div>}
    </div>
  )
}