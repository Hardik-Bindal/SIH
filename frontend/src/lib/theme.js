// Theme management — CSS class + localStorage + system-preference fallback.
// Kept dead simple: no context, just a hook that reads/writes the class
// on <html> so the first paint uses the correct theme.

const STORAGE_KEY = 'kavach.theme'

export function getInitialTheme() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'dark' || stored === 'light') return stored
  } catch { /* private mode */ }
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return 'light'
}

export function applyTheme(theme) {
  const root = document.documentElement
  if (theme === 'dark') root.classList.add('dark')
  else root.classList.remove('dark')
  try { localStorage.setItem(STORAGE_KEY, theme) } catch { /* noop */ }
}

// Run early — before React mounts — to avoid a light-to-dark flash.
export function initTheme() {
  applyTheme(getInitialTheme())
}

import { useCallback, useEffect, useState } from 'react'

export function useTheme() {
  const [theme, setTheme] = useState(() =>
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
      ? 'dark'
      : 'light'
  )

  useEffect(() => { applyTheme(theme) }, [theme])

  const toggle = useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), [])

  return { theme, setTheme, toggle, isDark: theme === 'dark' }
}