import { useState, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Minimize2, ShieldHalf, Sparkles } from 'lucide-react'
import CopilotChat from './CopilotChat'

const PANEL_VARIANTS = {
  hidden: { opacity: 0, y: 24, scale: 0.92 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 400, damping: 30 } },
  exit: { opacity: 0, y: 16, scale: 0.95, transition: { duration: 0.18 } },
}

const BTN_VARIANTS = {
  idle: { scale: 1 },
  hover: { scale: 1.06 },
  tap: { scale: 0.95 },
}

export default function FloatingAssistant() {
  const [open, setOpen] = useState(false)
  const location = useLocation()

  const toggle = useCallback(() => setOpen((v) => !v), [])

  // Detect if we're on an incident detail page for context hints
  const incidentMatch = location.pathname.match(/^\/incidents\/([\w-]+)$/)
  const incidentId = incidentMatch?.[1]

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3">
      {/* Chat panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="kavach-panel"
            variants={PANEL_VARIANTS}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="flex w-[22rem] sm:w-[24rem] flex-col overflow-hidden rounded-2xl border border-line bg-surface/95 shadow-lifted backdrop-blur-xl"
            style={{ height: 'min(32rem, calc(100vh - 7rem))' }}
          >
            {/* Panel header */}
            <div className="flex items-center gap-2.5 border-b border-line bg-gradient-to-r from-surface to-surface-2/30 px-4 py-3">
              <span className="relative grid h-8 w-8 shrink-0 place-items-center rounded-lg overflow-hidden">
                <span className="absolute inset-0 bg-gradient-to-br from-brand-400 to-brand-600" />
                <ShieldHalf size={15} className="relative text-white" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-fg">Kavach AI</p>
                <p className="truncate text-2xs text-fg-3">Safety Intelligence Assistant</p>
              </div>
              <button
                type="button"
                onClick={toggle}
                aria-label="Close assistant"
                className="rounded-lg p-1.5 text-fg-3 transition-colors hover:bg-surface-2 hover:text-fg"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>

            {/* Context hint when on incident page */}
            {incidentId && (
              <div className="border-b border-line bg-brand-500/5 px-4 py-2 text-2xs text-brand-400">
                <Sparkles size={10} className="mr-1 inline-block" />
                Viewing <span className="font-mono font-bold">{incidentId}</span> — ask about this incident
              </div>
            )}

            {/* Copilot chat reuse */}
            <div className="min-h-0 flex-1">
              <CopilotChat variant="compact" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating action button */}
      <motion.button
        type="button"
        onClick={toggle}
        variants={BTN_VARIANTS}
        initial="idle"
        whileHover="hover"
        whileTap="tap"
        aria-label={open ? 'Close Kavach AI assistant' : 'Open Kavach AI assistant'}
        className={`group flex items-center gap-2 rounded-full px-4 py-3 font-display text-sm font-bold text-white shadow-lifted
          transition-colors duration-200
          ${open
            ? 'bg-surface-2 text-fg-2 border border-line hover:bg-surface-3'
            : 'bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-400 hover:to-brand-500 shadow-[0_4px_24px_-4px_rgb(var(--color-brand-500)/0.5)]'
          }`}
      >
        {open ? (
          <>
            <Minimize2 size={16} aria-hidden="true" />
            <span className="hidden sm:inline">Close</span>
          </>
        ) : (
          <>
            <span className="relative flex h-5 w-5 items-center justify-center">
              <ShieldHalf size={16} aria-hidden="true" />
              <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-risk-low-solid animate-pulse-soft" />
            </span>
            <span className="hidden sm:inline">Kavach AI</span>
          </>
        )}
      </motion.button>
    </div>
  )
}
