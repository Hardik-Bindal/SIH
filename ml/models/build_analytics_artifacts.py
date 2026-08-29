"""
Batch-scores the historical incident corpus and precomputes every dashboard
aggregate (SRS 6.5 design decision: "pre-computed dashboard aggregates...
refreshed on write and on schedule"). Produces:
  ml/artifacts/incidents_scored.jsonl   - every incident + full AI analysis
  ml/artifacts/aggregates.json          - site/area/activity/department/LSR rollups
  ml/artifacts/forecast.json            - 7-day forecast per hazard/event category
  ml/artifacts/graph.json               - knowledge graph (cytoscape-ready)
"""
import json
import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
from ml.pipeline.inference import get_engine
from ml.models.forecaster import forecast_by_category
from ml.models.knowledge_graph import build_graph, top_centrality_nodes, to_cytoscape_json

ROOT = Path(__file__).resolve().parent.parent.parent
PROCESSED = ROOT / "data" / "processed"
ARTIFACTS = ROOT / "ml" / "artifacts"


def score_corpus(df: pd.DataFrame, engine, limit=None):
    rows = df if limit is None else df.head(limit)
    scored = []
    for r in rows.itertuples():
        analysis = engine.analyze(
            r.narrative, site=r.site, area=r.area, department=r.department,
            activity=r.activity, report_id=r.report_id,
        )
        analysis["reported_on"] = str(r.reported_on)
        analysis["report_type"] = r.report_type
        analysis["source"] = r.source
        scored.append(analysis)
    return scored


def build_aggregates(scored: list):
    df = pd.DataFrame([{
        "report_id": s["report_id"], "site": s["site"], "area": s["area"],
        "department": s["department"], "activity": s["activity"],
        "risk_band": s["risk_band"], "sif_probability": s["sif_probability"],
        "reported_on": s["reported_on"],
    } for s in scored])

    band_weight = {"LOW": 1, "MEDIUM": 2, "HIGH": 3, "CRITICAL": 4}
    df["band_weight"] = df["risk_band"].map(band_weight)

    def rollup(col):
        g = df.groupby(col).agg(
            report_count=("report_id", "count"),
            avg_sif_probability=("sif_probability", "mean"),
            critical_count=("risk_band", lambda x: (x == "CRITICAL").sum()),
            high_count=("risk_band", lambda x: (x == "HIGH").sum()),
            composite_risk_index=("band_weight", "mean"),
        ).reset_index().sort_values("composite_risk_index", ascending=False)
        return json.loads(g.to_json(orient="records"))

    lsr_counts = {}
    for s in scored:
        for tag in s["lsr_tags"]:
            lsr_counts.setdefault(tag["rule"], {"rule": tag["rule"], "count": 0, "avg_score": 0.0, "scores": []})
            lsr_counts[tag["rule"]]["count"] += 1
            lsr_counts[tag["rule"]]["scores"].append(tag["score"])
    lsr_list = []
    for rule, d in lsr_counts.items():
        d["avg_score"] = round(sum(d["scores"]) / len(d["scores"]), 3)
        del d["scores"]
        lsr_list.append(d)
    lsr_list.sort(key=lambda d: d["count"], reverse=True)

    risk_band_dist = df["risk_band"].value_counts().to_dict()

    return {
        "sites": rollup("site"),
        "areas": rollup("area"),
        "activities": rollup("activity"),
        "departments": rollup("department"),
        "lsr_rules": lsr_list,
        "risk_band_distribution": risk_band_dist,
        "kpis": {
            "total_reports": int(len(df)),
            "critical_pct": round(float((df.risk_band == "CRITICAL").mean() * 100), 1),
            "high_or_above_pct": round(float(df.risk_band.isin(["HIGH", "CRITICAL"]).mean() * 100), 1),
            "avg_sif_probability": round(float(df.sif_probability.mean()), 3),
        },
    }


def main():
    import sys as _sys
    incidents = pd.read_parquet(PROCESSED / "incidents.parquet")
    scored_path = ARTIFACTS / "incidents_scored.jsonl"

    if scored_path.exists() and "--force" not in _sys.argv:
        print(f"Reusing existing {scored_path}")
        scored = [json.loads(line) for line in open(scored_path)]
    else:
        engine = get_engine()
        print(f"Scoring {len(incidents)} historical incidents...")
        scored = score_corpus(incidents, engine)
        with open(scored_path, "w") as f:
            for s in scored:
                f.write(json.dumps(s, default=str) + "\n")

    print("Building aggregates...")
    aggregates = build_aggregates(scored)
    with open(ARTIFACTS / "aggregates.json", "w") as f:
        json.dump(aggregates, f, indent=2)

    print("Building forecast...")
    fc_df = incidents[["report_id"]].copy()
    fc_df["event_category"] = pd.read_parquet(PROCESSED / "incidents.parquet")["event_type"].fillna("Other")
    forecast = forecast_by_category(fc_df, "event_category")
    with open(ARTIFACTS / "forecast.json", "w") as f:
        json.dump(forecast, f, indent=2)

    print("Building knowledge graph...")
    g = build_graph(incidents, max_rows=1200)
    graph_json = to_cytoscape_json(g)
    graph_json["top_barrier_centrality"] = top_centrality_nodes(g, "barrier")
    with open(ARTIFACTS / "graph.json", "w") as f:
        json.dump(graph_json, f, indent=2)

    print(json.dumps(aggregates["kpis"], indent=2))
    print(f"Graph: {len(graph_json['nodes'])} nodes, {len(graph_json['edges'])} edges")


if __name__ == "__main__":
    main()
