"""
Gazetteer-driven entity extraction for SIF Sentinel AI.

SRS 10.1 specifies "spaCy pipeline augmented with a curated safety gazetteer
and LLM back-fill for unseen phrasing". This sandbox has no outbound access
to an LLM endpoint or to Hugging Face (huggingface.co is blocked by org
egress policy), so the back-fill stage is omitted; everything here runs on
a blank spaCy English pipeline + EntityRuler, which needs no downloaded
model weights. See docs/DEVIATIONS.md.

This module is imported both by the bulk ETL enrichment step (ml/pipeline/etl.py)
and by the live single-report inference path in the backend, so historical
and newly-submitted reports go through the exact same extraction logic.
"""
import re
import spacy
from spacy.pipeline import EntityRuler

HAZARDS = [
    "energized cable", "live circuit", "stored energy", "residual pressure",
    "unguarded machinery", "unguarded opening", "exposed rebar", "falling object",
    "unstable scaffold", "unstable ladder", "confined space atmosphere",
    "flammable vapor", "toxic gas", "chemical spill", "hot surface",
    "moving vehicle", "suspended load", "electrical shock hazard", "arc flash",
    "trench collapse", "unprotected edge", "slippery surface", "oil-contaminated grating",
    "excessive noise", "asbestos", "silica dust", "carbon monoxide",
]

EQUIPMENT = [
    "mechanical power press", "drill", "crane", "forklift", "scaffold", "ladder",
    "junction box", "circuit breaker", "conveyor", "grinder", "saw", "excavator",
    "hoist", "winch", "compressor", "generator", "welding machine", "cutting torch",
    "pressure vessel", "pipeline", "valve assembly", "gas cylinder", "man lift",
    "dump truck", "backhoe", "bulldozer", "chainsaw", "nail gun", "power tool",
]

ACTIVITIES = [
    "welding", "excavation", "scaffolding erection", "crane lift", "lifting operation",
    "confined space entry", "electrical maintenance", "vehicle operation",
    "material handling", "hot work", "working at height", "energy isolation",
    "lockout tagout", "demolition", "trenching", "roofing", "concrete pouring",
    "pipe fitting", "grinding", "cutting", "drilling", "painting", "housekeeping",
    "vehicle loading", "equipment inspection", "manual lifting",
]

CONDITIONS = [
    "isolation not verified", "guard removed", "ppe not worn", "no fall protection",
    "unmarked hazard", "improper lockout", "inadequate ventilation",
  "unsecured load", "damaged equipment", "poor housekeeping",
    "missing barricade", "inadequate lighting", "no spotter", "bypassed interlock",
    "no permit to work", "faulty wiring", "worn out equipment",
]

# Barrier-failure detection.
#
# Calibration note (measured, not assumed): an earlier, tighter version of
# these patterns fired on 2 of 16,249 narratives, which made the barrier
# signal effectively dead everywhere it is consumed -- risk fusion (SRS
# §10.2 weights it at 0.10), the Fatality Twin chain, root-cause assignment
# and CAPA selection. The patterns below are written to match how OSHA
# abstracts actually phrase a failed control ("the guard HAD BEEN removed",
# "was NOT WEARING a harness"), with bounded gaps for intervening words.
#
# Even so, barrier language appears in only ~1% of these narratives. That is
# a property of the source data, not of industrial safety: OSHA abstracts
# record what happened, rarely which control failed. A false barrier_failure
# would inflate a risk band on invented evidence, so these stay conservative
# and precise -- a missing barrier flag means "this narrative does not state
# a failed control", never "no barrier failed". See docs/DEVIATIONS.md.
BARRIER_FAILURE_PATTERNS = [
    # Energy isolation / LOTO
    r"\bnot\s+(?:been\s+)?lock(?:ed)?\s*[- ]?out\b",
    r"\block\s*out\b[^.]{0,20}?\b(?:fail|not\s+verif|malfunction|bypass|remov|not\s+perform|not\s+used)",
    r"\bfailed\s+to\s+(?:lock|tag)\s*[- ]?out\b",
    r"\bwithout\s+(?:lock(?:ing|out)|tagout|verification|isolation|permit)\b",
    r"\bnot\s+(?:been\s+)?de-?energiz",
    r"\bstill\s+energiz",
    r"\bfailed\s+to\s+de-?energiz",
    r"\bisolation\s+(?:was\s+)?(?:not\s+verified|failed|bypassed)",
    # Machine guarding / safety devices
    r"\bguards?\b[^.]{0,20}?\b(?:had\s+been\s+)?(?:removed|missing|not\s+in\s+place|bypassed|disabled|inoperable)",
    r"\b(?:no|without)\s+(?:a\s+|any\s+)?(?:machine\s+)?guard(?:ing|s)?\b",
    r"\b(?:safety\s+(?:device|switch|interlock)|interlock)\b[^.]{0,25}?(?:bypass|defeat|disabl|remov|inoperab)",
    # Fall protection
    r"\b(?:no|without)\s+[^.]{0,25}?(?:fall\s+protection|safety\s+harness|lanyard|lifeline|guardrail)",
    r"\bnot\s+(?:wearing|using|tied\s+off|attached|secured)\b[^.]{0,25}?(?:fall\s+protection|harness|lanyard|lifeline)",
    # PPE
    r"\b(?:not\s+wearing|without)\s+[^.]{0,20}?(?:hard\s*hat|helmet|respirator|protective\s+equipment|safety\s+glasses)",
    # Permit to work
    r"\bno\s+permit\b",
    r"\bwithout\s+a\s+permit\b",
    r"\bpermit\s+(?:was|had)\s+not\b",
    # Excavation / barricading
    r"\b(?:no|without)\s+[^.]{0,20}?(?:shoring|trench\s+box|protective\s+system|barricade)",
]

