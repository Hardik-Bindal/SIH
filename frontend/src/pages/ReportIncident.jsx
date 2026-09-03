import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, Loader2, Sparkles, AlertTriangle, ShieldCheck, FlaskConical } from 'lucide-react'
import { useSubmitIncident } from '../api/queries'

/* ── Demo scenarios for SIH presentation ──────────────────────────────── */
const DEMO_SCENARIOS = [
  {
    label: 'Confined Space',
    risk: 'CRITICAL',
    narrative: 'Worker entered a confined vessel at Rig-07 Duliajan to perform internal cleaning. Atmospheric testing was not completed prior to entry. The standby attendant was absent from the entry point. Gas detector was not available at the work site. The entry permit had expired the previous day and was not renewed. Approximately 15 minutes after entry, the worker reported dizziness and difficulty breathing. The rescue team was not immediately available as they had not been briefed on the confined space entry operation.',
  },
  {
    label: 'Work at Height',
    risk: 'HIGH',
    narrative: 'During routine maintenance on the derrick platform at Rig-12 Moran, a rigger was working at 18 meters height to replace a crown block sheave. The worker was not wearing a safety harness and there was no safety net or fall arrest system in place. The scaffold platform had missing guardrails on the east side. A toolbox talk was not conducted before the task. Wind speed was above safe working limits but operations continued.',
  },
  {
    label: 'Energy Isolation',
    risk: 'HIGH',
    narrative: 'An electrician was replacing a motor starter at Refinery Block B when the circuit was accidentally energized by another crew member. Lockout tagout procedures were not followed. The isolation point was not verified before work commenced. No energy isolation tags were placed on the breaker. The permit to work did not specify the isolation requirements. The worker received an electrical shock and sustained burns to both hands.',
  },
  {
    label: 'Line of Fire',
    risk: 'MEDIUM',
    narrative: 'While a crane was lifting pipe sections at Pipeline Sector 4, a helper walked under the suspended load to retrieve a sling. No barricade was established around the lift zone. The signal person did not halt the operation when personnel entered the exclusion zone. The rigging plan was not communicated to all workers in the area.',
  },
  {
    label: 'Low-Risk Observation',
    risk: 'LOW',
    narrative: 'During a routine safety walkthrough at Central Warehouse, it was observed that several fire extinguisher inspection tags were overdue by two weeks. The warehouse housekeeping was generally good with clearly marked walkways. One emergency exit sign light was not functioning. All workers were wearing appropriate PPE.',
  },
]

const SITES = [
  "Rig-07 Duliajan",
  "Rig-12 Moran",
  "Rig-03 Kumchai",
  "Refinery Block A",
  "Refinery Block B",
  "Pipeline Sector 4",
  "Pipeline Sector 9",
  "Central Warehouse",
  "Field Workshop Duliajan"
]

const AREAS = ["RIG", "REFINERY", "PIPELINE", "WAREHOUSE", "WORKSHOP"]

const DEPARTMENTS = [
  "Electrical Maintenance",
  "Mechanical Maintenance",
  "Process Operations",
  "Civil & Structural",
  "Logistics & Materials",
  "HSE",
  "Drilling Operations"
]

