"""Safety bulletin PDF generation — SRS §12.8, FR-14."""
import io
from datetime import datetime

from reportlab.lib import colors
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle

RISK_COLORS = {
    "CRITICAL": colors.HexColor("#dc2626"), "HIGH": colors.HexColor("#ea580c"),
    "MEDIUM": colors.HexColor("#d97706"), "LOW": colors.HexColor("#16a34a"),
}


def build_bulletin_pdf(scope: str, site: str, aggregates: dict, top_reports: list) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=LETTER, topMargin=0.6 * inch, bottomMargin=0.6 * inch)
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("TitleX", parent=styles["Title"], fontSize=18)
    elements = []

    elements.append(Paragraph(f"KAVACH AI — {scope.title()} Safety Bulletin", title_style))
    elements.append(Paragraph(
        f"Generated {datetime.now().strftime('%Y-%m-%d %H:%M')}"
        + (f" · Scope: {site}" if site else " · Scope: All Sites"),
        styles["Normal"],
    ))
    elements.append(Spacer(1, 0.2 * inch))

    kpis = aggregates["kpis"]
    kpi_table = Table([
        ["Total Reports", "Critical %", "High-or-above %", "Avg SIF Probability"],
        [str(kpis["total_reports"]), f"{kpis['critical_pct']}%",
         f"{kpis['high_or_above_pct']}%", f"{kpis['avg_sif_probability']:.2f}"],
    ], colWidths=[1.7 * inch] * 4)
    kpi_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e293b")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
    ]))
    elements.append(kpi_table)
    elements.append(Spacer(1, 0.25 * inch))

    elements.append(Paragraph("Top Sites by Composite Risk Index", styles["Heading2"]))
    site_rows = [["Site", "Reports", "Critical", "High", "Composite Index"]]
    for s in aggregates["sites"][:6]:
        site_rows.append([s["site"], str(s["report_count"]), str(s["critical_count"]),
                           str(s["high_count"]), f"{s['composite_risk_index']:.2f}"])
    site_table = Table(site_rows, colWidths=[1.9 * inch, 0.9 * inch, 0.8 * inch, 0.8 * inch, 1.2 * inch])
    site_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#334155")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
    ]))
    elements.append(site_table)
    elements.append(Spacer(1, 0.25 * inch))

    elements.append(Paragraph("Top Priority Reports", styles["Heading2"]))
    for r in top_reports[:5]:
        band = r["risk_band"]
        style = ParagraphStyle(f"band_{band}", parent=styles["Normal"], textColor=RISK_COLORS.get(band, colors.black))
        elements.append(Paragraph(f"<b>{r['report_id']}</b> — {band} ({r['sif_probability']:.0%}) · {r['site']}", style))
        elements.append(Paragraph(r["narrative"][:220] + "...", styles["Normal"]))
        if r.get("recommendations", {}).get("corrective_actions"):
            elements.append(Paragraph(
                "Recommended: " + r["recommendations"]["corrective_actions"][0]["action"], styles["Italic"],
            ))
        elements.append(Spacer(1, 0.12 * inch))

    doc.build(elements)
    return buf.getvalue()
