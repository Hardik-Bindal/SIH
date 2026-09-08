import { jsPDF } from 'jspdf'

/* ────────────────────────────────────────────────────────────────────────────
   KAVACH AI — single-page incident report.

   Mirrors the Incident Detail page section-for-section, laid out in two
   columns on exactly ONE A4 page. Content is measured before it is drawn:
   the generator picks the richest detail level that still fits, then balances
   the blocks across both columns so the page fills without a trailing gap.
   ──────────────────────────────────────────────────────────────────────────── */

// ── Palette (matches the KAVACH dark theme) ─────────────────────────────────
const BG_PAGE   = [13, 17, 35]
const BG_CARD   = [20, 27, 56]
const BG_CARD2  = [26, 35, 71]
const BORDER    = [45, 58, 100]
const BRAND     = [99, 155, 255]
const BRAND_DIM = [59, 100, 200]

const CRITICAL = [239, 68, 68]
const HIGH     = [249, 115, 22]
const MEDIUM   = [234, 179, 8]
const LOW      = [34, 197, 94]

const TEXT_1 = [226, 232, 240]
const TEXT_2 = [148, 163, 184]
const TEXT_3 = [100, 116, 139]
const WHITE  = [255, 255, 255]

// ── Page geometry (mm) ──────────────────────────────────────────────────────
const PAGE_W = 210
const PAGE_H = 297
const M      = 8
const W      = PAGE_W - M * 2          // 194
const GUTTER = 5
const COL_W  = (W - GUTTER) / 2        // 94.5
const COL_X1 = M
const COL_X2 = M + COL_W + GUTTER
const COL_TOP    = 60
const COL_BOTTOM = 286
const COL_H      = COL_BOTTOM - COL_TOP

// ── Type scale ──────────────────────────────────────────────────────────────
const BODY = 6.2
const BODY_LH = 2.75
const SMALL = 5.4
const SMALL_LH = 2.4
const HEAD = 6.2
const HEAD_H = 7.5

function bandColor(band) {
  switch (String(band || '').toUpperCase()) {
    case 'CRITICAL': return CRITICAL
    case 'HIGH': return HIGH
    case 'MEDIUM': return MEDIUM
    case 'LOW': return LOW
    default: return TEXT_3
  }
}

function fmt(v, fallback = '—') {
  if (v == null || v === '') return fallback
  return String(v)
}

function pct(v, fallback = '—') {
  if (v == null || Number.isNaN(Number(v))) return fallback
  return `${(Number(v) * 100).toFixed(1)}%`
}

function pct0(v) {
  if (v == null) return '—'
  return `${Math.round(Number(v) * 100)}%`
}

