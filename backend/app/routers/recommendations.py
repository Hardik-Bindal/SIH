from fastapi import APIRouter, HTTPException

from app.store import get_store
from ml.models.recommendations import generate as generate_recommendations

router = APIRouter()


@router.post("/api/v1/recommendations/{report_id}")
def recommendations(report_id: str):
    store = get_store()
    r = store.get_by_id(report_id)
    if not r:
        raise HTTPException(status_code=404, detail={"error": {"code": "NOT_FOUND", "message": f"{report_id} not found"}})
    twin = r.get("fatality_twin")
    fresh = generate_recommendations(
        r["lsr_tags"], r["barrier_failure"],
        twin["matched_report_ids"] if twin else [],
        r["risk_band"], r["entities"],
    )
    return fresh
