"""Download and verify the Piper Hindi voice used by the speech endpoint."""

from hashlib import md5
from pathlib import Path
from urllib.request import urlretrieve


BASE_URL = "https://huggingface.co/rhasspy/piper-voices/resolve/main/hi/hi_IN/priyamvada/medium"
DESTINATION = Path(__file__).resolve().parents[1] / "models" / "tts"
FILES = {
    "hi_IN-priyamvada-medium.onnx": "7d5e20c2d1e72de8ed772f222e679626",
    "hi_IN-priyamvada-medium.onnx.json": "599ca4dc5d421a9c66692433f618e080",
}


def digest(path: Path) -> str:
    checksum = md5()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            checksum.update(chunk)
    return checksum.hexdigest()


def main() -> None:
    DESTINATION.mkdir(parents=True, exist_ok=True)
    for filename, expected in FILES.items():
        target = DESTINATION / filename
        if target.is_file() and digest(target) == expected:
            print(f"Ready: {filename}")
            continue
        temporary = target.with_suffix(target.suffix + ".download")
        print(f"Downloading {filename}...")
        urlretrieve(f"{BASE_URL}/{filename}", temporary)
        actual = digest(temporary)
        if actual != expected:
            temporary.unlink(missing_ok=True)
            raise RuntimeError(f"Checksum mismatch for {filename}: {actual}")
        temporary.replace(target)
        print(f"Ready: {filename}")


if __name__ == "__main__":
    main()
