import { useState, useEffect } from 'react'
import { Sun, Moon, Key, Check, Trash2, Eye, EyeOff, RefreshCw } from 'lucide-react'
import { useTheme } from '../lib/theme'

const API_KEY_STORAGE = 'kavach.ai_api_key'

function maskKey(key) {
  if (!key || key.length < 8) return '****'
  return '****' + key.slice(-4)
}

export default function Settings() {
  const { theme, setTheme } = useTheme()
  const [hasKey, setHasKey] = useState(false)
  const [keyInput, setKeyInput] = useState('')
  const [showInput, setShowInput] = useState(false)
  const [keySaved, setKeySaved] = useState(false)
  const [maskedDisplay, setMaskedDisplay] = useState('')
  const [saveTimerId, setSaveTimerId] = useState(null)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(API_KEY_STORAGE)
      if (stored) {
        setHasKey(true)
        setMaskedDisplay(maskKey(stored))
      }
    } catch { /* storage unavailable */ }
    return () => {
      if (saveTimerId) clearTimeout(saveTimerId)
    }
  }, [saveTimerId])

  function handleSaveKey() {
    if (!keyInput.trim()) return
    try {
      if (saveTimerId) clearTimeout(saveTimerId)
      localStorage.setItem(API_KEY_STORAGE, keyInput.trim())
      setHasKey(true)
      setMaskedDisplay(maskKey(keyInput.trim()))
      setKeyInput('')
      setShowInput(false)
      setKeySaved(true)
      const timerId = setTimeout(() => setKeySaved(false), 2000)
      setSaveTimerId(timerId)
    } catch { /* storage unavailable */ }
  }

  function handleClearKey() {
    try {
      localStorage.removeItem(API_KEY_STORAGE)
    } catch { /* storage unavailable */ }
    setHasKey(false)
    setMaskedDisplay('')
    setKeyInput('')
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-fg">App Settings</h2>
          <p className="mt-1 text-sm text-fg-2">Manage your preferences and system configuration.</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Appearance */}
        <section className="card p-5">
          <h3 className="text-sm font-semibold text-fg">Appearance</h3>
          <p className="mt-1 text-xs text-fg-3">Customize the look and feel of the interface.</p>

          <div className="mt-4 grid max-w-md grid-cols-2 gap-3 sm:grid-cols-2">
            <button
              onClick={() => setTheme('light')}
              className={`flex items-center gap-3 rounded-xl border p-4 text-left transition-all ${
                theme === 'light'
                  ? 'border-brand-500 bg-brand-50/50 text-brand-700 shadow-glow'
                  : 'border-line bg-surface hover:border-line-2 hover:bg-surface-2 text-fg-2 hover:text-fg'
              }`}
            >
              <Sun size={20} className={theme === 'light' ? 'text-brand-600' : ''} />
              <div className="flex-1 text-sm font-medium">Light Mode</div>
            </button>
            <button
              onClick={() => setTheme('dark')}
              className={`flex items-center gap-3 rounded-xl border p-4 text-left transition-all ${
                theme === 'dark'
                  ? 'border-brand-500 bg-brand-500/10 text-brand-400 shadow-glow'
                  : 'border-line bg-surface hover:border-line-2 hover:bg-surface-2 text-fg-2 hover:text-fg'
              }`}
            >
              <Moon size={20} className={theme === 'dark' ? 'text-brand-400' : ''} />
              <div className="flex-1 text-sm font-medium">Dark Mode</div>
            </button>
          </div>
        </section>

        {/* AI API Key Configuration */}
        <section className="card p-5">
          <div className="flex items-center gap-2">
            <Key size={16} className="text-brand-500" />
            <h3 className="text-sm font-semibold text-fg">AI API Key</h3>
            <span className="rounded-full bg-surface-2 px-2 py-0.5 text-2xs font-bold text-fg-3">Optional</span>
          </div>
          <p className="mt-1 text-xs text-fg-3">
            KAVACH&apos;s scoring pipeline runs fully offline on self-hosted models — no external
            key is required for any feature. This slot is reserved for optional third-party AI
            enrichment. The key is stored only in your browser; the full key is never shown after saving.
          </p>

          <div className="mt-4 space-y-3">
            {/* Status */}
            <div className="flex items-center gap-2 rounded-lg border border-line bg-surface-2/30 px-3.5 py-2.5">
              <span
                className={`h-2 w-2 rounded-full ${hasKey ? 'bg-emerald-500 shadow-[0_0_6px_1px_rgba(34,197,94,0.4)]' : 'bg-fg-3/40'}`}
              />
              <span className="text-xs font-semibold text-fg-2">
                {hasKey ? 'Key configured' : 'No key configured'}
              </span>
              {hasKey && (
                <span className="ml-auto font-mono text-2xs text-fg-3">{maskedDisplay}</span>
              )}
            </div>

            {/* Input */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type={showInput ? 'text' : 'password'}
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  placeholder={hasKey ? 'Enter new key to replace' : 'Enter your API key'}
                  className="input w-full pr-9 text-xs h-9 px-3 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => setShowInput((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-fg-3 hover:text-fg-2"
                  aria-label={showInput ? 'Hide API key' : 'Show API key'}
                  aria-pressed={showInput}
                  title={showInput ? 'Hide input' : 'Show input'}
                >
                  {showInput ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <button
                type="button"
                onClick={handleSaveKey}
                disabled={!keyInput.trim()}
                className="btn-primary h-9 px-3 text-xs font-bold disabled:opacity-40"
              >
                {keySaved ? (
                  <><Check size={13} /> Saved</>
                ) : (
                  'Save Key'
                )}
              </button>
              {hasKey && (
                <button
                  type="button"
                  onClick={handleClearKey}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-red-500/20 bg-red-500/5 text-red-400 transition-colors hover:bg-red-500/10"
                  title="Remove API key"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>

            <p className="text-2xs text-fg-3 leading-relaxed">
              Your API key is stored only in this browser&apos;s local storage. It is never sent to our servers; the full key is never shown after saving. To update, enter a new key and save.
            </p>
          </div>
        </section>

        {/* Data & Cache */}
        <section className="card p-5">
          <div className="flex items-center gap-2">
            <RefreshCw size={16} className="text-brand-500" />
            <h3 className="text-sm font-semibold text-fg">Data &amp; Cache</h3>
          </div>
          <p className="mt-1 text-xs text-fg-3">
            Analytics data refreshes automatically every 60 seconds. Reload the page to force a fresh fetch from the server.
          </p>

          <div className="mt-4 space-y-2 text-xs text-fg-2">
            <div className="flex items-center justify-between rounded-lg border border-line bg-surface-2/30 px-3.5 py-2.5">
              <span className="font-semibold">Auto-refresh interval</span>
              <span className="font-mono text-fg-3">60s</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-line bg-surface-2/30 px-3.5 py-2.5">
              <span className="font-semibold">API base URL</span>
              <span className="font-mono text-2xs text-fg-3 truncate max-w-[220px]">
                {import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}
              </span>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
