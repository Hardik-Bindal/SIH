"""
Gazetteer-driven entity extraction for KAVACH AI.

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

CONTROLS = [
    "atmospheric testing", "gas monitoring", "gas detector", "gas monitor",
    "standby attendant", "hole watch", "rescue team", "rescue plan",
    "entry permit", "permit to work", "hot work permit", "confined space permit",
    "fall harness", "safety harness", "safety lanyard", "lifeline",
    "lockout tagout", "loto", "energy isolation", "isolation verification",
    "barricade", "safety barrier", "guardrail", "safety net",
    "fire watch", "fire extinguisher", "spotter", "signal person",
    "toolbox talk", "job safety analysis", "risk assessment",
    "ventilation system", "forced ventilation", "exhaust ventilation",
    "safety briefing", "pre-task briefing", "buddy system",
    "continuous monitoring", "oxygen monitoring", "h2s monitoring",
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
    # Confined space — atmospheric testing / monitoring / attendant
    r"\batmospheric\s+test(?:ing)?\s+(?:was\s+)?(?:not\s+(?:completed|performed|conducted|done)|absent|omitted|skipped)",
    r"\b(?:standby\s+)?attendant\s+(?:was\s+)?(?:absent|not\s+(?:present|available|assigned|posted))",
    r"\bgas\s+(?:monitor(?:ing)?|detect(?:or|ion))\s+(?:was\s+)?(?:not\s+(?:available|used|functional|working)|unavailable|absent|inoperable)",
    r"\b(?:entry|confined\s+space)\s+permit\s+(?:was\s+)?(?:not\s+(?:obtained|issued|completed|available)|absent|missing)",
    r"\bpermit\s+controls?\s+(?:were?\s+)?not\s+followed",
    r"\b(?:ventilation|air\s+supply)\s+(?:was\s+)?(?:not\s+(?:provided|available|adequate)|inadequate|absent)",
    r"\b(?:rescue|emergency)\s+(?:team|plan|equipment)\s+(?:was\s+)?(?:not\s+(?:available|in\s+place|established)|absent)",
    r"\bcontinuous\s+(?:monitoring|air\s+monitoring)\s+(?:was\s+)?(?:not\s+(?:performed|maintained|conducted)|absent)",
    # LOTO procedure phrasing ("the LOTO procedure was not followed")
    r"\b(?:loto|lockout[\s-]*tagout|energy\s+isolation)\s+procedure\s+(?:was\s+)?(?:not\s+followed|bypassed|skipped)",
]

_ENTITY_SPECS = {
    "HAZARD": HAZARDS,
    "EQUIPMENT": EQUIPMENT,
    "ACTIVITY": ACTIVITIES,
    "CONDITION": CONDITIONS,
    "CONTROL": CONTROLS,
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
    out = {"hazard": [], "equipment": [], "activity": [], "condition": [], "control": []}
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

    # Detect failed controls from narrative.
    # Strategy: for each control term in the CONTROLS gazetteer (and common
    # synonyms), we look for a NEGATIVE context within the same clause.
    # We avoid false positives by requiring the negative word to appear either
    # BEFORE or AFTER (within 35 chars) the control term, not just anywhere.
    #
    # Pattern groups:
    #  A) "without [a/the] <control>" — e.g. "without a fall arrest harness"
    #  B) "<control> was/were not [available|used|provided|installed|followed|worn|present]"
    #  C) "no <control>" — e.g. "no standby attendant", "no guardrail"
    #  D) "did not use/wear/provide/follow <control>"
    #  E) "failure to use/provide/install <control>"
    #  F) "<control> [was] absent/missing/unavailable/inoperable/removed"
    #  G) "was not wearing/using <control>"
    #
    # Each tuple: (regex_pattern, human_label)
    failed_controls = []
    _CONTROL_FAIL_PATTERNS = [
        # ---- Atmospheric / gas testing ---------------------------------
        (r"atmospheric\s+test(?:ing)?[^.]{0,40}?(?:not|absent|omit|skip|no\s+atmospheric)", "Atmospheric testing"),
        (r"(?:without|no)\s+(?:a\s+|any\s+)?atmospheric\s+test(?:ing)?", "Atmospheric testing"),
        # ---- Gas monitoring / detector ---------------------------------
        (r"gas\s+(?:monitor(?:ing)?|detect(?:or|ion))\s+(?:was\s+)?(?:not\s+(?:available|used|functional|working|present|perform)|unavailable|absent|inoperable|missing)", "Gas monitoring"),
        (r"(?:without|no)\s+(?:a\s+)?gas\s+(?:monitor(?:ing)?|detect(?:or|ion))", "Gas monitoring"),
        (r"gas\s+detect(?:or)?\s+(?:was\s+)?(?:not\s+available|absent|unavailable)", "Gas monitoring"),
        # ---- Standby attendant -----------------------------------------
        (r"(?:standby\s+)?attendant\s+(?:was\s+)?(?:absent|not\s+(?:present|available|assigned|posted))", "Standby attendant"),
        (r"(?:without|no)\s+(?:a\s+)?(?:standby\s+)?attendant", "Standby attendant"),
        (r"hole\s+watch\s+(?:was\s+)?(?:absent|not\s+(?:present|assigned|available))", "Standby attendant"),
        # ---- Entry / confined space permit -----------------------------
        (r"(?:entry|confined\s+space)\s+permit\s+(?:was\s+)?(?:not\s+(?:obtained|issued|completed|available|renewed)|absent|missing|expired)", "Entry permit"),
        (r"(?:without|no)\s+(?:(?:an?|the)\s+(?:required\s+)?)?(?:entry|confined\s+space)\s+permit", "Entry permit"),
        (r"without\s+the\s+required\s+(?:permit|work\s+authoris?ation)", "Entry permit"),
        (r"permit\s+controls?\s+(?:were?\s+)?not\s+followed", "Permit controls"),
        # ---- Fall arrest harness / fall protection --------------------
        (r"(?:without|no)\s+(?:(?:a|the)\s+(?:required\s+)?)?(?:fall\s+(?:arrest|protection)|safety\s+harness|safety\s+lanyard|lifeline|harness|lanyard)", "Fall arrest harness"),
        (r"(?:fall\s+(?:arrest|protection)|safety\s+harness|harness|lanyard|lifeline)\s+(?:was\s+)?(?:not\s+(?:used|worn|attached|provided|available|in\s+place)|absent|missing)", "Fall arrest harness"),
        (r"(?:did\s+not\s+(?:use|wear|attach)|was\s+not\s+wearing|failure\s+to\s+(?:use|wear|attach))\s+(?:a\s+|the\s+)?(?:fall\s+(?:arrest|protection)|safety\s+harness|harness|lanyard)", "Fall arrest harness"),
        (r"not\s+(?:wearing|using|tied\s+off|attached|secured)\s+[^.]{0,30}?(?:fall\s+protection|harness|lanyard|lifeline)", "Fall arrest harness"),
        # ---- Edge protection / guardrail -------------------------------
        (r"(?:missing|no|without(?:\s+a)?|not\s+installed|removed)\s+(?:edge\s+protection|guardrails?|safety\s+barrier|safety\s+net)", "Edge protection / guardrail"),
        (r"(?:edge\s+protection|guardrails?)\s+(?:was\s+)?(?:missing|absent|not\s+(?:installed|in\s+place|provided|present))", "Edge protection / guardrail"),
        # ---- LOTO / energy isolation -----------------------------------
        (r"(?:lockout[\s-]*tagout|loto|energy\s+isolation|isolation\s+verification)\s+(?:procedure\s+)?(?:was\s+)?(?:not\s+(?:followed|applied|performed|completed|verified|used)|bypassed|skipped|absent|missing)", "Energy isolation / LOTO"),
        (r"(?:without|no)\s+(?:lockout[\s-]*tagout|loto|proper\s+isolation)", "Energy isolation / LOTO"),
        (r"(?:did\s+not|failure\s+to)\s+(?:perform|follow|apply|complete)\s+(?:lockout[\s-]*tagout|loto|energy\s+isolation)", "Energy isolation / LOTO"),
        (r"without\s+following\s+(?:the\s+)?(?:(?:required\s+)?loto|lockout[\s-]*tagout|energy\s+isolation)\s+procedure", "Energy isolation / LOTO"),
        (r"\bnot\s+(?:been\s+)?(?:lock(?:ed)?[\s-]*out|de-?energiz)", "Energy isolation / LOTO"),
        (r"equipment\s+(?:was\s+)?not\s+(?:properly\s+)?isolated", "Energy isolation / LOTO"),
        # ---- Machine guarding ------------------------------------------
        (r"guard(?:ing)?\s+(?:was\s+)?(?:removed|missing|not\s+(?:in\s+place|installed|present)|bypassed|disabled)", "Machine guarding"),
        (r"(?:without|no)\s+(?:machine\s+)?guard(?:ing)?", "Machine guarding"),
        # ---- Ventilation -----------------------------------------------
        (r"ventilation\s+(?:was\s+)?(?:not\s+(?:provided|available|adequate|working)|inadequate|absent)", "Ventilation"),
        (r"(?:without|no)\s+(?:forced\s+|exhaust\s+|adequate\s+)?ventilation", "Ventilation"),
        # ---- Rescue / emergency plan -----------------------------------
        (r"(?:rescue|emergency)\s+(?:team|plan|equipment)\s+(?:was\s+)?(?:not\s+(?:available|in\s+place|established)|absent)", "Rescue / emergency plan"),
        # ---- Permit to work (general) ----------------------------------
        (r"(?:no|without\s+(?:a\s+)?|permit\s+(?:was|had)\s+not\s+)\s*permit(?:\s+to\s+work)?(?!\s+controls)", "Permit to work"),
        # ---- PPE (hard hat / respirator) --------------------------------
        (r"(?:not\s+wearing|without)\s+(?:a\s+)?(?:hard\s*hat|helmet|respirator|protective\s+equipment|safety\s+glasses)", "PPE"),
        (r"(?:did\s+not\s+(?:use|wear)|failure\s+to\s+(?:use|wear))\s+(?:a\s+)?(?:hard\s*hat|helmet|respirator|ppe)", "PPE"),
    ]
    for pattern, label in _CONTROL_FAIL_PATTERNS:
        if re.search(pattern, text_l):
            failed_controls.append(label)
    # Deduplicate while preserving insertion order
    seen_fc = set()
    failed_controls = [x for x in failed_controls if not (x in seen_fc or seen_fc.add(x))]

    return {
        "hazard": out["hazard"],
        "equipment": out["equipment"],
        "activity": out["activity"],
        "condition": out["condition"],
        "control": out["control"],
        "barrier_failure": barrier_failure,
        "failed_controls": failed_controls,
    }


def primary_activity(text: str, fallback: str = "General Duties") -> str:
    ents = extract_entities(text)
    if ents["activity"]:
        return ents["activity"][0].title()
    return fallback


if __name__ == "__main__":
    sample = "Worker contacted an energized 415V cable while replacing a junction box; lockout not verified before work start."
    print(extract_entities(sample))
