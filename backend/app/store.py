"""
In-memory data store, loaded once at process startup from the ML artifacts
built by ml/models/build_analytics_artifacts.py.

SRS §6.3/§9 specify MongoDB as the datastore. This sandbox has no reachable
MongoDB instance (see docs/DEVIATIONS.md), and the full demo corpus is
~16k rows -- small enough that an in-memory list + pandas recompute on read
comfortably beats the sub-400ms dashboard target (NFR-02) without a
separate cache tier, so aggregates are computed fresh on every request from
the canonical in-memory list rather than served from a manually-invalidated
cache. New reports submitted through POST /api/v1/incidents are appended to
the same list, so analytics immediately reflect them.
"""
import json
import sys
from pathlib import Path
from threading import Lock

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT))

from ml.models.build_analytics_artifacts import build_aggregates  # noqa: E402

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
        scored_path = ARTIFACTS / "incidents_scored.jsonl"
        if scored_path.exists():
            with open(scored_path) as f:
                self.incidents = [json.loads(line) for line in f]
        if self.incidents:
            self.model_version = self.incidents[0].get("model_version", "unknown")

        fat_path = PROCESSED / "fatalities.parquet"
        if fat_path.exists():
            fdf = pd.read_parquet(fat_path)
            self.fatalities_by_id = {
                r.report_id: {
                    "report_id": r.report_id, "narrative": r.narrative,
                    "site": r.site, "area": r.area, "city": r.city, "state": r.state,
                    # Carried so Safety Memory can date a fatality precedent —
                    # without it the recurrence window would silently span only
                    # the incident corpus.
                    "reported_on": str(r.reported_on) if r.reported_on is not None else None,
                }
                for r in fdf.itertuples()
            }

        fc_path = ARTIFACTS / "forecast.json"
        if fc_path.exists():
            self.forecast = json.load(open(fc_path))

        graph_path = ARTIFACTS / "graph.json"
        if graph_path.exists():
            self.graph = json.load(open(graph_path))

    # ---- mutation --------------------------------------------------------
    def add_incident(self, analysis: dict):
        with self._lock:
            self.incidents.append(analysis)

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
