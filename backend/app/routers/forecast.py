from fastapi import APIRouter

from app.store import get_store

router = APIRouter()


@router.get("/api/v1/forecast")
def forecast(category: str = None):
    store = get_store()
    if category:
        return {category: store.forecast.get(category, {})}
    return store.forecast
