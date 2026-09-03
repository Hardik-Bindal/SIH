"""
Single-report live analysis — SRS process 2.0 (AI Analysis & Scoring).

This is the one function the backend calls for both a brand-new report
submitted through the API (FR-02..FR-08) and, at seed time, for re-scoring
the historical corpus. It ties together every AI component behind one
contract so each model stays independently swappable (SRS 6.1).
"""
import hashlib
from pathlib import Path

import joblib
import pandas as pd

from ml.pipeline.ner import extract_entities
from ml.pipeline.etl import synth_site_area, synth_department
from ml.pipeline.embeddings import NarrativeEncoder, VectorIndex
from ml.models.risk_fusion import fuse
from ml.models.fatality_twin import build_twin
from ml.models.recommendations import generate as generate_recommendations

ROOT = Path(__file__).resolve().parent.parent.parent
ARTIFACTS = ROOT / "ml" / "artifacts"

MODEL_VERSION = "kavach-v2.0-tfidf-xgb"
# LSR filtering: a raw score of 0.20 is kept as the candidate floor, but
# only the 1 primary + up to 2 related rules are returned to the frontend.
LSR_CONFIDENCE_FLOOR = 0.20
LSR_PRIMARY_COUNT = 1
LSR_RELATED_COUNT = 2
FATALITY_TOPK = 10
INCIDENT_TOPK = 10

# Indicators that signal a GENUINE SIF precursor. Any narrative containing
# at least one of these signals is kept at full model probability.
_SIF_POSITIVE_SIGNALS = [
    # Serious outcomes / injuries
    r"\b(?:fatal|fatality|death|died|killed|serious\s+injur|hospitali|amputat|fracture|burn|cardiac)",
    # Uncontrolled hazardous energy
    r"\b(?:energized|live\s+circuit|stored\s+energy|residual\s+energy|residual\s+pressure|arc\s+flash|electro)",
    # SIF-high activities
    r"\b(?:confined\s+space\s+entr|entered\s+a\s+(?:confined|tank|vessel)|working\s+(?:at\s+height|on\s+(?:roof|elevated)))",
    # Atmospheric / toxic exposure events
    r"\b(?:oxygen.deficient|oxygen\s+deficien|exposed\s+to\s+(?:gas|vapor|fume|toxic)|h2s|hydrogen\s+sulphide|carbon\s+monoxide|toxic\s+exposure)",
    # Gravity / suspended load
    r"\b(?:fell\s+from|fall\s+from|struck\s+by\s+(?:falling|dropped)|suspended\s+load|dropped\s+object|nearly\s+lost\s+balance)",
    # Uncontrolled fire / explosion (exclude "fire extinguisher" / "fire watch" / "fire door")
    r"\b(?:fire\s+(?!extinguisher|watch|door|alarm|escape|drill|brigade|exit|safety)|explosion|ignition|flashback|blowout)",
    # Barrier absence in a high-energy context
    r"\b(?:without\s+(?:atmospheric|gas\s+monitor|fall\s+(?:arrest|protection)|lockout)|loto\s+(?:was\s+)?not\s+followed|isolation\s+not)",
    # Line of fire events
    r"\b(?:struck\s+by|hit\s+by|caught\s+between|crushed\s+by|run\s+over)",
]

# Indicators that suggest a routine observation with NO active exposure.
# ALL must be checked in combination — one phrase alone does not qualify.
_ROUTINE_OBSERVATION_SIGNALS = [
    # Temporal: overdue / expired / scheduled
    r"\b(?:overdue|expired|out.of.date|past.due|due\s+for|last\s+(?:inspection|service|test))",
    # Status: tag / sticker / label / certificate
    r"\b(?:inspection\s+tag|service\s+tag|monthly\s+(?:tag|sticker|label|check)|certificate\s+(?:expired|overdue))",
    # Equipment health: no active hazard stated
    r"\b(?:otherwise\s+in\s+good\s+condition|accessible|properly\s+mounted|in\s+working\s+order|no\s+(?:visible|apparent)\s+damage)",
    # Observation framing
    r"\b(?:during\s+routine|routine\s+inspection|during\s+inspection|while\s+conducting\s+(?:an\s+)?inspection)",
]


