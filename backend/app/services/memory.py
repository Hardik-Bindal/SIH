"""
Safety Memory — "an AI that remembers every safety incident ever reported."

The problem this exists for: every report is reviewed in isolation, so the
fourth occurrence of a pattern is investigated as if it were the first. This
service compares any report — historical or just-submitted — against the
entire 16k-record corpus and answers three questions a reviewer cannot
answer from memory:

  1. Has this happened before?      -> ranked matches with similarity
  2. What was the common cause?     -> the rule/barrier shared by the matches
  3. What was done about it?        -> the precedent-driven action

Every number here is derived from records actually retrieved: the "common
cause" is a counted majority across the matched set (support/of is always
reported alongside it, so a 2-of-3 majority never reads like a law), and the
matched report IDs are real and clickable. Nothing is generated.

Signals for a matched record come from whichever source is authoritative for
it: a scored incident carries its own model-assigned lsr_tags/barrier_failure,
while a fatality record (which is narrative-only) is passed through the same
deterministic rule extraction used everywhere else in the pipeline.
"""
import json
from collections import Counter
from functools import lru_cache
from pathlib import Path

import numpy as np

from ml.pipeline.inference import get_engine
from ml.pipeline.ner import extract_entities
from ml.models.lsr_rules import weak_label, RULE_LABELS
from ml.models.recommendations import RULE_ACTION_TEMPLATES, DEFAULT_ACTIONS

ARTIFACTS = Path(__file__).resolve().parent.parent.parent.parent / "ml" / "artifacts"

# Confidence floor for a match to count as "the same kind of event". Below
# this the neighbour is topically adjacent at best, and folding it into a
# common-cause vote would manufacture agreement that isn't there.
MATCH_FLOOR = 0.30
STRONG_MATCH = 0.55
LSR_TAG_FLOOR = 0.35

# Plain-language cause statements. The LSR rule names what was violated;
# these say what actually went wrong in words an HSE officer would use.
CAUSE_PHRASING = {
    "ENERGY_ISOLATION": "Energy isolation (LOTO) not verified before work",
    "CONFINED_SPACE": "Confined-space entry controls (gas test / standby) not confirmed",
    "WORK_AT_HEIGHT": "Fall protection or edge protection missing at height",
    "LINE_OF_FIRE": "Worker positioned in the line of fire of a moving/falling load",
    "BYPASSING_CONTROLS": "Guard or safety device removed, bypassed or inoperable",
    "HOT_WORK": "Hot-work permit / fire-watch controls not in place",
    "SAFE_MECHANICAL_LIFTING": "Lifting operation performed with unverified rigging or load path",
    "WORK_AUTHORISATION": "Work started without a valid permit or authorisation",
    "DRIVING_SAFETY": "Vehicle/mobile-equipment operation without adequate controls",
}


@lru_cache(maxsize=1)
def _patterns_payload():
    path = ARTIFACTS / "patterns.json"
    if not path.exists():
        return None
    with open(path) as f:
        payload = json.load(f)
    payload["_centroids"] = np.array(payload["centroids"], dtype="float32")
    payload["_by_id"] = {p["pattern_id"]: p for p in payload["patterns"]}
    return payload


def list_patterns(limit=None):
    payload = _patterns_payload()
    if not payload:
        return {"patterns": [], "corpus_size": 0, "available": False}
    patterns = payload["patterns"]
    return {
        "patterns": patterns[:limit] if limit else patterns,
        "corpus_size": payload["corpus_size"],
        "n_clusters": payload["n_clusters"],
        "method": payload["method"],
        "available": True,
    }


def get_pattern(pattern_id: int):
    payload = _patterns_payload()
    if not payload:
        return None
    return payload["_by_id"].get(int(pattern_id))


def _assign_pattern(vector):
    """Nearest cluster centroid — one dot product, no re-clustering."""
    payload = _patterns_payload()
    if not payload:
        return None
    sims = payload["_centroids"] @ np.asarray(vector, dtype="float32")
    best = int(np.argmax(sims))
    pattern = payload["_by_id"].get(best)
    if not pattern:
        return None
    return {**pattern, "assignment_similarity": round(float(sims[best]), 3)}


def _signals_for(store, match):
    """Rules + barrier failure for one matched record, from whichever source
    is authoritative for it."""
    rid = match["report_id"]
    scored = store.get_by_id(rid)
    if scored:
        rules = [t["rule"] for t in scored.get("lsr_tags", []) if t["score"] >= LSR_TAG_FLOOR]
        return {
            "rules": rules,
            "barrier_failure": bool(scored.get("barrier_failure")),
            "site": scored.get("site"),
            "reported_on": scored.get("reported_on"),
            "risk_band": scored.get("risk_band"),
        }
    narrative = match.get("narrative", "")
    weak = weak_label(narrative)
    fatality = store.fatalities_by_id.get(rid, {})
    return {
        "rules": [r for r in RULE_LABELS if weak.get(r)],
        "barrier_failure": bool(extract_entities(narrative).get("barrier_failure")),
        "site": match.get("site") or fatality.get("site"),
        "reported_on": fatality.get("reported_on"),
        "risk_band": None,
    }


