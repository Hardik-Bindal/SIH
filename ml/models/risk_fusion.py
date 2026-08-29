"""Risk Band Fusion — SRS 10.2, implemented exactly as specified.

score = 0.55*P(SIF) + 0.25*max(LSR_severity_weight) + 0.10*barrier_failure_present + 0.10*fatality_similarity_max
CRITICAL if score >= 0.85 OR (P(SIF) >= 0.90 AND barrier_failure_present)
HIGH     if score >= 0.65
MEDIUM   if score >= 0.40
LOW      otherwise
Escalation override: any report matching a fatal case at >= 0.90 similarity is floored at HIGH.
"""

# Relative severity of each Life Saving Rule if violated — historically the
# rules most associated with fatal outcomes (energy isolation, confined
# space, work at height, line of fire) are weighted highest.
LSR_SEVERITY_WEIGHT = {
    "ENERGY_ISOLATION": 1.00,
    "CONFINED_SPACE": 1.00,
    "WORK_AT_HEIGHT": 0.90,
    "LINE_OF_FIRE": 0.90,
    "BYPASSING_CONTROLS": 0.85,
    "HOT_WORK": 0.80,
    "SAFE_MECHANICAL_LIFTING": 0.80,
    "WORK_AUTHORISATION": 0.70,
    "DRIVING_SAFETY": 0.75,
}

RISK_BAND_ORDER = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]


def max_lsr_severity(lsr_tags: list) -> float:
    """lsr_tags: list of {'rule': str, 'score': float}. Returns max(confidence * severity)."""
    if not lsr_tags:
        return 0.0
    return max(t["score"] * LSR_SEVERITY_WEIGHT.get(t["rule"], 0.5) for t in lsr_tags)


def fuse(p_sif: float, lsr_tags: list, barrier_failure: bool, fatality_similarity_max: float):
    lsr_sev = max_lsr_severity(lsr_tags)
    score = (
        0.55 * p_sif
        + 0.25 * lsr_sev
        + 0.10 * (1.0 if barrier_failure else 0.0)
        + 0.10 * fatality_similarity_max
    )

    if score >= 0.85 or (p_sif >= 0.90 and barrier_failure):
        band = "CRITICAL"
    elif score >= 0.65:
        band = "HIGH"
    elif score >= 0.40:
        band = "MEDIUM"
    else:
        band = "LOW"

    escalated = False
    if fatality_similarity_max >= 0.90 and RISK_BAND_ORDER.index(band) < RISK_BAND_ORDER.index("HIGH"):
        band = "HIGH"
        escalated = True

    return {
        "score": round(float(score), 4),
        "risk_band": band,
        "lsr_severity_component": round(float(lsr_sev), 4),
        "escalation_override_applied": escalated,
    }
