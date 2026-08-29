"""
Narrative encoder + vector index for SIF Sentinel AI.

SRS 7.2 specifies Sentence-Transformers' all-MiniLM-L6-v2 for 384-dim
narrative embeddings, served through MongoDB Atlas Vector Search (SRS 9.3).
This sandbox has no outbound access to huggingface.co (blocked by org
egress policy) so pretrained transformer weights cannot be downloaded, and
there is no reachable MongoDB Atlas cluster. See docs/DEVIATIONS.md.

Substitute used here, offline end-to-end:
  - Encoder: TF-IDF (1-2 grams) -> TruncatedSVD(384) ("LSA" embedding),
    fit once on the combined incidents+fatalities corpus and pickled, so a
    freshly-submitted report is projected into the *same* 384-dim space as
    the historical corpus.
  - Vector index: FAISS IndexFlatIP over L2-normalised vectors (== cosine
    similarity), with an id map back to (source_type, report_id).
The public interface (encode_one, encode_many, search) is written so a real
sentence-transformer + Atlas Vector Search could be dropped in later without
changing any caller.
"""
import json
import pickle
import re
from pathlib import Path

import faiss
import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.decomposition import TruncatedSVD
from sklearn.preprocessing import normalize

ROOT = Path(__file__).resolve().parent.parent.parent
PROCESSED = ROOT / "data" / "processed"
ARTIFACTS = ROOT / "ml" / "artifacts"
ARTIFACTS.mkdir(parents=True, exist_ok=True)

EMBED_DIM = 384

# The OSHA incident abstracts share a near-fixed report-template preamble
# ("At 9:00 a.m. on August 10, 2017, an employee was ..."). Left in, its
# high-frequency shared tokens (times, dates, "employee") dominate cosine
# similarity between incidents purely on template overlap and crowd out the
# stylistically different (and much shorter) fatality narratives from
# nearest-neighbour results regardless of actual content similarity. Stripped
# only for the embedding input -- the stored/displayed narrative is untouched.
_BOILERPLATE_RE = re.compile(
    r"^at\s+\d{1,2}:\d{2}\s*[ap]\.?m\.?\s+on\s+[a-z]+\s+\d{1,2},?\s+\d{4},?\s*",
    re.IGNORECASE,
)


def _strip_boilerplate(text: str) -> str:
    return _BOILERPLATE_RE.sub("", text or "")


class NarrativeEncoder:
    def __init__(self, vectorizer=None, svd=None):
        self.vectorizer = vectorizer
        self.svd = svd

    def fit(self, texts):
        texts = [_strip_boilerplate(t) for t in texts]
        self.vectorizer = TfidfVectorizer(
            max_features=60000, ngram_range=(1, 2), min_df=2, stop_words="english",
            sublinear_tf=True,
        )
        X = self.vectorizer.fit_transform(texts)
        n_components = min(EMBED_DIM, X.shape[1] - 1, X.shape[0] - 1)
        self.svd = TruncatedSVD(n_components=n_components, random_state=42)
        self.svd.fit(X)
        return self

    def encode(self, texts) -> np.ndarray:
        texts = [_strip_boilerplate(t) for t in texts]
        X = self.vectorizer.transform(texts)
        V = self.svd.transform(X)
        if V.shape[1] < EMBED_DIM:
            pad = np.zeros((V.shape[0], EMBED_DIM - V.shape[1]), dtype=V.dtype)
            V = np.hstack([V, pad])
        return normalize(V.astype("float32"))

    def encode_one(self, text: str) -> np.ndarray:
        return self.encode([text])[0]

    def save(self, path: Path):
        with open(path, "wb") as f:
            pickle.dump({"vectorizer": self.vectorizer, "svd": self.svd}, f)

    @classmethod
    def load(cls, path: Path):
        with open(path, "rb") as f:
            d = pickle.load(f)
        return cls(d["vectorizer"], d["svd"])


