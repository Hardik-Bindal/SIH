"""
Structured natural-language query — the "ask instead of building a dashboard"
half of the AI Safety Copilot.

Target capability: a question like

    "Show all confined space incidents during monsoon having SIF > 90
     where gas detector failed."

carries four independent constraints (hazard class, season, score threshold,
failed control) that no dashboard filter bar composes. This module parses
that sentence into an explicit filter object, runs it over the analysed
corpus, and returns the aggregate an HSE officer actually wants: how many,
where most, and which control keeps failing.

Two deliberate design choices, both about trust:

  * The parsed filter is returned to the caller and rendered in the UI, so
    the user sees exactly what the system understood — an unparsed clause is
    reported in `unrecognised`, never silently dropped. A query the system
    half-understood is far more dangerous than one it admits it missed.

  * A zero-result query does not just say "no results". It relaxes each
    filter in turn and reports which single constraint is the binding one
    ("0 match all four; relaxing SIF > 90% yields 6"), so the officer learns
    something from an empty answer instead of guessing which term to change.

Parsing is deterministic (regex + curated synonym tables) rather than
LLM-driven — there is no reachable LLM in this environment (docs/DEVIATIONS.md),
and a filter that silently changes meaning between runs would be worse than
one with a known vocabulary.
"""
import re
from collections import Counter

from ml.models.lsr_rules import RULE_LABELS
from app.services.memory import CAUSE_PHRASING

# ---- vocabulary ---------------------------------------------------------

# Hazard-class phrasings mapped onto the nine Life Saving Rules. Order
# matters: longer, more specific phrases are tried first.
TOPIC_ALIASES = [
    ("CONFINED_SPACE", ["confined space", "confined-space", "vessel entry", "tank entry", "manhole"]),
    ("ENERGY_ISOLATION", ["energy isolation", "lock out", "lockout", "loto", "tag out", "tagout",
                          "electrical", "electrocution", "energised", "energized", "live circuit"]),
    ("WORK_AT_HEIGHT", ["work at height", "working at height", "fall from height", "height",
                        "scaffold", "ladder", "roof", "fall protection"]),
    ("LINE_OF_FIRE", ["line of fire", "struck by", "struck-by", "caught in", "caught between",
                      "crushed", "falling object"]),
    ("SAFE_MECHANICAL_LIFTING", ["mechanical lifting", "lifting", "crane", "rigging", "hoist",
                                 "suspended load", "forklift"]),
    ("HOT_WORK", ["hot work", "welding", "cutting torch", "open flame", "spark"]),
    ("WORK_AUTHORISATION", ["permit to work", "permit-to-work", "ptw", "work authorisation",
                            "work authorization", "unauthorised", "unauthorized"]),
    ("BYPASSING_CONTROLS", ["bypassing controls", "bypassed", "guard removed", "interlock",
                            "safety device"]),
    ("DRIVING_SAFETY", ["driving", "vehicle", "truck", "collision", "rollover"]),
]

# Indian operating seasons — the reason "during monsoon" is a natural way to
# ask the question and an unnatural thing to express in a date picker.
SEASONS = {
    "monsoon": ([6, 7, 8, 9], "June–September"),
    "summer": ([3, 4, 5], "March–May"),
    "winter": ([12, 1, 2], "December–February"),
    "post-monsoon": ([10, 11], "October–November"),
    "post monsoon": ([10, 11], "October–November"),
}

MONTHS = {
    "january": 1, "february": 2, "march": 3, "april": 4, "may": 5, "june": 6,
    "july": 7, "august": 8, "september": 9, "october": 10, "november": 11, "december": 12,
}

RISK_BANDS = ["CRITICAL", "HIGH", "MEDIUM", "LOW"]

SITE_NAMES = [
    "Rig-07 Duliajan", "Rig-12 Moran", "Rig-03 Kumchai", "Refinery Block A",
    "Refinery Block B", "Pipeline Sector 4", "Pipeline Sector 9",
    "Central Warehouse", "Field Workshop Duliajan",
]
AREA_NAMES = ["RIG", "REFINERY", "PIPELINE", "WAREHOUSE", "WORKSHOP"]
DEPARTMENT_NAMES = [
    "Electrical Maintenance", "Mechanical Maintenance", "Process Operations",
    "Civil & Structural", "Logistics & Materials", "HSE", "Drilling Operations",
]