def _contextual_risk_adjustment(narrative: str, model_prob: float) -> dict:
    """Post-classifier contextual risk adjustment layer.

    The TF-IDF/XGBoost model was trained primarily on OSHA fatality abstracts
    and serious-incident reports, so its base scores are biased toward HIGH/CRITICAL
    for almost any safety-related text.  This layer checks whether the narrative
    contains concrete evidence of an active SIF precursor BEFORE accepting the
    model's high score, and transparently documents any downward adjustment.

    Rules (applied in order):
    1. If ANY SIF-positive signal is present → keep model probability as-is.
    2. If ZERO SIF-positive signals AND the narrative matches the routine-observation
       pattern (≥2 routine signals) → cap adjusted probability at 0.25 and
       clamp the risk band at MEDIUM.
    3. Otherwise → no adjustment.

    The original model probability is always preserved in the response.
    """
    import re
    text_l = narrative.lower()

    # 1. Any genuine SIF indicator → no adjustment
    for sig in _SIF_POSITIVE_SIGNALS:
        if re.search(sig, text_l):
            return {
                "model_sif_probability": round(model_prob, 4),
                "final_sif_probability": round(model_prob, 4),
                "risk_adjustment": None,
                "risk_adjustment_reason": None,
            }

    # 2. No SIF signals → check for routine-observation cluster
    routine_hits = sum(1 for sig in _ROUTINE_OBSERVATION_SIGNALS if re.search(sig, text_l))
    if routine_hits >= 2:
        adjusted = min(model_prob, 0.25)
        return {
            "model_sif_probability": round(model_prob, 4),
            "final_sif_probability": round(adjusted, 4),
            "risk_adjustment": "DOWNWARD",
            "risk_adjustment_reason": (
                "Model confidence adjusted based on contextual safety indicators. "
                "No active SIF precursor (uncontrolled energy, exposure, barrier failure, "
                "or imminent dangerous event) was detected in this narrative. "
                "The report appears to describe a routine observation with no current hazard."
            ),
        }

    # 3. No clear signal either way → pass through
    return {
        "model_sif_probability": round(model_prob, 4),
        "final_sif_probability": round(model_prob, 4),
        "risk_adjustment": None,
        "risk_adjustment_reason": None,
    }


