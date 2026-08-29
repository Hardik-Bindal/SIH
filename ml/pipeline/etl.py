"""
ETL pipeline for SIF Sentinel AI (SRS section 5.3).

Stages: acquisition -> cleaning -> de-duplication -> enrichment -> labelling
-> splitting. Embedding (stage 7) lives in ml/pipeline/embeddings.py because
it is shared with the live inference path.

Two source corpora:
  - osha_incidents.csv  (4,847 rows): mixed-severity incident narratives with
    real structured fields (Degree of Injury, Nature of Injury, Human Factor,
    Environmental Factor, ...). Used as the SIF-classification training +
    operational corpus.
  - osha_fatalities.csv (14,914 rows): confirmed fatality narratives with no
    structured severity field (outcome is fatal by definition). Used as the
    knowledge base for similarity retrieval / Fatality Twin.

Neither file carries site/area/department metadata (they are OSHA public
datasets, not OIL's internal reporting system). Per SRS 4.5 ("site, area and
department attributes are either present in the data or synthesised
consistently for the demonstration corpus, and this is disclosed on
screen"), those three fields are deterministically synthesised from a hash
of each record's stable id, lightly biased by real fields where they carry
signal (e.g. Construction End Use). `is_synthetic_org_fields: true` is
carried on every output row so the API/UI can disclose it.
"""
import hashlib
import re
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
from ml.pipeline.ner import extract_entities  # noqa: E402

RAW_DIR = Path(__file__).resolve().parent.parent.parent / "data" / "raw"
OUT_DIR = Path(__file__).resolve().parent.parent.parent / "data" / "processed"
OUT_DIR.mkdir(parents=True, exist_ok=True)

SITES = [
    ("Rig-07 Duliajan", "RIG"), ("Rig-12 Moran", "RIG"), ("Rig-03 Kumchai", "RIG"),
    ("Refinery Block A", "REFINERY"), ("Refinery Block B", "REFINERY"),
    ("Pipeline Sector 4", "PIPELINE"), ("Pipeline Sector 9", "PIPELINE"),
    ("Central Warehouse", "WAREHOUSE"), ("Field Workshop Duliajan", "WORKSHOP"),
]
DEPARTMENTS = [
    "Electrical Maintenance", "Mechanical Maintenance", "Process Operations",
    "Civil & Structural", "Logistics & Materials", "HSE", "Drilling Operations",
]

HIGH_SEVERITY_NATURE = {"Amputation, Crushing", "Electrocution", "Asphyxiation, Drowning"}

DEPT_KEYWORDS = [
    (re.compile(r"electric|cable|wire|circuit|volt|energiz", re.I), "Electrical Maintenance"),
    (re.compile(r"crane|hoist|winch|rig|drill", re.I), "Drilling Operations"),
    (re.compile(r"pipe|valve|pressure|pump|compress", re.I), "Process Operations"),
    (re.compile(r"scaffold|concrete|excavat|trench|roof|structur", re.I), "Civil & Structural"),
    (re.compile(r"truck|forklift|load|warehouse|material", re.I), "Logistics & Materials"),
    (re.compile(r"grinder|saw|drill(?!ing rig)|welding|torch", re.I), "Mechanical Maintenance"),
]

AREA_KEYWORDS = [
    (re.compile(r"pipeline|pipe line", re.I), "PIPELINE"),
    (re.compile(r"manufacturing plant|refinery|process unit", re.I), "REFINERY"),
    (re.compile(r"warehouse|storage yard", re.I), "WAREHOUSE"),
]


def _stable_hash(key: str) -> int:
    return int(hashlib.sha256(key.encode()).hexdigest(), 16)


def _clean_text(t: str) -> str:
    if not isinstance(t, str):
        return ""
    t = t.replace("\x00", " ")
    t = re.sub(r"[\r\n\t]+", " ", t)
    t = re.sub(r"\s+", " ", t).strip()
    # Expand common safety abbreviations (SRS 5.3 stage 2)
    expansions = {
        r"\bLOTO\b": "Lock-Out Tag-Out (LOTO)",
        r"\bPTW\b": "Permit-to-Work (PTW)",
        r"\bPPE\b": "Personal Protective Equipment (PPE)",
        r"\bTBSA\b": "Total Body Surface Area (TBSA)",
    }
    for pat, repl in expansions.items():
        t = re.sub(pat, repl, t)
    return t


def synth_site_area(report_id: str, text_hint: str):
    area_hint = None
    for pat, area in AREA_KEYWORDS:
        if pat.search(text_hint or ""):
            area_hint = area
            break
    candidates = [s for s in SITES if area_hint is None or s[1] == area_hint] or SITES
    idx = _stable_hash(report_id + "|site") % len(candidates)
    return candidates[idx]