_ENTITY_SPECS = {
    "HAZARD": HAZARDS,
    "EQUIPMENT": EQUIPMENT,
    "ACTIVITY": ACTIVITIES,
    "CONDITION": CONDITIONS,
}

_nlp = None


_TOKEN_PATTERNS = [
    {"label": "HAZARD", "pattern": [{"LOWER": {"IN": ["energized", "live"]}}, {"OP": "{0,2}"}, {"LOWER": {"IN": ["cable", "wire", "conductor", "circuit", "line", "panel"]}}]},
    {"label": "CONDITION", "pattern": [{"LOWER": {"IN": ["guard", "guarding"]}}, {"OP": "*"}, {"LOWER": {"IN": ["removed", "missing", "bypassed", "inoperable"]}}]},
    {"label": "HAZARD", "pattern": [{"LOWER": "fall"}, {"LOWER": "from"}, {"OP": "*"}, {"LOWER": {"IN": ["height", "elevation", "platform", "ladder", "scaffold", "roof"]}}]},
]


def _build_pipeline():
    nlp = spacy.blank("en")
    ruler = nlp.add_pipe("entity_ruler")
    patterns = []
    for label, terms in _ENTITY_SPECS.items():
        for term in terms:
            patterns.append({"label": label, "pattern": term})
    patterns.extend(_TOKEN_PATTERNS)
    ruler.add_patterns(patterns)
    return nlp


def get_pipeline():
    global _nlp
    if _nlp is None:
        _nlp = _build_pipeline()
    return _nlp


def extract_entities(text: str) -> dict:
    """Return typed entity spans + a barrier-failure flag for one narrative."""
    text_l = (text or "").lower()
    nlp = get_pipeline()
    doc = nlp(text_l)
    out = {"hazard": [], "equipment": [], "activity": [], "condition": []}
    seen = set()
    for ent in doc.ents:
        key = (ent.label_, ent.text)
        if key in seen:
            continue
        seen.add(key)
        bucket = ent.label_.lower()
        if bucket in out:
            out[bucket].append(ent.text)

    barrier_failure = any(re.search(p, text_l) for p in BARRIER_FAILURE_PATTERNS)
    return {
        "hazard": out["hazard"],
        "equipment": out["equipment"],
        "activity": out["activity"],
        "condition": out["condition"],
        "barrier_failure": barrier_failure,
    }


def primary_activity(text: str, fallback: str = "General Duties") -> str:
    ents = extract_entities(text)
    if ents["activity"]:
        return ents["activity"][0].title()
    return fallback


if __name__ == "__main__":
    sample = "Worker contacted an energized 415V cable while replacing a junction box; lockout not verified before work start."
    print(extract_entities(sample))
