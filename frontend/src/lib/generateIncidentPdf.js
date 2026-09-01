/**
 * generateIncidentPdf.js
 *
 * Dark-themed, comprehensive incident analysis PDF for Kavach AI.
 * Matches the deep-blue dark UI. Pure client-side — no server required.
 */
import { jsPDF } from 'jspdf'

// ── Design Tokens (Dark UI Palette) ─────────────────────────────────────────
const BG_PAGE    = [13,  17,  35]   // deepest page bg  #0D1123
const BG_CARD    = [20,  27,  56]   // card surface     #141B38
const BG_CARD2   = [26,  35,  71]   // card surface 2   #1A2347
const BORDER     = [45,  58,  100]  // subtle border    #2D3A64
const BRAND      = [99,  155, 255]  // brand-400        #639BFF
const BRAND_DIM  = [59,  100, 200]  // brand-600        #3B64C8

const CRITICAL   = [239, 68,  68]   // red-500
const HIGH       = [249, 115, 22]   // orange-500
const MEDIUM     = [234, 179, 8]    // yellow-500
const LOW        = [34,  197, 94]   // green-500

const TEXT_1     = [226, 232, 240]  // slate-200  (primary text)
const TEXT_2     = [148, 163, 184]  // slate-400  (secondary)
const TEXT_3     = [100, 116, 139]  // slate-500  (muted)
const WHITE      = [255, 255, 255]

// ── Helpers ──────────────────────────────────────────────────────────────────

function bandColor(band) {
  if (!band) return TEXT_3
  switch (band.toUpperCase()) {
    case 'CRITICAL': return CRITICAL
    case 'HIGH':     return HIGH
    case 'MEDIUM':   return MEDIUM
    case 'LOW':      return LOW
    default:         return TEXT_3
  }
}

function fmt(val, fallback = '—') {
  if (val == null || val === '') return fallback
  return String(val)
}

function pct(val, fallback = '—') {
  if (val == null) return fallback
  return `${(val * 100).toFixed(1)}%`
}

function checkPageBreak(doc, y, needed = 20) {
  if (y + needed > 278) {
    doc.addPage()
    // Re-fill dark background on new page
    doc.setFillColor(...BG_PAGE)
    doc.rect(0, 0, 210, 297, 'F')
    return 16
  }
  return y
}

/** Filled rounded rectangle helper */
function fillRounded(doc, x, y, w, h, r, color) {
  doc.setFillColor(...color)
  doc.roundedRect(x, y, w, h, r, r, 'F')
}

/** Dark card background */
function card(doc, x, y, w, h, color = BG_CARD) {
  fillRounded(doc, x, y, w, h, 2, color)
  doc.setDrawColor(...BORDER)
  doc.setLineWidth(0.25)
  doc.roundedRect(x, y, w, h, 2, 2, 'S')
}

/** Section header bar */
function sectionHeader(doc, title, y) {
  const margin = 14
  const innerW = 182
  fillRounded(doc, margin, y, innerW, 8, 1.5, BG_CARD2)
  // Left accent bar
  doc.setFillColor(...BRAND)
  doc.rect(margin, y, 3, 8, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(...BRAND)
  doc.text(title.toUpperCase(), margin + 6, y + 5.3)
  return y + 13
}

/** Key → Value row */
function keyVal(doc, key, value, x, y, keyWidth = 52) {
  const maxW = 182 - keyWidth - (x - 14)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(...TEXT_3)
  doc.text(key, x, y)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...TEXT_1)
  const lines = doc.splitTextToSize(fmt(value), maxW)
  doc.text(lines, x + keyWidth, y)
  return y + lines.length * 4.8 + 1
}

/** Coloured pill / chip */
function pill(doc, text, x, y, bgColor, textColor = WHITE) {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6.5)
  const tw = doc.getTextWidth(text)
  const pw = tw + 5
  fillRounded(doc, x, y - 3.5, pw, 5.5, 1.2, bgColor)
  doc.setTextColor(...textColor)
  doc.text(text, x + 2.5, y)
  return x + pw + 2.5
}

/** Horizontal rule */
function hr(doc, y) {
  doc.setDrawColor(...BORDER)
  doc.setLineWidth(0.2)
  doc.line(14, y, 196, y)
  return y + 4
}