function titleCase(s) {
  return String(s || '').replaceAll('_', ' ').toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

/* ── Primitives ─────────────────────────────────────────────────────────── */

function fillRounded(doc, x, y, w, h, r, color) {
  doc.setFillColor(...color)
  doc.roundedRect(x, y, w, h, r, r, 'F')
}

function pill(doc, text, x, y, bg, fg = WHITE, size = 5) {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(size)
  const tw = doc.getTextWidth(text)
  const pw = tw + 3.4
  fillRounded(doc, x, y - 2.6, pw, 4.0, 1, bg)
  doc.setTextColor(...fg)
  doc.text(text, x + 1.7, y)
  return x + pw + 1.4
}

/** Section header bar. Returns the y after the header. */
function drawHead(doc, title, x, y, w) {
  fillRounded(doc, x, y, w, 5.6, 1, BG_CARD2)
  doc.setFillColor(...BRAND)
  doc.rect(x, y, 1.6, 5.6, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(HEAD)
  doc.setTextColor(...BRAND)
  doc.text(String(title).toUpperCase(), x + 4, y + 3.9)
  return y + HEAD_H
}

/** Measure wrapped text lines at a given size. */
function wrap(doc, text, w, size, style = 'normal') {
  doc.setFont('helvetica', style)
  doc.setFontSize(size)
  return doc.splitTextToSize(String(text || ''), w)
}

/* ── Block builders ─────────────────────────────────────────────────────────
   Each returns { h, draw(x, y, w) } — height is computed up front so the
   layout engine can fit and balance before anything is painted.
   ────────────────────────────────────────────────────────────────────────── */

function blockNarrative(doc, a, cap) {
  const raw = String(a.narrative || '—')
  const text = raw.length > cap ? raw.slice(0, cap).replace(/\s+\S*$/, '') + '…' : raw
  const lines = wrap(doc, text, COL_W - 4, BODY)
  const h = HEAD_H + lines.length * BODY_LH + 3
  return {
    h,
    draw(x, y, w) {
      let cy = drawHead(doc, 'Incident Narrative', x, y, w)
      fillRounded(doc, x, cy - 1.5, w, lines.length * BODY_LH + 3, 1, BG_CARD)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(BODY)
      doc.setTextColor(...TEXT_1)
      doc.text(lines, x + 2, cy + 1.2)
    },
  }
}

/** "Why is this dangerous?" — the risk-fusion breakdown from RiskFusionBar. */
function blockFusion(doc, a) {
  const parts = [
    { label: 'SIF probability', input: a.sif_probability ?? 0, weight: 0.55, color: BRAND },
    { label: 'Life Saving Rule severity', input: a.lsr_tags?.[0]?.score ?? a.lsr_tags?.[0]?.confidence ?? 0, weight: 0.25, color: [129, 165, 255] },
    { label: 'Barrier failure', input: a.barrier_failure ? 1 : 0, weight: 0.1, color: MEDIUM },
    { label: 'Fatal-case similarity', input: a.fatality_twin?.similarity ?? a.similar_fatalities?.[0]?.similarity ?? 0, weight: 0.1, color: HIGH },
  ].map((p) => ({ ...p, contribution: (Number(p.input) || 0) * p.weight }))

  const total = parts.reduce((s, p) => s + p.contribution, 0)
  const override = !!a.escalation_override_applied
  const ovLines = override
    ? wrap(doc, 'Escalation override — matched a fatal case above the similarity floor, so the band is floored at HIGH regardless of the computed score.', COL_W - 5, SMALL)
    : []

  const h = HEAD_H + 4.5 + 3.5 + parts.length * 4.2 + 2 + (override ? ovLines.length * SMALL_LH + 3.5 : 0)

  return {
    h,
    draw(x, y, w) {
      let cy = drawHead(doc, 'Why is this dangerous?', x, y, w)

      // Composite score readout
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(SMALL)
      doc.setTextColor(...TEXT_3)
      doc.text('How this score was assembled', x + 1, cy + 1.5)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(7.5)
      doc.setTextColor(...TEXT_1)
      doc.text(`${total.toFixed(2)}`, x + w - 9, cy + 1.8, { align: 'right' })
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(SMALL)
      doc.setTextColor(...TEXT_3)
      doc.text('/ 1.00', x + w - 1, cy + 1.8, { align: 'right' })
      cy += 4.5

      // Stacked contribution bar
      const barW = w - 2
      fillRounded(doc, x + 1, cy - 1, barW, 2.4, 1.2, BG_CARD2)
      let bx = x + 1
      parts.forEach((p) => {
        const seg = Math.max(0, p.contribution) * barW
        if (seg > 0.2) {
          doc.setFillColor(...p.color)
          doc.rect(bx, cy - 1, seg, 2.4, 'F')
          bx += seg
        }
      })
      cy += 3.5

      // Legend rows
      parts.forEach((p) => {
        doc.setFillColor(...p.color)
        doc.circle(x + 2, cy + 0.5, 0.9, 'F')
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(SMALL)
        doc.setTextColor(...TEXT_2)
        doc.text(p.label, x + 4.5, cy + 1.2)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(...TEXT_1)
        doc.text(`+${p.contribution.toFixed(2)}`, x + w - 1, cy + 1.2, { align: 'right' })
        cy += 4.2
      })

      if (override) {
        cy += 1
        fillRounded(doc, x, cy - 1.5, w, ovLines.length * SMALL_LH + 3, 1, [52, 30, 10])
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(SMALL)
        doc.setTextColor(...HIGH)
        doc.text(ovLines, x + 2, cy + 1)
      }
    },
  }
}

/** Terms the model weighted most — ExplanationPanel. */
function blockExplanation(doc, a, cap) {
  const tokens = (a.explanation?.tokens || []).slice(0, cap)
  if (!tokens.length) return null
  const summary = a.explanation?.summary
  const sumLines = summary ? wrap(doc, summary, COL_W - 4, SMALL, 'italic') : []
  const h = HEAD_H + (sumLines.length ? sumLines.length * SMALL_LH + 2 : 0) + tokens.length * 4.4 + 1

  return {
    h,
    draw(x, y, w) {
      let cy = drawHead(doc, 'Terms the model weighted most', x, y, w)

      if (sumLines.length) {
        doc.setFont('helvetica', 'italic')
        doc.setFontSize(SMALL)
        doc.setTextColor(...TEXT_3)
        doc.text(sumLines, x + 1, cy + 1)
        cy += sumLines.length * SMALL_LH + 2
      }

      const maxAbs = Math.max(...tokens.map((t) => Math.abs(Number(t.weight) || 0)), 0.0001)
      const barMax = w * 0.42
      tokens.forEach((t) => {
        const wt = Number(t.weight) || 0
        const color = wt >= 0 ? CRITICAL : LOW
        const bw = Math.max(0.6, (Math.abs(wt) / maxAbs) * barMax)

        fillRounded(doc, x, cy - 1.2, w, 3.9, 0.8, BG_CARD)
        doc.setFillColor(...color)
        doc.rect(x, cy - 1.2, bw, 3.9, 'F')

        doc.setFont('helvetica', 'bold')
        doc.setFontSize(SMALL)
        doc.setTextColor(...TEXT_1)
        doc.text(String(t.term || t.token || '').slice(0, 26), x + 1.6, cy + 1.4)

        doc.setFont('helvetica', 'bold')
        doc.setFontSize(SMALL)
        doc.setTextColor(...(wt >= 0 ? CRITICAL : LOW))
        doc.text(`${wt >= 0 ? '+' : ''}${wt.toFixed(3)}`, x + w - 1.5, cy + 1.4, { align: 'right' })
        cy += 4.4
      })
    },
  }
}

/** Which Life Saving Rules apply? — LsrMapping. */
function blockLsr(doc, a, cap) {
  const tags = [...(a.lsr_tags || [])]
    .map((t) => ({ rule: t.rule, score: Number(t.score ?? t.confidence ?? 0) }))
    .sort((x, z) => z.score - x.score)
    .slice(0, cap)

  const empty = tags.length === 0
  const h = HEAD_H + (empty ? 4 : tags.length * 6.4)

  return {
    h,
    draw(x, y, w) {
      let cy = drawHead(doc, 'Which Life Saving Rules apply?', x, y, w)
      if (empty) {
        doc.setFont('helvetica', 'italic')
        doc.setFontSize(SMALL)
        doc.setTextColor(...TEXT_3)
        doc.text('No rule crossed the confidence threshold.', x + 1, cy + 1.5)
        return
      }
      tags.forEach((t, i) => {
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(SMALL)
        doc.setTextColor(...(i === 0 ? CRITICAL : TEXT_2))
        doc.text(String(t.rule || '').replaceAll('_', ' '), x + 1, cy + 1.2)
        doc.setTextColor(...TEXT_1)
        doc.text(pct(t.score), x + w - 1, cy + 1.2, { align: 'right' })

        // score bar
        fillRounded(doc, x + 1, cy + 2.4, w - 2, 1.7, 0.85, BG_CARD2)
        const bw = Math.max(0.5, Math.min(1, t.score) * (w - 2))
        doc.setFillColor(...(i === 0 ? CRITICAL : BRAND))
        doc.roundedRect(x + 1, cy + 2.4, bw, 1.7, 0.85, 0.85, 'F')
        cy += 6.4
      })
    },
  }
}

/** Extracted entities — EntityTags (keys read straight off the payload). */
function blockEntities(doc, a, cap) {
  const COLORS = { hazard: HIGH, equipment: BRAND, activity: MEDIUM, condition: TEXT_3, control: [56, 189, 248] }
  // failed_controls has its own zone in the summary card — don't repeat it here.
  const groups = Object.entries(a.entities || {})
    .filter(([k, v]) => k !== 'failed_controls' && Array.isArray(v) && v.length > 0)
    .map(([k, v]) => ({ key: k, label: titleCase(k), items: v.slice(0, cap), color: COLORS[k] || BRAND_DIM }))

  if (!groups.length) return null

  // Pre-measure pill wrapping per group.
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(5)
  const laid = groups.map((g) => {
    const rows = []
    let cur = []
    let used = 0
    g.items.forEach((raw) => {
      const label = String(raw).slice(0, 26)
      const pw = doc.getTextWidth(label) + 3.4 + 1.4
      if (used + pw > COL_W - 1 && cur.length) {
        rows.push(cur); cur = []; used = 0
      }
      cur.push(label); used += pw
    })
    if (cur.length) rows.push(cur)
    return { ...g, rows }
  })

  const h = HEAD_H + laid.reduce((s, g) => s + 2.9 + g.rows.length * 4.6 + 1, 0)

  return {
    h,
    draw(x, y, w) {
      let cy = drawHead(doc, 'Extracted entities', x, y, w)
      laid.forEach((g) => {
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(4.8)
        doc.setTextColor(...TEXT_3)
        doc.text(g.label.toUpperCase(), x + 1, cy + 1)
        cy += 2.9
        g.rows.forEach((row) => {
          let px = x + 1
          row.forEach((label) => { px = pill(doc, label, px, cy + 2.2, g.color) })
          cy += 4.6
        })
        cy += 1
      })
    },
  }
}

/** Fatality Twin — what could this escalate to? */
function blockTwin(doc, a, cap) {
  const twin = a.fatality_twin
  if (!twin) return null
  const chain = (twin.chain || []).slice(0, cap)
  const chainLines = chain.map((s, i) => wrap(doc, `${i + 1}. ${s}`, COL_W - 5, SMALL))
  const chainH = chainLines.reduce((s, l) => s + l.length * SMALL_LH + 0.8, 0)
  const h = HEAD_H + 3 + 11 + (chain.length ? chainH + 2 : 0)

  return {
    h,
    draw(x, y, w) {
      let cy = drawHead(doc, 'Fatality Twin — what could this escalate to?', x, y, w)

      doc.setFont('helvetica', 'italic')
      doc.setFontSize(4.8)
      doc.setTextColor(...TEXT_3)
      doc.text('Model projection from similar historical fatalities — not a prediction.', x + 1, cy + 1)
      cy += 3

      const stats = [
        ['Likelihood', pct(twin.likelihood)],
        ['Matched', fmt(twin.matched)],
        ['Similarity', pct(twin.similarity)],
      ]
      const sw = (w - 3) / 3
      stats.forEach(([label, val], i) => {
        const sx = x + i * (sw + 1.5)
        fillRounded(doc, sx, cy, sw, 9.5, 1, BG_CARD)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(4.6)
        doc.setTextColor(...TEXT_3)
        doc.text(label.toUpperCase(), sx + 1.8, cy + 3)
        doc.setFontSize(7.5)
        doc.setTextColor(...BRAND)
        doc.text(String(val), sx + 1.8, cy + 7.6)
      })
      cy += 11

      if (chain.length) {
        cy += 1
        chainLines.forEach((lines) => {
          doc.setFillColor(...CRITICAL)
          doc.circle(x + 1.4, cy + 0.6, 0.7, 'F')
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(SMALL)
          doc.setTextColor(...TEXT_2)
          doc.text(lines, x + 3.5, cy + 1.2)
          cy += lines.length * SMALL_LH + 0.8
        })
      }
    },
  }
}

/** Matched fatal cases — similar_fatalities. */
function blockMatched(doc, a, cap) {
  const cases = (a.similar_fatalities || []).slice(0, cap)
  if (!cases.length) return null

  const laid = cases.map((c) => ({
    ...c,
    lines: wrap(doc, String(c.narrative || '').slice(0, 150), COL_W - 16, SMALL),
  }))
  const h = HEAD_H + laid.reduce((s, c) => s + Math.max(6, c.lines.length * SMALL_LH + 3.4) + 1.2, 0)

  return {
    h,
    draw(x, y, w) {
      let cy = drawHead(doc, `Matched fatal cases (${(a.similar_fatalities || []).length})`, x, y, w)
      laid.forEach((c) => {
        const bh = Math.max(6, c.lines.length * SMALL_LH + 3.4)
        fillRounded(doc, x, cy - 1, w, bh, 1, BG_CARD)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(4.8)
        doc.setTextColor(...TEXT_3)
        doc.text(fmt(c.report_id), x + 2, cy + 1.6)
        pill(doc, pct0(c.similarity), x + w - 11, cy + 1.9, BRAND_DIM, WHITE, 4.8)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(SMALL)
        doc.setTextColor(...TEXT_2)
        doc.text(c.lines, x + 2, cy + 4.4)
        cy += bh + 1.2
      })
    },
  }
}

/** Safety Memory — optional, only when the recall object is supplied. */
function blockMemory(doc, a, cap) {
  const sm = a.safety_memory
  if (!sm || sm.error || !(sm.matches || []).length) return null
  const matches = sm.matches.slice(0, cap)
  const laid = matches.map((m) => ({
    ...m,
    lines: wrap(doc, String(m.narrative || '').slice(0, 130), COL_W - 16, SMALL),
  }))
  const h = HEAD_H + (sm.verdict ? 5 : 0) + laid.reduce((s, m) => s + Math.max(6, m.lines.length * SMALL_LH + 3.4) + 1.2, 0)

  return {
    h,
    draw(x, y, w) {
      let cy = drawHead(doc, `Safety Memory — has this happened before?`, x, y, w)
      if (sm.verdict) {
        pill(doc, String(sm.verdict).replaceAll('_', ' '), x + 1, cy + 1.8,
          String(sm.verdict).includes('FATAL') ? CRITICAL : BRAND_DIM)
        cy += 5
      }
      laid.forEach((m) => {
        const bh = Math.max(6, m.lines.length * SMALL_LH + 3.4)
        fillRounded(doc, x, cy - 1, w, bh, 1, BG_CARD)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(4.8)
        doc.setTextColor(...TEXT_3)
        doc.text(fmt(m.report_id), x + 2, cy + 1.6)
        pill(doc, pct0(m.similarity), x + w - 11, cy + 1.9, BRAND_DIM, WHITE, 4.8)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(SMALL)
        doc.setTextColor(...TEXT_2)
        doc.text(m.lines, x + 2, cy + 4.4)
        cy += bh + 1.2
      })
    },
  }
}

/** Recommended CAPA — CapaPanel. */
function blockCapa(doc, a, caps) {
  const rec = a.recommendations
  if (!rec) return null

  const actions = [
    ...(rec.corrective_actions || []).slice(0, caps.corrective).map((x) => ({ ...x, kind: 'CORRECTIVE', color: CRITICAL })),
    ...(rec.preventive_actions || []).slice(0, caps.preventive).map((x) => ({ ...x, kind: 'PREVENTIVE', color: BRAND_DIM })),
  ]
  if (!actions.length) return null

  const laid = actions.map((x) => ({
    ...x,
    lines: wrap(doc, String(x.action || ''), COL_W - 15, SMALL),
  }))

  const training = (rec.training_needs || []).slice(0, caps.training)
  const trainLines = training.length ? wrap(doc, training.join('  ·  '), COL_W - 4, SMALL) : []

  const talk = rec.toolbox_talk
  const talkPoints = talk?.points ? talk.points.slice(0, caps.talk) : []
  const talkLines = talkPoints.map((p) => wrap(doc, `• ${p}`, COL_W - 5, SMALL))
  const talkH = talkPoints.length ? 3.4 + talkLines.reduce((s, l) => s + l.length * SMALL_LH + 0.6, 0) : 0

  const h = HEAD_H
    + laid.reduce((s, x) => s + Math.max(6, x.lines.length * SMALL_LH + 3.6) + 1.2, 0)
    + (trainLines.length ? trainLines.length * SMALL_LH + 4 : 0)
    + talkH

  return {
    h,
    draw(x, y, w) {
      let cy = drawHead(doc, 'Recommended CAPA — what should we do?', x, y, w)

      laid.forEach((act) => {
        const bh = Math.max(6, act.lines.length * SMALL_LH + 3.6)
        fillRounded(doc, x, cy - 1, w, bh, 1, BG_CARD)
        doc.setFillColor(...act.color)
        doc.rect(x, cy - 1, 1.4, bh, 'F')
        pill(doc, `${act.kind[0]}·${fmt(act.priority, '—')}`, x + 2.6, cy + 1.9, act.color, WHITE, 4.6)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(SMALL)
        doc.setTextColor(...TEXT_1)
        doc.text(act.lines, x + 2.6, cy + 4.6)
        cy += bh + 1.2
      })

      if (trainLines.length) {
        cy += 1
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(4.8)
        doc.setTextColor(...TEXT_3)
        doc.text('TRAINING NEEDS', x + 1, cy + 1)
        cy += 2.6
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(SMALL)
        doc.setTextColor(...TEXT_2)
        doc.text(trainLines, x + 1, cy + 1)
        cy += trainLines.length * SMALL_LH
      }

      if (talkPoints.length) {
        cy += 1.4
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(4.8)
        doc.setTextColor(...TEXT_3)
        doc.text(String(talk.title || 'TOOLBOX TALK').toUpperCase().slice(0, 46), x + 1, cy + 1)
        cy += 2.6
        talkLines.forEach((lines) => {
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(SMALL)
          doc.setTextColor(...TEXT_2)
          doc.text(lines, x + 1.5, cy + 1)
          cy += lines.length * SMALL_LH + 0.6
        })
      }
    },
  }
}

/* ── Fixed-position chrome ──────────────────────────────────────────────── */

function drawHeader(doc, a) {
  const rId = a.report_id || 'UNKNOWN'

  doc.setFillColor(...BRAND_DIM)
  doc.rect(0, 0, PAGE_W, 26, 'F')
  doc.setFillColor(16, 24, 58)
  doc.rect(0, 0, PAGE_W, 26, 'F')
  doc.setFillColor(...BRAND)
  doc.rect(0, 25.4, PAGE_W, 0.6, 'F')

  // Mark
  doc.setFillColor(...BRAND)
  doc.circle(M + 3.6, 9, 3.2, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(...BG_PAGE)
  doc.text('K', M + 2.1, 10.3)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(...WHITE)
  doc.text('Kavach AI', M + 9, 10)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.2)
  doc.setTextColor(...BRAND)
  doc.text('Incident Analysis Report', M + 9, 14.8)

  doc.setFontSize(5)
  doc.setTextColor(...TEXT_3)
  doc.text('Knowledge-driven AI for Vigilance and Critical Hazard Prevention', M + 9, 19)

  // Report id badge
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6.4)
  const bw = doc.getTextWidth(rId) + 6
  fillRounded(doc, PAGE_W - M - bw, 5.5, bw, 7, 1.5, BG_CARD)
  doc.setDrawColor(...BRAND)
  doc.setLineWidth(0.3)
  doc.roundedRect(PAGE_W - M - bw, 5.5, bw, 7, 1.5, 1.5, 'S')
  doc.setTextColor(...BRAND)
  doc.text(rId, PAGE_W - M - bw + 3, 10.1)

  // Provenance
  const prov = String(rId).startsWith('LIVE')
    ? { t: 'LIVE SUBMISSION', c: LOW }
    : a.source_type === 'FATALITY' || a.report_type === 'FATALITY'
      ? { t: 'HISTORICAL FATALITY (OSHA)', c: CRITICAL }
      : { t: 'OSHA PUBLIC DATA', c: BRAND_DIM }
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(4.8)
  const pw = doc.getTextWidth(prov.t) + 3.4
  fillRounded(doc, PAGE_W - M - pw, 14.4, pw, 4, 1, prov.c)
  doc.setTextColor(...WHITE)
  doc.text(prov.t, PAGE_W - M - pw + 1.7, 17.2)

  const now = new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(4.8)
  doc.setTextColor(...TEXT_3)
  doc.text(`Generated ${now}`, PAGE_W - M, 21.6, { align: 'right' })
}

function drawSummary(doc, a) {
  const y = 29
  const H = 22
  const bc = bandColor(a.risk_band)

  fillRounded(doc, M, y, W, H, 2, BG_CARD)
  doc.setDrawColor(...bc)
  doc.setLineWidth(0.5)
  doc.roundedRect(M, y, W, H, 2, 2, 'S')
  doc.setFillColor(...bc)
  doc.rect(M, y, 2.2, H, 'F')

  // Zone 1 — band + composite score
  const band = String(a.risk_band || 'UNSCORED')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(17)
  doc.setTextColor(...bc)
  doc.text(band, M + 5, y + 11)
  doc.setFillColor(...bc)
  doc.rect(M + 5, y + 12.8, Math.min(doc.getTextWidth(band), 44), 0.7, 'F')
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(5.2)
  doc.setTextColor(...TEXT_3)
  const rs = a.risk_score != null ? `Composite risk score ${Number(a.risk_score).toFixed(2)} / 1.00` : 'Composite risk band'
  doc.text(rs, M + 5, y + 17.5)

  doc.setDrawColor(...BORDER)
  doc.setLineWidth(0.2)
  doc.line(M + 54, y + 3, M + 54, y + H - 3)

  // Zone 2 — SIF + confidence
  const stat = (label, value, vx, color = TEXT_1) => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(4.7)
    doc.setTextColor(...TEXT_3)
    doc.text(label, vx, y + 5.5)
    doc.setFontSize(10)
    doc.setTextColor(...color)
    doc.text(String(value), vx, y + 12)
  }
  stat('SIF PROBABILITY', pct(a.sif_probability), M + 58)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(4.7)
  doc.setTextColor(...TEXT_3)
  doc.text('CONFIDENCE', M + 58, y + 16)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.4)
  doc.setTextColor(...TEXT_2)
  doc.text(pct(a.confidence), M + 58, y + 19.5)

  doc.setDrawColor(...BORDER)
  doc.line(M + 92, y + 3, M + 92, y + H - 3)

  // Zone 3 — barrier failure + root cause
  const bf = !!a.barrier_failure
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(4.7)
  doc.setTextColor(...TEXT_3)
  doc.text('BARRIER FAILURE', M + 96, y + 5.5)
  doc.setFontSize(9)
  doc.setTextColor(...(bf ? CRITICAL : LOW))
  doc.text(bf ? 'YES' : 'NO', M + 96, y + 12)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(4.7)
  doc.setTextColor(...TEXT_3)
  doc.text('PRIMARY CONTRIBUTING FACTOR', M + 96, y + 16)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6)
  doc.setTextColor(...TEXT_2)
  doc.text(titleCase(fmt(a.root_cause)).slice(0, 30), M + 96, y + 19.5)

  doc.setDrawColor(...BORDER)
  doc.line(M + 140, y + 3, M + 140, y + H - 3)

  // Zone 4 — failed controls
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(4.7)
  doc.setTextColor(...TEXT_3)
  doc.text('FAILED CONTROLS DETECTED', M + 144, y + 5.5)
  const fc = a.failed_controls || []
  if (fc.length) {
    let px = M + 144
    let py = y + 9.5
    fc.slice(0, 6).forEach((c) => {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(4.6)
      const cw = doc.getTextWidth(String(c)) + 3.4 + 1.4
      if (px + cw > M + W - 2) { px = M + 144; py += 4.6 }
      if (py < y + H - 1.5) px = pill(doc, String(c), px, py, CRITICAL, WHITE, 4.6)
    })
  } else {
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(5.4)
    doc.setTextColor(...TEXT_3)
    doc.text('None detected', M + 144, y + 10)
  }

  // Meta strip below the card
  const chips = [a.site, a.area, a.department, a.activity].filter(Boolean)
  let mx = M
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(4.8)
  chips.forEach((c) => { mx = pill(doc, String(c), mx, y + H + 4, BG_CARD2, TEXT_2, 4.8) })

  const metaBits = []
  if (a.reported_on) metaBits.push(`Reported ${String(a.reported_on).slice(0, 10)}`)
  if (a.model_version) metaBits.push(`model ${a.model_version}`)
  if (a.input_hash) metaBits.push(`hash ${String(a.input_hash).slice(0, 10)}`)
  if (metaBits.length) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(4.8)
    doc.setTextColor(...TEXT_3)
    doc.text(metaBits.join('  ·  '), M + W, y + H + 4, { align: 'right' })
  }
}

