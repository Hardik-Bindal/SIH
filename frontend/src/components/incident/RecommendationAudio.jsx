import { useEffect, useRef, useState } from 'react'
import { Volume2, Square, Languages } from 'lucide-react'
import { recommendationBrief, selectSpeechVoice } from '../../lib/recommendationSpeech'
import { API_BASE_URL } from '../../api/client'

export default function RecommendationAudio({ recommendations }) {
  const [language, setLanguage] = useState('en')
  const [voices, setVoices] = useState(() => window.speechSynthesis?.getVoices() || [])
  const [speaking, setSpeaking] = useState(false)
  const [error, setError] = useState('')
  const utterance = useRef(null)
  const generatedAudio = useRef(null)
  const supported = Boolean(window.speechSynthesis && window.SpeechSynthesisUtterance)
  const brief = recommendationBrief(recommendations, language)
  const voice = selectSpeechVoice(voices, language)

  useEffect(() => {
    if (!supported) return
    const synth = window.speechSynthesis
    const update = () => setVoices(synth.getVoices())
    synth.addEventListener('voiceschanged', update)
    return () => {
      synth.removeEventListener('voiceschanged', update)
      if (utterance.current) {
        utterance.current.onend = null
        utterance.current.onerror = null
        synth.cancel()
      }
      if (generatedAudio.current) {
        generatedAudio.current.pause()
        generatedAudio.current.src = ''
        generatedAudio.current = null
      }
    }
  }, [supported])

  function stop() {
    if (utterance.current) {
      utterance.current.onend = null
      utterance.current.onerror = null
      window.speechSynthesis.cancel()
      utterance.current = null
    }
    if (generatedAudio.current) {
      generatedAudio.current.onended = null
      generatedAudio.current.onerror = null
      generatedAudio.current.pause()
      generatedAudio.current.src = ''
      generatedAudio.current = null
    }
    setSpeaking(false)
  }

  function play() {
    stop()
    setError('')
    const synth = window.speechSynthesis
    const selectedVoice = synth ? selectSpeechVoice(synth.getVoices(), language) : null
    if (language === 'hi' && !selectedVoice) {
      const params = new URLSearchParams({ text: brief.lines.join(' '), language: 'hi' })
      const audio = new Audio(`${API_BASE_URL}/api/v1/speech?${params}`)
      generatedAudio.current = audio
      audio.onended = () => { generatedAudio.current = null; setSpeaking(false) }
      audio.onerror = () => {
        generatedAudio.current = null
        setSpeaking(false)
        setError('Hindi audio could not be generated. Check the backend connection and try again.')
      }
      setSpeaking(true)
      audio.play().catch(() => {
        generatedAudio.current = null
        setSpeaking(false)
        setError('Hindi audio could not start. Try the button again.')
      })
      return
    }
    synth.cancel()
    const speech = new SpeechSynthesisUtterance(brief.lines.join('\n'))
    // Chromium can resolve an online/system voice from the language hint even
    // when getVoices() does not list it. An absent explicit voice must not block
    // playback; let the speech engine choose its best available hi-IN/en-IN voice.
    if (selectedVoice) speech.voice = selectedVoice
    speech.lang = selectedVoice?.lang || (language === 'hi' ? 'hi-IN' : 'en-IN')
    speech.rate = 0.92
    utterance.current = speech
    speech.onend = () => { utterance.current = null; setSpeaking(false) }
    speech.onerror = (event) => {
      utterance.current = null
      setSpeaking(false)
      setError(event.error === 'language-unavailable'
        ? 'Hindi speech is unavailable in this browser. Open the app in Chrome or install the Hindi speech language on this device.'
        : 'Audio playback was interrupted. Try Listen again or choose another language.')
    }
    setSpeaking(true)
    synth.speak(speech)
  }

  return (
    <section className="rounded-xl border border-brand-200 bg-brand-50/30 p-4 space-y-3" aria-label="Listen to recommendations">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-brand-500">
          <Volume2 size={18} aria-hidden="true" />
          <h3 className="text-sm font-semibold text-fg">Listen to recommendations</h3>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-line bg-surface p-1" role="group" aria-label="Recommendation audio language">
          <Languages size={14} className="mx-1 text-fg-3" aria-hidden="true" />
          {[['en', 'English'], ['hi', 'हिन्दी']].map(([code, label]) => (
            <button type="button" key={code} aria-pressed={language === code}
              onClick={() => { stop(); setError(''); setLanguage(code) }}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold ${language === code ? 'bg-brand-500 text-white' : 'text-fg-2 hover:bg-surface-2'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <p className="text-xs text-fg-3">A short action briefing. Choose a language and listen.</p>
      {brief.translationAvailable ? (
        <div lang={language} className="space-y-1.5 text-sm leading-relaxed text-fg-2">
          {brief.lines.map((line, index) => <p key={line}><span className="mr-2 text-brand-500">{index + 1}.</span>{line}</p>)}
        </div>
      ) : <p className="text-xs text-fg-2">Hindi translation is not available for this customized recommendation. Choose English to hear the original advice.</p>}
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn-primary" onClick={speaking ? stop : play}
          disabled={(!supported && language === 'en') || !brief.lines.length}>
          {speaking ? <Square size={14} /> : <Volume2 size={14} />}
          {speaking ? 'Stop audio' : language === 'hi' ? 'हिन्दी में सुनें' : 'Listen in English'}
        </button>
        <span role="status" className="text-xs text-fg-3">{speaking ? 'Reading the short briefing…' : `${brief.lines.length} key points`}</span>
      </div>
      {!supported && language === 'en' && <p className="text-xs text-fg-3">English speech playback is unavailable in this browser. The briefing is shown above.</p>}
      {!supported && language === 'hi' && <p className="text-xs text-fg-3">Using the Kavach AI offline Hindi voice.</p>}
      {supported && !voice && language === 'hi' && <p className="text-xs text-fg-3">Using the Kavach AI Hindi voice because this device has no Hindi speech voice.</p>}
      {supported && !voice && language === 'en' && <p className="text-xs text-fg-3">Your browser will automatically choose the closest available English voice.</p>}
      {error && <p role="alert" className="text-xs text-red-500">{error}</p>}
    </section>
  )
}
