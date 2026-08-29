import { AlertTriangle, RefreshCw } from 'lucide-react'

export default function ErrorState({ componentName = 'This section', error, onRetry }) {
  return (
    <div
      role="alert"
      className="relative flex flex-col items-center justify-center overflow-hidden rounded-xl border border-risk-critical-border bg-risk-critical-bg/60 px-6 py-9 text-center"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-50"
        style={{
          backgroundImage: 'radial-gradient(circle at 50% 20%, rgb(var(--color-risk-critical-solid) / 0.08), transparent 60%)',
        }}
      />
      <span className="relative grid h-12 w-12 place-items-center rounded-xl border border-risk-critical-border bg-surface text-risk-critical-solid shadow-card">
        <AlertTriangle size={22} aria-hidden="true" />
      </span>
      <p className="relative mt-4 font-display text-sm font-semibold tracking-tight text-risk-critical">
        {componentName} couldn't load
      </p>
      <p className="relative mt-1.5 max-w-sm text-xs leading-relaxed text-risk-critical/80">
        {error?.message || 'Unexpected error contacting the API.'}
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="btn-secondary relative mt-4 border-risk-critical-border px-3 py-1.5 text-xs text-risk-critical hover:border-risk-critical-solid hover:bg-surface"
        >
          <RefreshCw size={13} aria-hidden="true" />
          Retry
        </button>
      )}
    </div>
  )
}