function drawFooter(doc, a) {
  doc.setDrawColor(...BORDER)
  doc.setLineWidth(0.2)
  doc.line(M, 288.5, PAGE_W - M, 288.5)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(5)
  doc.setTextColor(...BRAND)
  doc.text('Kavach AI', M, 292)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...TEXT_3)
  doc.text(`— Confidential Safety Report · ${a.report_id || ''}`, M + 12, 292)
  doc.text('Page 1 of 1', PAGE_W - M, 292, { align: 'right' })
}

/* ── Layout engine ──────────────────────────────────────────────────────── */

// Detail levels, richest first. The first level whose blocks fit in two
// columns wins, so a short report keeps full detail and a long one degrades
// gracefully instead of spilling onto a second page.
const LEVELS = [
  { narrative: 2800, tokens: 18, lsr: 9, ent: 18, fatal: 10, chain: 8, corrective: 6, preventive: 6, training: 5, talk: 6, mem: 5 },
  { narrative: 2000, tokens: 15, lsr: 8, ent: 15, fatal: 8, chain: 7, corrective: 5, preventive: 5, training: 4, talk: 5, mem: 4 },
  { narrative: 1400, tokens: 12, lsr: 7, ent: 12, fatal: 6, chain: 6, corrective: 4, preventive: 4, training: 3, talk: 5, mem: 3 },
  { narrative: 1100, tokens: 12, lsr: 6, ent: 12, fatal: 5, chain: 6, corrective: 4, preventive: 4, training: 3, talk: 4, mem: 3 },
  { narrative: 900, tokens: 10, lsr: 5, ent: 10, fatal: 4, chain: 6, corrective: 3, preventive: 3, training: 2, talk: 4, mem: 2 },
  { narrative: 700, tokens: 9, lsr: 5, ent: 8, fatal: 3, chain: 5, corrective: 3, preventive: 3, training: 2, talk: 3, mem: 2 },
  { narrative: 550, tokens: 8, lsr: 4, ent: 6, fatal: 3, chain: 5, corrective: 2, preventive: 2, training: 2, talk: 2, mem: 2 },
  { narrative: 420, tokens: 7, lsr: 4, ent: 5, fatal: 2, chain: 4, corrective: 2, preventive: 2, training: 1, talk: 0, mem: 1 },
  { narrative: 300, tokens: 6, lsr: 3, ent: 4, fatal: 2, chain: 4, corrective: 2, preventive: 1, training: 0, talk: 0, mem: 1 },
  { narrative: 200, tokens: 5, lsr: 3, ent: 3, fatal: 1, chain: 3, corrective: 1, preventive: 1, training: 0, talk: 0, mem: 0 },
]