// ── Page setup helpers ────────────────────────────────────────────────────────

function fillPageBg(doc) {
  doc.setFillColor(...BG_PAGE)
  doc.rect(0, 0, 210, 297, 'F')
}

// ── Main export ───────────────────────────────────────────────────────────────

export function generateIncidentPdf(analysis) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const margin = 14
  const innerW = 182   // 210 - 14*2
  const rId = analysis.report_id || 'UNKNOWN'

  // ── PAGE 1 BACKGROUND ────────────────────────────────────────────────────
  fillPageBg(doc)

  // ── HEADER BANNER ────────────────────────────────────────────────────────
  // Gradient-like dark banner
  doc.setFillColor(...BRAND_DIM)
  doc.rect(0, 0, 210, 36, 'F')
  doc.setFillColor(13, 22, 60, 0.7)
  doc.rect(0, 0, 210, 36, 'F')

  // Shield icon (simple polygon via lines)
  doc.setFillColor(...BRAND)
  doc.circle(margin + 5, 12, 4, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...BG_PAGE)
  doc.text('K', margin + 3, 13.5)

  // Title
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(17)
  doc.setTextColor(...WHITE)
  doc.text('Kavach AI', margin + 12, 13)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...BRAND)
  doc.text('Incident Analysis Report', margin + 12, 20)

  // Subtitle tag
  doc.setFontSize(6.5)
  doc.setTextColor(...TEXT_3)
  doc.text('Knowledge-driven AI for Vigilance and Critical Hazard Prevention', margin + 12, 26)

  // Report ID badge (top-right)
  const badgeW = doc.getTextWidth(rId) + 8
  fillRounded(doc, 210 - margin - badgeW, 8, badgeW, 8, 2, BG_CARD)
  doc.setDrawColor(...BRAND)
  doc.setLineWidth(0.4)
  doc.roundedRect(210 - margin - badgeW, 8, badgeW, 8, 2, 2, 'S')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(...BRAND)
  doc.text(rId, 210 - margin - badgeW + 4, 13.5)

  // Timestamp (bottom-right of banner)
  const now = new Date().toLocaleString('en-IN', { dateStyle: 'long', timeStyle: 'short' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.5)
  doc.setTextColor(...TEXT_3)
  doc.text(`Generated: ${now}`, 196, 32, { align: 'right' })

  let y = 44

  // ── RISK SUMMARY CARD ────────────────────────────────────────────────────
  const bColor = bandColor(analysis.risk_band)
  // Outer glow
  doc.setDrawColor(...bColor)
  doc.setLineWidth(0.5)
  doc.roundedRect(margin, y, innerW, 26, 3, 3, 'S')
  // Card fill
  fillRounded(doc, margin, y, innerW, 26, 3, BG_CARD)

  // Left: Risk band big text
  const bandText = analysis.risk_band || 'UNSCORED'
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.setTextColor(...bColor)
  doc.text(bandText, margin + 5, y + 15)

  // Risk band bar under text
  doc.setFillColor(...bColor)
  const bandW = doc.getTextWidth(bandText)
  doc.rect(margin + 5, y + 17, bandW, 1.2, 'F')

  // Middle column
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(...TEXT_3)
  doc.text('SIF PROBABILITY', margin + 68, y + 9)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(...TEXT_1)
  doc.text(pct(analysis.sif_probability), margin + 68, y + 18)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(...TEXT_3)
  doc.text('CONFIDENCE', margin + 68, y + 24)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...TEXT_2)
  doc.text(pct(analysis.confidence), margin + 68 + 22, y + 24)

  // Vertical divider
  doc.setDrawColor(...BORDER)
  doc.setLineWidth(0.25)
  doc.line(margin + 115, y + 4, margin + 115, y + 22)

  // Right column
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(...TEXT_3)
  doc.text('BARRIER FAILURE', margin + 119, y + 9)
  const bf = analysis.barrier_failure
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...(bf ? CRITICAL : LOW))
  doc.text(bf ? 'YES ⚠' : 'No', margin + 119, y + 17)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(...TEXT_3)
  doc.text('ROOT CAUSE', margin + 119, y + 23)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(...TEXT_2)
  doc.text(fmt(analysis.root_cause?.replaceAll('_', ' ')), margin + 119, y + 28)

  y += 32

  // Escalation override banner (if applied)
  if (analysis.escalation_override_applied) {
    y = checkPageBreak(doc, y, 8)
    fillRounded(doc, margin, y, innerW, 7, 1.5, [50, 30, 10])
    doc.setDrawColor(...HIGH)
    doc.setLineWidth(0.3)
    doc.roundedRect(margin, y, innerW, 7, 1.5, 1.5, 'S')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(...HIGH)
    doc.text('⚠  Escalation override applied — risk band raised by structural severity rules', margin + 4, y + 4.5)
    y += 11
  }

  y += 2

  // ── INCIDENT DETAILS ─────────────────────────────────────────────────────
  y = checkPageBreak(doc, y, 35)
  y = sectionHeader(doc, 'Incident Details', y)

  // Narrative box
  card(doc, margin, y - 2, innerW, 6, BG_CARD2)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(...TEXT_3)
  doc.text('NARRATIVE', margin + 3, y + 2.5)
  y += 7

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...TEXT_1)
  const narLines = doc.splitTextToSize(analysis.narrative || '—', innerW - 4)
  y = checkPageBreak(doc, y, narLines.length * 5 + 6)
  card(doc, margin, y - 2, innerW, narLines.length * 5 + 4)
  doc.text(narLines, margin + 3, y + 2)
  y += narLines.length * 5 + 6

  y = checkPageBreak(doc, y, 40)
  // Metadata grid (2-column)
  const col1x = margin + 2
  const col2x = margin + 94
  let yl = y
  let yr = y
  yl = keyVal(doc, 'Site', fmt(analysis.site), col1x, yl, 32)
  yl = keyVal(doc, 'Area', fmt(analysis.area), col1x, yl, 32)
  yl = keyVal(doc, 'Department', fmt(analysis.department), col1x, yl, 32)
  yl = keyVal(doc, 'Activity', fmt(analysis.activity), col1x, yl, 32)
  yr = keyVal(doc, 'Reported On', fmt(analysis.reported_on?.slice(0, 19)?.replace('T', ' ')), col2x, yr, 32)
  yr = keyVal(doc, 'Report Type', fmt(analysis.report_type), col2x, yr, 32)
  yr = keyVal(doc, 'Source', fmt(analysis.source), col2x, yr, 32)
  yr = keyVal(doc, 'Model', fmt(analysis.model_version), col2x, yr, 32)
  if (analysis.input_hash) {
    yr = keyVal(doc, 'Input Hash', analysis.input_hash.slice(0, 16) + '…', col2x, yr, 32)
  }
  y = Math.max(yl, yr) + 5

  // ── SCORE EXPLANATION ────────────────────────────────────────────────────
  if (analysis.explanation?.tokens?.length) {
    y = checkPageBreak(doc, y, 30)
    y = sectionHeader(doc, 'AI Score Explanation — Top Weighted Terms', y)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...TEXT_2)
    doc.text('Terms the model weighted most heavily when assigning the SIF probability:', margin + 2, y)
    y += 6

    const tokens = analysis.explanation.tokens.slice(0, 16) // top 16
    const colW = 59
    const cols = 3
    let col = 0
    let rowY = y
    let colXs = [margin + 2, margin + 2 + colW, margin + 2 + colW * 2]
    let colYs = [rowY, rowY, rowY]

    tokens.forEach((t) => {
      const cx = colXs[col]
      let cy = colYs[col]
      cy = checkPageBreak(doc, cy, 8)
      // Weight bar
      const weight = Math.min(Math.abs(t.weight || 0), 1)
      const barMaxW = colW - 25
      const barW = Math.max(1, weight * barMaxW)
      const barColor = (t.weight || 0) > 0 ? CRITICAL : LOW
      doc.setFillColor(...BG_CARD2)
      doc.roundedRect(cx, cy - 3, colW - 2, 7, 1, 1, 'F')
      doc.setFillColor(...barColor)
      doc.rect(cx + 1, cy - 1.5, barW, 2.5, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(7)
      doc.setTextColor(...TEXT_1)
      doc.text(String(t.token || '').slice(0, 18), cx + 2, cy + 2.8)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(6.5)
      doc.setTextColor(...TEXT_3)
      doc.text((t.weight > 0 ? '+' : '') + (t.weight || 0).toFixed(3), cx + colW - 12, cy + 2.8, { align: 'right' })
      colYs[col] = cy + 10
      col = (col + 1) % cols
    })
    y = Math.max(...colYs) + 4
  }

  // ── LSR VIOLATIONS ───────────────────────────────────────────────────────
  y = checkPageBreak(doc, y, 25)
  y = sectionHeader(doc, 'Life Saving Rule Violations', y)

  if (analysis.lsr_tags?.length) {
    analysis.lsr_tags.forEach((tag) => {
      y = checkPageBreak(doc, y, 13)
      card(doc, margin, y - 2, innerW, 10, BG_CARD)
      // Accent left strip matching severity
      doc.setFillColor(...CRITICAL)
      doc.rect(margin, y - 2, 3, 10, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(...TEXT_1)
      doc.text(fmt(tag.rule?.replaceAll('_', ' ')), margin + 6, y + 3.5)
      // Confidence pill
      const confColor = tag.confidence > 0.7 ? CRITICAL : HIGH
      pill(doc, `Confidence: ${pct(tag.confidence)}`, margin + 135, y + 3.5, confColor)
      y += 13
    })
  } else {
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(8)
    doc.setTextColor(...TEXT_3)
    doc.text('No LSR violations identified.', margin + 2, y)
    y += 8
  }
  y += 3

  // ── ENTITIES ─────────────────────────────────────────────────────────────
  const entityGroups = [
    ['Hazards',    analysis.entities?.hazards,    HIGH],
    ['Equipment',  analysis.entities?.equipment,  BRAND],
    ['Activities', analysis.entities?.activities, MEDIUM],
    ['Conditions', analysis.entities?.conditions, TEXT_3],
    ['Persons',    analysis.entities?.persons,    LOW],
  ].filter(([, items]) => items?.length)

  if (entityGroups.length) {
    y = checkPageBreak(doc, y, 30)
    y = sectionHeader(doc, 'Extracted Entities', y)

    entityGroups.forEach(([label, items, color]) => {
      y = checkPageBreak(doc, y, 14)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(7)
      doc.setTextColor(...TEXT_3)
      doc.text(label.toUpperCase(), margin + 2, y)
      y += 4

      let px = margin + 2
      items.forEach((item) => {
        const iw = doc.getTextWidth(item) + 9
        if (px + iw > 196) {
          px = margin + 2
          y += 7
          y = checkPageBreak(doc, y, 8)
        }
        px = pill(doc, item, px, y, color)
      })
      y += 9
    })
    y += 2
  }

  // ── FATALITY TWIN ────────────────────────────────────────────────────────
  if (analysis.fatality_twin) {
    y = checkPageBreak(doc, y, 35)
    y = sectionHeader(doc, 'Fatality Twin — Escalation Chain', y)

    const twin = analysis.fatality_twin
    // Stats row
    const statCards = [
      ['LIKELIHOOD',   pct(twin.likelihood)],
      ['MATCHED CASES', fmt(twin.matched)],
      ['SIMILARITY',    pct(twin.similarity)],
    ]
    const scW = (innerW - 8) / statCards.length
    statCards.forEach(([label, val], i) => {
      const sx = margin + i * (scW + 4)
      card(doc, sx, y - 2, scW, 14, BG_CARD2)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(6.5)
      doc.setTextColor(...TEXT_3)
      doc.text(label, sx + 3, y + 3)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.setTextColor(...BRAND)
      doc.text(val, sx + 3, y + 10)
    })
    y += 18

    if (twin.chain?.length) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(7)
      doc.setTextColor(...TEXT_3)
      doc.text('ESCALATION CHAIN', margin + 2, y)
      y += 5

      twin.chain.forEach((step, i) => {
        y = checkPageBreak(doc, y, 10)
        card(doc, margin, y - 2, innerW, 9, BG_CARD)
        // Step number circle
        doc.setFillColor(...BRAND_DIM)
        doc.circle(margin + 6, y + 2.5, 3.5, 'F')
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(7)
        doc.setTextColor(...WHITE)
        doc.text(String(i + 1), margin + 6, y + 3.8, { align: 'center' })
        // Step text
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(7.5)
        doc.setTextColor(...TEXT_1)
        const stepLines = doc.splitTextToSize(step, innerW - 18)
        doc.text(stepLines, margin + 13, y + 2.5)
        y += Math.max(stepLines.length * 5, 10) + 1
      })
    }
    y += 5
  }

  // ── SIMILAR FATALITIES ───────────────────────────────────────────────────
  if (analysis.similar_fatalities?.length) {
    y = checkPageBreak(doc, y, 30)
    y = sectionHeader(doc, `Matched Fatal Cases (${analysis.similar_fatalities.length})`, y)

    analysis.similar_fatalities.slice(0, 5).forEach((f) => {
      y = checkPageBreak(doc, y, 16)
      card(doc, margin, y - 2, innerW, 14, BG_CARD)
      // Similarity pill
      const simPct = Math.round((f.similarity || 0) * 100)
      const simColor = simPct >= 70 ? CRITICAL : simPct >= 50 ? HIGH : MEDIUM
      pill(doc, `${simPct}% match`, margin + 3, y + 5, simColor)
      // Report ID
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(7)
      doc.setTextColor(...TEXT_3)
      doc.text(fmt(f.report_id), margin + 28, y + 3)
      // Snippet
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7)
      doc.setTextColor(...TEXT_2)
      const snippet = doc.splitTextToSize((f.narrative || '').slice(0, 130) + '…', innerW - 32)
      doc.text(snippet, margin + 28, y + 8)
      y += 17
    })
    y += 3
  }

  // ── SIMILAR INCIDENTS ────────────────────────────────────────────────────
  if (analysis.similar_incidents?.length) {
    y = checkPageBreak(doc, y, 30)
    y = sectionHeader(doc, `Similar Incidents from Corpus (${analysis.similar_incidents.length})`, y)

    analysis.similar_incidents.slice(0, 5).forEach((f) => {
      y = checkPageBreak(doc, y, 16)
      card(doc, margin, y - 2, innerW, 14, BG_CARD)
      const simPct = Math.round((f.similarity || 0) * 100)
      const simColor = simPct >= 70 ? CRITICAL : simPct >= 50 ? HIGH : MEDIUM
      pill(doc, `${simPct}% match`, margin + 3, y + 5, simColor)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(7)
      doc.setTextColor(...TEXT_3)
      doc.text(fmt(f.report_id), margin + 28, y + 3)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7)
      doc.setTextColor(...TEXT_2)
      const snippet = doc.splitTextToSize((f.narrative || '').slice(0, 130) + '…', innerW - 32)
      doc.text(snippet, margin + 28, y + 8)
      y += 17
    })
    y += 3
  }

  // ── CAPA ─────────────────────────────────────────────────────────────────
  if (analysis.recommendations) {
    y = checkPageBreak(doc, y, 35)
    y = sectionHeader(doc, 'Corrective & Preventive Actions (CAPA)', y)
    const rec = analysis.recommendations

    function drawActionList(title, actions) {
      if (!actions?.length) return
      y = checkPageBreak(doc, y, 14)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(...TEXT_2)
      doc.text(title.toUpperCase(), margin + 2, y)
      y += 5

      actions.forEach((a) => {
        y = checkPageBreak(doc, y, 14)
        const pColor = a.priority === 'C1' ? CRITICAL : HIGH
        const aLines = doc.splitTextToSize(`${a.action}  (${a.rule})`, innerW - 22)
        const cardH = aLines.length * 5.5 + 8
        card(doc, margin, y - 2, innerW, cardH, BG_CARD)
        // Priority pill
        pill(doc, a.priority, margin + 4, y + 5, pColor)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        doc.setTextColor(...TEXT_1)
        doc.text(aLines, margin + 18, y + 3)
        // Rule tag
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(6.5)
        doc.setTextColor(...TEXT_3)
        y += cardH + 2
      })
      y += 2
    }

    drawActionList('Corrective Actions', rec.corrective_actions)
    drawActionList('Preventive Actions', rec.preventive_actions)

    // Training needs
    if (rec.training_needs?.length) {
      y = checkPageBreak(doc, y, 14)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(...TEXT_2)
      doc.text('TRAINING NEEDS', margin + 2, y)
      y += 5

      rec.training_needs.forEach((t) => {
        y = checkPageBreak(doc, y, 9)
        const tLines = doc.splitTextToSize(`▸  ${t}`, innerW - 6)
        card(doc, margin, y - 2, innerW, tLines.length * 5 + 4, BG_CARD)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(7.5)
        doc.setTextColor(...TEXT_1)
        doc.text(tLines, margin + 4, y + 2)
        y += tLines.length * 5 + 6
      })
      y += 2
    }

    // Toolbox talk
    if (rec.toolbox_talk) {
      y = checkPageBreak(doc, y, 25)
      const tt = rec.toolbox_talk
      // Header
      card(doc, margin, y - 2, innerW, 9, BG_CARD2)
      doc.setFillColor(...BRAND)
      doc.rect(margin, y - 2, 3, 9, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(...BRAND)
      doc.text(`Toolbox Talk (${tt.duration_minutes} min): ${tt.title}`, margin + 6, y + 3.5)
      y += 12

      ;(tt.points || []).forEach((p) => {
        y = checkPageBreak(doc, y, 9)
        const pLines = doc.splitTextToSize(`★  ${p}`, innerW - 8)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(7.5)
        doc.setTextColor(...TEXT_2)
        doc.text(pLines, margin + 6, y)
        y += pLines.length * 5
      })
      y += 4
    }

    // Precedent note
    if (rec.precedent_note) {
      y = checkPageBreak(doc, y, 12)
      const prLines = doc.splitTextToSize(`"  ${rec.precedent_note}  "`, innerW - 8)
      card(doc, margin, y - 2, innerW, prLines.length * 5 + 6, BG_CARD2)
      doc.setFillColor(...TEXT_3)
      doc.rect(margin, y - 2, 3, prLines.length * 5 + 6, 'F')
      doc.setFont('helvetica', 'italic')
      doc.setFontSize(7.5)
      doc.setTextColor(...TEXT_2)
      doc.text(prLines, margin + 7, y + 3)
      y += prLines.length * 5 + 8
    }
  }

  // ── SAFETY MEMORY ─────────────────────────────────────────────────────────
  const sm = analysis.safety_memory
  if (sm && !sm.error && sm.matches?.length) {
    y = checkPageBreak(doc, y, 30)
    y = sectionHeader(doc, `Safety Memory — Has This Happened Before? (${sm.matches.length} matches)`, y)

    sm.matches.slice(0, 4).forEach((m) => {
      y = checkPageBreak(doc, y, 16)
      card(doc, margin, y - 2, innerW, 14, BG_CARD)
      const simPct = Math.round((m.similarity || 0) * 100)
      pill(doc, `${simPct}% recall`, margin + 3, y + 5, BRAND_DIM)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(7)
      doc.setTextColor(...TEXT_3)
      doc.text(fmt(m.report_id), margin + 28, y + 3)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7)
      doc.setTextColor(...TEXT_2)
      const sn = doc.splitTextToSize((m.narrative || '').slice(0, 130) + '…', innerW - 32)
      doc.text(sn, margin + 28, y + 8)
      y += 17
    })
    y += 3
  }

  // ── FOOTER ON EVERY PAGE ─────────────────────────────────────────────────
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setDrawColor(...BORDER)
    doc.setLineWidth(0.25)
    doc.line(margin, 284, 196, 284)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6)
    doc.setTextColor(...BRAND)
    doc.text('Kavach AI', margin, 289)

    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...TEXT_3)
    doc.text(` — Confidential Safety Report · ${rId}`, margin + 15, 289)

    doc.setTextColor(...TEXT_3)
    doc.text(`Page ${i} of ${pageCount}`, 196, 289, { align: 'right' })
  }

  // ── SAVE ─────────────────────────────────────────────────────────────────
  doc.save(`KavachAI-Report-${rId}.pdf`)
}
