import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { recommendationBrief, recommendationTranslations, selectSpeechVoice } from './recommendationSpeech.js'

test('all shipped reports have a complete Hindi brief of 3–4 points', () => {
  const path = new URL('../../../ml/artifacts/incidents_scored.jsonl', import.meta.url)
  const reports = fs.readFileSync(path, 'utf8').trim().split(/\r?\n/).map((line) => JSON.parse(line))
  for (const report of reports) {
    const brief = recommendationBrief(report.recommendations, 'hi')
    assert.equal(brief.translationAvailable, true, report.report_id)
    assert.ok(brief.lines.length >= 3 && brief.lines.length <= 4, report.report_id)
    assert.ok(brief.lines.every((line) => /[\u0900-\u097F]/.test(line)))
  }
})

test('English preserves conditions in actual actions and skips long toolbox text', () => {
  const action = 'Do not restart until the isolation is tested.'
  const brief = recommendationBrief({
    corrective_actions: [{ action }],
    preventive_actions: [{ action: 'Review the procedure.' }],
    training_needs: ['Train the crew.'],
    toolbox_talk: { points: ['This long text must not be spoken.'] },
  })
  assert.deepEqual(brief.lines, [action, 'Review the procedure.', 'Train the crew.'])
})

test('custom advice is not silently replaced by a rule translation', () => {
  const brief = recommendationBrief({ corrective_actions: [{ rule: 'ENERGY_ISOLATION', action: 'New advice with a different condition.' }] }, 'hi')
  assert.equal(brief.translationAvailable, false)
  assert.deepEqual(brief.lines, [])
})

test('translation inventory contains no duplicate source entries', () => {
  assert.equal(new Set(recommendationTranslations.map(([text]) => text)).size, recommendationTranslations.length)
})

test('voice selection prefers Indian English and never substitutes English for Hindi', () => {
  const us = { lang: 'en-US' }, india = { lang: 'en-IN' }, hindi = { lang: 'hi-IN' }
  assert.equal(selectSpeechVoice([us, india, hindi], 'en'), india)
  assert.equal(selectSpeechVoice([us, india, hindi], 'hi'), hindi)
  assert.equal(selectSpeechVoice([us], 'hi'), null)
})
