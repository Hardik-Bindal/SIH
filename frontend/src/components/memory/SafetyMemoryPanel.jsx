import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  HelpCircle,
  Info,
  Repeat,
  Skull,
  MapPin,
  CalendarRange,
  Layers,
  ShieldOff,
  Wrench,
  ShieldCheck,
} from 'lucide-react'
import { verdictStyle } from '../../lib/memoryVerdicts'
import { formatDate, formatPct, formatNumber, truncate } from '../../lib/format'
import RiskBadge from '../common/RiskBadge'

const VERDICT_ICONS = { Skull, Repeat, AlertTriangle, HelpCircle, Info }

function Stat({ icon: Icon, label, value }) {
  return (
    <div className="flex min-w-[7.5rem] flex-col gap-1">
      <span className="eyebrow inline-flex items-center gap-1">
        {Icon && <Icon size={12} aria-hidden="true" />}
        {label}
      </span>
      <span className="font-display text-sm font-bold tabular-nums tracking-tight text-fg">{value}</span>
    </div>
  )
}

export default function SafetyMemoryPanel({ recall, compact = false }) {
  if (!recall) return null

  const style = verdictStyle(recall.verdict)
  const VerdictIcon = VERDICT_ICONS[style.icon] || Info
  const matches = recall.matches || []
  const recurrence = recall.recurrence || {}
  const cause = recall.common_cause
  const action = recall.recommended_action
  const barrier = recall.recurring_barrier
  const pattern = recall.pattern
  const hasPrecedent = matches.length > 0

  return (
    <div className={compact ? 'space-y-3' : 'space-y-4'}>
      {/* Verdict */}
      <div className={`relative overflow-hidden rounded-xl border p-3.5 ${style.panel}`}>
        {style.severity === 'CRITICAL' && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-40"
            style={{
              backgroundImage: 'radial-gradient(circle at 20% 30%, rgb(var(--color-risk-critical-solid) / 0.15), transparent 60%)',
            }}
          />
        )}
        <div className="relative flex flex-wrap items-start gap-x-3 gap-y-2">
          <span
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-2xs font-semibold uppercase tracking-[0.06em] ${style.badge}`}
          >
            <VerdictIcon size={12} aria-hidden="true" />
            {style.label}
          </span>
          <p className={`min-w-[12rem] flex-1 text-sm leading-relaxed ${style.text}`}>
            {recall.verdict_text || 'No verdict text returned.'}
          </p>
        </div>
        <p className="relative mt-2 font-mono text-2xs uppercase tracking-[0.08em] text-fg-3">
          verdict: {recall.verdict || 'UNKNOWN'}
          {recall.top_similarity != null && ` · best match ${formatPct(recall.top_similarity, 0)}`}
        </p>
      </div>

      {!hasPrecedent ? (
        <div className="rounded-xl border border-dashed border-line-2 bg-surface-2/50 p-4">
          <p className="font-display text-sm font-semibold tracking-tight text-fg">
            Nothing in the corpus looks like this.
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-fg-2">
            No historical report cleared the similarity floor, so on the evidence available this event looks genuinely
            novel — there is no precedent to learn from and no earlier warning that was missed. Treat the controls here as
            unproven rather than assuming they held.
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-x-6 gap-y-4 rounded-xl border border-line bg-gradient-to-br from-surface-2 to-surface p-3.5">
            <Stat icon={Layers} label="Total matches" value={formatNumber(recurrence.total_matches ?? matches.length)} />
            <Stat
              icon={Skull}
              label="Fatal matches"
              value={
                <span className={recurrence.fatal_matches > 0 ? 'text-risk-critical' : 'text-fg'}>
                  {formatNumber(recurrence.fatal_matches ?? 0)}
                </span>
              }
            />
            <Stat icon={MapPin} label="Sites affected" value={formatNumber(recurrence.site_count ?? 0)} />
            <Stat
              icon={CalendarRange}
              label="First → last seen"
              value={
                recurrence.first_seen || recurrence.last_seen
                  ? `${formatDate(recurrence.first_seen)} → ${formatDate(recurrence.last_seen)}`
                  : '—'
              }
            />
            {recurrence.strong_matches != null && (
              <Stat icon={ShieldCheck} label="Strong matches" value={formatNumber(recurrence.strong_matches)} />
            )}
          </div>

          {recurrence.sites_affected?.length > 0 && (
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-fg-2">
              <span className="eyebrow">Sites</span>
              {recurrence.sites_affected.join(' · ')}
            </p>
          )}

          <div className="card p-3.5">
            <p className="eyebrow flex items-center gap-1.5">
              <Wrench size={12} aria-hidden="true" />
              Common cause across the matched cases
            </p>
            {cause ? (
              <>
                <p className="mt-1.5 text-sm font-semibold text-fg">{cause.cause}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-fg-2">
                  <span className="chip py-0.5 font-semibold tabular-nums">
                    {cause.support} of {cause.of} matched cases
                    {cause.share != null && ` · ${formatPct(cause.share, 0)}`}
                  </span>
                  {cause.rule && (
                    <span className="chip border-line bg-surface py-0.5 font-mono text-2xs text-fg-2">
                      {cause.rule}
                    </span>
                  )}
                  <span className={cause.is_majority ? 'text-fg-2' : 'font-medium text-risk-medium'}>
                    {cause.is_majority
                      ? 'Majority of the matched set — still a count, not a proven cause.'
                      : 'A plurality, not a majority — read it as the most frequent tag, not the cause.'}
                  </span>
                </div>
              </>
            ) : (
              <p className="mt-1.5 text-sm leading-relaxed text-fg-2">
                The matched cases share no single cause — no one Life Saving Rule accounts for enough of them to name one.
                Review the matches individually rather than assuming a common failure.
              </p>
            )}
          </div>

          {barrier && barrier.of > 0 && (
            <p className="flex items-center gap-1.5 text-xs text-fg-2">
              <ShieldOff size={13} aria-hidden="true" className="shrink-0 text-fg-3" />
              Barrier failure recorded in{' '}
              <strong className="font-semibold tabular-nums text-fg">
                {barrier.detected_in} of {barrier.of}
              </strong>{' '}
              matched cases
              {barrier.share != null && ` (${formatPct(barrier.share, 0)})`}.
            </p>
          )}
        </>
      )}

      {action && (action.corrective || action.preventive) && (
        <div className="relative overflow-hidden rounded-xl border border-brand-200 bg-gradient-to-br from-brand-50 via-brand-50 to-surface p-3.5 shadow-card transition-shadow duration-180 hover:shadow-card-hover">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-brand-500/10 blur-2xl"
          />
          <p className="relative eyebrow flex flex-wrap items-center gap-1.5 text-brand-700">
            What the corpus says to do
            {action.rule && <span className="font-mono text-2xs font-normal normal-case text-brand-500">{action.rule}</span>}
          </p>
          {action.corrective && (
            <p className="relative mt-1.5 text-sm leading-relaxed text-fg-2">
              <span className="font-semibold text-fg">Corrective: </span>
              {action.corrective}
            </p>
          )}
          {action.preventive && (
            <p className="relative mt-1.5 text-sm leading-relaxed text-fg-2">
              <span className="font-semibold text-fg">Preventive: </span>
              {action.preventive}
            </p>
          )}
        </div>
      )}

      {hasPrecedent && (
        <div>
          <p className="eyebrow mb-2">Matched cases ({matches.length})</p>
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {matches.map((m, i) => (
              <li key={`${m.report_id}-${i}`}>
                <Link
                  to={`/incidents/${encodeURIComponent(m.report_id)}`}
                  className="flex items-start justify-between gap-3 p-3.5 transition-colors duration-180 ease-out-standard hover:bg-surface-2"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-mono text-2xs text-fg-3">{m.report_id}</span>
                      {m.is_fatal && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-risk-critical-solid px-1.5 py-0.5 text-2xs font-semibold uppercase tracking-[0.06em] text-white shadow-[0_2px_8px_-2px_rgb(var(--color-risk-critical-solid)/0.5)]">
                          <Skull size={10} aria-hidden="true" />
                          Fatal
                        </span>
                      )}
                      {m.risk_band && <RiskBadge band={m.risk_band} size="sm" />}
                      {m.site && <span className="text-xs text-fg-3">{m.site}</span>}
                      {m.reported_on && <span className="text-xs tabular-nums text-fg-3">· {formatDate(m.reported_on)}</span>}
                      {m.barrier_failure && (
                        <span className="rounded-full border border-line px-1.5 py-0.5 text-2xs uppercase tracking-[0.06em] text-fg-2">
                          barrier failed
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 text-sm leading-relaxed text-fg-2">{truncate(m.narrative, 190)}</p>
                    {m.rules?.length > 0 && (
                      <p className="mt-1.5 font-mono text-2xs uppercase tracking-[0.06em] text-fg-3">
                        {m.rules.join(' · ')}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold tabular-nums text-brand-700 ring-1 ring-inset ring-brand-200/70">
                    {formatPct(m.similarity, 0)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {pattern && (
        <div className="card p-3.5">
          <p className="eyebrow">Assigned recurring pattern</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-2">
            <Link
              to={`/memory?pattern=${encodeURIComponent(pattern.pattern_id)}`}
              className="font-display text-sm font-bold tracking-tight text-brand-700 underline-offset-2 hover:underline"
            >
              {pattern.label}
            </Link>
            <span className="text-xs tabular-nums text-fg-2">{formatNumber(pattern.size)} reports in cluster</span>
            {pattern.fatal_count > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-risk-critical-bg px-2 py-0.5 text-xs font-semibold tabular-nums text-risk-critical">
                <Skull size={11} aria-hidden="true" />
                {formatNumber(pattern.fatal_count)} fatal
              </span>
            )}
            {pattern.assignment_similarity != null && (
              <span className="text-xs tabular-nums text-fg-3">
                assignment similarity {formatPct(pattern.assignment_similarity, 0)}
              </span>
            )}
          </div>
          <p className="mt-2 text-2xs leading-relaxed text-fg-3">
            Pattern labels are generated from cluster top-terms — descriptive, not an official hazard taxonomy.
            {!hasPrecedent &&
              ' With no matched cases, this is simply the nearest cluster centroid — a weak label rather than evidence.'}
          </p>
        </div>
      )}
    </div>
  )
}