from fastapi import APIRouter

from app.store import get_store

router = APIRouter()


@router.get("/api/v1/graph")
def graph(scope: str = None, limit: int = None):
    store = get_store()
    g = dict(store.graph)
    if limit:
        g["nodes"] = g.get("nodes", [])[:limit]
        node_ids = {n["data"]["id"] for n in g["nodes"]}
        g["edges"] = [e for e in g.get("edges", []) if e["data"]["source"] in node_ids and e["data"]["target"] in node_ids]
    return g
