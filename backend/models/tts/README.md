# Offline Hindi speech model

Recommendation audio uses Piper's `hi_IN-priyamvada-medium` voice locally. The
recommendation text never leaves the machine.

After installing `backend/requirements.txt`, download the voice once:

```powershell
python backend/scripts/download_hindi_voice.py
```

The 64 MB ONNX model is ignored by Git. The download script verifies the model
and configuration checksums before installing them here.
