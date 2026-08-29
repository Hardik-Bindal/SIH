# SIF Sentinel AI

**AI-Powered Safety Intelligence Platform for Serious Injury & Fatality (SIF) Prevention**
Smart India Hackathon 2026 · Team The Last Commit · Problem domain: Industrial Safety (Oil India Limited)

Turns unstructured safety narratives into structured, scored, explainable, and
actionable intelligence: SIF probability, Life Saving Rule mapping, hazard/
entity extraction, explainable risk scoring, semantic retrieval against a
knowledge base of confirmed fatalities, a "Fatality Twin" escalation
projection, precedent-grounded CAPA generation, and a citation-enforced
Safety Copilot — built end-to-end on two real OSHA datasets.

Full requirements: [`docs/SIF_Sentinel_AI_SRS_v2.docx`](docs/SIF_Sentinel_AI_SRS_v2.docx)
(plain-text extraction: `docs/SRS_extracted.txt`). API contract:
[`docs/CONTRACT.md`](docs/CONTRACT.md). **Read
[`docs/DEVIATIONS.md`](docs/DEVIATIONS.md) first** — this sandbox has no
outbound access to Hugging Face or a MongoDB instance, so several SRS
components are swapped for honestly-documented offline equivalents that
preserve the same architecture and contracts.

## What's real here

- The SIF classifier, LSR mapper, embeddings/retrieval, risk-band fusion,
  Fatality Twin, CAPA generation, forecaster and knowledge graph all run on
  the actual `osha_incidents.csv` (4,847 rows) and `osha_fatalities.csv`
  (14,914 rows) datasets, with a genuine stratified train/val/test split.
- Every historical incident visible in the dashboard was scored by the same
  pipeline a live submission goes through — nothing is precomputed by hand.
- The Copilot's citation guardrail is enforced in code: an answer with no
  real report id backing it returns `grounded: false` and says so.
- Site/area/department metadata and the "last 90 days" forecast timeline are
  synthesised (neither OSHA file carries them) and every such value is
  labelled `is_synthetic_org_fields` / `is_synthetic_timeline` in the API —
  disclosed, not hidden, per the SRS's own engineering-honesty principle.

## The two flagship differentiators

**Safety Memory** — *"an AI that remembers every safety incident ever reported."*
Today every report is reviewed in isolation, so the fourth occurrence of a
pattern gets investigated as if it were the first. Every new report is
automatically compared against all 16,249 records the moment it is filed
(`safety_memory` comes back on the submission response — nobody has to think
to ask), and the system answers three questions no reviewer can answer from
memory: *has this happened before* (ranked real matches with similarity),
*what was the common cause* (a counted majority across the matched set,
always shown as "3 of 8" so a plurality never reads as a law), and *what
should be done* (the precedent-driven action for the rule actually violated).
It also clusters the whole corpus into recurring patterns — the complementary
question nobody asks: not "has this happened before?" but "what keeps
happening?" See `backend/app/services/memory.py`, `ml/models/pattern_clusters.py`.

**Structured natural-language query** — *ask instead of building a dashboard.*
"Show all confined space incidents during monsoon having SIF > 90 where the
gas detector failed" carries four independent constraints that no filter bar
composes. The Copilot parses it into an explicit filter, runs it, and returns
the aggregate an officer actually wants (how many, where most, which control
keeps failing). Two honesty properties matter more than the parsing: the
parsed filter is shown back to the user, and anything it *couldn't* interpret
is reported rather than silently dropped; and a zero-result query relaxes each
constraint in turn to name the binding one ("0 match all four — dropping *gas
detector* alone returns 4") instead of a dead-end "no results".
See `backend/app/services/structured_query.py`.

## Repository layout

```
data/
  raw/            the two source CSVs
  processed/      cleaned, labelled, split parquet/jsonl (built by ml/pipeline/etl.py)
ml/
  pipeline/       etl.py, ner.py, embeddings.py, inference.py (shared analysis engine)
  models/         classifier/mapper training, risk fusion, fatality twin, recommendations,
                  forecaster, knowledge graph, pattern clustering, batch-scoring script
  artifacts/      trained models, vector index, precomputed dashboard aggregates (generated)
backend/          FastAPI service (app/) implementing docs/CONTRACT.md
frontend/         React + Vite + Tailwind dashboard (SRS §13 pages + Safety Memory)
docs/             SRS, API contract, deviations doc
docker-compose.yml
```

## Running it

### 1. Build the ML pipeline (one-time; produces everything under `ml/artifacts/`)

```bash
pip install -r backend/requirements.txt
python3 ml/pipeline/etl.py                       # clean, label, split the two corpora
python3 ml/pipeline/embeddings.py                # fit the encoder + build the vector index
python3 ml/models/train_sif_classifier.py        # SIF classifier (SC-1)
python3 ml/models/train_lsr_mapper.py            # Life Saving Rule mapper (SC-2)
export OMP_NUM_THREADS=1                         # (macOS ARM only) fixes OpenMP crash
python3 ml/models/build_analytics_artifacts.py   # batch-score the corpus + precompute dashboards
python3 ml/models/pattern_clusters.py            # recurring-pattern clusters (Safety Memory)
```

### 2. Run the backend

```bash
cd backend
uvicorn app.main:app --reload --port 8000
# -> http://localhost:8000/api/v1/health, OpenAPI docs at /docs
```

### 3. Run the frontend

```bash
cd frontend
npm install
npm run dev
# -> http://localhost:5173, talking to VITE_API_BASE_URL (defaults to http://localhost:8000)
```

### Or, both together with Docker

```bash
docker compose up --build
```

## Success criteria vs. SRS §3.3

See `ml/artifacts/sif_classifier_metrics.json` and `lsr_mapper_metrics.json`
for the actual measured numbers on the held-out test split — printed at the
end of each training script, and reproduced honestly (including where a
target isn't met) rather than asserted.
