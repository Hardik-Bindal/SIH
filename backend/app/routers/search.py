from fastapi import APIRouter

from app.schemas import SemanticSearchRequest
from ml.pipeline.inference import get_engine

router = APIRouter()


@router.post("/api/v1/search/semantic")
def semantic_search(body: SemanticSearchRequest):
    engine = get_engine()
    vec = engine.encoder.encode_one(body.query)
    results = engine.index.search(
        vec, top_k=body.top_k, source_type=body.source_type, site=body.site, area=body.area,
    )
    return {"results": results}