# "where the gas detector failed" / "with no fall arrest" / "guard removed".
# Captures the failed-control phrase so it can be matched against narratives.
CONDITION_PATTERNS = [
    re.compile(r"where\s+(?:the\s+)?([a-z][a-z\s\-]{2,40}?)\s+(?:failed|was\s+not|were\s+not|did\s+not|missing|skipped|bypassed)", re.I),
    re.compile(r"with\s+(?:no|missing|failed|faulty)\s+([a-z][a-z\s\-]{2,40}?)(?:\s+(?:and|but|during|having|where)\b|[.,]|$)", re.I),
    re.compile(r"without\s+(?:a\s+|any\s+)?([a-z][a-z\s\-]{2,40}?)(?:\s+(?:and|but|during|having|where)\b|[.,]|$)", re.I),
    re.compile(r"\b([a-z][a-z\s\-]{2,30}?)\s+(?:failure|failed|skipped|not\s+verified|not\s+done)\b", re.I),
]

SIF_PATTERN = re.compile(
    r"sif\s*(?:score|probability|potential)?\s*(>=|<=|>|<|above|below|over|under|greater than|less than|at least)?\s*(\d{1,3})\s*%?",
    re.I,
)
GENERIC_SCORE_PATTERN = re.compile(
    r"(?:score|probability|risk)\s*(>=|<=|>|<|above|below|over|under)\s*(\d{1,3})\s*%?", re.I
)

_OP_NORMALISE = {
    "above": ">", "over": ">", "greater than": ">", ">": ">",
    "below": "<", "under": "<", "less than": "<", "<": "<",
    ">=": ">=", "at least": ">=", "<=": "<=",
}

# Words that carry no filtering meaning — excluded from the "unrecognised"
# report so it lists real missed constraints rather than English grammar.
_FILLER = set("""
show me all list find get display which what where when how many count of the a an and or
in on at during for with without having is are was were that this these those report reports
incident incidents case cases event events please give tell about across our my we us
""".split())


def _norm_op(raw):
    if not raw:
        return ">"
    return _OP_NORMALISE.get(raw.lower().strip(), ">")


def parse(query: str) -> dict:
    ql = query.lower()
    consumed = []

    topic = None
    for rule, aliases in TOPIC_ALIASES:
        for alias in aliases:
            if alias in ql:
                topic = {"rule": rule, "phrase": alias,
                         "label": CAUSE_PHRASING.get(rule, rule.replace("_", " ").title())}
                consumed.append(alias)
                break
        if topic:
            break

    season = None
    for name, (months, human) in SEASONS.items():
        if name in ql:
            season = {"name": name, "months": months, "human": human}
            consumed.append(name)
            break
    if not season:
        for mname, mnum in MONTHS.items():
            if re.search(rf"\b{mname}\b", ql):
                season = {"name": mname, "months": [mnum], "human": mname.title()}
                consumed.append(mname)
                break

    year = None
    ymatch = re.search(r"\b(20\d{2})\b", ql)
    if ymatch:
        year = int(ymatch.group(1))
        consumed.append(ymatch.group(0))

    sif = None
    m = SIF_PATTERN.search(ql) or GENERIC_SCORE_PATTERN.search(ql)
    if m:
        value = float(m.group(2))
        # "SIF > 90" means 90%, not a probability of 90.0.
        value = value / 100 if value > 1 else value
        sif = {"op": _norm_op(m.group(1)), "value": round(value, 4),
               "human": f"SIF {_norm_op(m.group(1))} {value:.0%}"}
        consumed.append(m.group(0))

    risk_band = None
    for band in RISK_BANDS:
        if re.search(rf"\b{band.lower()}\b", ql):
            risk_band = band
            consumed.append(band.lower())
            break

    # Organisational scope. Sites are matched before areas so "Refinery
    # Block B" binds to the site rather than the REFINERY area.
    site = next((s for s in SITE_NAMES if s.lower() in ql), None)
    if site:
        consumed.append(site.lower())
    area = None
    if not site:
        area = next((a for a in AREA_NAMES if re.search(rf"\b{a.lower()}\b", ql)), None)
        if area:
            consumed.append(area.lower())
    department = next((d for d in DEPARTMENT_NAMES if d.lower() in ql), None)
    if department:
        consumed.append(department.lower())

    conditions = []
    for pat in CONDITION_PATTERNS:
        for cm in pat.finditer(query):
            phrase = re.sub(r"\s+", " ", cm.group(1)).strip().lower()
            if len(phrase) < 3 or phrase in _FILLER:
                continue
            phrase = " ".join(w for w in phrase.split() if w not in _FILLER)
            if phrase and phrase not in conditions:
                conditions.append(phrase)
                consumed.append(cm.group(0).lower())

    barrier_failure = bool(re.search(r"barrier (failure|failed)|control (failure|failed)", ql))
    if barrier_failure:
        consumed.append("barrier failure")

    # Anything meaningful the parser did not claim.
    leftover = ql
    for c in consumed:
        leftover = leftover.replace(c.lower(), " ")
    unrecognised = [
        w for w in re.findall(r"[a-z][a-z\-]{2,}", leftover)
        if w not in _FILLER
    ]

    return {
        "topic": topic, "season": season, "year": year, "sif": sif,
        "risk_band": risk_band, "conditions": conditions,
        "site": site, "area": area, "department": department,
        "barrier_failure": barrier_failure,
        "unrecognised": sorted(set(unrecognised)),
        "has_any_filter": any([topic, season, year, sif, risk_band, conditions,
                               barrier_failure, site, area, department]),
    }


