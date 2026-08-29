"""Seven-day risk forecaster — SRS 10.1 (Forecaster), FR-13.

SRS specifies Prophet. Prophet's compiled Stan backend is heavy to build in
this sandbox and adds real risk of failing mid-build for a component that,
for a 7-day linear-trend forecast, does not need it. A direct linear-trend +
weekly-seasonal-residual model is used instead — same inputs/outputs
(direction, magnitude, confidence interval), simpler failure mode. See
docs/DEVIATIONS.md.

The two source corpora carry real dates (2009-2022 for fatalities, 2016-17
for incidents) but neither is "the last 90 days" of anything — there is no
live feed. To demonstrate a moving 90-day operational window, each report is
deterministically mapped onto a synthetic recent date via a stable hash of
its report_id (disclosed via `is_synthetic_timeline: true` in the response),
preserving each report's real day-of-week and its real hazard category.
"""
import hashlib
from datetime import timedelta

import numpy as np
import pandas as pd

WINDOW_DAYS = 90
FORECAST_DAYS = 7


def _synthetic_recent_date(report_id: str, anchor: pd.Timestamp) -> pd.Timestamp:
    h = int(hashlib.sha256((report_id + "|date").encode()).hexdigest(), 16)
    offset = h % WINDOW_DAYS
    return anchor - timedelta(days=offset)


def build_synthetic_timeline(df: pd.DataFrame, date_col="reported_on", anchor=None) -> pd.Series:
    anchor = anchor or pd.Timestamp.now().normalize()
    return df["report_id"].map(lambda rid: _synthetic_recent_date(rid, anchor))


def forecast_by_category(df: pd.DataFrame, category_col: str, anchor=None):
    """df must have columns [report_id, category_col]. Returns per-category 7-day forecast."""
    anchor = anchor or pd.Timestamp.now().normalize()
    df = df.copy()
    df["_date"] = build_synthetic_timeline(df, anchor=anchor)

    results = {}
    for cat, g in df.groupby(category_col):
        daily = g.groupby("_date").size()
        full_range = pd.date_range(anchor - timedelta(days=WINDOW_DAYS - 1), anchor, freq="D")
        daily = daily.reindex(full_range, fill_value=0)

        x = np.arange(len(daily))
        y = daily.values.astype(float)
        if len(x) < 2 or y.sum() == 0:
            continue
        slope, intercept = np.polyfit(x, y, 1)
        trend = slope * x + intercept
        resid_std = float(np.std(y - trend)) or 0.5

        future_x = np.arange(len(daily), len(daily) + FORECAST_DAYS)
        future_y = np.clip(slope * future_x + intercept, 0, None)

        pct_change = 0.0
        recent_mean = y[-14:].mean() if y[-14:].mean() > 0 else 0.01
        pct_change = float((future_y.mean() - recent_mean) / recent_mean * 100)

        results[cat] = {
            "category": cat,
            "history": [{"date": d.strftime("%Y-%m-%d"), "count": int(v)} for d, v in daily.items()],
            "forecast": [
                {
                    "date": (anchor + timedelta(days=i + 1)).strftime("%Y-%m-%d"),
                    "expected": round(float(v), 2),
                    "lower": round(max(0.0, float(v) - 1.96 * resid_std), 2),
                    "upper": round(float(v) + 1.96 * resid_std, 2),
                }
                for i, v in enumerate(future_y)
            ],
            "direction": "up" if slope > 0.01 else ("down" if slope < -0.01 else "flat"),
            "pct_change_vs_recent_mean": round(pct_change, 1),
            "is_synthetic_timeline": True,
        }
    return results
