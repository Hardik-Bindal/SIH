"""
Life Saving Rule (LSR) keyword heuristics — IOGP Report 459 taxonomy (SRS 1.4, 1.3).

Neither OSHA corpus carries an LSR label, so ground truth does not exist.
Per SRS 5.3 stage 5 ("weak-label ambiguous cases via rule heuristics"), a
domain-reviewable keyword/phrase heuristic assigns weak labels; a multi-label
classifier is then trained on top of those weak labels (train_lsr_mapper.py)
so that at *inference* time a brand-new narrative is scored by the learned
model, not by re-running these regexes. Reported Micro-F1 is therefore
"agreement with the weak-supervision heuristic", not agreement with a
human-annotated gold set — this is stated plainly in ml/artifacts/lsr_mapper_metrics.json
and should be repeated to reviewers rather than presented as ground-truth F1.
"""
import re

LSR_RULES = {
    "ENERGY_ISOLATION": [
        r"lock\s*out", r"tag\s*out", r"energiz", r"live\s+(circuit|wire|cable|line)",
        r"residual\s+(energy|pressure)", r"isolation\s+(not\s+verified|failed|bypassed)",
        r"stored\s+energy", r"de-energiz",
    ],
    "WORK_AT_HEIGHT": [
        r"fall\s+(from|through)", r"scaffold", r"ladder", r"unprotected\s+edge",
        r"working\s+at\s+height", r"fall\s+protection", r"harness", r"guardrail",
        r"elevat(ed|ion)", r"roof",
    ],
    "CONFINED_SPACE": [
        r"confined\s+space", r"atmospher(e|ic)\s+(test|hazard)", r"toxic\s+gas",
        r"oxygen\s+(deficien|level)", r"tank\s+entry", r"vessel\s+entry",
    ],
    "LINE_OF_FIRE": [
        r"struck\s+by", r"caught\s+in", r"caught\s+between", r"line\s+of\s+fire",
        r"falling\s+object", r"swinging\s+load", r"pinch\s+point", r"crush",
    ],
    "SAFE_MECHANICAL_LIFTING": [
        r"crane", r"hoist", r"lifting\s+operation", r"suspended\s+load",
        r"rigg(ing|er)", r"sling", r"winch", r"forklift",
    ],
    "HOT_WORK": [
        r"weld", r"cutting\s+torch", r"hot\s+work", r"grinding\s+spark", r"open\s+flame",
        r"flammable\s+(vapor|material)",
    ],
    "WORK_AUTHORISATION": [
        r"permit\s*[- ]?to[- ]?work", r"\bptw\b", r"unauthorized\s+work",
        r"no\s+permit", r"work\s+order\s+missing",
    ],
    "BYPASSING_CONTROLS": [
        r"guard\s+(removed|missing|bypassed|inoperable)", r"safety\s+device.{0,15}(removed|bypassed|inoperable)",
        r"interlock.{0,10}(bypass|defeat|disabl)", r"safety\s+switch\s+(bypassed|disabled)",
    ],
    "DRIVING_SAFETY": [
        r"vehicle\s+(accident|collision|rollover)", r"driving", r"seat\s*belt",
        r"speeding", r"dump\s+truck", r"forklift\s+(struck|collision)",
    ],
}

RULE_LABELS = list(LSR_RULES.keys())
_COMPILED = {rule: [re.compile(p, re.I) for p in pats] for rule, pats in LSR_RULES.items()}

# The OSHA incident export also carries real reviewer-assigned categorical
# fields (Human Factor, Event type) that are far more reliable signal than
# regexing the narrative for some rules — e.g. "Safety Devices
# Removed/Inoperable" is a literal Human Factor category, not a phrase that
# ever appears verbatim in free text. These are combined with the narrative
# regex hits (OR'd together) rather than replacing them.
HUMAN_FACTOR_TO_RULE = {
    "Safety Devices Removed/Inoperable": "BYPASSING_CONTROLS",
    "Lockout/Tagout Procedure Malfunction": "ENERGY_ISOLATION",
    "Insufficient /Lack/Written Work Practice Program": "WORK_AUTHORISATION",
    "Insufficient /Lack/Engineering Controls": "BYPASSING_CONTROLS",
}
EVENT_TYPE_TO_RULE = {
    "Struck-by": "LINE_OF_FIRE",
    "Caught in or between": "LINE_OF_FIRE",
    "Fall (from elevation)": "WORK_AT_HEIGHT",
}


def weak_label(text: str, human_factor: str = None, event_type: str = None) -> dict:
    """Return {rule: 1/0} weak labels combining narrative regex with real
    structured-field signal when available (see module docstring)."""
    text = text or ""
    out = {}
    for rule, patterns in _COMPILED.items():
        hits = sum(1 for p in patterns if p.search(text))
        out[rule] = 1 if hits > 0 else 0
    hf_rule = HUMAN_FACTOR_TO_RULE.get(human_factor)
    if hf_rule:
        out[hf_rule] = 1
    et_rule = EVENT_TYPE_TO_RULE.get(event_type)
    if et_rule:
        out[et_rule] = 1
    return out
