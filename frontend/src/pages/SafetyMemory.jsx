import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { BrainCircuit, History, Search, Layers } from 'lucide-react'
import { useMemoryRecall, useMemoryPatterns, useMemoryPattern } from '../api/queries'
import AsyncSection from '../components/common/AsyncSection'
import SectionErrorBoundary from '../components/common/SectionErrorBoundary'
import ErrorState from '../components/common/ErrorState'
import EmptyState from '../components/common/EmptyState'
import { SkeletonBlock, SkeletonText } from '../components/common/Skeleton'
import SyntheticBadge from '../components/common/SyntheticBadge'
import SafetyMemoryPanel from '../components/memory/SafetyMemoryPanel'
import PatternCard from '../components/memory/PatternCard'
import { severityBaseline } from '../lib/patternSeverity'
import { formatNumber } from '../lib/format'

const PATTERN_LIMIT = 20
const EXAMPLE_NARRATIVE =
  'Worker touched energized cable while replacing a junction box; isolation was assumed but never physically verified.'
const MIN_NARRATIVE_LENGTH = 10

function RecallBox() {
  const [narrative, setNarrative] = useState('')
  const recall = useMemoryRecall()
  const textareaId = useId()
  const trimmed = narrative.trim()
  const tooShort = trimmed.length > 0 && trimmed.length < MIN_NARRATIVE_LENGTH

  function submit(e) {
    e.preventDefault()
    if (trimmed.length < MIN_NARRATIVE_LENGTH || recall.isPending) return
    recall.mutate({ narrative: trimmed, top_k: 8 })
  }

  return (
    <section className="card-premium relative overflow-hidden border-brand-200/60 p-5 bg-gradient-to-br from-surface to-surface-2/20">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full bg-brand-500/10 blur-3xl animate-pulse-soft"
      />
      <div className="relative flex items-start gap-3.5 animate-fade-up">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-glow">
          <BrainCircuit size={17} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-base font-extrabold tracking-tight text-fg">Ask safety memory</h2>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-fg-2 font-medium">
            Paste the narrative you are about to report. Every one of the 16k historical records is checked before it is
            filed, so the fourth occurrence is never reviewed as if it were the first.
          </p>
        </div>
      </div>

      <form onSubmit={submit} className="relative mt-4 animate-fade-up" style={{ animationDelay: '60ms' }}>
        <label className="sr-only" htmlFor={textareaId}>
          Incident narrative to check against the corpus
        </label>
        <textarea
          id={textareaId}
          value={narrative}
          onChange={(e) => setNarrative(e.target.value)}
          rows={4}
          placeholder="e.g. Worker entered a tank to clean sludge without a gas test; standby man had left the area."
          className="input resize-y leading-relaxed focus:ring-brand-500/10 border-line shadow-sm"
        />
        <div className="mt-3.5 flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={recall.isPending || trimmed.length < MIN_NARRATIVE_LENGTH}
            className="btn-primary px-5 shadow-md"
          >
            <Search size={15} aria-hidden="true" />
            {recall.isPending ? 'Checking corpus…' : 'Check safety memory'}
          </button>
          <button type="button" onClick={() => setNarrative(EXAMPLE_NARRATIVE)} className="btn-secondary h-9 px-4 text-xs font-semibold shadow-sm">
            Use an example narrative
          </button>
          {tooShort && (
            <span className="text-xs font-bold text-risk-medium animate-pulse-soft">
              Add at least {MIN_NARRATIVE_LENGTH} characters — the corpus check needs a sentence to work with.
            </span>
          )}
          {!tooShort && recall.isSuccess && (
            <span className="text-xs tabular-nums text-fg-3 font-semibold bg-surface px-2.5 py-1 rounded-md border border-line">
              {formatNumber(recall.data?.match_count ?? 0)} match(es) returned
            </span>
          )}
        </div>
      </form>

      <div className="relative mt-5">
        <SectionErrorBoundary componentName="Safety Memory recall">
          {recall.isPending && (
            <div className="space-y-3">
              <SkeletonBlock className="h-16 w-full" />
              <SkeletonBlock className="h-14 w-full" />
              <SkeletonText lines={4} />
            </div>
          )}
          {recall.isError && (
            <ErrorState
              componentName="Safety Memory recall"
              error={recall.error}
              onRetry={() => recall.mutate({ narrative: trimmed, top_k: 8 })}
            />
          )}
          {recall.isSuccess && <SafetyMemoryPanel recall={recall.data} />}
          {recall.isIdle && (
            <EmptyState
              icon={BrainCircuit}
              title="Nothing checked yet"
              message="Paste or type a narrative above and the corpus recall — verdict, matched cases, common cause and the recurring pattern it belongs to — appears here."
            />
          )}
        </SectionErrorBoundary>
      </div>
    </section>
  )
}

