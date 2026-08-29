from fastapi import APIRouter, HTTPException, Query

from app.schemas import IncidentSubmit
from app.services import memory as memory_service
from app.store import get_store
from ml.pipeline.inference import get_engine

router = APIRouter()


def _summary(r: dict) -> dict:
    return {
        "report_id": r["report_id"], "narrative": r["narrative"][:200],
        "site": r["site"], "area": r["area"], "department": r["department"],
        "activity": r["activity"], "risk_band": r["risk_band"],
        "sif_probability": r["sif_probability"], "reported_on": r.get("reported_on"),
        "report_type": r.get("report_type"),
    }


@router.post("/api/v1/incidents")
def submit_incident(body: IncidentSubmit):
    store = get_store()
    engine = get_engine()
    live_id = f"LIVE-{len(store.incidents) + 1:05d}"
    analysis = engine.analyze(
        body.narrative, site=body.site, area=body.area, department=body.department,
        report_id=live_id,
    )
    import pandas as pd
    analysis["reported_on"] = pd.Timestamp.now().isoformat()
    analysis["report_type"] = "NEAR_MISS" if analysis["risk_band"] in ("LOW", "MEDIUM") else "INCIDENT"
    analysis["source"] = "LIVE_SUBMISSION"
    analysis["is_synthetic_org_fields"] = body.site is None or body.area is None
    store.add_incident(analysis)
    # Safety Memory is attached at submission time, not on demand: the USP is
    # that *every* new report is automatically checked against the corpus, so
    # a reviewer never has to think to ask "has this happened before?".
    try:
        analysis["safety_memory"] = memory_service.recall(store, body.narrative, exclude_id=live_id)
    except Exception as exc:  # NFR-06: recall failing must not fail the analysis
        analysis["safety_memory"] = {"error": str(exc), "matches": []}
    return analysis


@router.get("/api/v1/incidents")
def list_incidents(
    site: str = None, area: str = None, department: str = None, risk_band: str = None,
    date_from: str = None, date_to: str = None, q: str = None,
    page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=200),
):
    store = get_store()
    rows = store.filtered(site=site, area=area, department=department, risk_band=risk_band,
                           date_from=date_from, date_to=date_to, q=q)
    rows = sorted(rows, key=lambda r: str(r.get("reported_on", "")), reverse=True)
    total = len(rows)
    start = (page - 1) * page_size
    page_rows = rows[start:start + page_size]
    return {
        "items": [_summary(r) for r in page_rows],
        "total": total, "page": page, "page_size": page_size,
    }


@router.get("/api/v1/incidents/{report_id}")
def get_incident(report_id: str):
    store = get_store()
    r = store.get_by_id(report_id)
    if r:
        return r

    # Fatality records are reachable through this route too. Every surface
    # that lists precedent -- similar_fatalities, the Fatality Twin's matched
    # cases, Safety Memory matches, Copilot citations -- hands the user a
    # FAT-#### id to open, and the demo walkthrough (SRS §20.2 step 7) opens
    # a matched fatal case directly. 404-ing those made every one of those
    # links a dead end. Fatalities carry no model analysis (they are the
    # knowledge base, never scored as predictions), so the payload is
    # explicitly marked so the UI renders the record rather than an empty
    # analysis view.
    fatality = store.fatalities_by_id.get(report_id)
    if fatality:
        return {
            **fatality,
            "source_type": "FATALITY",
            "source": "OSHA_FATALITY",
            "report_type": "INCIDENT",
            "is_analysed": False,
            "analysis_unavailable_reason": (
                "This is a confirmed fatality from the reference knowledge base. "
                "It is retrieval evidence, not a scored prediction, so it carries no "
                "SIF probability, risk band or CAPA."
            ),
            "is_synthetic_org_fields": True,
        }

    raise HTTPException(status_code=404, detail={"error": {"code": "NOT_FOUND", "message": f"{report_id} not found"}})


@router.get("/api/v1/incidents/{report_id}/similar")
def similar_incidents(report_id: str, top_k: int = 10, type: str = None):
    store = get_store()
    r = store.get_by_id(report_id)
    if not r:
        raise HTTPException(status_code=404, detail={"error": {"code": "NOT_FOUND", "message": f"{report_id} not found"}})
    pool = r.get("similar_fatalities", []) + r.get("similar_incidents", [])
    if type:
        pool = [m for m in pool if m["source_type"] == type.upper()]
    pool = sorted(pool, key=lambda m: m["similarity"], reverse=True)[:top_k]
    return {"matches": pool}