def synth_department(report_id: str, text_hint: str):
    for pat, dept in DEPT_KEYWORDS:
        if pat.search(text_hint or ""):
            return dept
    idx = _stable_hash(report_id + "|dept") % len(DEPARTMENTS)
    return DEPARTMENTS[idx]


def _dedupe_exact(df: pd.DataFrame, text_col: str) -> pd.DataFrame:
    norm = df[text_col].str.lower().str.replace(r"\s+", " ", regex=True).str.strip()
    return df.loc[~norm.duplicated()].copy()


def _dedupe_near(df: pd.DataFrame, text_col: str, threshold: float = 0.95, cap: int = 6000) -> pd.DataFrame:
    """Cosine-similarity near-duplicate removal. Only run on corpora small
    enough for a dense pairwise pass (see docs/DEVIATIONS.md re: MinHash)."""
    if len(df) > cap:
        return df
    vec = TfidfVectorizer(max_features=20000, ngram_range=(1, 2), stop_words="english")
    X = vec.fit_transform(df[text_col].fillna(""))
    sim = cosine_similarity(X, dense_output=False)
    keep = np.ones(len(df), dtype=bool)
    coo = sim.tocoo()
    for i, j, v in zip(coo.row, coo.col, coo.data):
        if i < j and v >= threshold and keep[i] and keep[j]:
            keep[j] = False
    return df.loc[keep].copy()


def _consolidate_wrapped_rows(df: pd.DataFrame) -> pd.DataFrame:
    """A handful of `summary_nr` values in the source CSV are split across
    multiple physical rows -- long `Abstract Text` values that wrapped
    without proper CSV quoting in the original export, so pandas reads each
    wrapped fragment as its own row sharing the same summary_nr and every
    other field. Left unmerged, this creates several report_ids per real
    incident (verified: e.g. summary_nr 220957740's two fragments read
    "...the scissor lift got stuck..." / "resulting in the employee's head
    being crushed..." -- two halves of one sentence). Concatenate the
    Abstract Text fragments in file order and collapse to one row per
    summary_nr before anything downstream assigns a report_id."""
    dup_ids = df["summary_nr"][df["summary_nr"].duplicated(keep=False)].unique()
    if len(dup_ids) == 0:
        return df
    merged_text = (
        df[df["summary_nr"].isin(dup_ids)]
        .groupby("summary_nr")["Abstract Text"]
        .apply(lambda s: " ".join(t.strip() for t in s.fillna("") if t.strip()))
    )
    df = df.drop_duplicates(subset="summary_nr", keep="first").copy()
    df.loc[df["summary_nr"].isin(dup_ids), "Abstract Text"] = df.loc[
        df["summary_nr"].isin(dup_ids), "summary_nr"
    ].map(merged_text)
    return df


def process_incidents() -> pd.DataFrame:
    df = pd.read_csv(RAW_DIR / "osha_incidents.csv")
    df = _consolidate_wrapped_rows(df)
    df["report_id"] = "INC-" + df["summary_nr"].astype(str)
    df["narrative"] = (df["Abstract Text"].fillna("") + " " + df["Event Description"].fillna("")).map(_clean_text)
    df = df[df["narrative"].str.len() > 15]
    df = _dedupe_exact(df, "narrative")
    df = _dedupe_near(df, "narrative")

    df["sif_positive"] = (
        (df["Degree of Injury"] == "Fatal") | (df["Nature of Injury"].isin(HIGH_SEVERITY_NATURE))
    ).astype(int)

    site_area = df.apply(lambda r: synth_site_area(r["report_id"], r["narrative"]), axis=1)
    df["site"] = site_area.map(lambda t: t[0])
    df["area"] = site_area.map(lambda t: t[1])
    df["department"] = df.apply(lambda r: synth_department(r["report_id"], r["narrative"]), axis=1)

    ents = df["narrative"].map(extract_entities)
    df["activity"] = ents.map(lambda e: (e["activity"][0].title() if e["activity"] else "General Duties"))
    df["hazard_tags"] = ents.map(lambda e: e["hazard"])
    df["equipment_tags"] = ents.map(lambda e: e["equipment"])
    df["condition_tags"] = ents.map(lambda e: e["condition"])
    df["barrier_failure"] = ents.map(lambda e: e["barrier_failure"])

    try:
        df["reported_on"] = pd.to_datetime(df["Event Date"], format="%m/%d/%Y", errors="coerce")
    except Exception:
        df["reported_on"] = pd.to_datetime(df["Event Date"], errors="coerce")

    report_type = np.where(df["sif_positive"] == 1, "INCIDENT", "NEAR_MISS")
    df["report_type"] = report_type
    df["source"] = "OSHA_INCIDENT"
    df["source_type"] = "INCIDENT"
    df["is_synthetic_org_fields"] = True

    keep_cols = [
        "report_id", "narrative", "report_type", "site", "area", "department", "activity",
        "hazard_tags", "equipment_tags", "condition_tags", "barrier_failure",
        "reported_on", "sif_positive", "source", "source_type", "is_synthetic_org_fields",
        "Degree of Injury", "Nature of Injury", "Event type", "Human Factor",
        "Environmental Factor", "Part of Body",
    ]
    out = df[keep_cols].rename(columns={
        "Degree of Injury": "degree_of_injury", "Nature of Injury": "nature_of_injury",
        "Event type": "event_type", "Human Factor": "human_factor",
        "Environmental Factor": "environmental_factor", "Part of Body": "part_of_body",
    })
    return out.reset_index(drop=True)


