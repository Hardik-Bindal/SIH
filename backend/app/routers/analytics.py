from fastapi import APIRouter

from app.store import get_store

router = APIRouter()


@router.get("/api/v1/analytics/sites")
def sites():
    return get_store().aggregates()["sites"]


@router.get("/api/v1/analytics/areas")
def areas():
    return get_store().aggregates()["areas"]


@router.get("/api/v1/analytics/activities")
def activities():
    return get_store().aggregates()["activities"]


@router.get("/api/v1/analytics/departments")
def departments():
    return get_store().aggregates()["departments"]


@router.get("/api/v1/analytics/lsr")
def lsr():
    return get_store().aggregates()["lsr_rules"]


@router.get("/api/v1/analytics/kpis")
def kpis():
    agg = get_store().aggregates()
    return {**agg["kpis"], "risk_band_distribution": agg["risk_band_distribution"]}


@router.get("/api/v1/analytics/heatmap")
def heatmap():
    return get_store().heatmap_geojson()