export default function ReportIncident() {
  const navigate = useNavigate()
  const submitMutation = useSubmitIncident()

  const [narrative, setNarrative] = useState('')
  const [site, setSite] = useState('')
  const [area, setArea] = useState('')
  const [department, setDepartment] = useState('')
  const [errorMsg, setErrorMsg] = useState(null)

  function handleSubmit(e) {
    e.preventDefault()
    setErrorMsg(null)

    if (!narrative.trim()) {
      setErrorMsg('Narrative is required.')
      return
    }

    const payload = {
      narrative: narrative.trim(),
      site: site || undefined,
      area: area || undefined,
      department: department || undefined
    }

    submitMutation.mutate(payload, {
      onSuccess: (data) => {
        if (data && data.report_id) {
          navigate(`/incidents/${encodeURIComponent(data.report_id)}`)
        } else {
          setErrorMsg('Failed to fetch the created report ID.')
        }
      },
      onError: (err) => {
        setErrorMsg(err?.message || 'An error occurred during submission.')
      }
    })
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Premium Header */}
      <section className="card-premium relative overflow-hidden border-brand-200 bg-gradient-to-br from-brand-50/50 via-surface to-surface p-6 shadow-sm">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-brand-400/10 blur-3xl"
        />
        <div className="relative flex items-start gap-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-glow">
            <Sparkles size={18} aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-display text-lg font-bold tracking-tight text-fg">Submit Live Safety Narrative</h2>
            <p className="mt-1 text-xs leading-relaxed text-fg-2">
              Type or paste a raw safety observation narrative. The AI Intelligence pipeline will automatically clean the text, score its Serious Injury &amp; Fatality (SIF) potential, tag Life Saving Rule violations, extract entities, construct its Fatality Twin counterfactual, and generate corrective and preventive actions.
            </p>
          </div>
        </div>
      </section>

      {/* Demo Scenarios */}
      <section className="card overflow-hidden bg-gradient-to-br from-surface to-surface-2/10">
        <div className="card-header">
          <div className="flex items-center gap-2">
            <FlaskConical size={15} className="text-brand-500" />
            <h3 className="card-title text-fg font-bold text-sm">Demo Scenarios</h3>
            <span className="rounded-full bg-brand-500/10 px-2 py-0.5 text-2xs font-bold text-brand-400">SIH Demo</span>
          </div>
          <p className="text-xs text-fg-3">Select a scenario to populate the narrative. Submitted through the real AI pipeline.</p>
        </div>
        <div className="flex flex-wrap gap-2 p-4">
          {DEMO_SCENARIOS.map((s) => {
            const riskColors = {
              CRITICAL: 'border-red-500/30 bg-red-500/5 text-red-400 hover:bg-red-500/10',
              HIGH: 'border-orange-500/30 bg-orange-500/5 text-orange-400 hover:bg-orange-500/10',
              MEDIUM: 'border-yellow-500/30 bg-yellow-500/5 text-yellow-400 hover:bg-yellow-500/10',
              LOW: 'border-green-500/30 bg-green-500/5 text-green-400 hover:bg-green-500/10',
            }
            return (
              <button
                key={s.label}
                type="button"
                onClick={() => setNarrative(s.narrative)}
                className={`rounded-lg border px-3 py-2 text-xs font-bold transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${riskColors[s.risk] || riskColors.MEDIUM}`}
              >
                {s.label}
                <span className="ml-1.5 text-2xs opacity-70">{s.risk}</span>
              </button>
            )
          })}
        </div>
      </section>

      {/* Main Form */}
      <form onSubmit={handleSubmit} className="card p-6 space-y-6 bg-surface shadow-sm">
        {errorMsg && (
          <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50/50 p-3.5 text-xs text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400">
            <AlertTriangle size={15} className="mt-0.5 shrink-0 text-red-500" aria-hidden="true" />
            <div>
              <p className="font-semibold">Submission Error</p>
              <p className="mt-0.5">{errorMsg}</p>
            </div>
          </div>
        )}

        {/* Narrative Textarea */}
        <div className="space-y-2">
          <label htmlFor="narrative" className="block text-xs font-bold uppercase tracking-wider text-fg-2">
            Incident Narrative <span className="text-red-500">*</span>
          </label>
          <textarea
            id="narrative"
            rows={6}
            required
            value={narrative}
            onChange={(e) => setNarrative(e.target.value)}
            placeholder="Describe what happened. Be specific about hazards, equipment, and conditions (e.g., 'Worker was adjusting a conveyor belt guide rail while the machine was running; hand was caught in pinch point. LOTO was bypassed...')"
            className="input w-full resize-y text-sm px-3.5 py-2.5 min-h-[140px] focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>

        {/* Optional Metadata Grid */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <label htmlFor="site" className="block text-xs font-bold uppercase tracking-wider text-fg-2">
              Site Location
            </label>
            <select
              id="site"
              value={site}
              onChange={(e) => setSite(e.target.value)}
              className="input w-full text-xs font-semibold text-fg-2 cursor-pointer h-9 px-2.5 focus:outline-none"
            >
              <option value="">Auto-Detect by AI</option>
              {SITES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label htmlFor="area" className="block text-xs font-bold uppercase tracking-wider text-fg-2">
              Operational Area
            </label>
            <select
              id="area"
              value={area}
              onChange={(e) => setArea(e.target.value)}
              className="input w-full text-xs font-semibold text-fg-2 cursor-pointer h-9 px-2.5 focus:outline-none"
            >
              <option value="">Auto-Detect by AI</option>
              {AREAS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label htmlFor="department" className="block text-xs font-bold uppercase tracking-wider text-fg-2">
              Department
            </label>
            <select
              id="department"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="input w-full text-xs font-semibold text-fg-2 cursor-pointer h-9 px-2.5 focus:outline-none"
            >
              <option value="">Auto-Detect by AI</option>
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Info panel on Auto-Detect */}
        <div className="flex items-start gap-2.5 rounded-lg border border-brand-100 bg-brand-50/20 px-3.5 py-3 text-2xs leading-relaxed text-fg-3">
          <ShieldCheck size={14} className="mt-0.5 shrink-0 text-brand-500" aria-hidden="true" />
          <p>
            Leaving metadata options as <strong>&quot;Auto-Detect by AI&quot;</strong> leverages the pipeline&apos;s deterministic classification &amp; gazetteer entity ruler to map sites, areas, and departments based on textual hints in the narrative.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => navigate('/incidents')}
            className="btn-secondary px-4 py-2 text-xs"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitMutation.isPending}
            className="btn-primary min-w-[140px] px-4 py-2 text-xs shadow-md font-bold"
          >
            {submitMutation.isPending ? (
              <>
                <Loader2 size={13} className="animate-spin" aria-hidden="true" />
                Analyzing...
              </>
            ) : (
              <>
                <FileText size={13} aria-hidden="true" />
                Submit Narrative
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
