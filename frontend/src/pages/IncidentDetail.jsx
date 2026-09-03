import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, ShieldOff, ShieldAlert, GitBranch, FileDown, Loader2, Database, FlaskConical } from 'lucide-react'
import { useIncident, useIncidentMemory } from '../api/queries'
import AsyncSection from '../components/common/AsyncSection'
import { SkeletonBlock, SkeletonText } from '../components/common/Skeleton'
import SyntheticBadge from '../components/common/SyntheticBadge'
import RiskGauge from '../components/incident/RiskGauge'
import ExplanationPanel from '../components/incident/ExplanationPanel'
import RiskFusionBar from '../components/diagrams/RiskFusionBar'
import LsrMapping from '../components/incident/LsrMapping'
import EntityTags from '../components/incident/EntityTags'
import FatalityTwinChain from '../components/incident/FatalityTwinChain'
import CapaPanel from '../components/incident/CapaPanel'
import SafetyMemoryPanel from '../components/memory/SafetyMemoryPanel'
import EmptyState from '../components/common/EmptyState'
import { BrainCircuit } from 'lucide-react'
import { formatDate, truncate } from '../lib/format'
import { generateIncidentPdf } from '../lib/generateIncidentPdf'

// Its own AsyncSection (and therefore its own error boundary): a Safety
// Memory outage names itself and leaves the rest of the analysis intact
// (SRS 14.5).
function SafetyMemorySection({ reportId }) {
  const memoryQuery = useIncidentMemory(reportId)
  return (
    <AsyncSection
      query={memoryQuery}
      componentName="Safety Memory"
      skeleton={
        <div className="space-y-3">
          <SkeletonBlock className="h-16 w-full" />
          <SkeletonBlock className="h-14 w-full" />
          <SkeletonText lines={4} />
        </div>
      }
      isEmpty={(data) => !data}
      empty={
        <EmptyState
          icon={BrainCircuit}
          title="No recall returned"
          message="The Safety Memory service returned no recall object for this report."
        />
      }
    >
      {(recall) => <SafetyMemoryPanel recall={recall} />}
    </AsyncSection>
  )
}

function Section({ title, description, children, className = '' }) {
  return (
    <section className={`card ${className}`}>
      <div className="card-header">
        <div className="min-w-0">
          <h2 className="card-title text-fg">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-fg-2">{description}</p>}
        </div>
      </div>
      <div className="p-4">{children}</div>
    </section>
  )
}

function FactTile({ icon: Icon, label, value, accent = 'text-fg' }) {
  return (
    <div className="min-w-[9rem] flex-1 rounded-lg border border-line bg-surface-2 px-3.5 py-3">
      <span className="eyebrow flex items-center gap-1.5">
        {Icon && <Icon size={12} aria-hidden="true" />}
        {label}
      </span>
      <p className={`mt-1 font-display text-sm font-bold tracking-tight ${accent}`}>{value}</p>
    </div>
  )
}