class InferenceEngine:
    """Loads every artifact once; safe to hold as a singleton in the backend."""

    def __init__(self):
        self.encoder = NarrativeEncoder.load(ARTIFACTS / "encoder.pkl")
        self.index = VectorIndex.load(ARTIFACTS / "vector_index.faiss", ARTIFACTS / "vector_meta.json")
        sif_bundle = joblib.load(ARTIFACTS / "sif_classifier.joblib")
        self.text_pipe = sif_bundle["text_pipe"]
        self.ct = sif_bundle["column_transformer"]
        self.xgb = sif_bundle["xgb"]
        self.iso = sif_bundle["isotonic"]
        self.blend_weights = sif_bundle["blend_weights"]
        lsr_bundle = joblib.load(ARTIFACTS / "lsr_mapper.joblib")
        self.lsr_vectorizer = lsr_bundle["vectorizer"]
        self.lsr_clf = lsr_bundle["clf"]
        self.lsr_labels = lsr_bundle["labels"]

    # ---- sub-steps -----------------------------------------------------
    def _sif_probability(self, narrative, area, department, activity, barrier_failure):
        p_text = self.text_pipe.predict_proba([narrative])[0, 1]
        struct = pd.DataFrame([{
            "area": area, "department": department, "activity": activity,
            "barrier_failure": int(barrier_failure),
        }])
        Xs = self.ct.transform(struct)
        p_struct = self.xgb.predict_proba(Xs)[0, 1]
        w_text, w_struct = self.blend_weights
        raw = w_text * p_text + w_struct * p_struct
        return float(self.iso.predict([raw])[0])

    def _lsr_tags(self, narrative):
        X = self.lsr_vectorizer.transform([narrative])
        probs = self.lsr_clf.predict_proba(X)[0]
        # All candidates above the floor, sorted best-first.
        candidates = sorted(
            [
                {"rule": rule, "score": round(float(p), 4)}
                for rule, p in zip(self.lsr_labels, probs)
                if p >= LSR_CONFIDENCE_FLOOR
            ],
            key=lambda t: t["score"],
            reverse=True,
        )
        # Keep the raw candidate list for internal debugging/scoring, but
        # return at most 1 primary + LSR_RELATED_COUNT related rules so the
        # user-facing output stays focused.  A related rule must also exceed
        # a stricter secondary threshold (0.30) to avoid weak semantic matches.
        if not candidates:
            return []
        primary = candidates[0]
        related = [
            t for t in candidates[1:]
            if t["score"] >= 0.30
        ][:LSR_RELATED_COUNT]
        return [primary] + related

    def _explanation(self, narrative):
        """Linear-model token attribution. For a logistic-regression head over
        TF-IDF, contribution_j = coefficient_j * tfidf_value_j is the exact
        (not approximate) per-feature attribution -- the same quantity SHAP
        converges to on a linear model -- so no separate `shap` dependency
        is required here."""
        vec = self.text_pipe.named_steps["tfidf"]
        clf = self.text_pipe.named_steps["clf"]
        X = vec.transform([narrative])
        coo = X.tocoo()
        feature_names = vec.get_feature_names_out()
        generic_terms = {"worker", "workers", "employee", "employees", "was", "were"}
        contribs = [
            (feature_names[j], float(clf.coef_[0][j] * v))
            for j, v in zip(coo.col, coo.data)
            if feature_names[j] not in generic_terms
        ]
        contribs.sort(key=lambda t: abs(t[1]), reverse=True)
        top = contribs[:6]
        tokens = [{"term": t, "weight": round(w, 4)} for t, w in top if abs(w) > 1e-6]
        if tokens:
            top_terms = ", ".join(t["term"] for t in tokens[:3])
            summary = f"Elevated risk driven primarily by: {top_terms}."
        else:
            summary = "No single phrase dominates; risk reflects the overall narrative and structured context."
        return {"summary": summary, "tokens": tokens}

    def _root_cause(self, barrier_failure, lsr_tags, entities):
        # Use 'contributing factor' language — the system detects risk factors,
        # not definitive root causes (which require human investigation).
        failed_controls = entities.get("failed_controls", [])
        conditions = entities.get("condition", [])

        if failed_controls:
            primary = "CONTROL_FAILURE"
        elif barrier_failure:
            primary = "PROCEDURE_VIOLATION"
        elif lsr_tags and lsr_tags[0]["rule"] in ("SAFE_MECHANICAL_LIFTING", "HOT_WORK"):
            primary = "EQUIPMENT_RELATED"
        elif conditions:
            primary = "HAZARDOUS_CONDITION"
        else:
            primary = "CONTRIBUTING_FACTORS_DETECTED"

        return {
            "primary": primary,
            "contributing_factors": conditions[:5] if conditions else [],
            "failed_controls": failed_controls,
        }

    # ---- public API ------------------------------------------------------
    def analyze(self, narrative: str, site=None, area=None, department=None, activity=None, report_id="LIVE"):
        entities = extract_entities(narrative)
        if area is None or site is None:
            s, a = synth_site_area(report_id, narrative)
            site = site or s
            area = area or a
        department = department or synth_department(report_id, narrative)
        activity = activity or (entities["activity"][0].title() if entities["activity"] else "General Duties")
        barrier_failure = entities["barrier_failure"]

        model_p_sif = self._sif_probability(narrative, area, department, activity, barrier_failure)
        # --- FIX 1: contextual risk adjustment (transparent, post-classifier) ---
        adj = _contextual_risk_adjustment(narrative, model_p_sif)
        p_sif = adj["final_sif_probability"]
        # Use the adjusted probability for downstream fusion and risk banding.

        lsr_tags = self._lsr_tags(narrative)

        query_vec = self.encoder.encode_one(narrative)
        similar_fatalities = self.index.search(query_vec, top_k=FATALITY_TOPK, source_type="FATALITY")
        similar_incidents = self.index.search(query_vec, top_k=INCIDENT_TOPK, source_type="INCIDENT")
        fatality_sim_max = max([m["similarity"] for m in similar_fatalities], default=0.0)

        risk = fuse(p_sif, lsr_tags, barrier_failure, fatality_sim_max)
        explanation = self._explanation(narrative)
        root_cause_detail = self._root_cause(barrier_failure, lsr_tags, entities)
        # Keep backward-compatible string root_cause
        root_cause = root_cause_detail["primary"]

        twin_matches = [m for m in similar_fatalities if m["similarity"] >= 0.30][:5] or similar_fatalities[:3]
        failed_controls = entities.get("failed_controls", [])
        if failed_controls:
            barrier_text = failed_controls[0]
        else:
            barrier_text = "Control absent or bypassed" if barrier_failure else None
        twin = build_twin(narrative, twin_matches, barrier_text) if twin_matches else None

        recs = generate_recommendations(
            lsr_tags, barrier_failure,
            [m["report_id"] for m in twin_matches] if twin_matches else [],
            risk["risk_band"], entities,
        )

        input_hash = hashlib.sha256(narrative.encode()).hexdigest()[:16]

        return {
            "report_id": report_id,
            "narrative": narrative,
            "site": site, "area": area, "department": department, "activity": activity,
            # FIX 1 fields: expose both the raw model score and the adjusted score
            # so the UI can present them transparently.
            "model_sif_probability": adj["model_sif_probability"],
            "sif_probability": round(p_sif, 4),      # = final_sif_probability (backward-compat key)
            "final_sif_probability": adj["final_sif_probability"],
            "risk_adjustment": adj["risk_adjustment"],
            "risk_adjustment_reason": adj["risk_adjustment_reason"],
            "risk_band": risk["risk_band"],
            "risk_score": risk["score"],
            "confidence": round(1 - abs(0.5 - p_sif) * 0.4, 3),
            "lsr_tags": lsr_tags,
            "entities": {k: v for k, v in entities.items() if k not in ("barrier_failure", "failed_controls")},
            "barrier_failure": barrier_failure,
            "failed_controls": entities.get("failed_controls", []),
            "root_cause": root_cause,
            "root_cause_detail": root_cause_detail,
            "explanation": explanation,
            "similar_fatalities": similar_fatalities,
            "similar_incidents": similar_incidents,
            "fatality_twin": twin,
            "recommendations": recs,
            "model_version": MODEL_VERSION,
            "input_hash": input_hash,
            "escalation_override_applied": risk["escalation_override_applied"],
        }


_engine = None


def get_engine() -> InferenceEngine:
    global _engine
    if _engine is None:
        _engine = InferenceEngine()
    return _engine
