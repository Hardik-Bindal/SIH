"""
Recurring-pattern discovery — the corpus-wide half of Safety Memory.

The premise of the Safety Memory USP is that incidents are filed, closed and
forgotten one at a time, so nobody notices that four of them were the same
event with different luck. Per-report recall (backend/app/services/memory.py)
answers "has this happened before?"; this module answers the complementary
question the organisation never asks: "what keeps happening?"

Method: KMeans over the 384-dim narrative embeddings of the FULL corpus
(incidents + fatalities together, so a near miss and the fatality it
resembles land in the same pattern), then for each cluster derive
  - the dominant Life Saving Rule across its members,
  - how often a barrier failure is detected in it,
  - how many members are confirmed fatalities,
  - which sites it spans and over what date range,
  - a human-readable label from the cluster centroid's top TF-IDF terms.

Centroids are saved alongside the patterns so a brand-new report can be
assigned to its pattern at inference time with a single dot product, without
re-running the clustering.

Output: ml/artifacts/patterns.json
"""
import json
import sys
from collections import Counter
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.cluster import KMeans

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT))

from ml.pipeline.embeddings import NarrativeEncoder, ARTIFACTS  # noqa: E402
from ml.models.lsr_rules import weak_label, RULE_LABELS  # noqa: E402
from ml.pipeline.ner import extract_entities  # noqa: E402

PROCESSED = ROOT / "data" / "processed"
N_CLUSTERS = 28
# Stop-terms that describe every OSHA narrative and so label nothing.
_GENERIC_TERMS = {
    "employee", "employees", "worker", "workers", "died", "killed", "fatally",
    "hospitalized", "injured", "injury", "injuries", "sustained", "day", "later",
    "am", "pm", "approximately", "coworker", "victim",
}


def _top_terms(encoder, centroid, n=6):
    """Project a cluster centroid back into TF-IDF space to name the pattern."""
    try:
        weights = encoder.svd.inverse_transform(centroid.reshape(1, -1))[0]
    except Exception:
        return []
    names = encoder.vectorizer.get_feature_names_out()
    order = np.argsort(weights)[::-1]
    terms = []
    for idx in order[: n * 8]:
        term = names[idx]
        if term in _GENERIC_TERMS or any(w in _GENERIC_TERMS for w in term.split()):
            continue
        # Skip a bigram whose words are already covered by a kept term.
        if any(term in kept or kept in term for kept in terms):
            continue
        terms.append(term)
        if len(terms) >= n:
            break
    return terms


def _label_for(terms, dominant_rule):
    phrase = ", ".join(terms[:3]) if terms else "unclassified narrative group"
    rule = dominant_rule.replace("_", " ").title() if dominant_rule else "No dominant rule"
    return f"{phrase} ({rule})"