def _recommended_action(rule):
    tpl = RULE_ACTION_TEMPLATES.get(rule, DEFAULT_ACTIONS)
    return {"corrective": tpl["corrective"], "preventive": tpl["preventive"], "rule": rule}


def recall(store, narrative: str, exclude_id: str = None, top_k: int = 8) -> dict:
    """Compare one narrative against the whole corpus and summarise what the
    organisation already knows about events like it."""
    engine = get_engine()
    vector = engine.encoder.encode_one(narrative)

    # Over-fetch, then drop the report itself and anything below the floor.
    raw = engine.index.search(vector, top_k=top_k + 6)
    matches = [
        m for m in raw
        if m["report_id"] != exclude_id and m["similarity"] >= MATCH_FLOOR
    ][:top_k]

    pattern = _assign_pattern(vector)

    if not matches:
        return {
            "matches": [],
            "match_count": 0,
            "top_similarity": round(float(raw[0]["similarity"]), 3) if raw else 0.0,
            "common_cause": None,
            "recommended_action": None,
            "recurrence": None,
            "pattern": pattern,
            "verdict": "NO_PRECEDENT",
            "verdict_text": (
                "No sufficiently similar report exists in the 16k-record corpus. "
                "This appears to be a genuinely novel event — treat it as unprecedented "
                "rather than assuming it is routine."
            ),
            "citations": [],
        }

    enriched, rule_votes, barrier_votes = [], Counter(), 0
    for m in matches:
        sig = _signals_for(store, m)
        for rule in sig["rules"]:
            rule_votes[rule] += 1
        if sig["barrier_failure"]:
            barrier_votes += 1
        enriched.append({
            "report_id": m["report_id"],
            "source_type": m["source_type"],
            "similarity": round(float(m["similarity"]), 3),
            "narrative": m.get("narrative", ""),
            "site": sig["site"],
            "reported_on": str(sig["reported_on"]) if sig["reported_on"] else None,
            "risk_band": sig["risk_band"],
            "rules": sig["rules"],
            "barrier_failure": sig["barrier_failure"],
            "is_fatal": m["source_type"] == "FATALITY",
        })

    n = len(enriched)
    common_cause = None
    if rule_votes:
        rule, support = rule_votes.most_common(1)[0]
        common_cause = {
            "rule": rule,
            "cause": CAUSE_PHRASING.get(rule, rule.replace("_", " ").title()),
            "support": support,
            "of": n,
            "share": round(support / n, 2),
            "is_majority": support > n / 2,
        }

    fatal_matches = sum(1 for e in enriched if e["is_fatal"])
    sites = sorted({e["site"] for e in enriched if e["site"]})
    dates = sorted(e["reported_on"] for e in enriched if e["reported_on"])
    top_sim = enriched[0]["similarity"]
    strong = [e for e in enriched if e["similarity"] >= STRONG_MATCH]

    if fatal_matches and top_sim >= STRONG_MATCH:
        verdict = "REPEAT_FATAL_PATTERN"
        verdict_text = (
            f"This closely matches {fatal_matches} case(s) that ended in a fatality "
            f"(best match {top_sim:.0%}). The same conditions have already killed someone."
        )
    elif strong:
        verdict = "REPEAT_PATTERN"
        verdict_text = (
            f"{len(strong)} strongly similar report(s) already exist (best match {top_sim:.0%}). "
            f"This is a recurrence, not a first occurrence."
        )
    elif fatal_matches:
        verdict = "RELATED_FATAL_PRECEDENT"
        verdict_text = (
            f"{fatal_matches} related fatal case(s) exist in the corpus at moderate similarity "
            f"(best {top_sim:.0%}) — related circumstances rather than an exact recurrence."
        )
    else:
        verdict = "WEAK_PRECEDENT"
        verdict_text = (
            f"Only loosely similar reports exist (best match {top_sim:.0%}). "
            f"Treat the precedent below as context, not as an established pattern."
        )

    return {
        "matches": enriched,
        "match_count": n,
        "top_similarity": top_sim,
        "common_cause": common_cause,
        "recurring_barrier": {
            "detected_in": barrier_votes, "of": n,
            "share": round(barrier_votes / n, 2),
        },
        "recommended_action": _recommended_action(common_cause["rule"]) if common_cause else None,
        "recurrence": {
            "total_matches": n,
            "strong_matches": len(strong),
            "fatal_matches": fatal_matches,
            "sites_affected": sites,
            "site_count": len(sites),
            "first_seen": dates[0][:10] if dates else None,
            "last_seen": dates[-1][:10] if dates else None,
        },
        "pattern": pattern,
        "verdict": verdict,
        "verdict_text": verdict_text,
        "citations": [e["report_id"] for e in enriched[:5]],
    }


def recall_for_report(store, report_id: str):
    report = store.get_by_id(report_id)
    if report:
        return recall(store, report["narrative"], exclude_id=report_id)
    fatality = store.fatalities_by_id.get(report_id)
    if fatality:
        return recall(store, fatality["narrative"], exclude_id=report_id)
    return None
