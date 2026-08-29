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

MODEL_VERSION = "sif-sentinel-v1.0-tfidf-xgb"
LSR_CONFIDENCE_FLOOR = 0.20
FATALITY_TOPK = 10
INCIDENT_TOPK = 10


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
        tags = [
            {"rule": rule, "score": round(float(p), 4)}
            for rule, p in zip(self.lsr_labels, probs)
            if p >= LSR_CONFIDENCE_FLOOR
        ]
        return sorted(tags, key=lambda t: t["score"], reverse=True)

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

    def _root_cause(self, barrier_failure, lsr_tags):
        if barrier_failure:
            return "PROCEDURE_VIOLATION"
        if lsr_tags and lsr_tags[0]["rule"] in ("SAFE_MECHANICAL_LIFTING", "HOT_WORK"):
            return "EQUIPMENT_FAILURE"
        return "HUMAN_ERROR"

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

        p_sif = self._sif_probability(narrative, area, department, activity, barrier_failure)
        lsr_tags = self._lsr_tags(narrative)

        query_vec = self.encoder.encode_one(narrative)
        similar_fatalities = self.index.search(query_vec, top_k=FATALITY_TOPK, source_type="FATALITY")
        similar_incidents = self.index.search(query_vec, top_k=INCIDENT_TOPK, source_type="INCIDENT")
        fatality_sim_max = max([m["similarity"] for m in similar_fatalities], default=0.0)

        risk = fuse(p_sif, lsr_tags, barrier_failure, fatality_sim_max)
        explanation = self._explanation(narrative)
        root_cause = self._root_cause(barrier_failure, lsr_tags)

        twin_matches = [m for m in similar_fatalities if m["similarity"] >= 0.30][:5] or similar_fatalities[:3]
        barrier_text = "Lock-out/isolation not verified" if barrier_failure else None
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
            "sif_probability": round(p_sif, 4),
            "risk_band": risk["risk_band"],
            "risk_score": risk["score"],
            "confidence": round(1 - abs(0.5 - p_sif) * 0.4, 3),
            "lsr_tags": lsr_tags,
            "entities": {k: v for k, v in entities.items() if k != "barrier_failure"},
            "barrier_failure": barrier_failure,
            "root_cause": root_cause,
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
