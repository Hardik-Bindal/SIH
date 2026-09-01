#!/usr/bin/env python3
"""
seed_mongo.py — Idempotent MongoDB seed script for SIF Sentinel AI.

What it does:
  1. Connects to MongoDB Atlas using MONGODB_URI from backend/.env
  2. Loads the pre-scored incident corpus from ml/artifacts/incidents_scored.jsonl
  3. Upserts each document into the 'reports' collection using report_id as the key
  4. Creates required indexes

Idempotency:
  - Uses upsert (update_one with $set) so running this script multiple
    times never creates duplicate records.
  - Documents already in MongoDB are refreshed, not duplicated.

Usage:
  cd <project-root>
  python backend/scripts/seed_mongo.py

  # Or with a custom env file:
  MONGODB_URI="..." python backend/scripts/seed_mongo.py
"""

import json
import logging
import os
import sys
from pathlib import Path

# ── environment ─────────────────────────────────────────────────────────────
# Load .env from backend/ directory
HERE = Path(__file__).resolve().parent
PROJECT_ROOT = HERE.parent.parent
ENV_PATH = HERE.parent / ".env"

try:
    from dotenv import load_dotenv
    load_dotenv(dotenv_path=ENV_PATH)
except ImportError:
    # python-dotenv not installed yet — rely on env vars being set manually
    pass

# ── logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("seed")

# ── validate environment ─────────────────────────────────────────────────────
MONGODB_URI = os.environ.get("MONGODB_URI", "").strip()
MONGODB_DB_NAME = os.environ.get("MONGODB_DB_NAME", "sif_sentinel").strip()

if not MONGODB_URI:
    log.error("MONGODB_URI environment variable is not set.")
    log.error("Add it to backend/.env or export it before running this script.")
    sys.exit(1)

if "<db_password>" in MONGODB_URI:
    log.error("MONGODB_URI still contains the placeholder '<db_password>'.")
    log.error("Replace it with the real password in backend/.env first.")
    sys.exit(1)

# ── locate artifacts ─────────────────────────────────────────────────────────
SCORED_PATH = PROJECT_ROOT / "ml" / "artifacts" / "incidents_scored.jsonl"

if not SCORED_PATH.exists():
    log.error("Scored corpus not found at: %s", SCORED_PATH)
    log.error("Run the ML pipeline first: python ml/pipeline/inference.py")
    sys.exit(1)

# ── connect ──────────────────────────────────────────────────────────────────
log.info("Connecting to MongoDB Atlas (database: %s)…", MONGODB_DB_NAME)

try:
    from pymongo import MongoClient, ASCENDING
    from pymongo.errors import BulkWriteError

    client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=10000)
    client.admin.command("ping")
    db = client[MONGODB_DB_NAME]
    log.info("Connected successfully.")
except Exception as exc:
    log.error("Connection failed: %s", exc)
    sys.exit(1)

# ── ensure indexes ────────────────────────────────────────────────────────────
col = db["reports"]
col.create_index([("report_id", ASCENDING)], unique=True, name="report_id_unique")
col.create_index([("risk_band", ASCENDING)], name="risk_band")
col.create_index([("site", ASCENDING)], name="site")
col.create_index([("department", ASCENDING)], name="department")
col.create_index([("reported_on", ASCENDING)], name="reported_on")
col.create_index([("source", ASCENDING)], name="source")
log.info("Indexes verified.")

# ── load corpus ───────────────────────────────────────────────────────────────
log.info("Loading scored corpus from %s…", SCORED_PATH)
incidents = []
with open(SCORED_PATH) as f:
    for line in f:
        line = line.strip()
        if line:
            incidents.append(json.loads(line))

log.info("Loaded %d incident records.", len(incidents))

# ── upsert ────────────────────────────────────────────────────────────────────
log.info("Upserting into 'reports' collection (this may take a moment)…")

inserted = 0
updated = 0
errors = 0

for doc in incidents:
    try:
        result = col.update_one(
            {"report_id": doc["report_id"]},
            {"$set": doc},
            upsert=True,
        )
        if result.upserted_id:
            inserted += 1
        else:
            updated += 1
    except Exception as exc:
        log.warning("Failed to upsert %s: %s", doc.get("report_id"), exc)
        errors += 1

log.info(
    "Done. inserted=%d  updated=%d  errors=%d  total_in_collection=%d",
    inserted, updated, errors, col.count_documents({}),
)

if errors:
    log.warning("%d records had errors — check the logs above.", errors)

log.info("Seed complete. Documents are now visible in MongoDB Atlas.")
client.close()
