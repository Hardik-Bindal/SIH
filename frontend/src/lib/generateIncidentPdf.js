import { jsPDF } from 'jspdf'

// ── Design Tokens (Dark UI Palette) ─────────────────────────────────────────
const BG_PAGE    = [13,  17,  35]
const BG_CARD    = [20,  27,  56]
const BG_CARD2   = [26,  35,  71]
const BORDER     = [45,  58,  100]
const BRAND      = [99,  155, 255]
const BRAND_DIM  = [59,  100, 200]

const CRITICAL   = [239, 68,  68]
const HIGH       = [249, 115, 22]
const MEDIUM     = [234, 179, 8]
const LOW        = [34,  197, 94]

const TEXT_1     = [226, 232, 240]
const TEXT_2     = [148, 163, 184]
const TEXT_3     = [100, 116, 139]
const WHITE      = [255, 255, 255]

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

function fillRounded(doc, x, y, w, h, r, color) {
  doc.setFillColor(...color)
  doc.roundedRect(x, y, w, h, r, r, 'F')
}

function pill(doc, text, x, y, bgColor, textColor = WHITE) {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(5.5)
  const tw = doc.getTextWidth(text)
  const pw = tw + 4
  fillRounded(doc, x, y - 2.8, pw, 4.5, 1, bgColor)
  doc.setTextColor(...textColor)
  doc.text(text, x + 2, y)
  return x + pw + 1.5
}

// ── Main export ───────────────────────────────────────────────────────────────

