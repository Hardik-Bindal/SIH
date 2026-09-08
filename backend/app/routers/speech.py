from functools import lru_cache
from io import BytesIO
from pathlib import Path
from threading import Lock
import wave

from fastapi import APIRouter, HTTPException, Query, Response
from piper import PiperVoice


router = APIRouter()
MODEL_DIR = Path(__file__).resolve().parents[2] / "models" / "tts"
MODEL_PATH = MODEL_DIR / "hi_IN-priyamvada-medium.onnx"
CONFIG_PATH = MODEL_DIR / "hi_IN-priyamvada-medium.onnx.json"
SYNTHESIS_LOCK = Lock()


@lru_cache(maxsize=1)
def _hindi_voice() -> PiperVoice:
    if not MODEL_PATH.is_file() or not CONFIG_PATH.is_file():
        raise FileNotFoundError(
            "Hindi voice model is missing. Run backend/scripts/download_hindi_voice.py."
        )
    return PiperVoice.load(MODEL_PATH, CONFIG_PATH)


@lru_cache(maxsize=128)
def _synthesise(text: str, language: str) -> bytes:
    audio = BytesIO()
    if language != "hi":
        raise ValueError("Only Hindi server-side speech is supported")
    with SYNTHESIS_LOCK, wave.open(audio, "wb") as wav_file:
        _hindi_voice().synthesize_wav(text, wav_file)
    return audio.getvalue()


@router.get("/api/v1/speech")
def speech(
    text: str = Query(min_length=1, max_length=1500),
    language: str = Query(default="hi", pattern="^hi$"),
):
    """Generate a short spoken recommendation when the device has no voice."""
    try:
        audio = _synthesise(" ".join(text.split()), language)
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail={
                "error": {
                    "code": "SPEECH_UNAVAILABLE",
                    "message": "Speech generation is temporarily unavailable.",
                }
            },
        ) from exc
    return Response(
        content=audio,
        media_type="audio/wav",
        headers={"Cache-Control": "public, max-age=86400"},
    )
