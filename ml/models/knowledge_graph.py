"""Safety Knowledge Graph — SRS 10.4, 12.6.

Builds a graph over site / activity / hazard / barrier-failure / root-cause /
outcome nodes from the analysed incident corpus, and ranks barrier-failure
nodes by betweenness centrality to surface the single control whose failure
threads through the most incident pathways.
"""
import networkx as nx
import pandas as pd


def _root_cause(row) -> str:
    if row.get("barrier_failure"):
        return "PROCEDURE_VIOLATION"
    hf = row.get("human_factor")
    hf = hf if isinstance(hf, str) else ""
    if "Equipment" in hf or "Defective" in hf:
        return "EQUIPMENT_FAILURE"
    if "Insufficient" in hf or "Lack" in hf:
        return "TRAINING_GAP"
    return "HUMAN_ERROR"


def build_graph(df: pd.DataFrame, max_rows=None) -> nx.Graph:
    g = nx.Graph()
    rows = df if max_rows is None else df.head(max_rows)
    for row in rows.itertuples():
        r = row._asdict() if hasattr(row, "_asdict") else dict(zip(df.columns, row))
        site = f"SITE::{r.get('site')}"
        activity = f"ACTIVITY::{r.get('activity')}"
        outcome = "OUTCOME::FATAL" if r.get("sif_positive") else "OUTCOME::NON_FATAL"
        root_cause = f"ROOT_CAUSE::{_root_cause(r)}"
        report_node = f"REPORT::{r.get('report_id')}"

        for n, kind in [(site, "site"), (activity, "activity"), (outcome, "outcome"), (root_cause, "root_cause")]:
            g.add_node(n, kind=kind, label=n.split("::", 1)[1])
        g.add_node(report_node, kind="report", label=r.get("report_id"))

        hazards = r.get("hazard_tags")
        hazards = list(hazards) if hazards is not None and len(hazards) > 0 else []
        for h in hazards[:3]:
            hnode = f"HAZARD::{h}"
            g.add_node(hnode, kind="hazard", label=h)
            g.add_edge(report_node, hnode)
            g.add_edge(hnode, root_cause)

        if r.get("barrier_failure"):
            barrier_node = "BARRIER::General barrier not verified"
            g.add_node(barrier_node, kind="barrier", label="Barrier not verified")
            g.add_edge(report_node, barrier_node)
            g.add_edge(barrier_node, outcome)

        g.add_edge(report_node, site)
        g.add_edge(report_node, activity)
        g.add_edge(report_node, root_cause)
        g.add_edge(root_cause, outcome)

    return g


def top_centrality_nodes(g: nx.Graph, kind: str = "barrier", top_n=10):
    if g.number_of_nodes() == 0:
        return []
    centrality = nx.betweenness_centrality(g, k=min(300, g.number_of_nodes()), seed=42)
    ranked = sorted(
        ((n, c) for n, c in centrality.items() if g.nodes[n].get("kind") == kind),
        key=lambda x: x[1], reverse=True,
    )[:top_n]
    return [{"node": n, "label": g.nodes[n]["label"], "centrality": round(c, 4)} for n, c in ranked]


def to_cytoscape_json(g: nx.Graph, max_nodes=250):
    nodes = list(g.nodes(data=True))[:max_nodes]
    node_ids = {n for n, _ in nodes}
    elements_nodes = [{"data": {"id": n, "label": d.get("label", n), "kind": d.get("kind", "")}} for n, d in nodes]
    elements_edges = [
        {"data": {"source": u, "target": v}}
        for u, v in g.edges()
        if u in node_ids and v in node_ids
    ]
    return {"nodes": elements_nodes, "edges": elements_edges}