# ---- predicates ---------------------------------------------------------

def _month_of(row):
    raw = str(row.get("reported_on") or "")
    m = re.match(r"(\d{4})-(\d{2})", raw)
    return (int(m.group(1)), int(m.group(2))) if m else (None, None)


def _match_topic(row, topic):
    if any(t["rule"] == topic["rule"] and t["score"] >= 0.35 for t in row.get("lsr_tags", [])):
        return True
    return topic["phrase"] in row.get("narrative", "").lower()


def _match_condition(row, phrase):
    """All words of the phrase present in the narrative or extracted entities
    — tolerant of word order ("detector gas") without matching on one
    incidental word."""
    haystack = row.get("narrative", "").lower()
    ents = row.get("entities") or {}
    for bucket in ("hazard", "equipment", "condition", "activity"):
        haystack += " " + " ".join(ents.get(bucket) or [])
    words = [w for w in phrase.split() if len(w) > 2]
    return bool(words) and all(w in haystack for w in words)


def _predicates(parsed):
    """One named predicate per constraint, so a zero-result query can be
    diagnosed by dropping them one at a time."""
    preds = {}
    if parsed["topic"]:
        t = parsed["topic"]
        preds[f"hazard: {t['phrase']}"] = lambda r, t=t: _match_topic(r, t)
    if parsed["season"]:
        s = parsed["season"]
        preds[f"season: {s['name']} ({s['human']})"] = lambda r, s=s: _month_of(r)[1] in s["months"]
    if parsed["year"]:
        y = parsed["year"]
        preds[f"year: {y}"] = lambda r, y=y: _month_of(r)[0] == y
    if parsed["sif"]:
        s = parsed["sif"]
        ops = {">": lambda a, b: a > b, ">=": lambda a, b: a >= b,
               "<": lambda a, b: a < b, "<=": lambda a, b: a <= b}
        fn = ops.get(s["op"], ops[">"])
        preds[s["human"]] = lambda r, fn=fn, v=s["value"]: fn(r.get("sif_probability", 0), v)
    if parsed["risk_band"]:
        b = parsed["risk_band"]
        preds[f"risk band: {b}"] = lambda r, b=b: r.get("risk_band") == b
    for cond in parsed["conditions"]:
        preds[f"control: {cond}"] = lambda r, c=cond: _match_condition(r, c)
    if parsed["barrier_failure"]:
        preds["barrier failure detected"] = lambda r: bool(r.get("barrier_failure"))
    for key, label in (("site", "site"), ("area", "area"), ("department", "department")):
        if parsed.get(key):
            val = parsed[key]
            preds[f"{label}: {val}"] = lambda r, k=key, v=val: r.get(k) == v
    return preds


