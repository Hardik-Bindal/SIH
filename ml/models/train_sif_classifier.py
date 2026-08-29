"""
SIF Classifier (SRS 10.1 / SC-1).

SRS specifies "DistilBERT fine-tuned, blended with XGBoost over structured
features; probability calibrated with isotonic regression". Fine-tuning
DistilBERT needs pretrained weights from huggingface.co, which this sandbox
cannot reach (see docs/DEVIATIONS.md). The blended-ensemble + calibration +
recall-first threshold-tuning *architecture* is preserved exactly; only the
text-encoder swap is a substitution:

    LogisticRegression(TF-IDF text)  +  XGBoost(structured features)
    -> soft-voted, then isotonic-calibrated, then threshold tuned on
       validation to maximise recall at a precision floor (SRS 5.4).

Structured features come from the ETL enrichment (barrier_failure flag,
site/area/department, human/environmental factor codes where present).
"""
import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.calibration import CalibratedClassifierCV
from sklearn.compose import ColumnTransformer
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score, recall_score, precision_score, brier_score_loss, f1_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder
from xgboost import XGBClassifier

ROOT = Path(__file__).resolve().parent.parent.parent
PROCESSED = ROOT / "data" / "processed"
ARTIFACTS = ROOT / "ml" / "artifacts"
ARTIFACTS.mkdir(parents=True, exist_ok=True)

STRUCTURED_CATS = ["area", "department", "activity"]
STRUCTURED_BOOL = ["barrier_failure"]


def build_text_pipeline():
    return Pipeline([
        ("tfidf", TfidfVectorizer(max_features=30000, ngram_range=(1, 2), min_df=2, stop_words="english")),
        ("clf", LogisticRegression(max_iter=2000, class_weight="balanced", C=2.0)),
    ])


def build_structured_matrix(df: pd.DataFrame):
    ct = ColumnTransformer([
        ("cat", OneHotEncoder(handle_unknown="ignore"), STRUCTURED_CATS),
    ], remainder="passthrough")
    X = df[STRUCTURED_CATS + STRUCTURED_BOOL].copy()
    X["barrier_failure"] = X["barrier_failure"].astype(int)
    return ct, X


def main():
    df = pd.read_parquet(PROCESSED / "incidents.parquet")
    train = df[df.split == "train"].reset_index(drop=True)
    val = df[df.split == "val"].reset_index(drop=True)
    test = df[df.split == "test"].reset_index(drop=True)

    text_pipe = build_text_pipeline()
    text_pipe.fit(train["narrative"], train["sif_positive"])

    ct, X_struct_train = build_structured_matrix(train)
    Xs_train = ct.fit_transform(X_struct_train)
    xgb = XGBClassifier(
        n_estimators=300, max_depth=4, learning_rate=0.08, subsample=0.9,
        colsample_bytree=0.9, eval_metric="logloss",
        scale_pos_weight=(train.sif_positive == 0).sum() / max(1, (train.sif_positive == 1).sum()),
        random_state=42,
    )
    xgb.fit(Xs_train, train["sif_positive"])

    def blended_proba(split_df):
        p_text = text_pipe.predict_proba(split_df["narrative"])[:, 1]
        _, Xs = build_structured_matrix(split_df)
        Xs = ct.transform(Xs)
        p_struct = xgb.predict_proba(Xs)[:, 1]
        return 0.65 * p_text + 0.35 * p_struct

    val_raw = blended_proba(val)

    # Isotonic calibration fit on validation predictions vs true labels.
    from sklearn.isotonic import IsotonicRegression
    iso = IsotonicRegression(out_of_bounds="clip")
    iso.fit(val_raw, val["sif_positive"])

    def calibrated_proba(split_df):
        return iso.predict(blended_proba(split_df))

    # Threshold tuning on validation: maximise recall subject to precision >= 0.60
    val_cal = calibrated_proba(val)
    best_t, best_recall = 0.5, -1
    for t in np.arange(0.05, 0.95, 0.01):
        preds = (val_cal >= t).astype(int)
        if preds.sum() == 0:
            continue
        prec = precision_score(val["sif_positive"], preds, zero_division=0)
        rec = recall_score(val["sif_positive"], preds, zero_division=0)
        if prec >= 0.60 and rec > best_recall:
            best_recall, best_t = rec, t

    test_cal = calibrated_proba(test)
    test_preds = (test_cal >= best_t).astype(int)

    metrics = {
        "threshold": float(best_t),
        "test_recall_sif_positive": float(recall_score(test["sif_positive"], test_preds)),
        "test_precision_sif_positive": float(precision_score(test["sif_positive"], test_preds)),
        "test_f1": float(f1_score(test["sif_positive"], test_preds)),
        "test_roc_auc": float(roc_auc_score(test["sif_positive"], test_cal)),
        "test_brier_score": float(brier_score_loss(test["sif_positive"], test_cal)),
        "n_train": int(len(train)), "n_val": int(len(val)), "n_test": int(len(test)),
        "success_criteria": {
            "SC-1_recall_target": 0.90, "SC-1_roc_auc_target": 0.88,
        },
    }
    print(json.dumps(metrics, indent=2))

    joblib.dump({
        "text_pipe": text_pipe, "column_transformer": ct, "xgb": xgb,
        "isotonic": iso, "threshold": best_t, "blend_weights": (0.65, 0.35),
    }, ARTIFACTS / "sif_classifier.joblib")

    with open(ARTIFACTS / "sif_classifier_metrics.json", "w") as f:
        json.dump(metrics, f, indent=2)


if __name__ == "__main__":
    main()
