"""
AI Safety Copilot — SRS §10.3, §12.2, FR-12, SC-5.

SRS specifies LangChain RAG over a hosted LLM. This sandbox has no reachable
LLM endpoint (see docs/DEVIATIONS.md), so answer synthesis is intent-routed
extractive/template composition over the *same* retrieval substrate (the
FAISS vector index + the live in-memory aggregates) rather than free
generation. The part of the spec that actually matters for trust -- the
citation guardrail -- is enforced for real: every branch below either
attaches at least one genuine report_id it read data from, or returns
`grounded: false` with an explicit refusal. Nothing is fabricated.
"""
import re

from ml.pipeline.inference import get_engine

SITE_NAMES = [
    "Rig-07 Duliajan", "Rig-12 Moran", "Rig-03 Kumchai", "Refinery Block A",
    "Refinery Block B", "Pipeline Sector 4", "Pipeline Sector 9",
    "Central Warehouse", "Field Workshop Duliajan",
]
AREA_NAMES = ["RIG", "REFINERY", "PIPELINE", "WAREHOUSE", "WORKSHOP"]
REPORT_ID_RE = re.compile(r"\b(INC|FAT|LIVE)-[A-Za-z0-9]+\b", re.I)


def _refuse(reason: str):
    return {"answer": reason, "citations": [], "intent": "unresolved", "grounded": False}


def _site_ranking(store):
    sites = store.aggregates()["sites"]
    if not sites:
        return _refuse("No scored reports are available yet to rank sites by risk.")
    top = sites[0]
    incidents_at_top = [r for r in store.incidents if r["site"] == top["site"]]
    incidents_at_top.sort(key=lambda r: r["sif_probability"], reverse=True)
    citations = [r["report_id"] for r in incidents_at_top[:3]]
    answer = (
        f"{top['site']} currently has the highest composite risk index "
        f"({top['composite_risk_index']:.2f}) across {top['report_count']} analysed reports, "
        f"with {top['critical_count']} CRITICAL and {top['high_count']} HIGH-band reports. "
        f"Average SIF probability there is {top['avg_sif_probability']:.2f}."
    )
    return {"answer": answer, "citations": citations, "intent": "site_ranking", "grounded": bool(citations)}


def _report_lookup(store, query):
    m = REPORT_ID_RE.search(query)
    if not m:
        return None
    rid = m.group(0).upper()
    report = store.get_by_id(rid) or store.fatalities_by_id.get(rid)
    if not report:
        return _refuse(f"No report with id {rid} was found in the corpus.")
    if "risk_band" not in report:
        answer = f"{rid} is a confirmed fatality on record: \"{report['narrative'][:200]}\""
        return {"answer": answer, "citations": [rid], "intent": "report_lookup", "grounded": True}
    top_lsr = report["lsr_tags"][0]["rule"] if report["lsr_tags"] else "no specific rule"
    twin = report.get("fatality_twin")
    twin_str = (
        f" It matches {twin['matched']} historical fatal case(s) at up to {twin['similarity']:.0%} similarity."
        if twin else ""
    )
    answer = (
        f"{rid} is rated {report['risk_band']} (SIF probability {report['sif_probability']:.0%}). "
        f"{report['explanation']['summary']} Primary Life Saving Rule concern: {top_lsr}.{twin_str}"
    )
    citations = [rid] + (twin["matched_report_ids"][:3] if twin else [])
    return {"answer": answer, "citations": citations, "intent": "report_lookup", "grounded": True}


def _capa(store, query):
    ql = query.lower()
    site = next((s for s in SITE_NAMES if s.lower() in ql), None)
    area = next((a for a in AREA_NAMES if a.lower() in ql), None)
    candidates = store.filtered(site=site, area=area)
    if not candidates:
        candidates = store.incidents
    candidates = [c for c in candidates if c["risk_band"] in ("HIGH", "CRITICAL")]
    if not candidates:
        return _refuse("No HIGH/CRITICAL reports match that scope to base a CAPA on.")
    candidates.sort(key=lambda r: r["sif_probability"], reverse=True)
    top = candidates[0]
    recs = top["recommendations"]
    corrective = "; ".join(a["action"] for a in recs["corrective_actions"][:2])
    answer = (
        f"Based on {top['report_id']} ({top['risk_band']}, {top['site']}): {corrective} "
        f"{recs['precedent_note']}"
    )
    return {"answer": answer, "citations": [top["report_id"]], "intent": "capa", "grounded": True}


def _summary(store):
    kpis = store.aggregates()["kpis"]
    top_risky = sorted(store.incidents, key=lambda r: r["sif_probability"], reverse=True)[:3]
    if not top_risky:
        return _refuse("No reports have been analysed yet.")
    ids = [r["report_id"] for r in top_risky]
    answer = (
        f"{kpis['total_reports']} reports analysed; {kpis['critical_pct']}% CRITICAL and "
        f"{kpis['high_or_above_pct']}% HIGH-or-above. Highest-priority reports right now: "
        + ", ".join(f"{r['report_id']} ({r['risk_band']}, {r['site']})" for r in top_risky) + "."
    )
    return {"answer": answer, "citations": ids, "intent": "summary", "grounded": True}


def _barrier_analysis(store):
    top_barriers = store.graph.get("top_barrier_centrality", [])
    failed = [r for r in store.incidents if r.get("barrier_failure")]
    if not failed:
        return _refuse("No barrier-failure pattern is evident in the corpus yet.")
    ids = [r["report_id"] for r in failed[:3]]
    if top_barriers:
        answer = (
            f"The most central recurring barrier failure across the knowledge graph is "
            f"\"{top_barriers[0]['label']}\" (betweenness centrality {top_barriers[0]['centrality']}). "
            f"{len(failed)} analysed reports show a detected barrier failure."
        )
    else:
        answer = f"{len(failed)} analysed reports show a detected barrier failure (e.g. lockout/guard not verified)."
    return {"answer": answer, "citations": ids, "intent": "barrier_analysis", "grounded": True}