function buildBlocks(doc, a, L) {
  return [
    blockNarrative(doc, a, L.narrative),
    blockFusion(doc, a),
    blockExplanation(doc, a, L.tokens),
    blockLsr(doc, a, L.lsr),
    blockEntities(doc, a, L.ent),
    blockTwin(doc, a, L.chain),
    blockMatched(doc, a, L.fatal),
    blockMemory(doc, a, L.mem),
    blockCapa(doc, a, L),
  ].filter(Boolean)
}

const GAP = 3.2      // minimum vertical space between blocks
const MAX_GAP = 15   // ceiling when slack is spread to fill the column

/**
 * Split blocks into two columns, preserving reading order and keeping each
 * column within COL_H. Returns null when the content cannot fit.
 */
function splitColumns(blocks) {
  const heights = blocks.map((b) => b.h)
  const totalWithGaps = heights.reduce((s, h) => s + h + GAP, 0) - GAP
  const target = totalWithGaps / 2

  // Choose the boundary that gets column 1 closest to half the content.
  let idx = 0
  let acc = 0
  for (let i = 0; i < blocks.length; i++) {
    const next = acc + (acc ? GAP : 0) + heights[i]
    if (acc > 0 && next - target > target - acc) break
    acc = next
    idx = i + 1
  }

  const colHeight = (arr) => arr.reduce((s, b, i) => s + b.h + (i ? GAP : 0), 0)

  // Pull blocks back from column 1 until it fits.
  let left = blocks.slice(0, idx)
  let right = blocks.slice(idx)
  while (left.length > 1 && colHeight(left) > COL_H) {
    right = [left[left.length - 1], ...right]
    left = left.slice(0, -1)
  }
  // Push blocks forward if column 2 is the one overflowing.
  while (right.length > 1 && colHeight(right) > COL_H && colHeight(left) + GAP + right[0].h <= COL_H) {
    left = [...left, right[0]]
    right = right.slice(1)
  }

  if (colHeight(left) > COL_H || colHeight(right) > COL_H) return null
  return { left, right }
}

