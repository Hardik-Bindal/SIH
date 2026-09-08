# Spoken recommendation briefing

The shared Corrective & Preventive Actions panel now includes **Listen to
recommendations**, with English and Hindi selectors and Listen/Stop controls.
It appears in the shared CAPA panel on incident detail and the Incidents page.
No microphone, recording or API key is involved.

The brief selects up to four complete corrective/preventive action statements,
adding training needs when fewer than three points are available. Current CAPA
outputs produce three or four points. Shorter custom inputs remain shorter;
the feature does not invent advice to fill space. The full toolbox talk,
citations and report narrative are not read aloud. The exact spoken text is
visible before playback.

Hindi translations are included for all 30 current English recommendation
templates, matched against the actual action text. This supports the current
rule-template generator without an external translation service. If advice is
customized or a template changes, Hindi playback is unavailable for that brief
until a matching translation is added; English retains the actual advice.

English playback and Hindi playback on supported devices use the browser's
SpeechSynthesis API. When the device has no Hindi voice, `/api/v1/speech`
generates WAV audio with the local Piper `hi_IN-priyamvada-medium` model. The
recommendation text stays on the machine and playback works without internet.
Install `backend/requirements.txt`, then run
`python backend/scripts/download_hindi_voice.py` once to obtain the 64 MB
model. Changing language/report or leaving the panel stops playback; it never
starts automatically.

Validation: `node --test src/lib/recommendationSpeech.test.js` from frontend
checks translation coverage across the shipped incident corpus, 3–4 point
selection, unknown-translation handling and language-specific voice selection.
The backend endpoint is also checked for a valid RIFF/WAV response. Hindi
pronunciation should still receive a listening check on the target demo
machine.

Browser reference: https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis/getVoices
