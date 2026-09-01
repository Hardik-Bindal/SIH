/**
 * generateIncidentPdf.js
 *
 * Generates a fully formatted PDF for an incident analysis report using jsPDF.
 * Pure client-side — no server required.
 */
import { jsPDF } from 'jspdf'

// ── helpers ──────────────────────────────────────────────────────────────────

const BRAND = [59, 130, 246]   // blue-500
const CRITICAL = [220, 38, 38] // red-600
const HIGH = [234, 88, 12]     // orange-600
const MEDIUM = [202, 138, 4]   // yellow-600
const LOW = [22, 163, 74]      // green-600
const GRAY = [107, 114, 128]
const DARK = [17, 24, 39]
const LIGHT_BG = [248, 250, 252]
const BORDER = [226, 232, 240]

function bandColor(band) {
  if (!band) return GRAY
  switch (band.toUpperCase()) {
    case 'CRITICAL': return CRITICAL
    case 'HIGH':     return HIGH
    case 'MEDIUM':   return MEDIUM
    case 'LOW':      return LOW
    default:         return GRAY
  }
}

function fmt(val, fallback = '—') {
  return val || fallback
}

function pct(val) {
  if (val == null) return '—'
  return `${(val * 100).toFixed(1)}%`
}

function wrapText(doc, text, x, y, maxWidth, lineHeight = 5) {
  const lines = doc.splitTextToSize(text || '—', maxWidth)
  doc.text(lines, x, y)
  return y + lines.length * lineHeight
}

// ── section helpers ───────────────────────────────────────────────────────────

function drawHR(doc, y, color = BORDER) {
  doc.setDrawColor(...color)
  doc.setLineWidth(0.3)
  doc.line(14, y, 196, y)
  return y + 4
}

function sectionHeader(doc, title, y) {
  doc.setFillColor(...BRAND)
  doc.roundedRect(14, y, 182, 7, 1.5, 1.5, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(255, 255, 255)
  doc.text(title.toUpperCase(), 18, y + 4.8)
  return y + 11
}

function keyVal(doc, key, value, x, y, keyWidth = 45) {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(...GRAY)
  doc.text(key, x, y)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...DARK)
  const lines = doc.splitTextToSize(String(value || '—'), 130 - keyWidth)
  doc.text(lines, x + keyWidth, y)
  return y + lines.length * 4.5
}