export default function IncidentDetail() {
  const { id } = useParams()
  const query = useIncident(id)
  const [pdfLoading, setPdfLoading] = useState(false)

  async function handleDownloadPdf(analysis) {
    setPdfLoading(true)
    try {
      await generateIncidentPdf(analysis)
    } finally {
      setPdfLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="min-w-0 space-y-6">
        <Link
          to="/incidents"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-fg-2 transition-colors duration-180 hover:text-brand-700"
        >
          <ArrowLeft size={15} aria-hidden="true" /> Back to Incident Explorer
        </Link>

        <AsyncSection
          query={query}
          componentName="Incident detail"
          skeleton={
            <div className="space-y-4">
              <SkeletonBlock className="h-40 w-full" />
              <SkeletonText lines={4} />
            </div>
          }
        >
          {(analysis) => (
            <>
              <section className="card overflow-hidden">
                <div className="flex flex-col gap-6 p-5 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-fg-3">{analysis.report_id}</span>
                      {analysis.is_synthetic_org_fields && <SyntheticBadge label="Synthetic org fields" />}
                      {/* Data provenance badge */}
                      {analysis.report_id?.startsWith('LIVE') ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-2xs font-bold text-green-400 ring-1 ring-green-500/20">
                          <Database size={9} /> Live Submission
                        </span>
                      ) : analysis.source_type === 'FATALITY' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-2xs font-bold text-red-400 ring-1 ring-red-500/20">
                          <ShieldAlert size={9} /> Historical Fatality (OSHA)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-2xs font-bold text-blue-400 ring-1 ring-blue-500/20">
                          <Database size={9} /> OSHA Public Data
                        </span>
                      )}
                      <button
                        type="button"
                        id={`btn-download-pdf-${analysis.report_id}`}
                        onClick={() => handleDownloadPdf(analysis)}
                        disabled={pdfLoading}
                        title="Download incident report as PDF"
                        className="ml-1 inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-2.5 py-1 text-xs font-semibold text-fg-2 transition-all hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 disabled:opacity-60"
                      >
                        {pdfLoading
                          ? <Loader2 size={12} className="animate-spin" aria-hidden="true" />
                          : <FileDown size={12} aria-hidden="true" />}
                        {pdfLoading ? 'Generating…' : 'Download PDF'}
                      </button>
                    </div>
                    <p className="mt-2 max-w-2xl font-display text-sm font-semibold leading-relaxed tracking-tight text-fg sm:text-base">
                      {analysis.narrative}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs text-fg-2">
                      {[analysis.site, analysis.area, analysis.department, analysis.activity]
                        .filter(Boolean)
                        .map((v, i) => (
                          <span key={`${v}-${i}`} className="chip py-0.5 text-2xs">
                            {v}
                          </span>
                        ))}
                    </div>
                    {analysis.reported_on && (
                      <p className="mt-2.5 text-xs text-fg-3">Reported {formatDate(analysis.reported_on)}</p>
                    )}
                    {analysis.model_version && (
                      <p className="mt-1 font-mono text-2xs text-fg-3">
                        model {analysis.model_version}
                        {analysis.input_hash ? ` · hash ${analysis.input_hash.slice(0, 10)}…` : ''}
                        {analysis.model_sif_probability !== undefined && analysis.model_sif_probability !== analysis.final_sif_probability && (
                          <> · raw p(SIF) {(analysis.model_sif_probability * 100).toFixed(1)}%</>
                        )}
                      </p>
                    )}
                    {analysis.risk_adjustment === 'DOWNWARD' && (
                      <div className="mt-2.5 flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2">
                        <span className="mt-0.5 text-sm leading-none text-amber-400">⚡</span>
                        <p className="text-2xs leading-relaxed text-amber-300/90">
                          <span className="font-bold">Confidence adjusted.</span>{' '}
                          {analysis.risk_adjustment_reason}
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="shrink-0 self-center sm:self-start">
                    <RiskGauge
                      probability={analysis.sif_probability}
                      band={analysis.risk_band}
                      confidence={analysis.confidence}
                    />
                  </div>
                </div>

                {(analysis.barrier_failure || analysis.root_cause) && (
                  <div className="flex flex-wrap gap-3 border-t border-line bg-surface-2 p-4">
                    <FactTile
                      icon={ShieldOff}
                      label="Barrier failure"
                      value={analysis.barrier_failure ? 'Yes' : 'No'}
                      accent={analysis.barrier_failure ? 'text-risk-critical' : 'text-risk-low'}
                    />
                    {analysis.root_cause && (
                      <FactTile
                        icon={GitBranch}
                        label="Primary contributing factor"
                        value={analysis.root_cause.replaceAll('_', ' ')}
                      />
                    )}
                    {analysis.failed_controls?.length > 0 && (
                      <div className="min-w-[9rem] flex-1 rounded-lg border border-line bg-surface-2 px-3.5 py-3">
                        <span className="eyebrow flex items-center gap-1.5">
                          <ShieldOff size={12} aria-hidden="true" />
                          Failed controls detected
                        </span>
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {analysis.failed_controls.map((c) => (
                            <span key={c} className="rounded-md bg-red-500/10 px-2 py-0.5 text-2xs font-bold text-red-400 ring-1 ring-red-500/20">
                              {c}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </section>

              <Section title="Why is this dangerous?">
                {/* Two complementary answers: fusion bar shows which *component*
                    drove the band, attribution panel shows which *words* drove
                    the model score. */}
                <div className="space-y-5">
                  <RiskFusionBar analysis={analysis} />
                  <div className="border-t border-line pt-5">
                    <p className="eyebrow mb-2.5">Terms the model weighted most</p>
                    <ExplanationPanel explanation={analysis.explanation} />
                  </div>
                </div>
              </Section>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <Section title="Which Life Saving Rules apply?">
                  <LsrMapping lsrTags={analysis.lsr_tags} />
                </Section>
                <Section title="Extracted entities">
                  <EntityTags entities={analysis.entities} />
                </Section>
              </div>

              <Section title="Fatality Twin — what could this escalate to?">
                <p className="mb-3 text-2xs text-fg-3 font-medium italic">
                  ⚠ Potential escalation scenario based on similar historical fatalities. This is a model projection, not a prediction.
                </p>
                <FatalityTwinChain twin={analysis.fatality_twin} />
              </Section>

              <Section title="Safety Memory — has this happened before?">
                <SafetyMemorySection reportId={analysis.report_id} />
              </Section>

              {analysis.similar_fatalities?.length > 0 && (
                <section className="card overflow-hidden">
                  <div className="card-header">
                    <h2 className="card-title text-fg">Matched fatal cases</h2>
                    <span className="text-xs tabular-nums text-fg-3">
                      {analysis.similar_fatalities.length} cases
                    </span>
                  </div>
                  <ul className="divide-y divide-line">
                    {analysis.similar_fatalities.map((f) => (
                      <li key={f.report_id}>
                        <Link
                          to={`/incidents/${encodeURIComponent(f.report_id)}`}
                          className="flex items-start justify-between gap-4 p-4 transition-colors duration-180 ease-out-standard hover:bg-surface-2"
                        >
                          <div className="min-w-0">
                            <span className="font-mono text-xs text-fg-3">{f.report_id}</span>
                            <p className="mt-1 text-sm leading-relaxed text-fg-2">{truncate(f.narrative, 140)}</p>
                          </div>
                          <span className="shrink-0 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold tabular-nums text-brand-700 ring-1 ring-inset ring-brand-200/70">
                            {(f.similarity * 100).toFixed(0)}%
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <Section title="Recommended CAPA — what should we do?">
                <CapaPanel
                  reportId={analysis.report_id}
                  recommendations={analysis.recommendations}
                  onExport={() => handleDownloadPdf(analysis)}
                />
              </Section>
            </>
          )}
        </AsyncSection>
      </div>
    </div>
  )
}
