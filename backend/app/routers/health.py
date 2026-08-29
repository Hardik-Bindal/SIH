from fastapi import APIRouter

from app.store import get_store

router = APIRouter()


@router.get("/api/v1/health")
def health():
    store = get_store()
    return {
        "status": "ok",
        "models_loaded": bool(store.incidents),
        "corpus_size": len(store.incidents) + len(store.fatalities_by_id),
        "model_version": store.model_version,
    }
