# API Contract — KAVACH AI Backend

Source of truth for both the FastAPI backend and the React frontend so they
can be built in parallel (SRS §19.1: "Interface runs parallel from day 5
against mocked contracts"). Base URL: `http://localhost:8000`. All responses
are JSON unless noted. See SRS §15 for the full endpoint table this
implements a working subset of (all `Must`-priority rows, plus the
`Should`-priority rows needed for the ten dashboard pages in §13).

Every endpoint that returns model output includes `model_version` and,
where a report is scored fresh, `input_hash` (NFR-11 auditability). Every
row derived from synthesised organisational metadata carries
`is_synthetic_org_fields: true`; forecast responses carry
`is_synthetic_timeline: true`. See `docs/DEVIATIONS.md`.

## Health

`GET /api/v1/health` → `{ "status": "ok", "models_loaded": true, "corpus_size": 16252, "model_version": "sif-sentinel-v1.0-tfidf-xgb" }`

## Incidents

`POST /api/v1/incidents` — submit one report for live analysis.
Request:
```json
{ "narrative": "string, required", "site": "string, optional", "area": "RIG|REFINERY|PIPELINE|WAREHOUSE|WORKSHOP, optional", "department": "string, optional" }
```
Response: full `AIAnalysis` object (see below), persisted, `report_id` starts with `LIVE-`.

`GET /api/v1/incidents?site=&area=&department=&risk_band=&date_from=&date_to=&q=&page=&page_size=` — paginated, filtered list.
Response: `{ "items": [IncidentSummary...], "total": int, "page": int, "page_size": int }`
`IncidentSummary`: `{ report_id, narrative (truncated 200 chars), site, area, department, activity, risk_band, sif_probability, reported_on, report_type }`

`GET /api/v1/incidents/{id}` → full `AIAnalysis` object for one report (404 if not found).

`GET /api/v1/incidents/{id}/similar?top_k=10&type=FATALITY|INCIDENT` → `{ "matches": [{ report_id, source_type, site, area, narrative, similarity }] }`

## Search

`POST /api/v1/search/semantic`
Request: `{ "query": "string", "top_k": 10, "source_type": "INCIDENT|FATALITY|null", "site": "optional", "area": "optional" }`
Response: `{ "results": [{ report_id, source_type, site, area, narrative, similarity }] }`

## Analytics (pre-computed, refreshed on write — SRS §6.5)

`GET /api/v1/analytics/sites` → `[{ site, report_count, avg_sif_probability, critical_count, high_count, composite_risk_index }]` sorted desc by `composite_risk_index`.
`GET /api/v1/analytics/areas` → same shape, keyed by `area`.
`GET /api/v1/analytics/activities` → same shape, keyed by `activity`.
`GET /api/v1/analytics/departments` → same shape, keyed by `department`.
`GET /api/v1/analytics/lsr` → `[{ rule, count, avg_score }]`.
`GET /api/v1/analytics/kpis` → `{ total_reports, critical_pct, high_or_above_pct, avg_sif_probability, risk_band_distribution: {LOW,MEDIUM,HIGH,CRITICAL} }`
`GET /api/v1/analytics/heatmap` → GeoJSON `FeatureCollection`, each feature a Point with `properties: { report_id, risk_band, site, area }`. (Sites are given fixed synthetic lat/lng around Duliajan, Assam — disclosed via `is_synthetic_org_fields`.)

## Forecast

`GET /api/v1/forecast?category=` → if `category` omitted, all categories: `{ "<category>": { history: [{date,count}], forecast: [{date,expected,lower,upper}], direction, pct_change_vs_recent_mean, is_synthetic_timeline: true } }`

## Recommendations

`POST /api/v1/recommendations/{id}` → regenerate CAPA for an already-analysed report:
`{ corrective_actions: [{action, priority, rule}], preventive_actions: [...], training_needs: [string], toolbox_talk: { title, duration_minutes, points }, precedent_note }`

## Copilot

`POST /api/v1/copilot/query`
Request: `{ "query": "string" }`
Response: `{ "answer": "string", "citations": ["INC-...", "FAT-..."], "intent": "site_ranking|report_lookup|capa|summary|barrier_analysis|comparison|semantic", "grounded": true }`
**Guardrail**: if no citation can be produced, `grounded: false` and `answer` explicitly says the corpus has no matching evidence — it is never fabricated (SC-5, FR-12).

`WS /ws/copilot` — optional streaming variant (same payload, tokens streamed then a final `{done: true, citations: [...]}` frame). Implemented as a thin wrapper over the same handler used by the POST route.

## Safety Memory

Every new report is automatically compared against the whole 16k-record corpus, so a reviewer never has to think to ask "has this happened before?". `POST /api/v1/incidents` therefore also returns a `safety_memory` object (same shape as the recall response below) alongside the analysis.

`GET /api/v1/incidents/{id}/memory` — recall for an existing report.
`POST /api/v1/memory/recall` — Request `{ "narrative": "...", "top_k": 8 }` — ad-hoc recall for a narrative not yet filed.

Both return:
```json
{
  "matches": [{ "report_id": "FAT-10344", "source_type": "FATALITY", "similarity": 0.6,
                "narrative": "...", "site": "...", "reported_on": "2015-10-12", "risk_band": "HIGH",
                "rules": ["ENERGY_ISOLATION"], "barrier_failure": true, "is_fatal": true }],
  "match_count": 8,
  "top_similarity": 0.6,
  "common_cause": { "rule": "ENERGY_ISOLATION", "cause": "Energy isolation (LOTO) not verified before work",
                    "support": 3, "of": 8, "share": 0.38, "is_majority": false },
  "recurring_barrier": { "detected_in": 5, "of": 8, "share": 0.63 },
  "recommended_action": { "corrective": "...", "preventive": "...", "rule": "ENERGY_ISOLATION" },
  "recurrence": { "total_matches": 8, "strong_matches": 2, "fatal_matches": 6,
                  "sites_affected": ["..."], "site_count": 6, "first_seen": "2015-10-12", "last_seen": "2019-04-02" },
  "pattern": { "pattern_id": 4, "label": "electrocuted, electrical, energized (Energy Isolation)",
               "size": 512, "fatal_count": 498, "assignment_similarity": 0.44, "...": "..." },
  "verdict": "REPEAT_FATAL_PATTERN | REPEAT_PATTERN | RELATED_FATAL_PRECEDENT | WEAK_PRECEDENT | NO_PRECEDENT",
  "verdict_text": "This closely matches 6 case(s) that ended in a fatality...",
  "citations": ["FAT-10344", "..."]
}
```
`common_cause` is `null` when the matched set shares no rule, and `matches` is `[]` with `verdict: "NO_PRECEDENT"` when nothing clears the similarity floor — render both as designed states, not errors. `support`/`of` must always be shown next to a common cause so a 3-of-8 plurality never reads as a certainty.

`GET /api/v1/memory/patterns?limit=` → `{ patterns: [...], corpus_size, n_clusters, method, available }` — corpus-wide recurring patterns (the incidents nobody realised were the same event), ranked most-severe first. Each pattern: `pattern_id, label, top_terms, size, incident_count, fatal_count, fatal_rate, dominant_rule, dominant_rule_rate, barrier_failure_rate, sites[], site_spread, departments[], first_seen, last_seen, examples[], severity_score`.
`GET /api/v1/memory/patterns/{pattern_id}` → one pattern object.

## Structured natural-language query

`POST /api/v1/copilot/structured-query` — Request `{ "query": "Show all confined space incidents during monsoon having SIF > 90 where gas detector failed." }`

```json
{
  "recognised": true,
  "parsed": { "topic": {"rule":"CONFINED_SPACE","phrase":"confined space","label":"..."},
              "season": {"name":"monsoon","months":[6,7,8,9],"human":"June–September"},
              "sif": {"op":">","value":0.9,"human":"SIF > 90%"},
              "conditions": ["gas detector"], "risk_band": null,
              "site": null, "area": null, "department": null,
              "unrecognised": [] },
  "applied_filters": ["hazard: confined space", "season: monsoon (June–September)", "SIF > 90%", "control: gas detector"],
  "answer": "357 report(s) match all 3 filters. Most common site: Refinery Block A (43 of 357). Repeated barrier: ...",
  "aggregate": { "count": 357, "most_common_site": {"site":"...","count":43},
                 "site_breakdown": [...], "department_breakdown": [...],
                 "repeated_barrier": {"rule":"...","label":"...","count":357,"of":357},
                 "barrier_failure_count": 0, "barrier_failure_rate": 0.0,
                 "risk_band_breakdown": {"HIGH": 300}, "critical_count": 0, "avg_sif_probability": 0.97 },
  "results": [{ "report_id","site","area","department","risk_band","sif_probability","reported_on","narrative" }],
  "relaxation": [{ "dropped_filter": "control: gas detector", "would_match": 4 }],
  "citations": ["INC-..."],
  "grounded": true
}
```
Render `applied_filters` as chips so the user sees exactly what was understood, and `parsed.unrecognised` as a muted "not interpreted" note when non-empty. On zero results `aggregate` is `null` and `relaxation` names the binding constraint — show that instead of a bare "no results". `recognised: false` means no filterable constraint was found; `answer` then explains what to try.

The chat endpoint `POST /api/v1/copilot/query` routes multi-constraint questions to this engine automatically and returns the same payload nested under a `structured` key (with `intent: "structured_query"`); questions like "has this happened before?" return `intent: "safety_memory"` with a `memory` key holding the recall object.

## Knowledge Graph

`GET /api/v1/graph?scope=&limit=` → `{ nodes: [{data:{id,label,kind}}], edges: [{data:{source,target}}], top_barrier_centrality: [{node,label,centrality}] }` (Cytoscape.js element format).

## Bulletin

`POST /api/v1/bulletin` — Request: `{ "scope": "daily|weekly|executive", "site": "optional" }` → returns a PDF (`application/pdf`) with top risks, LSR breakdown and top recommended actions.

## Shared object: `AIAnalysis`

```json
{
  "report_id": "INC-220982664",
  "narrative": "...",
  "site": "Rig-07 Duliajan", "area": "RIG", "department": "Electrical Maintenance", "activity": "Energy Isolation",
  "sif_probability": 0.96, "risk_band": "CRITICAL", "risk_score": 0.93, "confidence": 0.91,
  "lsr_tags": [{"rule": "ENERGY_ISOLATION", "score": 0.97}],
  "entities": {"hazard": [...], "equipment": [...], "activity": [...], "condition": [...]},
  "barrier_failure": true, "root_cause": "PROCEDURE_VIOLATION",
  "explanation": {"summary": "...", "tokens": [{"term": "...", "weight": 0.9}]},
  "similar_fatalities": [{"report_id": "FAT-...", "similarity": 0.93, "narrative": "..."}],
  "fatality_twin": {"chain": [...], "likelihood": 0.96, "matched": 14, "similarity": 0.93, "matched_report_ids": [...]},
  "recommendations": { "corrective_actions": [...], "preventive_actions": [...], "training_needs": [...], "toolbox_talk": {...} },
  "model_version": "sif-sentinel-v1.0-tfidf-xgb", "input_hash": "a1b2c3...",
  "is_synthetic_org_fields": true
}
```

## Errors

All errors: `{ "error": { "code": "string", "message": "string" } }` with the matching HTTP status. A model-loading failure returns `503` on write endpoints but read/analytics endpoints keep serving from precomputed artifacts (NFR-06 graceful degradation).
