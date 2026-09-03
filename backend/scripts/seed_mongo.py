#!/usr/bin/env python3
"""
seed_mongo.py — Sample MongoDB seed script for KAVACH AI.

What it does:
  1. Connects to MongoDB Atlas using MONGODB_URI from backend/.env
  2. Creates required indexes
  3. Inserts a few dummy LIVE_SUBMISSION records for demonstration

Note:
  This script does NOT upload the 16,249 historical OSHA records.
  The historical corpus must remain in-memory for fast <400ms analytics.
  MongoDB is strictly used as the persistence layer for new LIVE submissions.
"""

import logging
import os
import sys
from datetime import datetime
from pathlib import Path

# ── environment ─────────────────────────────────────────────────────────────
HERE = Path(__file__).resolve().parent
ENV_PATH = HERE.parent / ".env"

try:
    from dotenv import load_dotenv
    load_dotenv(dotenv_path=ENV_PATH)
except ImportError:
    pass

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("seed")

MONGODB_URI = os.environ.get("MONGODB_URI", "").strip()
MONGODB_DB_NAME = os.environ.get("MONGODB_DB_NAME", "sif_sentinel").strip()

if not MONGODB_URI or "<db_password>" in MONGODB_URI:
    log.error("Valid MONGODB_URI is not set in backend/.env")
    sys.exit(1)

# ── connect ──────────────────────────────────────────────────────────────────
log.info("Connecting to MongoDB Atlas (database: %s)…", MONGODB_DB_NAME)
try:
    from pymongo import MongoClient, ASCENDING
    client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=5000)
    db = client[MONGODB_DB_NAME]
    col = db["reports"]
    
    col.create_index([("report_id", ASCENDING)], unique=True, name="report_id_unique")
    col.create_index([("risk_band", ASCENDING)], name="risk_band")
    col.create_index([("site", ASCENDING)], name="site")
    col.create_index([("department", ASCENDING)], name="department")
    col.create_index([("reported_on", ASCENDING)], name="reported_on")
    col.create_index([("source", ASCENDING)], name="source")
    log.info("Indexes verified.")

    # ── insert dummy live records ─────────────────────────────────────────────
    dummy_records = [
        {
            "report_id": "LIVE-DEMO-01",
            "narrative": "Worker bypassed safety interlock to clear a jam in the packaging machine.",
            "site": "Refinery Block A",
            "department": "Packaging",
            "risk_band": "CRITICAL",
            "risk_score": 0.85,
            "sif_probability": 0.88,
            "lsr_tags": [{"rule": "BYPASSING_CONTROLS", "confidence": 0.90}],
            "barrier_failure": True,
            "reported_on": datetime.now().isoformat(),
            "report_type": "INCIDENT",
            "source": "LIVE_SUBMISSION"
        }
    ]

    for doc in dummy_records:
        col.update_one({"report_id": doc["report_id"]}, {"$set": doc}, upsert=True)
    
    log.info("Successfully inserted %d demo LIVE_SUBMISSION records.", len(dummy_records))

except Exception as exc:
    log.error("Failed: %s", exc)
    sys.exit(1)
finally:
    client.close()