/* ── Public API ─────────────────────────────────────────────────────────── */

export function generateIncidentPdf(analysis) {
  const a = analysis || {}
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  // Page background
  doc.setFillColor(...BG_PAGE)
  doc.rect(0, 0, PAGE_W, PAGE_H, 'F')

  drawHeader(doc, a)
  drawSummary(doc, a)

  // Pick the richest detail level that fits on one page.
  let layout = null
  for (const L of LEVELS) {
    const blocks = buildBlocks(doc, a, L)
    const split = splitColumns(blocks)
    if (split) { layout = split; break }
  }
  // Last resort: hard-clip at the tightest level so we never emit page 2.
  if (!layout) {
    const blocks = buildBlocks(doc, a, LEVELS[LEVELS.length - 1])
    const left = []
    const right = []
    let h = 0
    for (const b of blocks) {
      const target = h + b.h <= COL_H ? left : right
      if (target === left) { left.push(b); h += b.h + GAP }
      else if (right.reduce((s, x, i) => s + x.h + (i ? GAP : 0), 0) + b.h + GAP <= COL_H) right.push(b)
    }
    layout = { left, right }
  }

  // Spread the leftover space evenly between blocks so each column reaches
  // the bottom of the page instead of stopping short and leaving a gap.
  const paint = (blocks, x) => {
    if (!blocks.length) return
    const content = blocks.reduce((s, b) => s + b.h, 0)
    const slots = Math.max(1, blocks.length - 1)
    const gap = Math.min(MAX_GAP, Math.max(GAP, (COL_H - content) / slots))
    let y = COL_TOP
    blocks.forEach((b) => {
      b.draw(x, y, COL_W)
      y += b.h + gap
    })
  }
  paint(layout.left, COL_X1)
  paint(layout.right, COL_X2)

  drawFooter(doc, a)
  doc.save(`KavachAI-Report-${a.report_id || 'report'}.pdf`)
}

export default generateIncidentPdf