def _comparison(store, query):
    ql = query.lower()
    mentioned = [s for s in SITE_NAMES if s.lower() in ql] or [a for a in AREA_NAMES if a.lower() in ql]
    if len(mentioned) < 2:
        return None
    a, b = mentioned[0], mentioned[1]
    key = "site" if a in SITE_NAMES else "area"
    agg = store.aggregates()[f"{key}s"]
    row_a = next((r for r in agg if r[key] == a), None)
    row_b = next((r for r in agg if r[key] == b), None)
    if not row_a or not row_b:
        return _refuse(f"Not enough data to compare {a} and {b}.")
    winner = a if row_a["composite_risk_index"] > row_b["composite_risk_index"] else b
    answer = (
        f"{a}: composite risk index {row_a['composite_risk_index']:.2f} across {row_a['report_count']} reports. "
        f"{b}: composite risk index {row_b['composite_risk_index']:.2f} across {row_b['report_count']} reports. "
        f"{winner} currently carries higher risk."
    )
    ex_a = next((r["report_id"] for r in store.incidents if r[key] == a), None)
    ex_b = next((r["report_id"] for r in store.incidents if r[key] == b), None)
    citations = [c for c in (ex_a, ex_b) if c]
    return {"answer": answer, "citations": citations, "intent": "comparison", "grounded": bool(citations)}


MIN_SEMANTIC_SIMILARITY = 0.35


def _semantic_fallback(store, query):
    engine = get_engine()
    vec = engine.encoder.encode_one(query)
    hits = engine.index.search(vec, top_k=5)
    hits = [h for h in hits if h["similarity"] >= MIN_SEMANTIC_SIMILARITY]
    if not hits:
        # A TF-IDF/SVD encoder (see docs/DEVIATIONS.md) can still return a
        # non-zero cosine score for an off-topic query; below this floor the
        # match is noise, not evidence, so the guardrail declines rather
        # than asserting a "closest match" that isn't actually relevant.
        return _refuse(
            "No sufficiently relevant reports were found in the corpus for this question — "
            "the corpus doesn't appear to have evidence on this topic."
        )
    snippet = "; ".join(f"{h['report_id']}: \"{h['narrative'][:120]}\"" for h in hits[:3])
    answer = f"The closest matching reports in the corpus are: {snippet}"
    return {"answer": answer, "citations": [h["report_id"] for h in hits[:3]], "intent": "semantic", "grounded": True}


def _structured(store, query):
    """Multi-constraint queries ("confined space incidents during monsoon with
    SIF > 90 where the gas detector failed") are answered by the structured
    filter engine rather than by semantic similarity, which cannot honour a
    numeric threshold or a season. Only used when the parser actually
    recognised more than one constraint — a single-constraint question is
    better served by the intent handlers below."""
    from app.services import structured_query as sq

    parsed = sq.parse(query)
    constraint_count = sum(
        1 for k in ("topic", "season", "year", "sif", "risk_band", "barrier_failure",
                    "site", "area", "department")
        if parsed.get(k)
    ) + len(parsed["conditions"])
    if constraint_count < 2:
        return None

    result = sq.run(store, query)
    if not result["recognised"]:
        return None
    return {
        "answer": result["answer"],
        "citations": result["citations"],
        "intent": "structured_query",
        "grounded": result["grounded"],
        "structured": {
            "applied_filters": result.get("applied_filters", []),
            "aggregate": result.get("aggregate"),
            "results": result.get("results", [])[:10],
            "relaxation": result.get("relaxation"),
            "unrecognised": parsed.get("unrecognised", []),
        },
    }


def _memory_recall(store, query):
    """"Has this happened before?" — routed to Safety Memory so the chat
    surface and the report page answer it from the same evidence."""
    from app.services import memory as memory_service

    m = REPORT_ID_RE.search(query)
    if m:
        recall = memory_service.recall_for_report(store, m.group(0).upper())
    else:
        recall = memory_service.recall(store, query)
    if not recall:
        return None
    if not recall["matches"]:
        return _refuse(recall["verdict_text"])
    bits = [recall["verdict_text"]]
    if recall["common_cause"]:
        cc = recall["common_cause"]
        bits.append(f"Common cause: {cc['cause']} ({cc['support']} of {cc['of']} matched cases).")
    if recall["recommended_action"]:
        bits.append(f"Recommended action: {recall['recommended_action']['corrective']}")
    return {
        "answer": " ".join(bits),
        "citations": recall["citations"],
        "intent": "safety_memory",
        "grounded": bool(recall["citations"]),
        "memory": recall,
    }


def answer(store, query: str) -> dict:
    ql = query.lower()

    if any(k in ql for k in ("happened before", "seen this before", "similar to this",
                             "has this happened", "precedent", "safety memory", "recur")):
        mem = _memory_recall(store, query)
        if mem:
            return mem

    structured = _structured(store, query)
    if structured:
        return structured

    result = _report_lookup(store, query)
    if result:
        return result
    if any(k in ql for k in ("most dangerous", "riskiest", "which site", "which of our sites")):
        return _site_ranking(store)
    if "capa" in ql or "corrective" in ql or "toolbox" in ql:
        return _capa(store, query)
    if "summar" in ql:
        return _summary(store)
    if "barrier" in ql:
        return _barrier_analysis(store)
    if "compare" in ql or " vs " in ql or " versus " in ql:
        cmp_result = _comparison(store, query)
        if cmp_result:
            return cmp_result
    return _semantic_fallback(store, query)