def build():
    incidents = pd.read_parquet(PROCESSED / "incidents.parquet")
    fatalities = pd.read_parquet(PROCESSED / "fatalities.parquet")
    inc_vecs = np.load(ARTIFACTS / "incident_vectors.npy")
    fat_vecs = np.load(ARTIFACTS / "fatality_vectors.npy")
    encoder = NarrativeEncoder.load(ARTIFACTS / "encoder.pkl")

    vectors = np.vstack([inc_vecs, fat_vecs])
    frame = pd.concat(
        [
            incidents.assign(source_type="INCIDENT")[
                ["report_id", "narrative", "site", "area", "department", "reported_on",
                 "barrier_failure", "source_type", "human_factor", "event_type"]
            ],
            fatalities.assign(source_type="FATALITY", human_factor=None, event_type=None)[
                ["report_id", "narrative", "site", "area", "department", "reported_on",
                 "barrier_failure", "source_type", "human_factor", "event_type"]
            ],
        ],
        ignore_index=True,
    )
    assert len(frame) == len(vectors), f"corpus/vector mismatch: {len(frame)} vs {len(vectors)}"

    print(f"Clustering {len(vectors)} narratives into {N_CLUSTERS} patterns...")
    km = KMeans(n_clusters=N_CLUSTERS, random_state=42, n_init=10)
    labels = km.fit_predict(vectors)
    frame["cluster"] = labels

    print("Deriving rule / barrier signals per pattern...")
    rules_per_row = frame.apply(
        lambda r: weak_label(r["narrative"], r.get("human_factor"), r.get("event_type")), axis=1
    )
    for rule in RULE_LABELS:
        frame[f"rule_{rule}"] = [d[rule] for d in rules_per_row]

    patterns = []
    for cid in range(N_CLUSTERS):
        members = frame[frame.cluster == cid]
        if members.empty:
            continue
        rule_counts = {rule: int(members[f"rule_{rule}"].sum()) for rule in RULE_LABELS}
        dominant_rule, dominant_count = max(rule_counts.items(), key=lambda kv: kv[1])
        if dominant_count == 0:
            dominant_rule = None

        fatal_members = int((members.source_type == "FATALITY").sum())
        barrier_members = int(members["barrier_failure"].fillna(False).astype(bool).sum())
        dates = pd.to_datetime(members["reported_on"], errors="coerce").dropna()
        terms = _top_terms(encoder, km.cluster_centers_[cid])

        patterns.append({
            "pattern_id": int(cid),
            "label": _label_for(terms, dominant_rule),
            "top_terms": terms,
            "size": int(len(members)),
            "incident_count": int((members.source_type == "INCIDENT").sum()),
            "fatal_count": fatal_members,
            "fatal_rate": round(fatal_members / len(members), 3),
            "dominant_rule": dominant_rule,
            "dominant_rule_support": dominant_count,
            "dominant_rule_rate": round(dominant_count / len(members), 3),
            "barrier_failure_count": barrier_members,
            "barrier_failure_rate": round(barrier_members / len(members), 3),
            "rule_counts": rule_counts,
            "sites": [{"site": s, "count": int(c)} for s, c in
                      Counter(members["site"].dropna()).most_common(5)],
            "site_spread": int(members["site"].nunique()),
            "departments": [{"department": d, "count": int(c)} for d, c in
                            Counter(members["department"].dropna()).most_common(3)],
            "first_seen": dates.min().strftime("%Y-%m-%d") if not dates.empty else None,
            "last_seen": dates.max().strftime("%Y-%m-%d") if not dates.empty else None,
            "examples": [
                {"report_id": r.report_id, "source_type": r.source_type,
                 "site": r.site, "narrative": r.narrative[:200]}
                for r in members.head(5).itertuples()
            ],
        })

    # Ranking. The obvious score — rank by fatality rate — puts pure-fatality
    # clusters on top, and those are the *least* actionable: a cluster of 1,201
    # historical fatalities with no live incidents in it describes the past
    # and offers nothing to intervene on. The pattern worth a supervisor's
    # attention is the mixed one: current incidents sitting in the same
    # cluster as confirmed fatalities, i.e. near misses that already look
    # like something that killed someone. `mix` scores that directly (0 for a
    # single-source cluster, 1 when incident and fatal counts are balanced),
    # and `is_actionable` flags it for the UI.
    total = max(len(frame), 1)
    for p in patterns:
        inc, fat = p["incident_count"], p["fatal_count"]
        mix = min(inc, fat) / max(inc, fat) if inc and fat else 0.0
        p["mix_ratio"] = round(mix, 3)
        # A meaningful mix, not just "has some of each": 15 incidents against
        # 890 fatalities is a fatality cluster with a rounding error in it,
        # and badging that "actionable" in the UI would be a claim the data
        # does not support.
        p["is_actionable"] = bool(inc >= 10 and fat >= 10 and mix >= 0.15)
        p["severity_score"] = round(
            0.35 * mix
            + 0.25 * p["fatal_rate"]
            + 0.25 * min(p["size"] / total * 8, 1.0)
            + 0.15 * min(p["site_spread"] / 9, 1.0),
            4,
        )
    patterns.sort(key=lambda p: p["severity_score"], reverse=True)

    payload = {
        "patterns": patterns,
        "centroids": km.cluster_centers_.tolist(),
        "n_clusters": N_CLUSTERS,
        "corpus_size": int(len(frame)),
        "method": "KMeans over 384-dim TF-IDF/SVD narrative embeddings (see docs/DEVIATIONS.md)",
    }
    with open(ARTIFACTS / "patterns.json", "w") as f:
        json.dump(payload, f)

    print(f"Wrote {len(patterns)} patterns over {len(frame)} narratives.")
    for p in patterns[:5]:
        print(f"  [{p['pattern_id']:2d}] {p['label']}  size={p['size']} "
              f"fatal={p['fatal_count']} sites={p['site_spread']}")


if __name__ == "__main__":
    build()
