# Deviations from the SRS — and why

`docs/SIF_Sentinel_AI_SRS_v2.docx` (and `docs/SRS_extracted.txt`, a plain-text
extraction used to build against) assumes a networked development machine
with access to Hugging Face and a provisioned MongoDB Atlas cluster. This
build runs in a sandboxed session with:

- **No route to `huggingface.co`** (blocked by org egress policy — confirmed
  via a direct request, not a transient failure). PyPI and the npm registry
  *are* reachable.
- **No MongoDB instance** (no `mongod` binary, no Atlas credentials).
- **No LLM inference endpoint / API key** available to the running app.

Per the SRS's own stated principle ("stating what we are not building is a
deliberate act of engineering honesty"), every substitution below keeps the
*architecture and contracts* from the SRS intact and swaps only the specific
component that needed network access it doesn't have. Every substitution is
also written so that plugging in the original SRS component later (a real
sentence-transformer, MongoDB Atlas, a hosted LLM) requires no interface
changes — only the implementation behind `NarrativeEncoder`, `VectorIndex`,
or the copilot's answer step needs to change.

| SRS component | SRS spec | This build | Where |
|---|---|---|---|
| Narrative encoder | `all-MiniLM-L6-v2` (Sentence-Transformers), 384-dim | TF-IDF (1-2 grams) → TruncatedSVD, 384-dim, fit once on the combined corpus | `ml/pipeline/embeddings.py` |
| Vector index | MongoDB Atlas Vector Search, cosine, 384-dim | FAISS `IndexFlatIP` over L2-normalised vectors (== cosine), same filter-by-metadata behaviour | `ml/pipeline/embeddings.py` |
| Primary datastore | MongoDB 7.x (7 collections) | SQLite (structured tables) + on-disk FAISS index + JSON artifacts, mirroring the same 7 logical collections | `backend/app/db.py` |
| SIF Classifier | DistilBERT fine-tune blended with XGBoost, isotonic calibration | TF-IDF+LogisticRegression blended with XGBoost-over-structured-features, isotonic calibration, recall-first threshold tuning — same blending/calibration/tuning pipeline, different text encoder | `ml/models/train_sif_classifier.py` |
| Explainability | SHAP token attribution | Exact linear-model attribution (`coefficient × tfidf value`) — mathematically what SHAP reduces to for a linear classifier, so this is not an approximation, just computed directly without the `shap` package | `ml/pipeline/inference.py::_explanation` |
| Hazard/Activity NER | spaCy pipeline + gazetteer + **LLM back-fill for unseen phrasing** | spaCy blank pipeline + `EntityRuler` gazetteer only — no LLM back-fill stage (no reachable LLM) | `ml/pipeline/ner.py` |
| AI Safety Copilot | LangChain RAG over a hosted LLM, guardrail-gated | Retrieval (same vector index) + intent-routed template/extractive synthesis over real aggregates and real report text; the citation guardrail is enforced the same way (no answer ships without ≥1 real report ID) | `backend/app/services/copilot.py` |
| Forecaster | Prophet, weekly seasonality + changepoints | Linear-trend + residual-based confidence interval per hazard category (Prophet's compiled Stan backend is unnecessary build risk for a 7-day linear projection) | `ml/models/forecaster.py` |
| Site / Area / Department | Present in OIL's internal reporting system | **Synthesised.** Neither OSHA source file carries this metadata (they are public federal datasets, not OIL's system of record). Values are deterministically derived from a hash of each record's id, lightly biased by real fields where they carry signal. Every synthesised row carries `is_synthetic_org_fields: true`, and the API/UI surface this flag rather than hide it — exactly what SRS §4.5 calls for ("synthesised consistently... and this is disclosed on screen") | `ml/pipeline/etl.py` |
| Recent 90-day timeline | Live report timestamps | Both source corpora have real but non-recent dates (2009-2022 for fatalities, 2016-17 for incidents). Each report is deterministically mapped onto a synthetic recent date within the last 90 days for forecasting/trend demo purposes; responses carry `is_synthetic_timeline: true` | `ml/models/forecaster.py` |
| CAPA precedent text | "reads what actually prevented recurrence in similar historical cases" | Neither source file has free-text remediation guidance (the fatality file's `plan`/`citation` columns are jurisdiction/citation flags, not abatement text). CAPA priority and phrasing is grounded in the LSR rule(s) and barrier failure actually detected, and every action **cites the real matched fatal report IDs** that motivate it | `ml/models/recommendations.py` |
| De-duplication | MinHash + cosine similarity ≥ 0.95 | Exact-text de-dup (both corpora) + a dense TF-IDF cosine pass at the same 0.95 threshold for the incidents corpus only (4.8k rows — a dense pairwise pass is cheap); the 14.9k-row fatality corpus is exact-dedup only, to keep pipeline runtime bounded | `ml/pipeline/etl.py` |

## The two flagship features, and what is real in them

Both go beyond the SRS rather than substituting for it, so neither is a
"deviation" — but both make claims worth stating precisely.

**Safety Memory** (`backend/app/services/memory.py`,
`ml/models/pattern_clusters.py`). The matches are real retrieved records and
the report IDs are genuine and clickable. The "common cause" is a *counted
majority* over the matched set's rule labels, and its `support`/`of` is
returned and displayed alongside it precisely so a 3-of-8 plurality is never
read as a law. Signals for a matched record come from whichever source is
authoritative: a scored incident uses its own model-assigned tags, while a
fatality record (narrative-only in the source data) is passed through the
same deterministic rule extraction used everywhere else — it is not scored by
the classifier, because it was never in its training distribution as a
"prediction" target. Recurring patterns are KMeans clusters over the same
TF-IDF/SVD embeddings described above, which means pattern *labels* are
generated from centroid top-terms and are descriptive, not curated taxonomy:
a label like "crushed, truck, forklift (Line Of Fire)" names what the cluster
contains, and should be read that way rather than as an official hazard
category. Similarity magnitudes are lower than a transformer encoder would
give (a strong match here is ~0.6, not ~0.93) — a direct consequence of the
TF-IDF/SVD substitution, and the reason the thresholds are calibrated to this
encoder rather than copied from the SRS's illustrative numbers.

**Structured natural-language query** (`backend/app/services/structured_query.py`).
Parsing is deterministic — regex plus curated synonym tables — not LLM-driven,
since no LLM is reachable here. That has a real limit worth stating to
reviewers rather than hiding: the vocabulary is finite, so a phrasing outside
the alias tables will not be understood. The design response is to never fail
silently — whatever the parser could not claim comes back in `unrecognised`
and is shown in the UI, and the applied filters are displayed so the user can
see exactly what was run. Season handling maps to the real `reported_on`
event dates from the source data (not the synthetic 90-day forecast
timeline). Because the OSHA corpora are US federal records, some plausible
OIL-specific queries legitimately return nothing — the zero-result path
therefore reports which single constraint is binding, which is more useful
than an empty table and more honest than quietly widening the query.

## A measured limitation of the source data: barrier-failure coverage

The SRS treats barrier failure as a first-class signal — it carries 0.10 of
the risk-fusion score (§10.2), drives root-cause assignment, gates the
Fatality Twin's barrier node, and selects the CAPA. Worth stating plainly
what it can actually do on this corpus.

Barrier-failure language appears in roughly **1% of these 16,249 narratives**
(128 detected). That is a property of OSHA abstracts, which record *what
happened* — "an employee was struck by a falling beam" — and only sometimes
*which control failed*. It is emphatically **not** a finding that barriers
rarely fail; it means these particular records rarely say so.

Two consequences we hold to rather than paper over:

- A missing `barrier_failure` flag means "this narrative does not state a
  failed control", never "no barrier failed". The UI and the Fatality Twin
  are worded accordingly — an earlier version asserted "barrier assumed
  absent or not verified" on reports whose own flag was `false`, which
  contradicted the same page's "Barrier Failure: No" and was fixed.
- The detection patterns are deliberately conservative. A false positive here
  inflates a risk band on invented evidence, which is worse than a miss. They
  were calibrated against real narratives (an earlier, tighter version fired
  on 2 of 16,249 records, leaving the signal effectively dead everywhere it
  is consumed); the current set was spot-checked for precision on sampled
  matches.

On OIL's own UA/UC/near-miss reports — which are written by the observer
specifically to record the unsafe condition — this signal would be far denser
than it is here. The pipeline needs no change for that; the field simply
carries more information.

## Everything that is *not* a deviation

The core, hard-to-fake claims in the SRS are real and unmodified in this
build: the SIF classifier is trained and evaluated on a genuine held-out
split of the actual OSHA data; the risk-band fusion formula (§10.2) is
implemented verbatim, including the escalation override; the Fatality Twin
only returns chain nodes traced to real matched report IDs; the Copilot's
citation guardrail is a real, enforced check, not a decorative label; and
every historical incident in the dashboard was actually scored by the
pipeline above, not mocked.