class VectorIndex:
    """Cosine-similarity FAISS index (Atlas Vector Search substitute)."""

    def __init__(self, dim=EMBED_DIM):
        self.dim = dim
        # A per-source-type sub-index each, so a FATALITY-filtered query
        # returns the genuine top-k nearest fatalities rather than an
        # oversample-then-filter slice of a mixed index (which starves the
        # minority-in-the-neighbourhood source type -- see docs/DEVIATIONS.md
        # note on retrieval quality). "ALL" holds every vector for unfiltered
        # queries.
        self.indices = {"ALL": faiss.IndexFlatIP(dim)}
        self.meta = {"ALL": []}

    def add(self, vectors: np.ndarray, meta_rows):
        source_type = meta_rows[0]["source_type"] if meta_rows else None
        if source_type and source_type not in self.indices:
            self.indices[source_type] = faiss.IndexFlatIP(self.dim)
            self.meta[source_type] = []
        self.indices["ALL"].add(vectors)
        self.meta["ALL"].extend(meta_rows)
        if source_type:
            self.indices[source_type].add(vectors)
            self.meta[source_type].extend(meta_rows)

    def _search_one(self, key, query_vec, top_k, site=None, area=None):
        meta = self.meta.get(key, [])
        if not meta:
            return []
        oversample = top_k * 10 if (site or area) else top_k
        k = min(len(meta), oversample) or 1
        D, I = self.indices[key].search(query_vec.reshape(1, -1), k)
        results = []
        for score, idx in zip(D[0], I[0]):
            if idx < 0:
                continue
            m = meta[idx]
            if site and m.get("site") != site:
                continue
            if area and m.get("area") != area:
                continue
            results.append({**m, "similarity": float(score)})
            if len(results) >= top_k:
                break
        return results

    def search(self, query_vec: np.ndarray, top_k=10, source_type=None, site=None, area=None):
        key = source_type if source_type in self.indices else "ALL"
        return self._search_one(key, query_vec, top_k, site=site, area=area)

    def save(self, index_path: Path, meta_path: Path):
        # index_path is used as a base path; one FAISS file per source-type key.
        for key, idx in self.indices.items():
            faiss.write_index(idx, str(index_path) + f".{key}")
        with open(meta_path, "w") as f:
            json.dump({"keys": list(self.indices.keys()), "meta": self.meta}, f)

    @classmethod
    def load(cls, index_path: Path, meta_path: Path):
        obj = cls.__new__(cls)
        with open(meta_path) as f:
            payload = json.load(f)
        obj.meta = payload["meta"]
        obj.indices = {key: faiss.read_index(str(index_path) + f".{key}") for key in payload["keys"]}
        obj.dim = EMBED_DIM
        return obj


def build_and_save():
    incidents = pd.read_parquet(PROCESSED / "incidents.parquet")
    fatalities = pd.read_parquet(PROCESSED / "fatalities.parquet")

    combined_text = pd.concat([incidents["narrative"], fatalities["narrative"]], ignore_index=True)
    encoder = NarrativeEncoder().fit(combined_text.tolist())
    encoder.save(ARTIFACTS / "encoder.pkl")

    inc_vecs = encoder.encode(incidents["narrative"].tolist())
    fat_vecs = encoder.encode(fatalities["narrative"].tolist())

    index = VectorIndex()
    inc_meta = [
        {"report_id": r.report_id, "source_type": "INCIDENT", "site": r.site, "area": r.area,
         "narrative": r.narrative[:280], "sif_positive": int(r.sif_positive)}
        for r in incidents.itertuples()
    ]
    fat_meta = [
        {"report_id": r.report_id, "source_type": "FATALITY", "site": r.site, "area": r.area,
         "narrative": r.narrative[:280], "sif_positive": 1}
        for r in fatalities.itertuples()
    ]
    index.add(inc_vecs, inc_meta)
    index.add(fat_vecs, fat_meta)
    index.save(ARTIFACTS / "vector_index.faiss", ARTIFACTS / "vector_meta.json")

    np.save(ARTIFACTS / "incident_vectors.npy", inc_vecs)
    np.save(ARTIFACTS / "fatality_vectors.npy", fat_vecs)

    print(f"Encoder fit on {len(combined_text)} narratives, {inc_vecs.shape[1]}-dim.")
    print(f"Vector index: {index.indices['ALL'].ntotal} vectors "
          f"({len(inc_meta)} incidents + {len(fat_meta)} fatalities).")


if __name__ == "__main__":
    build_and_save()
