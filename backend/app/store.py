"""
Hybrid data store: in-memory + MongoDB Atlas persistence.

Startup flow:
  1. Load pre-scored ML corpus from ml/artifacts/incidents_scored.jsonl
     into self.incidents (in-memory list — unchanged from original).
  2. Load fatality reference corpus from data/processed/fatalities.parquet.
  3. Load forecast.json and graph.json artifacts.
  4. Fetch any persisted LIVE_SUBMISSION documents from MongoDB and merge
     them into self.incidents, so user-submitted reports survive restarts.

Mutation flow (POST /api/v1/incidents):
  - Append to in-memory list (immediate analytics reflect new report).
  - Upsert to MongoDB "reports" collection (persistence across restarts).

Analytics:
  - All aggregates run in-memory via pandas — same performance as before.

SRS §6.3/§9: MongoDB is now the persistence layer for live submissions.
Static ML artifacts (forecast, graph, patterns) remain file-based.
"""
import json
import logging
import sys
from pathlib import Path
from threading import Lock

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT))

from ml.models.build_analytics_artifacts import build_aggregates  # noqa: E402

logger = logging.getLogger("sif.store")

ARTIFACTS = ROOT / "ml" / "artifacts"
PROCESSED = ROOT / "data" / "processed"

# Deterministic demo coordinates around Duliajan, Assam (OIL's real operating
# area) -- purely for the geospatial heatmap page; disclosed as synthetic
# via is_synthetic_org_fields on every incident.
SITE_COORDS = {
    "Rig-07 Duliajan": (27.38, 95.34),
    "Rig-12 Moran": (27.28, 95.40),
    "Rig-03 Kumchai": (27.20, 95.55),
    "Refinery Block A": (27.45, 95.30),
    "Refinery Block B": (27.47, 95.33),
    "Pipeline Sector 4": (27.30, 95.60),
    "Pipeline Sector 9": (27.15, 95.20),
    "Central Warehouse": (27.40, 95.25),
    "Field Workshop Duliajan": (27.36, 95.36),
}


def _strip_mongo_id(doc: dict) -> dict:
    """Remove MongoDB _id field so responses stay clean JSON."""
    doc.pop("_id", None)
    return doc


class Store:
    def __init__(self):
        self._lock = Lock()
        self.incidents: list[dict] = []
        self.fatalities_by_id: dict[str, dict] = {}
        self.forecast: dict = {}
        self.graph: dict = {}
        self.model_version = "unloaded"
        self._load()

    def _load(self):
        # --- 1. Pre-scored incident corpus (ML artifacts) ---
        scored_path = ARTIFACTS / "incidents_scored.jsonl"
        if scored_path.exists():
            with open(scored_path) as f:
                self.incidents = [json.loads(line) for line in f]
        if self.incidents:
            self.model_version = self.incidents[0].get("model_version", "unknown")

        # Track report_ids already loaded to avoid duplicates from MongoDB
        loaded_ids: set[str] = {r["report_id"] for r in self.incidents}

        # --- 2. Fatality reference corpus ---
        fat_path = PROCESSED / "fatalities.parquet"
        if fat_path.exists():
            fdf = pd.read_parquet(fat_path)
            self.fatalities_by_id = {
                r.report_id: {
                    "report_id": r.report_id, "narrative": r.narrative,
                    "site": r.site, "area": r.area, "city": r.city, "state": r.state,
                    "reported_on": str(r.reported_on) if r.reported_on is not None else None,
                }
                for r in fdf.itertuples()
            }

        # --- 3. Static ML artifacts ---
        fc_path = ARTIFACTS / "forecast.json"
        if fc_path.exists():
            self.forecast = json.load(open(fc_path))

        graph_path = ARTIFACTS / "graph.json"
        if graph_path.exists():
            self.graph = json.load(open(graph_path))

        # --- 4. Merge persisted live submissions from MongoDB ---
        self._load_from_mongo(loaded_ids)

    def _load_from_mongo(self, already_loaded: set[str]):
        """
        Fetch LIVE_SUBMISSION documents from MongoDB that are not already
        in the in-memory corpus (i.e., user-submitted reports from past sessions).
        This is called once at startup to restore persistence.
        """
        try:
            from app.database import get_db
            db = get_db()
            if db is None:
                return
            col = db["reports"]
            cursor = col.find(
                {"source": "LIVE_SUBMISSION"},
                projection={"_id": 0},
            )
            count = 0
            for doc in cursor:
                if doc.get("report_id") not in already_loaded:
                    self.incidents.append(doc)
                    count += 1
            if count:
                logger.info("Restored %d live submission(s) from MongoDB.", count)
        except Exception as exc:
            logger.warning("Could not load live submissions from MongoDB: %s", exc)

    # ---- mutation --------------------------------------------------------
    def add_incident(self, analysis: dict):
        """
        Append the incident to the in-memory list (so analytics reflect it
        immediately) and persist it to MongoDB (so it survives restarts).
        """
        with self._lock:
            self.incidents.append(analysis)

        # Persist to MongoDB — non-blocking on failure so a Mongo outage
        # does not break incident submission.
        try:
            from app.database import get_db
            db = get_db()
            if db is not None:
                doc = {k: v for k, v in analysis.items()}
                db["reports"].update_one(
                    {"report_id": analysis["report_id"]},
                    {"$set": doc},
                    upsert=True,
                )
        except Exception as exc:
            logger.warning(
                "Failed to persist incident %s to MongoDB: %s",
                analysis.get("report_id"), exc,
            )

    # ---- reads -------------------------------------------------------
    def get_by_id(self, report_id: str):
        for r in self.incidents:
            if r["report_id"] == report_id:
                return r
        return None

    def as_dataframe(self) -> pd.DataFrame:
        return pd.DataFrame(self.incidents)

    def filtered(self, site=None, area=None, department=None, risk_band=None,
                 date_from=None, date_to=None, q=None):
        rows = self.incidents
        if site:
            rows = [r for r in rows if r["site"] == site]
        if area:
            rows = [r for r in rows if r["area"] == area]
        if department:
            rows = [r for r in rows if r["department"] == department]
        if risk_band:
            rows = [r for r in rows if r["risk_band"] == risk_band]
        if date_from:
            rows = [r for r in rows if str(r.get("reported_on", "")) >= date_from]
        if date_to:
            rows = [r for r in rows if str(r.get("reported_on", "")) <= date_to]
        if q:
            ql = q.lower()
            rows = [r for r in rows if ql in r["narrative"].lower()]
        return rows

    def aggregates(self) -> dict:
        return build_aggregates(self.incidents)

    def heatmap_geojson(self) -> dict:
        features = []
        for r in self.incidents:
            lat, lng = SITE_COORDS.get(r["site"], (27.38, 95.34))
            features.append({
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [lng, lat]},
                "properties": {
                    "report_id": r["report_id"], "risk_band": r["risk_band"],
                    "site": r["site"], "area": r["area"],
                    "is_synthetic_org_fields": True,
                },
            })
        return {"type": "FeatureCollection", "features": features}


_store = None


def get_store() -> Store:
    global _store
    if _store is None:
        _store = Store()
    return _store