function pill(doc, text, x, y, bgColor, textColor = [255, 255, 255]) {
  const textW = doc.getTextWidth(text) + 4
  doc.setFillColor(...bgColor)
  doc.roundedRect(x, y - 3.2, textW, 5, 1, 1, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(...textColor)
  doc.text(text, x + 2, y)
  return x + textW + 2
}

function checkPageBreak(doc, y, needed = 20) {
  if (y + needed > 278) {
    doc.addPage()
    return 16
  }
  return y
}

// ── main export ───────────────────────────────────────────────────────────────

export function generateIncidentPdf(analysis) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = 210
  const margin = 14
  const innerW = pageW - margin * 2

  // ── COVER HEADER ─────────────────────────────────────────────────────────
  doc.setFillColor(...BRAND)
  doc.rect(0, 0, 210, 30, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(255, 255, 255)
  doc.text('SIF Sentinel AI', margin, 12)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(200, 220, 255)
  doc.text('Incident Analysis Report', margin, 18)

  // Report ID badge top-right
  const rId = analysis.report_id || 'UNKNOWN'
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  const idW = doc.getTextWidth(rId) + 6
  doc.setFillColor(255, 255, 255)
  doc.roundedRect(210 - margin - idW, 10, idW, 8, 2, 2, 'F')
  doc.setTextColor(...BRAND)
  doc.text(rId, 210 - margin - idW + 3, 15.5)

  // Timestamp
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(180, 210, 255)
  const now = new Date().toLocaleString('en-IN', { dateStyle: 'long', timeStyle: 'short' })
  doc.text(`Generated: ${now}`, margin, 26)

  let y = 38

  // ── RISK SUMMARY BAND ─────────────────────────────────────────────────────
  const bColor = bandColor(analysis.risk_band)
  doc.setFillColor(...bColor)
  doc.roundedRect(margin, y, innerW, 18, 2, 2, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.setTextColor(255, 255, 255)
  doc.text(analysis.risk_band || 'UNSCORED', margin + 5, y + 12)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(255, 255, 255)
  doc.text(`SIF Probability: ${pct(analysis.sif_probability)}`, margin + 60, y + 7)
  doc.text(`Confidence: ${pct(analysis.confidence)}`, margin + 60, y + 12)
  doc.text(`Barrier Failure: ${analysis.barrier_failure ? 'YES ⚠' : 'No'}`, margin + 110, y + 7)
  doc.text(`Root Cause: ${fmt(analysis.root_cause?.replaceAll('_', ' '))}`, margin + 110, y + 12)

  y += 23

  // ── INCIDENT DETAILS ─────────────────────────────────────────────────────
  y = sectionHeader(doc, 'Incident Details', y)

  doc.setFillColor(...LIGHT_BG)
  doc.roundedRect(margin, y - 2, innerW, 4.5, 1, 1, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(...GRAY)
  doc.text('NARRATIVE', margin + 2, y + 1.8)
  y += 6

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...DARK)
  const narLines = doc.splitTextToSize(analysis.narrative || '—', innerW)
  doc.text(narLines, margin + 2, y)
  y += narLines.length * 4.5 + 4

  y = checkPageBreak(doc, y, 30)
  y = keyVal(doc, 'Site', fmt(analysis.site), margin + 2, y)
  y = keyVal(doc, 'Area', fmt(analysis.area), margin + 2, y)
  y = keyVal(doc, 'Department', fmt(analysis.department), margin + 2, y)
  y = keyVal(doc, 'Activity', fmt(analysis.activity), margin + 2, y)
  y = keyVal(doc, 'Reported On', fmt(analysis.reported_on), margin + 2, y)
  y = keyVal(doc, 'Report Type', fmt(analysis.report_type), margin + 2, y)
  y = keyVal(doc, 'Source', fmt(analysis.source), margin + 2, y)
  y = keyVal(doc, 'Model Version', fmt(analysis.model_version), margin + 2, y)
  y += 4

  // ── LSR TAGS ─────────────────────────────────────────────────────────────
  y = checkPageBreak(doc, y, 25)
  y = sectionHeader(doc, 'Life Saving Rule Violations', y)

  if (analysis.lsr_tags?.length) {
    analysis.lsr_tags.forEach((tag) => {
      y = checkPageBreak(doc, y, 12)
      doc.setFillColor(...LIGHT_BG)
      doc.roundedRect(margin, y - 2, innerW, 9, 1, 1, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(...DARK)
      doc.text(tag.rule?.replaceAll('_', ' ') || '—', margin + 3, y + 2)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.5)
      doc.setTextColor(...GRAY)
      doc.text(`Confidence: ${pct(tag.confidence)}`, margin + 100, y + 2)
      y += 11
    })
  } else {
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(8)
    doc.setTextColor(...GRAY)
    doc.text('No LSR violations identified.', margin + 2, y)
    y += 8
  }
  y += 2

  // ── ENTITIES ─────────────────────────────────────────────────────────────
  y = checkPageBreak(doc, y, 30)
  y = sectionHeader(doc, 'Extracted Entities', y)

  const entityGroups = [
    ['Hazards',    analysis.entities?.hazards],
    ['Equipment',  analysis.entities?.equipment],
    ['Activities', analysis.entities?.activities],
    ['Conditions', analysis.entities?.conditions],
  ]
  entityGroups.forEach(([label, items]) => {
    if (!items?.length) return
    y = checkPageBreak(doc, y, 12)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(...GRAY)
    doc.text(label.toUpperCase(), margin + 2, y)
    y += 4
    let px = margin + 2
    items.forEach((item) => {
      if (px + doc.getTextWidth(item) + 10 > 196) {
        px = margin + 2
        y += 6
        y = checkPageBreak(doc, y, 8)
      }
      px = pill(doc, item, px, y, BRAND)
    })
    y += 8
  })
  y += 2

  // ── FATALITY TWIN ─────────────────────────────────────────────────────────
  if (analysis.fatality_twin) {
    y = checkPageBreak(doc, y, 30)
    y = sectionHeader(doc, 'Fatality Twin — Escalation Chain', y)

    const twin = analysis.fatality_twin
    y = keyVal(doc, 'Likelihood', pct(twin.likelihood), margin + 2, y)
    y = keyVal(doc, 'Matched Cases', String(twin.matched ?? '—'), margin + 2, y)
    y = keyVal(doc, 'Similarity', pct(twin.similarity), margin + 2, y)

    if (twin.chain?.length) {
      y = checkPageBreak(doc, y, 15)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(7.5)
      doc.setTextColor(...GRAY)
      doc.text('CHAIN', margin + 2, y)
      y += 4
      twin.chain.forEach((step, i) => {
        y = checkPageBreak(doc, y, 8)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(7.5)
        doc.setTextColor(...DARK)
        doc.text(`${i + 1}. ${step}`, margin + 5, y)
        y += 4.5
      })
    }
    y += 4
  }

  // ── CAPA ──────────────────────────────────────────────────────────────────
  if (analysis.recommendations) {
    y = checkPageBreak(doc, y, 30)
    y = sectionHeader(doc, 'Corrective & Preventive Actions (CAPA)', y)

    const rec = analysis.recommendations

    const drawActionList = (title, actions) => {
      if (!actions?.length) return
      y = checkPageBreak(doc, y, 15)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(...DARK)
      doc.text(title, margin + 2, y)
      y += 5
      actions.forEach((a) => {
        y = checkPageBreak(doc, y, 14)
        const pColor = a.priority === 'C1' ? CRITICAL : HIGH
        pill(doc, a.priority, margin + 4, y, pColor)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(7.5)
        doc.setTextColor(...DARK)
        const aLines = doc.splitTextToSize(`${a.action} (${a.rule})`, innerW - 18)
        doc.text(aLines, margin + 16, y - 1)
        y += aLines.length * 4.5 + 3
      })
      y += 2
    }

    drawActionList('Corrective Actions', rec.corrective_actions)
    drawActionList('Preventive Actions', rec.preventive_actions)

    if (rec.training_needs?.length) {
      y = checkPageBreak(doc, y, 15)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(...DARK)
      doc.text('Training Needs', margin + 2, y)
      y += 5
      rec.training_needs.forEach((t) => {
        y = checkPageBreak(doc, y, 8)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(7.5)
        doc.setTextColor(...DARK)
        const tLines = doc.splitTextToSize(`• ${t}`, innerW - 6)
        doc.text(tLines, margin + 4, y)
        y += tLines.length * 4.5
      })
      y += 3
    }

    if (rec.toolbox_talk) {
      y = checkPageBreak(doc, y, 20)
      const tt = rec.toolbox_talk
      doc.setFillColor(239, 246, 255)
      doc.roundedRect(margin, y - 2, innerW, 7, 1, 1, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(...BRAND)
      doc.text(`Toolbox Talk (${tt.duration_minutes} min): ${tt.title}`, margin + 3, y + 2.5)
      y += 9
      ;(tt.points || []).forEach((p) => {
        y = checkPageBreak(doc, y, 8)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(7.5)
        doc.setTextColor(...DARK)
        const pLines = doc.splitTextToSize(`★ ${p}`, innerW - 6)
        doc.text(pLines, margin + 4, y)
        y += pLines.length * 4.5
      })
      y += 3
    }

    if (rec.precedent_note) {
      y = checkPageBreak(doc, y, 12)
      doc.setFillColor(245, 245, 245)
      doc.roundedRect(margin, y - 2, innerW, 4.5, 1, 1, 'F')
      doc.setFont('helvetica', 'italic')
      doc.setFontSize(7.5)
      doc.setTextColor(...GRAY)
      const prLines = doc.splitTextToSize(rec.precedent_note, innerW - 6)
      doc.text(prLines, margin + 3, y + 1.5)
      y += prLines.length * 4.5 + 4
    }
  }

  // ── FOOTER ───────────────────────────────────────────────────────────────
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setDrawColor(...BORDER)
    doc.setLineWidth(0.3)
    doc.line(margin, 285, 196, 285)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.5)
    doc.setTextColor(...GRAY)
    doc.text(`SIF Sentinel AI — Confidential Safety Report · ${rId}`, margin, 289)
    doc.text(`Page ${i} of ${pageCount}`, 196, 289, { align: 'right' })
  }

  // ── SAVE ─────────────────────────────────────────────────────────────────
  doc.save(`SIF-Report-${rId}.pdf`)
}