export default function SafetyMemory() {
  const [searchParams, setSearchParams] = useSearchParams()
  const deepLinked = searchParams.get('pattern')
  const deepLinkedId = deepLinked === null || deepLinked === '' ? null : Number(deepLinked)
  const expandedId = deepLinkedId
  const scrolledFor = useRef(null)

  const patternsQuery = useMemoryPatterns({ limit: PATTERN_LIMIT })
  const patterns = useMemo(() => patternsQuery.data?.patterns || [], [patternsQuery.data])

  const isDeepLinkedInList =
    deepLinkedId === null || Number.isNaN(deepLinkedId)
      ? true
      : patterns.some((p) => p.pattern_id === deepLinkedId)
  const singlePatternQuery = useMemoryPattern(
    !isDeepLinkedInList && patternsQuery.isSuccess ? deepLinkedId : undefined
  )

  useEffect(() => {
    if (deepLinkedId === null || Number.isNaN(deepLinkedId)) return
    if (scrolledFor.current === deepLinkedId) return
    const el = document.getElementById(`pattern-${deepLinkedId}`)
    if (!el) return
    scrolledFor.current = deepLinkedId
    el.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'start',
    })
  }, [deepLinkedId, patterns, singlePatternQuery.data])

  function toggle(id) {
    const next = expandedId === id ? null : id
    const params = new URLSearchParams(searchParams)
    if (next === null) params.delete('pattern')
    else params.set('pattern', String(next))
    setSearchParams(params, { replace: true })
  }

  const extraPattern = !isDeepLinkedInList ? singlePatternQuery.data : null

  return (
    <div className="space-y-6">
      <RecallBox />

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-surface-2 text-fg-2 border border-line shadow-sm">
              <History size={17} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 className="font-display text-base font-bold tracking-tight text-fg">
                Recurring patterns across the whole corpus
              </h2>
              <p className="mt-1 max-w-3xl text-sm leading-relaxed text-fg-2">
                Reports that keep happening as the same event, ranked most-severe first. This corpus is mostly
                fatality records, so fatal-dominance is the norm — the bar on each card is scaled to its fatal count,
                and a badge appears only where a cluster breaks from that norm.
              </p>
            </div>
          </div>
          {patternsQuery.data && (
            <p className="flex flex-wrap items-center gap-2 text-xs text-fg-3">
              <Layers size={13} aria-hidden="true" className="text-brand-500" />
              <span className="tabular-nums font-semibold">
                {formatNumber(patternsQuery.data.n_clusters)} patterns over{' '}
                {formatNumber(patternsQuery.data.corpus_size)} reports
              </span>
              <SyntheticBadge label="Derived clusters" title={patternsQuery.data.method} />
            </p>
          )}
        </div>

        {extraPattern && (
          <PatternCard
            key={`deep-${extraPattern.pattern_id}`}
            pattern={extraPattern}
            rank={null}
            expanded={expandedId === extraPattern.pattern_id}
            onToggle={() => toggle(extraPattern.pattern_id)}
            panelId={`pattern-panel-${extraPattern.pattern_id}`}
          />
        )}

        <AsyncSection
          query={patternsQuery}
          componentName="Recurring patterns"
          skeleton={
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <SkeletonBlock key={i} className="h-28 w-full" />
              ))}
            </div>
          }
          isEmpty={(data) => !data || !data.available || (data.patterns || []).length === 0}
          empty={
            <EmptyState
              icon={History}
              title="No recurring patterns available"
              message="Pattern clustering runs over the scored corpus. Once the clustering artifact is built, the recurring patterns nobody spotted individually appear here, ranked by severity."
            />
          }
        >
          {(data) => {
            const rows = data.patterns || []
            const maxFatalCount = Math.max(...rows.map((p) => p.fatal_count || 0), 1)
            const baselineKey = severityBaseline(rows)
            return (
              <div className="space-y-3">
                {rows.map((p, i) => (
                  <PatternCard
                    key={p.pattern_id}
                    pattern={p}
                    rank={i + 1}
                    maxFatalCount={maxFatalCount}
                    baselineKey={baselineKey}
                    expanded={expandedId === p.pattern_id}
                    onToggle={() => toggle(p.pattern_id)}
                    panelId={`pattern-panel-${p.pattern_id}`}
                  />
                ))}
                <p className="pt-1 text-2xs leading-relaxed text-fg-3 font-semibold">{data.method}</p>
              </div>
            )
          }}
        </AsyncSection>
      </section>
    </div>
  )
}