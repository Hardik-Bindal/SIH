"""CAPA + Toolbox Talk generation — SRS 12.5.

Neither OSHA source file contains free-text remediation guidance (the
fatality file's `plan`/`citation` columns are jurisdiction/citation flags,
not abatement text — see docs/DEVIATIONS.md), so "precedent-driven" here
means: the priority and phrasing of each action is grounded in the LSR
rule(s) actually violated and the barrier failure actually detected, and
every action cites the real matched fatal report IDs that motivate it —
not that literal remediation text was mined from those records.
"""
from ml.models.risk_fusion import LSR_SEVERITY_WEIGHT

RULE_ACTION_TEMPLATES = {
    "ENERGY_ISOLATION": {
        "corrective": "Verify and physically test isolation (lock-out/tag-out) before any work resumes on this equipment.",
        "preventive": "Audit lock-out/tag-out compliance across the department; refresh isolation-verification training.",
        "training": "Energy Isolation (LOTO) refresher for all crew members on this task.",
    },
    "CONFINED_SPACE": {
        "corrective": "Suspend confined-space entry until atmospheric testing and rescue-standby are re-verified.",
        "preventive": "Review confined-space entry permit process and gas-testing calibration schedule.",
        "training": "Confined Space Entry and Rescue awareness session.",
    },
    "WORK_AT_HEIGHT": {
        "corrective": "Inspect and reinstate fall-protection and edge-protection at the work location immediately.",
        "preventive": "Housekeeping and edge-protection verification audit across similar elevated work areas.",
        "training": "Working at Height / fall-arrest equipment refresher.",
    },
    "LINE_OF_FIRE": {
        "corrective": "Re-establish exclusion zones / barricading around the line of fire before work continues.",
        "preventive": "Review task risk assessment for line-of-fire exposure on similar activities.",
        "training": "Line-of-Fire hazard recognition toolbox session.",
    },
    "BYPASSING_CONTROLS": {
        "corrective": "Reinstate all removed/bypassed guards and safety devices before equipment restart.",
        "preventive": "Investigate why the safety device was bypassed; add a management-of-change check.",
        "training": "Safety-critical device tampering / management-of-change awareness.",
    },
    "HOT_WORK": {
        "corrective": "Halt hot work until a valid hot-work permit and fire-watch are confirmed in place.",
        "preventive": "Review hot-work permit issuance and flammable-material control near the work zone.",
        "training": "Hot Work permit and fire-watch responsibilities refresher.",
    },
    "SAFE_MECHANICAL_LIFTING": {
        "corrective": "Stop lifting operations until rigging, sling and load-path are re-inspected.",
        "preventive": "Audit lifting-equipment inspection records and rigger certification currency.",
        "training": "Safe Mechanical Lifting / rigging competency refresher.",
    },
    "WORK_AUTHORISATION": {
        "corrective": "Stop the job until a valid work permit/authorisation is issued and briefed.",
        "preventive": "Review permit-to-work issuance controls for this activity type.",
        "training": "Permit-to-Work system refresher for supervisors and crew.",
    },
    "DRIVING_SAFETY": {
        "corrective": "Ground the vehicle/equipment pending inspection of brakes, visibility and load securing.",
        "preventive": "Review journey-management and vehicle-inspection compliance for this fleet.",
        "training": "Defensive driving / vehicle safety refresher.",
    },
}

DEFAULT_ACTIONS = {
    "corrective": "Stop the activity, secure the area and report the condition to the shift supervisor.",
    "preventive": "Include this scenario in the next site risk assessment review.",
    "training": "General hazard-recognition toolbox talk for the crew.",
}


def generate(lsr_tags: list, barrier_failure: bool, matched_fatality_ids: list, risk_band: str, entities: dict):
    top_rules = sorted(lsr_tags, key=lambda t: t["score"], reverse=True)[:2]
    rules_for_actions = [t["rule"] for t in top_rules] or []

    corrective, preventive, training = [], [], []
    for rule in rules_for_actions:
        tpl = RULE_ACTION_TEMPLATES.get(rule, DEFAULT_ACTIONS)
        corrective.append({"action": tpl["corrective"], "priority": "C1", "rule": rule})
        preventive.append({"action": tpl["preventive"], "priority": "P1", "rule": rule})
        training.append(tpl["training"])

    if not corrective:
        corrective.append({"action": DEFAULT_ACTIONS["corrective"], "priority": "C1", "rule": None})
        preventive.append({"action": DEFAULT_ACTIONS["preventive"], "priority": "P2", "rule": None})
        training.append(DEFAULT_ACTIONS["training"])

    precedent_note = (
        f"Grounded in {len(matched_fatality_ids)} matched fatal case(s) with the same barrier failure: "
        + ", ".join(matched_fatality_ids[:5])
        if matched_fatality_ids else
        "No closely matching fatal precedent found in the knowledge base; actions are rule-based only."
    )

    hazard_str = ", ".join(entities.get("hazard", [])[:3]) or "the hazard identified in this report"
    equip_str = ", ".join(entities.get("equipment", [])[:2]) or "the equipment involved"

    toolbox_talk = {
        "title": f"5-Minute Toolbox Talk — {rules_for_actions[0].replace('_', ' ').title() if rules_for_actions else 'General Safety'}",
        "duration_minutes": 5,
        "points": [
            f"A recent {risk_band.lower()}-risk report involved {hazard_str} while using {equip_str}.",
            "Confirm the barrier that failed here (isolation, guarding, permit, or PPE) before starting similar work today."
            if barrier_failure else "Confirm all controls for this task are in place before starting work today.",
            precedent_note,
            "Any worker who sees the same condition must stop the job and notify the supervisor immediately.",
        ],
    }

    return {
        "corrective_actions": corrective,
        "preventive_actions": preventive,
        "training_needs": list(dict.fromkeys(training)),
        "toolbox_talk": toolbox_talk,
        "precedent_note": precedent_note,
    }
