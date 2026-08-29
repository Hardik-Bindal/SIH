from fastapi import APIRouter, Response

from app.schemas import BulletinRequest
from app.services.bulletin import build_bulletin_pdf
from app.store import get_store

router = APIRouter()


@router.post("/api/v1/bulletin")
def bulletin(body: BulletinRequest):
    store = get_store()
    rows = store.filtered(site=body.site) if body.site else store.incidents
    top_reports = sorted(rows, key=lambda r: r["sif_probability"], reverse=True)
    pdf_bytes = build_bulletin_pdf(body.scope, body.site, store.aggregates(), top_reports)
    return Response(content=pdf_bytes, media_type="application/pdf", headers={
        "Content-Disposition": f'inline; filename="sif_sentinel_{body.scope}_bulletin.pdf"'
    })
