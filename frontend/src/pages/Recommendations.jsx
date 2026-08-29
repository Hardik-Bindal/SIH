import { useMemo, useState } from 'react'
import { FileDown, Loader2, ClipboardList, ListChecks, Sparkles } from 'lucide-react'
import { useIncidents, useGenerateRecommendations, useGenerateBulletin } from '../api/queries'
import { SkeletonTable, SkeletonText } from '../components/common/Skeleton'
import EmptyState from '../components/common/EmptyState'
import ErrorState from '../components/common/ErrorState'
import RiskBadge from '../components/common/RiskBadge'
import CapaPanel from '../components/incident/CapaPanel'
import { formatPct, truncate } from '../lib/format'

const PAGE_SIZE = 25

export default function Recommendations() {
  const criticalQuery = useIncidents({ risk_band: 'CRITICAL', page: 1, page_size: PAGE_SIZE })
  const highQuery = useIncidents({ risk_band: 'HIGH', page: 1, page_size: PAGE_SIZE })
  const [selectedId, setSelectedId] = useState(null)
  const recMutation = useGenerateRecommendations()
  const bulletinMutation = useGenerateBulletin()
  const [bulletinScope, setBulletinScope] = useState('daily')

  const queue = useMemo(() => {
    const critical = (criticalQuery.data?.items || []).map((i) => ({ ...i, _band: 'CRITICAL' }))
    const high = (highQuery.data?.items || []).map((i) => ({ ...i, _band: 'HIGH' }))
    return [...critical, ...high].sort((a, b) => b.sif_probability - a.sif_probability)
  }, [criticalQuery.data, highQuery.data])

  function selectIncident(id) {
    setSelectedId(id)
    recMutation.mutate(id)
  }

  async function handleBulletin() {
    bulletinMutation.mutate(
      { scope: bulletinScope },
      {
        onSuccess: (blob) => {
          const url = URL.createObjectURL(blob)
          window.open(url, '_blank', 'noopener,noreferrer')
          setTimeout(() => URL.revokeObjectURL(url), 30_000)
        },
      }
    )
  }

  const isLoadingQueue = criticalQuery.isPending || highQuery.isPending
  const queueError = criticalQuery.error || highQuery.error

  return (
    <div className="space-y-6">
      <section className="card-premium relative overflow-hidden border-brand-200 bg-gradient-to-br from-brand-50/50 via-surface to-surface p-5">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-brand-400/10 blur-3xl"
        />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-glow">
              <Sparkles size={17} aria-hidden="true" />
            </span>
            <div>
              <h2 className="font-display text-base font-bold tracking-tight text-fg">Automated safety bulletin</h2>
              <p className="mt-0.5 max-w-xl text-xs leading-relaxed text-fg-2">
                Generates a print-ready PDF from the backend — detailing current top risks, LSR breakdowns and the highest-priority corrective actions.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <label className="sr-only" htmlFor="bulletin-scope">
              Bulletin scope
            </label>
            <select
              id="bulletin-scope"
              value={bulletinScope}
              onChange={(e) => setBulletinScope(e.target.value)}
              className="h-9 rounded-lg border border-line bg-surface px-2.5 text-xs font-semibold text-fg-2 transition-all focus:outline-none"
            >
              <option value="daily">Daily report</option>
              <option value="weekly">Weekly digest</option>
              <option value="executive">Executive summary</option>
            </select>
            <button
              type="button"
              onClick={handleBulletin}
              disabled={bulletinMutation.isPending}
              className="btn-primary px-4 py-2 text-xs shadow-md"
            >
              {bulletinMutation.isPending ? (
                <Loader2 size={14} className="animate-spin" aria-hidden="true" />
              ) : (
                <FileDown size={14} aria-hidden="true" />
              )}
              Generate PDF
            </button>
          </div>
        </div>
      </section>
      {bulletinMutation.isError && (
        <ErrorState componentName="Bulletin generator" error={bulletinMutation.error} onRetry={handleBulletin} />
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <section className="card flex flex-col self-start overflow-hidden bg-gradient-to-br from-surface to-surface-2/10">
          <div className="card-header bg-gradient-to-r from-surface to-surface-2/10">
            <div className="flex items-center gap-2">
              <ListChecks size={15} className="text-brand-500 animate-pulse-soft" aria-hidden="true" />
              <h2 className="card-title text-fg font-bold">CAPA queue — CRITICAL &amp; HIGH</h2>
            </div>
            {!isLoadingQueue && !queueError && queue.length > 0 && (
              <span className="chip shrink-0 tabular-nums border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-500/20 dark:bg-brand-500/10 dark:text-brand-300 font-bold">{queue.length}</span>
            )}
          </div>
          {isLoadingQueue ? (
            <SkeletonTable rows={8} cols={3} />
          ) : queueError ? (
            <div className="p-4">
              <ErrorState
                componentName="CAPA queue"
                error={queueError}
                onRetry={() => {
                  criticalQuery.refetch()
                  highQuery.refetch()
                }}
              />
            </div>
          ) : queue.length === 0 ? (
            <div className="p-4">
              <EmptyState title="Queue is empty" message="No CRITICAL or HIGH risk-band reports are outstanding right now." />
            </div>
          ) : (
            <ul className="scrollbar-slim max-h-[560px] divide-y divide-line overflow-y-auto">
              {queue.map((inc) => {
                const isSelected = selectedId === inc.report_id
                return (
                  <li key={inc.report_id}>
                    <button
                      type="button"
                      onClick={() => selectIncident(inc.report_id)}
                      aria-current={isSelected ? 'true' : undefined}
                      className={`relative block w-full px-4 py-3.5 text-left transition-colors duration-180 ease-out-standard
                        ${isSelected ? 'bg-brand-50/50 dark:bg-brand-500/5' : 'hover:bg-surface-2/40'}`}
                    >
                      {isSelected && (
                        <span aria-hidden="true" className="absolute inset-y-0 left-0 w-0.5 bg-brand-500" />
                      )}
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-2xs text-fg-3 font-semibold">{inc.report_id}</span>
                        <RiskBadge band={inc.risk_band} size="sm" />
                      </div>
                      <p className="mt-1.5 truncate text-sm font-bold text-fg">{truncate(inc.narrative, 100)}</p>
                      <p className="mt-1 text-xs text-fg-3 font-medium">
                        {inc.site} · <span className="tabular-nums font-semibold text-fg-2">{formatPct(inc.sif_probability)}</span> SIF probability
                      </p>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <section className="card overflow-hidden">
          <div className="card-header bg-gradient-to-r from-surface to-surface-2/10">
            <div className="flex min-w-0 items-center gap-2">
              <ClipboardList size={15} className="shrink-0 text-brand-500 animate-pulse-soft" aria-hidden="true" />
              <h2 className="card-title text-fg font-bold">Generated CAPA</h2>
            </div>
            {selectedId && <span className="shrink-0 font-mono text-2xs text-fg-3 font-semibold bg-surface-2/80 px-2 py-0.5 rounded-md border border-line">{selectedId}</span>}
          </div>
          <div className="p-4">
            {!selectedId && (
              <EmptyState
                icon={ClipboardList}
                title="Select a report"
                message="Choose a CRITICAL or HIGH report from the queue to generate its corrective action plan and toolbox talk."
              />
            )}
            {selectedId && recMutation.isPending && <SkeletonText lines={6} />}
            {selectedId && recMutation.isError && (
              <ErrorState componentName="CAPA generation" error={recMutation.error} onRetry={() => recMutation.mutate(selectedId)} />
            )}
            {selectedId && recMutation.isSuccess && <CapaPanel reportId={selectedId} recommendations={recMutation.data} />}
          </div>
        </section>
      </div>
    </div>
  )
}