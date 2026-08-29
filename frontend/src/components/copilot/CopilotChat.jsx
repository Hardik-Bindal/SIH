import { useId, useRef, useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion, useReducedMotion, AnimatePresence } from 'framer-motion'
import { Send, ShieldAlert, Sparkles, Bot, User, CornerDownLeft } from 'lucide-react'
import { useCopilotQuery } from '../../api/queries'
import StructuredResultView from './StructuredResultView'
import SafetyMemoryPanel from '../memory/SafetyMemoryPanel'

const SUGGESTED_PROMPTS = [
  'Show all confined space incidents during monsoon having SIF > 90 where gas detector failed.',
  'Show all work at height incidents during monsoon having SIF > 90',
  'Has this happened before? Worker touched energized cable while replacing a junction box.',
  'critical lifting incidents at Refinery Block B',
  'Which site is most dangerous this month, and why?',
  'What barrier keeps failing across our electrical maintenance work?',
]

function Avatar({ icon: Icon, tone = 'brand' }) {
  const tones = {
    brand: 'bg-brand-500/10 text-brand-500 ring-brand-500/20 dark:bg-brand-500/20 dark:text-brand-300 dark:ring-brand-500/30',
    slate: 'bg-surface-2 text-fg-2 ring-line',
    amber: 'bg-risk-medium-bg text-risk-medium ring-risk-medium-border/50',
  }
  return (
    <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl ring-1 shadow-sm transition-transform duration-250 hover:scale-105 ${tones[tone]}`}>
      <Icon size={16} aria-hidden="true" />
    </span>
  )
}

function CitationChips({ citations }) {
  if (!citations || citations.length === 0) return null
  return (
    <div className="mt-3 flex flex-wrap gap-1.5 border-t border-line/60 pt-3">
      <span className="eyebrow self-center mr-1">Sources:</span>
      {citations.map((id) => (
        <Link
          key={id}
          to={`/incidents/${encodeURIComponent(id)}`}
          className="inline-flex items-center rounded-lg border border-brand-200/60 bg-brand-50/50 dark:border-brand-500/30 dark:bg-brand-500/10 px-2 py-0.5 font-mono text-2xs
            font-semibold text-brand-700 dark:text-brand-300 transition-all duration-180 ease-out-standard hover:-translate-y-0.5 hover:bg-brand-100 dark:hover:bg-brand-500/20 hover:shadow-sm"
        >
          {id}
        </Link>
      ))}
    </div>
  )
}

function AssistantBubble({ message, reduceMotion }) {
  const MotionDiv = reduceMotion ? 'div' : motion.div
  const motionProps = reduceMotion
    ? {}
    : { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.25, ease: 'easeOut' } }

  const rich = message.structured || message.memory

  if (message.grounded === false && !rich) {
    return (
      <MotionDiv {...motionProps} className="flex gap-3">
        <Avatar icon={ShieldAlert} tone="amber" />
        <div className="max-w-[85%] rounded-2xl rounded-tl-sm border border-risk-medium-border/60 bg-gradient-to-br from-risk-medium-bg/80 to-risk-medium-bg/35 px-4 py-3 text-sm leading-relaxed text-risk-medium shadow-sm">
          <p className="eyebrow mb-1 flex items-center gap-1.5 text-risk-medium">
            <ShieldAlert size={12} />
            No grounded evidence found
          </p>
          <p className="font-medium">{message.answer}</p>
        </div>
      </MotionDiv>
    )
  }

  return (
    <MotionDiv {...motionProps} className="flex gap-3">
      <Avatar icon={Bot} tone="brand" />
      <div
        className={`rounded-2xl rounded-tl-sm border border-line bg-gradient-to-b from-surface to-surface-2/30 px-4 py-3.5 text-sm leading-relaxed text-fg-2 shadow-card
          ${rich ? 'min-w-0 flex-1' : 'max-w-[85%]'}`}
      >
        <p className="whitespace-pre-wrap leading-relaxed text-fg-2">{message.answer}</p>

        {message.structured && (
          <div className="mt-3.5">
            <StructuredResultView payload={message.structured} resultLimit={10} />
          </div>
        )}

        {message.memory && (
          <div className="mt-3.5">
            <SafetyMemoryPanel recall={message.memory} compact />
          </div>
        )}

        <CitationChips citations={message.citations} />
        {message.intent && (
          <p className="eyebrow mt-2.5 text-fg-3/80 font-mono text-[10px]">
            Intent Tag: <span className="text-fg-2 font-semibold">{message.intent}</span>
          </p>
        )}
      </div>
    </MotionDiv>
  )
}

export default function CopilotChat({ variant = 'full' }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const mutation = useCopilotQuery()
  const listRef = useRef(null)
  const reduceMotion = useReducedMotion()
  const inputId = useId()

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: reduceMotion ? 'auto' : 'smooth' })
  }, [messages, mutation.isPending, reduceMotion])

  function send(query) {
    const q = (query ?? input).trim()
    if (!q || mutation.isPending) return
    setMessages((prev) => [...prev, { role: 'user', text: q }])
    setInput('')
    mutation.mutate(q, {
      onSuccess: (data) => {
        setMessages((prev) => [...prev, { role: 'assistant', ...data }])
      },
      onError: (error) => {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', answer: error?.message || 'Copilot request failed.', grounded: false, isTransportError: true },
        ])
      },
    })
  }

  const isCompact = variant === 'compact'

  return (
    <div className={`flex h-full min-h-0 flex-col ${isCompact ? '' : 'card-premium overflow-hidden bg-surface/80 backdrop-blur-xl shadow-lifted ring-1 ring-white/10'}`}>
      {!isCompact && (
        <div className="card-header bg-gradient-to-r from-surface to-surface-2/30">
          <div className="flex items-center gap-3">
            <span className="relative grid h-9 w-9 place-items-center overflow-hidden rounded-xl">
              <span className="absolute inset-0 bg-gradient-to-br from-brand-400 to-brand-600 animate-gradient" />
              <Sparkles size={16} className="relative text-white" aria-hidden="true" />
            </span>
            <div>
              <h2 className="card-title text-fg font-bold tracking-tight">AI Safety Copilot</h2>
              <p className="text-xs text-fg-3">Grounded answers, cited to real reports. No citation, no answer.</p>
            </div>
          </div>
        </div>
      )}

      <div
        ref={listRef}
        className={`scrollbar-slim min-h-0 flex-1 space-y-4 overflow-y-auto ${isCompact ? 'py-3' : 'p-4'}`}
      >
        {messages.length === 0 && (
          <div className="flex h-full flex-col justify-center gap-4 max-w-xl mx-auto py-6">
            <p className="eyebrow text-center flex items-center justify-center gap-1.5 text-fg-3">
              <Sparkles size={11} className="text-brand-500 animate-pulse-soft" />
              {isCompact ? 'Ask about this report or the wider corpus' : 'Try asking the safety repository'}
            </p>
            <div className="grid gap-2 sm:grid-cols-1 md:grid-cols-2">
              {SUGGESTED_PROMPTS.map((p, idx) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => send(p)}
                  className="rounded-xl border border-line bg-gradient-to-b from-surface to-surface-2/40 px-3.5 py-3 text-left text-xs leading-relaxed text-fg-2
                    transition-all duration-250 ease-out-standard hover:-translate-y-0.5 hover:border-brand-300 dark:hover:border-brand-500/40 hover:bg-brand-50/30 dark:hover:bg-brand-500/5 hover:text-brand-800 dark:hover:text-brand-300 hover:shadow-md animate-fade-up"
                  style={{ animationDelay: `${idx * 40}ms` }}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((m, i) =>
            m.role === 'user' ? (
              <div key={i} className="flex justify-end gap-3 animate-fade-up">
                <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-gradient-to-br from-brand-600 to-brand-700 px-4 py-3 text-sm leading-relaxed text-white shadow-[0_4px_16px_-4px_rgb(var(--color-brand-600)/0.4)]">
                  {m.text}
                </div>
                <Avatar icon={User} tone="slate" />
              </div>
            ) : (
              <AssistantBubble key={i} message={m} reduceMotion={reduceMotion} />
            )
          )}
        </AnimatePresence>

        {mutation.isPending && (
          <div className="flex gap-3 animate-fade-up">
            <Avatar icon={Bot} tone="brand" />
            <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-sm border border-line bg-gradient-to-b from-surface to-surface-2/30 px-4 py-3.5 shadow-sm">
              <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-brand-500" />
              <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-brand-500 [animation-delay:0.15s]" />
              <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-brand-500 [animation-delay:0.3s]" />
              <span className="sr-only">Copilot is thinking</span>
            </div>
          </div>
        )}
      </div>

      <form
        className="flex items-center gap-2 border-t border-line p-3 bg-gradient-to-b from-surface/50 to-surface-2/50"
        onSubmit={(e) => {
          e.preventDefault()
          send()
        }}
      >
        <label className="sr-only" htmlFor={inputId}>
          Ask the Safety Copilot
        </label>
        <div className="relative flex-1">
          <input
            id={inputId}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask the Safety Copilot…"
            className="input pr-10"
          />
          <kbd className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none hidden items-center gap-0.5 rounded border border-line-2 bg-surface-2 px-1.5 font-mono text-[9px] font-medium text-fg-3 shadow-sm sm:flex">
            <CornerDownLeft size={8} /> Enter
          </kbd>
        </div>
        <button
          type="submit"
          disabled={mutation.isPending || !input.trim()}
          className="btn-primary shrink-0 p-2.5 rounded-lg shadow-sm"
          aria-label="Send"
        >
          <Send size={15} aria-hidden="true" />
        </button>
      </form>
    </div>
  )
}