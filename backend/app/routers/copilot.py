from fastapi import APIRouter

from app.schemas import CopilotRequest, StructuredQueryRequest
from app.services import copilot as copilot_service
from app.services import structured_query as sq_service
from app.store import get_store

router = APIRouter()


@router.post("/api/v1/copilot/query")
def copilot_query(body: CopilotRequest):
    store = get_store()
    return copilot_service.answer(store, body.query)


@router.post("/api/v1/copilot/structured-query")
def copilot_structured_query(body: StructuredQueryRequest):
    """Multi-constraint natural-language query returning the parsed filter,
    the aggregate and the matching reports (see services/structured_query.py)."""
    return sq_service.run(get_store(), body.query)
