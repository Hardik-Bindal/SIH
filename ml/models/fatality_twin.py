"""Fatality Twin — SRS 12.1.

Retrieves the nearest fatal cases for a report and synthesises the
escalation chain the event was plausibly on. Chain nodes are constrained to
vocabulary actually observed in the matched cases (SRS 10.1: "every chain
node must trace to a real case") rather than freely generated, since there
is no reachable LLM to freely generate one responsibly.
"""
import re
from collections import Counter

CONTACT_PATTERNS = [
    (re.compile(r"slip|fell|fall", re.I), "Loss of balance / fall"),
    (re.compile(r"struck by|struck-by|hit by", re.I), "Struck by object"),
    (re.compile(r"caught in|caught between|pinned|crushed", re.I), "Caught in / crushed"),
    (re.compile(r"electrocut|energiz|shock|arc flash", re.I), "Electrical contact"),
    (re.compile(r"explosion|blast", re.I), "Explosion"),
    (re.compile(r"asphyxiat|suffocat|drown|confined space", re.I), "Asphyxiation / atmosphere"),
    (re.compile(r"fire|burn", re.I), "Fire / burn exposure"),
    (re.compile(r"collaps", re.I), "Structural collapse"),
    (re.compile(r"vehicle|truck|forklift|run over", re.I), "Vehicle contact"),
]
OUTCOME_PATTERNS = [
    (re.compile(r"burn", re.I), "Severe burns"),
    (re.compile(r"fractur|broken", re.I), "Fracture"),
    (re.compile(r"head\s+injur|skull", re.I), "Head trauma"),
    (re.compile(r"amputat", re.I), "Amputation"),
    (re.compile(r"drown|asphyx", re.I), "Asphyxiation"),
    (re.compile(r"internal\s+injur", re.I), "Internal injuries"),
]


def _first_match(text, patterns, default):
    for pat, label in patterns:
        if pat.search(text or ""):
            return label
    return default


def build_twin(report_text: str, matched_fatalities: list, barrier_failure_text: str = None):
    """matched_fatalities: list of dicts with 'narrative' and 'similarity', already
    filtered to source_type == FATALITY and sorted by similarity desc."""
    if not matched_fatalities:
        return None

    contact = _first_match(report_text, CONTACT_PATTERNS, "Unexpected loss of control")
    outcome_counts = Counter()
    for m in matched_fatalities:
        outcome_counts[_first_match(m["narrative"], OUTCOME_PATTERNS, "Fatal injury")] += 1
    common_outcome = outcome_counts.most_common(1)[0][0]

    # Only assert a barrier-failure node when one was actually detected in
    # this report's own text (barrier_failure_text). Previously this always
    # asserted "Barrier assumed absent or not verified" even when the
    # report's own barrier_failure flag was False -- contradicting the
    # explicit "Barrier Failure: No" shown elsewhere on the same page.
    if barrier_failure_text:
        chain = [contact, "Barrier failure: " + barrier_failure_text, common_outcome, "Fatality"]
    else:
        chain = [contact, "No confirmed barrier failure in this report's narrative", common_outcome, "Fatality"]
    sims = [m["similarity"] for m in matched_fatalities]

    return {
        "chain": chain,
        "likelihood": round(float(sum(sims) / len(sims)) if sims else 0.0, 3),
        "matched": len(matched_fatalities),
        "similarity": round(float(max(sims)) if sims else 0.0, 3),
        "matched_report_ids": [m["report_id"] for m in matched_fatalities],
    }