export function generateIncidentPdf(analysis) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const M = 10
  const W = 190
  const rId = analysis.report_id || 'UNKNOWN'

  // Dark page background
  doc.setFillColor(...BG_PAGE)
  doc.rect(0, 0, 210, 297, 'F')

  // ── HEADER BANNER (0-28mm) ──────────────────────────────────────────────
  doc.setFillColor(...BRAND_DIM)
  doc.rect(0, 0, 210, 28, 'F')
  doc.setFillColor(13, 22, 60, 0.7)
  doc.rect(0, 0, 210, 28, 'F')

  doc.setFillColor(...BRAND)
  doc.circle(M + 4, 9.5, 3.2, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(...BG_PAGE)
  doc.text('K', M + 2.4, 10.8)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(...WHITE)
  doc.text('Kavach AI', M + 10, 10.5)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.5)
  doc.setTextColor(...BRAND)
  doc.text('Incident Analysis Report', M + 10, 16)

  doc.setFontSize(5.5)
  doc.setTextColor(...TEXT_3)
  doc.text('Knowledge-driven AI for Vigilance and Critical Hazard Prevention', M + 10, 21)

  // Report ID badge
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6)
  const badgeW = doc.getTextWidth(rId) + 6
  fillRounded(doc, 200 - badgeW, 6, badgeW, 7, 1.5, BG_CARD)
  doc.setDrawColor(...BRAND)
  doc.setLineWidth(0.3)
  doc.roundedRect(200 - badgeW, 6, badgeW, 7, 1.5, 1.5, 'S')
  doc.setTextColor(...BRAND)
  doc.text(rId, 200 - badgeW + 3, 10.5)

  const now = new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(5.5)
  doc.setTextColor(...TEXT_3)
  doc.text(`Generated: ${now}`, 200, 24, { align: 'right' })

  let y = 32

  // ── RISK SUMMARY CARD ───────────────────────────────────────────────────
  const bColor = bandColor(analysis.risk_band)
  doc.setDrawColor(...bColor)
  doc.setLineWidth(0.4)
  doc.roundedRect(M, y, W, 20, 2, 2, 'S')
  fillRounded(doc, M, y, W, 20, 2, BG_CARD)

  const bandText = analysis.risk_band || 'UNSCORED'
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(...bColor)
  doc.text(bandText, M + 4, y + 12)
  doc.setFillColor(...bColor)
  doc.rect(M + 4, y + 13.5, doc.getTextWidth(bandText), 0.8, 'F')

  // SIF probability
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(5.5)
  doc.setTextColor(...TEXT_3)
  doc.text('SIF PROBABILITY', M + 55, y + 6)
  doc.setFontSize(11)
  doc.setTextColor(...TEXT_1)
  doc.text(pct(analysis.sif_probability), M + 55, y + 13)
  doc.setFontSize(5.5)
  doc.setTextColor(...TEXT_3)
  doc.text('CONFIDENCE', M + 55, y + 17.5)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.5)
  doc.setTextColor(...TEXT_2)
  doc.text(pct(analysis.confidence), M + 75, y + 17.5)

  // Divider
  doc.setDrawColor(...BORDER)
  doc.setLineWidth(0.2)
  doc.line(M + 100, y + 3, M + 100, y + 17)

  // Barrier & root cause
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(5.5)
  doc.setTextColor(...TEXT_3)
  doc.text('BARRIER FAILURE', M + 104, y + 6)
  const bf = analysis.barrier_failure
  doc.setFontSize(7.5)
  doc.setTextColor(...(bf ? CRITICAL : LOW))
  doc.text(bf ? 'YES' : 'NO', M + 104, y + 12)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(5.5)
  doc.setTextColor(...TEXT_3)
  doc.text('ROOT CAUSE', M + 135, y + 6)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6)
  doc.setTextColor(...TEXT_2)
  const rcText = fmt(analysis.root_cause?.replaceAll('_', ' ')).slice(0, 30)
  doc.text(rcText, M + 135, y + 12)

  // Metadata row
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(5.5)
  doc.setTextColor(...TEXT_3)
  const meta = [
    fmt(analysis.site),
    fmt(analysis.area),
    fmt(analysis.department),
    fmt(analysis.reported_on?.slice(0, 10)),
  ].join('  ·  ')
  doc.text(meta, M + 104, y + 17.5)

  y += 24

  // ── NARRATIVE ───────────────────────────────────────────────────────────
  fillRounded(doc, M, y, W, 6, 1, BG_CARD2)
  doc.setFillColor(...BRAND)
  doc.rect(M, y, 2, 6, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6)
  doc.setTextColor(...BRAND)
  doc.text('INCIDENT NARRATIVE', M + 5, y + 4)
  y += 8

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.5)
  doc.setTextColor(...TEXT_1)
  const narText = (analysis.narrative || '—').slice(0, 500) + (analysis.narrative?.length > 500 ? '...' : '')
  const narLines = doc.splitTextToSize(narText, W - 4)
  const maxNarLines = 6
  const displayNar = narLines.slice(0, maxNarLines)
  fillRounded(doc, M, y - 1, W, displayNar.length * 3.8 + 3, 1, BG_CARD)
  doc.text(displayNar, M + 2, y + 2)
  y += displayNar.length * 3.8 + 5

  // ── ESCALATION OVERRIDE ─────────────────────────────────────────────────
  if (analysis.escalation_override_applied) {
    fillRounded(doc, M, y, W, 5.5, 1, [50, 30, 10])
    doc.setDrawColor(...HIGH)
    doc.setLineWidth(0.2)
    doc.roundedRect(M, y, W, 5.5, 1, 1, 'S')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(5.5)
    doc.setTextColor(...HIGH)
    doc.text('Escalation override applied — risk band raised by structural severity rules', M + 3, y + 3.5)
    y += 8
  }

  // ── SCORE EXPLANATION (Top 12 terms, 3 cols) ────────────────────────────
  if (analysis.explanation?.tokens?.length) {
    fillRounded(doc, M, y, W, 6, 1, BG_CARD2)
    doc.setFillColor(...BRAND)
    doc.rect(M, y, 2, 6, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6)
    doc.setTextColor(...BRAND)
    doc.text('AI SCORE EXPLANATION', M + 5, y + 4)
    y += 8

    const tokens = analysis.explanation.tokens.slice(0, 12)
    const colW = 62
    tokens.forEach((t, i) => {
      const col = i % 3
      const row = Math.floor(i / 3)
      const cx = M + col * (colW + 2)
      const cy = y + row * 6

      const weight = Math.min(Math.abs(t.weight || 0), 1)
      const barW = Math.max(1, weight * 25)
      const barColor = (t.weight || 0) > 0 ? CRITICAL : LOW
      doc.setFillColor(...BG_CARD2)
      doc.roundedRect(cx, cy - 1, colW, 5, 0.5, 0.5, 'F')
      doc.setFillColor(...barColor)
      doc.rect(cx + 0.5, cy, barW, 2, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(5.5)
      doc.setTextColor(...TEXT_1)
      doc.text(String(t.term || t.token || '').slice(0, 16), cx + 1, cy + 3.8)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(5)
      doc.setTextColor(...TEXT_3)
      doc.text((t.weight > 0 ? '+' : '') + (t.weight || 0).toFixed(3), cx + colW - 2, cy + 3.8, { align: 'right' })
    })
    y += Math.ceil(tokens.length / 3) * 6 + 3
  }

  // ── LSR VIOLATIONS ──────────────────────────────────────────────────────
  fillRounded(doc, M, y, W, 6, 1, BG_CARD2)
  doc.setFillColor(...BRAND)
  doc.rect(M, y, 2, 6, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6)
  doc.setTextColor(...BRAND)
  doc.text('LIFE SAVING RULE VIOLATIONS', M + 5, y + 4)
  y += 8

  if (analysis.lsr_tags?.length) {
    analysis.lsr_tags.slice(0, 4).forEach((tag) => {
      fillRounded(doc, M, y - 1, W, 6.5, 1, BG_CARD)
      doc.setFillColor(...CRITICAL)
      doc.rect(M, y - 1, 2, 6.5, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(6)
      doc.setTextColor(...TEXT_1)
      doc.text(fmt(tag.rule?.replaceAll('_', ' ')), M + 4, y + 2.5)
      if (tag.confidence != null) {
        pill(doc, pct(tag.confidence), M + 140, y + 2.5, tag.confidence > 0.7 ? CRITICAL : HIGH)
      }
      y += 8
    })
  } else {
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(6)
    doc.setTextColor(...TEXT_3)
    doc.text('No LSR violations identified.', M + 2, y)
    y += 5
  }
  y += 1

  // ── ENTITIES (compact pills) ────────────────────────────────────────────
  const entityGroups = [
    ['Hazards',    analysis.entities?.hazards,    HIGH],
    ['Equipment',  analysis.entities?.equipment,  BRAND],
    ['Activities', analysis.entities?.activities, MEDIUM],
    ['Conditions', analysis.entities?.conditions, TEXT_3],
  ].filter(([, items]) => items?.length)

  if (entityGroups.length) {
    fillRounded(doc, M, y, W, 6, 1, BG_CARD2)
    doc.setFillColor(...BRAND)
    doc.rect(M, y, 2, 6, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6)
    doc.setTextColor(...BRAND)
    doc.text('EXTRACTED ENTITIES', M + 5, y + 4)
    y += 8

    entityGroups.forEach(([label, items, color]) => {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(5)
      doc.setTextColor(...TEXT_3)
      doc.text(label.toUpperCase(), M + 1, y)
      let px = M + 1
      const startY = y + 3
      items.slice(0, 6).forEach((item) => {
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(5)
        const iw = doc.getTextWidth(item.slice(0, 22)) + 4
        if (px + iw > M + W) {
          px = M + 1
          y += 5
        }
        px = pill(doc, item.slice(0, 22), px, y + 3, color)
      })
      y += 6
    })
    y += 1
  }

  // ── FATALITY TWIN (compact) ─────────────────────────────────────────────
  if (analysis.fatality_twin) {
    const twin = analysis.fatality_twin
    fillRounded(doc, M, y, W, 6, 1, BG_CARD2)
    doc.setFillColor(...BRAND)
    doc.rect(M, y, 2, 6, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6)
    doc.setTextColor(...BRAND)
    doc.text('FATALITY TWIN', M + 5, y + 4)
    y += 8

    // Stats row
    const stats = [
      ['Likelihood', pct(twin.likelihood)],
      ['Matched Cases', fmt(twin.matched)],
      ['Similarity', pct(twin.similarity)],
    ]
    const sw = (W - 4) / 3
    stats.forEach(([label, val], i) => {
      const sx = M + i * (sw + 2)
      fillRounded(doc, sx, y - 1, sw, 10, 1, BG_CARD)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(5)
      doc.setTextColor(...TEXT_3)
      doc.text(label.toUpperCase(), sx + 2, y + 2)
      doc.setFontSize(8)
      doc.setTextColor(...BRAND)
      doc.text(val, sx + 2, y + 7)
    })
    y += 13

    if (twin.chain?.length) {
      const chainText = twin.chain.slice(0, 4).map((s, i) => `${i + 1}. ${s}`).join('  →  ')
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(5.5)
      doc.setTextColor(...TEXT_2)
      const chainLines = doc.splitTextToSize(chainText, W - 4)
      doc.text(chainLines.slice(0, 2), M + 1, y)
      y += Math.min(chainLines.length, 2) * 3.5 + 2
    }
  }

  // ── SIMILAR FATALITIES + INCIDENTS (compact, side by side) ──────────────
  const fatals = analysis.similar_fatalities?.slice(0, 2) || []
  const similars = analysis.similar_incidents?.slice(0, 2) || []
  if (fatals.length || similars.length) {
    fillRounded(doc, M, y, W, 6, 1, BG_CARD2)
    doc.setFillColor(...BRAND)
    doc.rect(M, y, 2, 6, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6)
    doc.setTextColor(...BRAND)
    doc.text('MATCHED CASES', M + 5, y + 4)
    y += 8

    const allCases = [
      ...fatals.map((f) => ({ ...f, fatal: true })),
      ...similars.map((s) => ({ ...s, fatal: false })),
    ].slice(0, 3)

    allCases.forEach((c) => {
      fillRounded(doc, M, y - 1, W, 7, 1, BG_CARD)
      const simPct = Math.round((c.similarity || 0) * 100)
      const simColor = simPct >= 70 ? CRITICAL : simPct >= 50 ? HIGH : MEDIUM
      pill(doc, `${simPct}%`, M + 2, y + 2.5, simColor)
      if (c.fatal) pill(doc, 'FATAL', M + 15, y + 2.5, CRITICAL)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(5.5)
      doc.setTextColor(...TEXT_3)
      doc.text(fmt(c.report_id), M + (c.fatal ? 30 : 20), y + 2)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(5.5)
      doc.setTextColor(...TEXT_2)
      doc.text((c.narrative || '').slice(0, 90) + '…', M + (c.fatal ? 30 : 20), y + 5)
      y += 9
    })
    y += 1
  }

  // ── CAPA (compact) ──────────────────────────────────────────────────────
  if (analysis.recommendations) {
    const rec = analysis.recommendations
    fillRounded(doc, M, y, W, 6, 1, BG_CARD2)
    doc.setFillColor(...BRAND)
    doc.rect(M, y, 2, 6, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6)
    doc.setTextColor(...BRAND)
    doc.text('CORRECTIVE & PREVENTIVE ACTIONS', M + 5, y + 4)
    y += 8

    const actions = [
      ...(rec.corrective_actions || []).slice(0, 2).map((a) => ({ ...a, type: 'C' })),
      ...(rec.preventive_actions || []).slice(0, 2).map((a) => ({ ...a, type: 'P' })),
    ]

    actions.forEach((a) => {
      const lineText = `[${a.priority}] ${a.action}`
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(5.5)
      const aLines = doc.splitTextToSize(lineText, W - 20)
      fillRounded(doc, M, y - 1, W, Math.min(aLines.length, 2) * 3.5 + 3, 1, BG_CARD)
      const pColor = a.priority === 'C1' ? CRITICAL : HIGH
      pill(doc, a.type, M + 2, y + 2, pColor)
      doc.setTextColor(...TEXT_1)
      doc.text(aLines.slice(0, 2), M + 10, y + 1.5)
      y += Math.min(aLines.length, 2) * 3.5 + 4
    })

    if (rec.training_needs?.length) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(5)
      doc.setTextColor(...TEXT_3)
      doc.text('TRAINING:', M + 1, y)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(5.5)
      doc.setTextColor(...TEXT_2)
      doc.text(rec.training_needs.slice(0, 2).join('; ').slice(0, 140), M + 17, y)
      y += 5
    }
  }

  // ── SAFETY MEMORY (compact) ─────────────────────────────────────────────
  const sm = analysis.safety_memory
  if (sm && !sm.error && sm.matches?.length) {
    fillRounded(doc, M, y, W, 6, 1, BG_CARD2)
    doc.setFillColor(...BRAND)
    doc.rect(M, y, 2, 6, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6)
    doc.setTextColor(...BRAND)
    doc.text(`SAFETY MEMORY (${sm.matches.length} matches)`, M + 5, y + 4)
    y += 8

    if (sm.verdict) {
      pill(doc, sm.verdict.replaceAll('_', ' '), M + 2, y + 1, sm.verdict.includes('FATAL') ? CRITICAL : BRAND_DIM)
      y += 5
    }

    sm.matches.slice(0, 2).forEach((m) => {
      fillRounded(doc, M, y - 1, W, 7, 1, BG_CARD)
      const simPct = Math.round((m.similarity || 0) * 100)
      pill(doc, `${simPct}%`, M + 2, y + 2.5, BRAND_DIM)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(5.5)
      doc.setTextColor(...TEXT_3)
      doc.text(fmt(m.report_id), M + 16, y + 2)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(5.5)
      doc.setTextColor(...TEXT_2)
      doc.text((m.narrative || '').slice(0, 100) + '…', M + 16, y + 5)
      y += 9
    })
  }

  // ── FOOTER ──────────────────────────────────────────────────────────────
  doc.setDrawColor(...BORDER)
  doc.setLineWidth(0.2)
  doc.line(M, 287, 200, 287)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(5)
  doc.setTextColor(...BRAND)
  doc.text('Kavach AI', M, 291)

  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...TEXT_3)
  doc.text(` — Confidential Safety Report · ${rId}`, M + 13, 291)

  doc.setTextColor(...TEXT_3)
  doc.text('Page 1 of 1', 200, 291, { align: 'right' })

  doc.save(`KavachAI-Report-${rId}.pdf`)
}