def _aggregate(rows):
    sites = Counter(r["site"] for r in rows if r.get("site"))
    depts = Counter(r["department"] for r in rows if r.get("department"))
    rules = Counter(
        t["rule"] for r in rows for t in r.get("lsr_tags", []) if t["score"] >= 0.35
    )
    barrier_hits = sum(1 for r in rows if r.get("barrier_failure"))
    top_rule = rules.most_common(1)[0] if rules else None
    return {
        "count": len(rows),
        "most_common_site": (
            {"site": sites.most_common(1)[0][0], "count": sites.most_common(1)[0][1]}
            if sites else None
        ),
        "site_breakdown": [{"site": s, "count": c} for s, c in sites.most_common(5)],
        "department_breakdown": [{"department": d, "count": c} for d, c in depts.most_common(5)],
        "repeated_barrier": (
            {
                "rule": top_rule[0],
                "label": CAUSE_PHRASING.get(top_rule[0], top_rule[0].replace("_", " ").title()),
                "count": top_rule[1], "of": len(rows),
            } if top_rule else None
        ),
        "barrier_failure_count": barrier_hits,
        "barrier_failure_rate": round(barrier_hits / len(rows), 3) if rows else 0.0,
        "risk_band_breakdown": dict(Counter(r.get("risk_band") for r in rows)),
        "critical_count": sum(1 for r in rows if r.get("risk_band") == "CRITICAL"),
        "avg_sif_probability": (
            round(sum(r.get("sif_probability", 0) for r in rows) / len(rows), 3) if rows else 0.0
        ),
    }


def run(store, query: str) -> dict:
    parsed = parse(query)
    preds = _predicates(parsed)

    if not preds:
        return {
            "recognised": False,
            "parsed": parsed,
            "answer": (
                "No filterable constraint was recognised in that question. Try naming a hazard "
                "(e.g. confined space, work at height), a season or month, a SIF threshold "
                "(e.g. SIF > 90), a risk band, or a failed control (e.g. \"where the gas detector failed\")."
            ),
            "results": [], "aggregate": None, "citations": [], "grounded": False,
        }

    rows = store.incidents
    matched = [r for r in rows if all(fn(r) for fn in preds.values())]

    # Zero results: find the binding constraint rather than shrugging.
    relaxation = None
    if not matched and len(preds) > 1:
        options = []
        for name in preds:
            rest = {k: v for k, v in preds.items() if k != name}
            n = sum(1 for r in rows if all(fn(r) for fn in rest.values()))
            options.append({"dropped_filter": name, "would_match": n})
        options.sort(key=lambda o: o["would_match"], reverse=True)
        if options and options[0]["would_match"] > 0:
            relaxation = options

    matched_sorted = sorted(matched, key=lambda r: r.get("sif_probability", 0), reverse=True)
    agg = _aggregate(matched_sorted) if matched_sorted else None
    citations = [r["report_id"] for r in matched_sorted[:5]]

    if matched_sorted:
        bits = [f"{agg['count']} report(s) match all {len(preds)} filters."]
        if agg["most_common_site"]:
            bits.append(
                f"Most common site: {agg['most_common_site']['site']} "
                f"({agg['most_common_site']['count']} of {agg['count']})."
            )
        if agg["repeated_barrier"]:
            bits.append(
                f"Repeated barrier: {agg['repeated_barrier']['label']} "
                f"({agg['repeated_barrier']['count']} of {agg['repeated_barrier']['of']})."
            )
        if agg["critical_count"]:
            bits.append(f"{agg['critical_count']} are CRITICAL.")
        answer = " ".join(bits)
    else:
        answer = f"No report matches all {len(preds)} filters."
        if relaxation:
            best = relaxation[0]
            answer += (
                f" The binding constraint is \"{best['dropped_filter']}\" — "
                f"dropping it alone would return {best['would_match']} report(s)."
            )
        else:
            answer += " Relaxing any single filter still returns nothing in this corpus."

    return {
        "recognised": True,
        "parsed": parsed,
        "applied_filters": list(preds.keys()),
        "answer": answer,
        "aggregate": agg,
        "results": [
            {
                "report_id": r["report_id"], "site": r["site"], "area": r["area"],
                "department": r["department"], "risk_band": r["risk_band"],
                "sif_probability": r["sif_probability"], "reported_on": r.get("reported_on"),
                "narrative": r["narrative"][:220],
            }
            for r in matched_sorted[:25]
        ],
        "relaxation": relaxation,
        "citations": citations,
        "grounded": bool(citations),
    }
