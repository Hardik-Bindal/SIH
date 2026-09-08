import io

from fastapi import APIRouter, File, UploadFile, HTTPException

router = APIRouter()

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB

# Resolve the PDF reader once at import time. pypdf pulls in `cryptography`
# for its crypt providers, and a half-installed native backend raises a Rust
# PanicException (a BaseException, not an Exception) that a per-request
# `except Exception` would not catch. Detecting it here turns a hard 500 into
# a clean, explainable 503.
try:
    from pypdf import PdfReader
    _PDF_IMPORT_ERROR = None
except BaseException as exc:  # noqa: BLE001 - see comment above
    PdfReader = None
    _PDF_IMPORT_ERROR = str(exc)


@router.post("/api/v1/upload/extract-text")
async def extract_text_from_pdf(file: UploadFile = File(...)):
    if file.content_type not in ("application/pdf",):
        raise HTTPException(
            status_code=400,
            detail={"error": {"code": "INVALID_FILE_TYPE", "message": "Only PDF files are accepted."}},
        )

    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail={"error": {"code": "FILE_TOO_LARGE", "message": "File exceeds 10 MB limit."}},
        )
    if len(contents) == 0:
        raise HTTPException(
            status_code=400,
            detail={"error": {"code": "EMPTY_FILE", "message": "The uploaded file is empty."}},
        )

    if PdfReader is None:
        raise HTTPException(
            status_code=503,
            detail={"error": {
                "code": "PDF_ENGINE_UNAVAILABLE",
                "message": f"PDF text extraction is unavailable on this server: {_PDF_IMPORT_ERROR}",
            }},
        )

    try:
        reader = PdfReader(io.BytesIO(contents))
        pages_text = []
        for page in reader.pages:
            text = page.extract_text()
            if text:
                pages_text.append(text.strip())

        full_text = "\n\n".join(pages_text).strip()
        if not full_text:
            return {
                "text": "",
                "pages": len(reader.pages),
                "warning": "No extractable text found. The PDF may contain only images or scanned content.",
            }

        return {"text": full_text, "pages": len(reader.pages)}

    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail={"error": {"code": "PDF_PARSE_ERROR", "message": f"Could not parse PDF: {exc}"}},
        )
