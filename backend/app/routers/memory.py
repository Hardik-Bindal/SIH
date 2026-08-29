from fastapi import APIRouter, HTTPException, Query

from app.schemas import MemoryRecallRequest
from app.services import memory as memory_service
from app.store import get_store

router = APIRouter()


@router.get("/api/v1/incidents/{report_id}/memory")
def report_memory(report_id: str):
    """Safety Memory recall for an existing report — what the corpus already
    knows about events like this one."""
    result = memory_service.recall_for_report(get_store(), report_id)
    if result is None:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "NOT_FOUND", "message": f"{report_id} not found"}},
        )
    return result


@router.post("/api/v1/memory/recall")
def memory_recall(body: MemoryRecallRequest):
    """Ad-hoc recall for a narrative that has not been filed yet — lets an
    officer check "has this happened before?" before submitting anything."""
    return memory_service.recall(get_store(), body.narrative, top_k=body.top_k)


@router.get("/api/v1/memory/patterns")
def list_patterns(limit: int = Query(None, ge=1, le=100)):
    """Corpus-wide recurring patterns — the incidents nobody realised were
    the same event."""
    return memory_service.list_patterns(limit=limit)


@router.get("/api/v1/memory/patterns/{pattern_id}")
def get_pattern(pattern_id: int):
    pattern = memory_service.get_pattern(pattern_id)
    if not pattern:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "NOT_FOUND", "message": f"pattern {pattern_id} not found"}},
        )
    return pattern