def process_fatalities() -> pd.DataFrame:
    df = pd.read_csv(RAW_DIR / "osha_fatalities.csv")
    df["report_id"] = "FAT-" + df["id"].astype(str)
    df["narrative"] = df["description"].fillna("").map(_clean_text)
    df = df[df["narrative"].str.len() > 15]
    df = _dedupe_exact(df, "narrative")

    site_area = df.apply(lambda r: synth_site_area(r["report_id"], r["narrative"]), axis=1)
    df["site"] = site_area.map(lambda t: t[0])
    df["area"] = site_area.map(lambda t: t[1])
    df["department"] = df.apply(lambda r: synth_department(r["report_id"], r["narrative"]), axis=1)

    ents = df["narrative"].map(extract_entities)
    df["activity"] = ents.map(lambda e: (e["activity"][0].title() if e["activity"] else "General Duties"))
    df["hazard_tags"] = ents.map(lambda e: e["hazard"])
    df["equipment_tags"] = ents.map(lambda e: e["equipment"])
    df["condition_tags"] = ents.map(lambda e: e["condition"])
    df["barrier_failure"] = ents.map(lambda e: e["barrier_failure"])

    df["reported_on"] = pd.to_datetime(df["incident_date"], errors="coerce")
    df["report_type"] = "INCIDENT"
    df["sif_positive"] = 1
    df["source"] = "OSHA_FATALITY"
    df["source_type"] = "FATALITY"
    df["is_synthetic_org_fields"] = True

    keep_cols = [
        "report_id", "narrative", "report_type", "site", "area", "department", "activity",
        "hazard_tags", "equipment_tags", "condition_tags", "barrier_failure",
        "reported_on", "sif_positive", "source", "source_type", "is_synthetic_org_fields",
        "city", "state", "plan", "citation",
    ]
    return df[keep_cols].reset_index(drop=True)


def stratified_split(df: pd.DataFrame, group_col="site", label_col="sif_positive", seed=42):
    """70/15/15 split, grouped by site to prevent leakage (SRS 5.3 stage 6)."""
    rng = np.random.RandomState(seed)
    groups = np.array(df[group_col].unique().tolist(), dtype=object)
    rng.shuffle(groups)
    n = len(groups)
    n_train = max(1, int(n * 0.70))
    n_val = max(1, int(n * 0.15))
    train_groups = set(groups[:n_train])
    val_groups = set(groups[n_train:n_train + n_val])
    test_groups = set(groups[n_train + n_val:]) or set(groups[-1:])

    split = np.where(df[group_col].isin(train_groups), "train",
             np.where(df[group_col].isin(val_groups), "val", "test"))
    df = df.copy()
    df["split"] = split
    return df


def main():
    print("Processing incidents corpus...")
    incidents = process_incidents()
    incidents = stratified_split(incidents)
    print(f"  -> {len(incidents)} rows after cleaning/dedup "
          f"(sif_positive rate: {incidents['sif_positive'].mean():.3f})")
    print(incidents["split"].value_counts())

    print("Processing fatalities corpus...")
    fatalities = process_fatalities()
    fatalities["split"] = "reference"  # knowledge base, not used for classifier training
    print(f"  -> {len(fatalities)} rows after cleaning/dedup")

    incidents.to_parquet(OUT_DIR / "incidents.parquet", index=False)
    fatalities.to_parquet(OUT_DIR / "fatalities.parquet", index=False)
    incidents.to_json(OUT_DIR / "incidents.jsonl", orient="records", lines=True, date_format="iso")
    fatalities.to_json(OUT_DIR / "fatalities.jsonl", orient="records", lines=True, date_format="iso")

    summary = {
        "incidents_total": int(len(incidents)),
        "incidents_sif_positive": int(incidents["sif_positive"].sum()),
        "incidents_sif_positive_rate": float(incidents["sif_positive"].mean()),
        "fatalities_total": int(len(fatalities)),
        "combined_vector_corpus_size": int(len(incidents) + len(fatalities)),
    }
    import json
    with open(OUT_DIR / "etl_summary.json", "w") as f:
        json.dump(summary, f, indent=2)
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
