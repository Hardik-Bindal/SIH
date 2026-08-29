"""Multi-label Life Saving Rule mapper (SRS 10.1 LSR Mapper, SC-2)."""
import json
import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import f1_score
from sklearn.multiclass import OneVsRestClassifier

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
from ml.models.lsr_rules import weak_label, RULE_LABELS  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent.parent
PROCESSED = ROOT / "data" / "processed"
ARTIFACTS = ROOT / "ml" / "artifacts"


def main():
    df = pd.read_parquet(PROCESSED / "incidents.parquet")
    weak = df.apply(lambda r: weak_label(r["narrative"], r.get("human_factor"), r.get("event_type")), axis=1)
    Y = pd.DataFrame(list(weak))[RULE_LABELS]

    train_mask = df.split == "train"
    val_mask = df.split == "val"
    test_mask = df.split == "test"

    vec = TfidfVectorizer(max_features=30000, ngram_range=(1, 2), min_df=2, stop_words="english")
    X_train = vec.fit_transform(df.loc[train_mask, "narrative"])
    X_test = vec.transform(df.loc[test_mask, "narrative"])

    clf = OneVsRestClassifier(LogisticRegression(max_iter=2000, class_weight="balanced"))
    clf.fit(X_train, Y.loc[train_mask])

    pred_test = clf.predict(X_test)
    micro_f1 = f1_score(Y.loc[test_mask], pred_test, average="micro", zero_division=0)

    per_rule = {}
    for i, rule in enumerate(RULE_LABELS):
        per_rule[rule] = float(f1_score(Y.loc[test_mask].iloc[:, i], pred_test[:, i], zero_division=0))

    metrics = {
        "micro_f1_vs_weak_labels": float(micro_f1),
        "per_rule_f1_vs_weak_labels": per_rule,
        "label_source": "rule-based weak supervision (ml/models/lsr_rules.py) — NOT human-annotated ground truth",
        "success_criteria": {"SC-2_micro_f1_target": 0.85},
        "n_test": int(test_mask.sum()),
    }
    print(json.dumps(metrics, indent=2))

    joblib.dump({"vectorizer": vec, "clf": clf, "labels": RULE_LABELS}, ARTIFACTS / "lsr_mapper.joblib")
    with open(ARTIFACTS / "lsr_mapper_metrics.json", "w") as f:
        json.dump(metrics, f, indent=2)


if __name__ == "__main__":
    main()
