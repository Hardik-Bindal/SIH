# Database Setup Guide — KAVACH AI

This document explains how to configure and connect to MongoDB Atlas for the KAVACH AI platform.

---

## Architecture Overview

```
React/Vite Frontend
       ↓  (HTTP only)
FastAPI Backend (Python)
       ↓
MongoDB Atlas (Cloud)
```

The backend uses a **hybrid storage model**:

| Data | Storage | Reason |
|---|---|---|
| Pre-scored OSHA corpus (16k records) | In-memory (from `.jsonl` artifacts) | Analytics performance (<400ms target) |
| Live user submissions | MongoDB `reports` collection | Persistence across restarts |
| Forecast / Graph / Patterns | JSON artifacts (file-based) | Pre-built by ML pipeline, read-only |

---

## 1. MongoDB Atlas Cluster

The cluster is already provisioned at:

```
sif-sentinal-ai.jfvauei.mongodb.net
```

App name: `SIF-Sentinal-AI`

---

## 2. Environment Variables

Create `backend/.env` (never commit this file):

```env
MONGODB_URI=mongodb+srv://hardika680_db_user:<db_password>@sif-sentinal-ai.jfvauei.mongodb.net/?appName=SIF-Sentinal-AI
MONGODB_DB_NAME=sif_sentinel
```

Replace `<db_password>` with the actual database user password from MongoDB Atlas.

A safe template is provided at `backend/.env.example`.

> ⚠️ **Never commit `.env` to git.** It is listed in `.gitignore`.

---

## 3. Install Dependencies

```bash
cd <project-root>
source .venv/bin/activate    # or .venv\Scripts\activate on Windows
pip install -r backend/requirements.txt
```

New packages added:
- `pymongo[srv]` — MongoDB driver with Atlas SRV support
- `python-dotenv` — loads `.env` automatically at startup

---

## 4. Run the Seed Script

The seed script upserts the pre-scored ML corpus into MongoDB Atlas.
It is **idempotent** — safe to run multiple times.

```bash
cd <project-root>
python backend/scripts/seed_mongo.py
```

Expected output:
```
10:00:00 [INFO] Connecting to MongoDB Atlas (database: sif_sentinel)…
10:00:01 [INFO] Connected successfully.
10:00:01 [INFO] Indexes verified.
10:00:01 [INFO] Loading scored corpus from ml/artifacts/incidents_scored.jsonl…
10:00:01 [INFO] Loaded 4813 incident records.
10:00:01 [INFO] Upserting into 'reports' collection (this may take a moment)…
10:00:25 [INFO] Done. inserted=4813  updated=0  errors=0  total_in_collection=4813
10:00:25 [INFO] Seed complete. Documents are now visible in MongoDB Atlas.
```

---

## 5. Start the Backend

```bash
./scripts/demo_start.sh
```

Or manually:

```bash
cd <project-root>
source .venv/bin/activate
uvicorn app.main:app --reload --app-dir backend
```

Startup log shows MongoDB status:

```
KAVACH AI backend ready. MongoDB: connected
```

If MongoDB is unavailable:
```
KAVACH AI backend ready. MongoDB: unavailable (memory-only mode)
```

In memory-only mode, all existing functionality works — only live submissions won't persist across restarts.

---

## 6. Verify MongoDB Connectivity

```bash
curl http://localhost:8000/api/v1/health
```

Response when connected:
```json
{
  "status": "ok",
  "models_loaded": true,
  "corpus_size": 16249,
  "model_version": "sif-sentinel-v1.0-tfidf-xgb",
  "mongo_connected": true
}
```

---

## 7. Collection Structure

### `reports` collection

Each document in the `reports` collection represents a live user-submitted incident:

```json
{
  "report_id": "LIVE-00001",
  "narrative": "Worker touched energized cable...",
  "site": "Rig-07 Duliajan",
  "area": "RIG",
  "department": "Electrical Maintenance",
  "activity": "electrical maintenance",
  "risk_band": "CRITICAL",
  "risk_score": 0.91,
  "sif_probability": 0.91,
  "confidence": 0.87,
  "lsr_tags": [
    {"rule": "Energy_Isolation", "confidence": 0.92}
  ],
  "entities": {
    "hazards": ["energized cable"],
    "equipment": ["junction box"],
    "activities": ["lockout tagout"],
    "conditions": ["isolation not verified"]
  },
  "barrier_failure": true,
  "root_cause": "PROCEDURE_VIOLATION",
  "explanation": {"tokens": [...]},
  "fatality_twin": {...},
  "recommendations": {...},
  "safety_memory": {...},
  "similar_fatalities": [...],
  "similar_incidents": [...],
  "reported_on": "2026-09-01T17:20:00",
  "report_type": "INCIDENT",
  "source": "LIVE_SUBMISSION",
  "is_synthetic_org_fields": false,
  "model_version": "sif-sentinel-v1.0-tfidf-xgb"
}
```

---

## 8. Indexes

| Index | Field | Type |
|---|---|---|
| `report_id_unique` | `report_id` | Unique |
| `risk_band` | `risk_band` | Ascending |
| `site` | `site` | Ascending |
| `department` | `department` | Ascending |
| `reported_on` | `reported_on` | Ascending |
| `source` | `source` | Ascending |

---

## 9. Security Checklist

- [x] `.env` is in `.gitignore`
- [x] `.env.*` wildcard is in `.gitignore`
- [x] `.env.example` (no real password) is committed
- [x] MongoDB URI never appears in Python/JS source code
- [x] MongoDB URI never sent to the frontend
- [x] Connection string never printed in logs
- [x] Backend logs only the database name, not credentials

---

## 10. Troubleshooting

**`MONGODB_URI still contains placeholder`**
→ Edit `backend/.env` and replace `<db_password>` with the real password.

**`Connection failed: ServerSelectionTimeoutError`**
→ Check network/firewall. Add your IP to MongoDB Atlas Network Access allowlist.

**`mongo_connected: false` in health check**
→ Check `backend/.env` exists, has correct URI, and the Atlas cluster is running.

**Seed script shows `errors > 0`**
→ Check the specific error messages. Usually a schema mismatch or network issue.
