import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ShieldHalf, ArrowRight, Brain, MessageSquareText, Sparkles, Activity,
  Search, GitBranch, FileText, Gauge,
  CircleAlert, TriangleAlert, Quote, Check, ExternalLink, Sun, Moon
} from 'lucide-react'
import PipelineFlow from '../components/diagrams/PipelineFlow'
import { useKpis } from '../api/queries'
import { formatNumber } from '../lib/format'
import { useTheme } from '../lib/theme'

const FALLBACK = { total_reports: 4813, high_or_above_pct: 65.3 }
const CORPUS_TOTAL = 16249
const FATALITY_COUNT = 11436

function Reveal({ children, delay = 0, className = '' }) {
  const ref = useRef(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduced || !('IntersectionObserver' in window)) {
      setShown(true)
      return
    }
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true)
          io.disconnect()
        }
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.05 }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={`transition-all duration-700 ease-out-expo ${
        shown ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
      } ${className}`}
    >
      {children}
    </div>
  )
}

function CountUp({ value, decimals = 0, suffix = '' }) {
  const [display, setDisplay] = useState(0)
  const ref = useRef(null)

  useEffect(() => {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduced || !('IntersectionObserver' in window)) {
      setDisplay(value)
      return
    }
    const el = ref.current
    if (!el) return
    let raf
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return
      io.disconnect()
      const start = performance.now()
      const tick = (now) => {
        const p = Math.min((now - start) / 1200, 1)
        setDisplay(value * (1 - Math.pow(1 - p, 4)))
        if (p < 1) raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
    })
    io.observe(el)
    return () => {
      io.disconnect()
      if (raf) cancelAnimationFrame(raf)
    }
  }, [value])

  return (
    <span ref={ref} className="tabular-nums">
      {decimals ? display.toFixed(decimals) : formatNumber(Math.round(display))}
      {suffix}
    </span>
  )
}

function SectionHeading({ eyebrow, title, children }) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      {eyebrow && (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-200/50 bg-brand-50/70 dark:border-brand-500/20 dark:bg-brand-500/10 px-3.5 py-1 text-2xs font-semibold uppercase tracking-[0.15em] text-brand-700 dark:text-brand-300">
          {eyebrow}
        </span>
      )}
      <h2 className="mt-4 text-balance text-3xl font-extrabold tracking-tight text-fg sm:text-4xl">
        {title}
      </h2>
      {children && <p className="mt-4 text-base leading-relaxed text-fg-2">{children}</p>}
    </div>
  )
}

export default function Landing() {
  const { data: kpis } = useKpis()
  const k = kpis || FALLBACK
  const [scrolled, setScrolled] = useState(false)
  const { theme, toggle, isDark } = useTheme()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className="min-h-screen bg-surface transition-colors duration-250">
      <a href="#main" className="skip-link">
        Skip to content
      </a>

      {/* ---------------- Nav ---------------- */}
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-all duration-250 ease-out-standard ${
          scrolled ? 'border-b border-line bg-surface/80 shadow-card backdrop-blur-xl backdrop-saturate-150' : 'bg-transparent'
        }`}
      >
        <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2.5">
            <div className="relative grid h-9 w-9 place-items-center overflow-hidden rounded-lg shadow-md">
              <span className="absolute inset-0 bg-gradient-to-br from-brand-500 via-brand-600 to-brand-800" />
              <ShieldHalf size={20} className="relative text-white" aria-hidden="true" />
            </div>
            <div className="leading-tight">
              <p className="font-display text-sm font-bold text-fg">Kavach AI</p>
              <p className="text-2xs text-fg-3">Safety Intelligence Platform</p>
            </div>
          </div>

          <div className="hidden items-center gap-8 md:flex">
            {[
              ['Problem', '#problem'],
              ['Safety Memory', '#memory'],
              ['Copilot', '#copilot'],
              ['How it works', '#pipeline'],
              ['Proof', '#proof'],
            ].map(([label, href]) => (
              <a
                key={href}
                href={href}
                className="text-sm font-semibold text-fg-2 transition-colors duration-180 hover:text-fg"
              >
                {label}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-3">
            {/* Inline Light/Dark Theme toggle */}
            <button
              type="button"
              onClick={toggle}
              aria-label="Toggle theme"
              className="grid h-9 w-9 place-items-center rounded-lg border border-line bg-surface text-fg-2 transition-all hover:bg-surface-2 hover:text-fg"
            >
              {isDark ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <Link
              to="/dashboard"
              className="btn-primary px-4.5 py-2 text-xs md:text-sm shadow-md"
            >
              Open dashboard
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </div>
        </nav>
      </header>

      <main id="main" tabIndex={-1}>
        {/* ---------------- Hero ---------------- */}
        <section className="relative overflow-hidden pb-24 pt-32 sm:pb-32 sm:pt-40 bg-gradient-to-b from-brand-50/50 via-surface to-surface dark:from-brand-950/20">
          {/* Animated aurora background orbs */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -left-42 -top-40 h-[38rem] w-[38rem] rounded-full bg-brand-200/40 dark:bg-brand-800/10 blur-[130px] animate-aurora" />
            <div
              className="absolute -right-32 top-20 h-[32rem] w-[32rem] rounded-full bg-brand-100/50 dark:bg-brand-900/10 blur-[130px] animate-aurora"
              style={{ animationDelay: '-7s' }}
            />
            <div
              className="absolute inset-0 opacity-[0.04] dark:opacity-[0.015]"
              style={{
                backgroundImage:
                  'linear-gradient(to right, rgb(var(--color-fg)) 1px, transparent 1px), linear-gradient(to bottom, rgb(var(--color-fg)) 1px, transparent 1px)',
                backgroundSize: '48px 48px',
                maskImage: 'radial-gradient(ellipse 60% 50% at 50% 40%, black, transparent)',
                WebkitMaskImage: 'radial-gradient(ellipse 60% 50% at 50% 40%, black, transparent)',
              }}
            />
          </div>

          <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-4xl text-center">
              <div className="animate-fade-up">
                <span className="inline-flex items-center gap-2 rounded-full border border-brand-200/80 bg-brand-100/50 dark:border-brand-500/20 dark:bg-brand-500/10 px-4 py-1.5 text-xs font-semibold text-brand-800 dark:text-brand-300 shadow-sm">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-500 opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand-600 dark:bg-brand-400" />
                  </span>
                  Smart India Hackathon 2026 · Team The Last Commit
                </span>
              </div>

              <h1
                className="animate-fade-up mt-7 text-balance font-display text-4xl font-extrabold leading-[1.08] tracking-tightest text-fg sm:text-5xl lg:text-[4.25rem]"
                style={{ animationDelay: '80ms' }}
              >
                Every fatality was a near miss
                <span className="block text-gradient-brand mt-1.5">somebody already filed.</span>
              </h1>

              <p
                className="animate-fade-up mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-fg-2"
                style={{ animationDelay: '160ms' }}
              >
                We read every report the way an expert investigator would — and raise the ones
                carrying SIF potential while the outcome can still be changed.
              </p>

              <div
                className="animate-fade-up mt-9 flex flex-wrap items-center justify-center gap-3.5"
                style={{ animationDelay: '240ms' }}
              >
                <Link
                  to="/dashboard"
                  className="btn-primary px-6 py-3 shadow-lg"
                >
                  Explore platform
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
                <Link
                  to="/memory"
                  className="btn-secondary px-6 py-3 shadow-sm"
                >
                  <Brain size={16} aria-hidden="true" className="text-brand-500 animate-pulse-soft" />
                  See Safety Memory
                </Link>
              </div>
            </div>

            {/* Live stats strip */}
            <Reveal delay={120}>
              <dl className="mx-auto mt-16 grid max-w-4xl grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line shadow-lifted sm:grid-cols-4">
                {[
                  { label: 'Records in memory', value: <CountUp value={CORPUS_TOTAL} /> },
                  { label: 'Reports scored', value: <CountUp value={k.total_reports} /> },
                  { label: 'Fatal cases retrievable', value: <CountUp value={FATALITY_COUNT} /> },
                  { label: 'SIF recall on test', value: <CountUp value={98.8} decimals={1} suffix="%" /> },
                ].map((s) => (
                  <div key={s.label} className="bg-surface px-5 py-6 text-center transition-colors hover:bg-surface-2/40">
                    <dt className="text-2xs font-bold uppercase tracking-[0.12em] text-fg-3">
                      {s.label}
                    </dt>
                    <dd className="mt-1.5 font-display text-2xl font-extrabold text-fg sm:text-3xl tabular-nums tracking-tight">
                      {s.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </Reveal>
          </div>
        </section>

        {/* ---------------- Problem ---------------- */}
        <section id="problem" className="scroll-mt-20 bg-surface py-24 transition-colors">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <SectionHeading eyebrow="The problem" title="A reporting system stores a narrative. It does not read it.">
              Thousands of reports a month. The signal in each one is locked inside free text.
            </SectionHeading>

            <div className="mt-14 grid gap-6 lg:grid-cols-3">
              {[
                {
                  icon: CircleAlert,
                  title: 'Reviewed in isolation',
                  body: 'The fourth occurrence is investigated as if it were the first.',
                },
                {
                  icon: TriangleAlert,
                  title: 'Severity is recorded, not predicted',
                  body: 'Systems capture what happened — never what could have happened.',
                },
                {
                  icon: Search,
                  title: 'Nobody can search 15,000 fatalities',
                  body: 'Institutional memory is the only link to the fatality it resembles.',
                },
              ].map((c, i) => (
                <Reveal key={c.title} delay={i * 90}>
                  <div className="card-interactive h-full p-6 bg-gradient-to-b from-surface to-surface-2/30">
                    <div className="grid h-10 w-10 place-items-center rounded-xl bg-risk-critical-bg border border-risk-critical-border/40 shadow-sm">
                      <c.icon size={19} className="text-risk-critical" aria-hidden="true" />
                    </div>
                    <h3 className="mt-4 text-base font-bold text-fg">{c.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-fg-2">{c.body}</p>
                  </div>
                </Reveal>
              ))}
            </div>

            <Reveal delay={120}>
              <figure className="relative mx-auto mt-14 max-w-3xl overflow-hidden rounded-2xl border border-brand-200 dark:border-brand-500/20 border-l-4 border-l-brand-600 dark:border-l-brand-500 bg-brand-50/50 dark:bg-brand-500/5 p-8 sm:p-10 shadow-card">
                <Quote
                  size={120}
                  className="pointer-events-none absolute -right-6 -top-6 text-brand-600/5 dark:text-brand-400/5"
                  aria-hidden="true"
                />
                <blockquote className="relative font-display text-lg sm:text-xl font-bold leading-relaxed text-fg italic">
                  “Fatal injuries are rarely surprises. They are near misses that nobody read carefully
                  enough.”
                </blockquote>
                <figcaption className="relative mt-3 text-xs font-semibold tracking-wider uppercase text-brand-700 dark:text-brand-300">
                  The core thesis — SRS §2.3
                </figcaption>
              </figure>
            </Reveal>
          </div>
        </section>

        {/* ---------------- USP 1: Safety Memory ---------------- */}
        <section id="memory" className="scroll-mt-20 border-y border-line bg-bg py-24 transition-colors">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid items-center gap-14 lg:grid-cols-2 [&>*]:min-w-0">
              <Reveal>
                <span className="chip border-brand-200 bg-brand-100/40 text-brand-800 dark:border-brand-500/20 dark:bg-brand-500/10 dark:text-brand-300">
                  <Brain size={13} className="text-brand-600 dark:text-brand-400 animate-pulse-soft" aria-hidden="true" />
                  Flagship capability
                </span>
                <h2 className="mt-5 text-balance text-3xl font-extrabold tracking-tight text-fg sm:text-4xl">
                  An AI that remembers every safety incident ever reported.
                </h2>
                <p className="mt-5 text-base leading-relaxed text-fg-2">
                  Every new report is compared against all {formatNumber(CORPUS_TOTAL)} records the
                  moment it is filed.
                </p>
                <ul className="mt-7 space-y-4">
                  {[
                    ['Has this happened before?', 'Ranked matches with real, clickable report IDs.'],
                    ['What was the common cause?', 'A counted majority, always shown as “3 of 8”.'],
                    ['What should we do about it?', 'The precedent-driven action for the rule violated.'],
                  ].map(([t, b]) => (
                    <li key={t} className="flex gap-3">
                      <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-600 shadow-[0_2px_6px_-1px_rgb(var(--color-brand-600)/0.5)]">
                        <Check size={11} className="text-white" aria-hidden="true" strokeWidth={3} />
                      </span>
                      <span>
                        <span className="text-sm font-bold text-fg">{t}</span>{' '}
                        <span className="text-sm text-fg-2">{b}</span>
                      </span>
                    </li>
                  ))}
                </ul>
                <Link to="/memory" className="btn-primary mt-8 shadow-md">
                  Open Safety Memory
                  <ArrowRight size={15} aria-hidden="true" />
                </Link>
              </Reveal>

              <Reveal delay={140}>
                <div className="card overflow-hidden shadow-lifted">
                  <div className="flex items-center gap-2 border-b border-line bg-surface-2 px-4 py-2.5">
                    <span className="flex gap-1.5" aria-hidden="true">
                      <i className="h-2.5 w-2.5 rounded-full bg-risk-critical-solid" />
                      <i className="h-2.5 w-2.5 rounded-full bg-risk-medium-solid" />
                      <i className="h-2.5 w-2.5 rounded-full bg-risk-low-solid" />
                    </span>
                    <p className="text-2xs font-semibold text-fg-3">Safety Memory · live recall</p>
                  </div>

                  <div className="space-y-4 p-5 bg-gradient-to-b from-surface to-surface-2/10">
                    <div>
                      <p className="eyebrow mb-1.5">New report</p>
                      <p className="rounded-xl bg-surface-2/50 p-3.5 text-sm font-medium text-fg ring-1 ring-line">
                        Worker touched energized cable while replacing a junction box. Lockout was
                        not verified.
                      </p>
                    </div>

                    <div className="rounded-xl border border-risk-critical-border bg-gradient-to-br from-risk-critical-bg to-risk-critical-bg/30 p-4">
                      <p className="flex items-center gap-1.5 text-2xs font-bold uppercase tracking-wide text-risk-critical">
                        <TriangleAlert size={13} aria-hidden="true" className="animate-pulse-soft" />
                        Repeat fatal pattern
                      </p>
                      <p className="mt-1.5 text-sm leading-relaxed text-risk-critical font-medium">
                        Closely matches 6 cases that ended in a fatality. The same conditions have
                        already killed someone.
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      {[
                        ['FAT-10344', 'Worker electrocuted by junction box.', '60%', true],
                        ['INC-220802540', 'Employee pulling un-energized wire…', '59%', false],
                        ['FAT-8393', 'Worker electrocuted by junction box wire.', '58%', true],
                      ].map(([id, text, sim, fatal]) => (
                        <div
                          key={id}
                          className="flex min-w-0 items-center gap-2.5 rounded-xl px-3 py-2 text-xs bg-surface border border-line hover:border-line-2 shadow-sm"
                        >
                          <span className="w-9 shrink-0 font-bold tabular-nums text-brand-600">
                            {sim}
                          </span>
                          <span className="hidden shrink-0 font-mono text-2xs text-fg-3 sm:inline">{id}</span>
                          <span className="min-w-0 flex-1 truncate text-fg-2 font-medium">{text}</span>
                          {fatal && (
                            <span className="shrink-0 rounded bg-risk-critical-solid px-1.5 py-0.5 text-2xs font-bold text-white shadow-sm">
                              FATAL
                            </span>
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl bg-surface border border-line p-3.5">
                        <p className="eyebrow">Common cause</p>
                        <p className="mt-1.5 text-sm font-bold leading-snug text-fg">
                          Energy isolation (LOTO) not verified
                        </p>
                        <p className="mt-1 text-2xs font-semibold text-fg-3">
                          3 of 8 matched cases
                        </p>
                      </div>
                      <div className="rounded-xl border border-brand-200/60 bg-gradient-to-br from-brand-50 to-brand-100/50 dark:border-brand-500/20 dark:from-brand-500/10 dark:to-surface p-3.5">
                        <p className="eyebrow text-brand-700 dark:text-brand-300">Recommended action</p>
                        <p className="mt-1.5 text-sm font-bold leading-snug text-brand-900 dark:text-brand-200">
                          Verify and physically test isolation before work resumes.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ---------------- USP 2: Copilot ---------------- */}
        <section id="copilot" className="scroll-mt-20 overflow-hidden bg-surface py-24 transition-colors">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid items-center gap-14 lg:grid-cols-2 [&>*]:min-w-0">
              <Reveal className="lg:order-2">
                <span className="chip border-brand-200 bg-brand-100/40 text-brand-800 dark:border-brand-500/20 dark:bg-brand-500/10 dark:text-brand-300">
                  <MessageSquareText size={13} className="text-brand-600 dark:text-brand-400" aria-hidden="true" />
                  Flagship capability
                </span>
                <h2 className="mt-5 text-balance text-3xl font-extrabold tracking-tight text-fg sm:text-4xl">
                  Stop building dashboards. Just ask.
                </h2>
                <p className="mt-5 text-base leading-relaxed text-fg-2">
                  Four constraints in one sentence — hazard, season, threshold, failed control.
                  No filter bar composes that.
                </p>
                <ul className="mt-7 space-y-4">
                  {[
                    ['Shows what it understood', 'Parsed filters shown back; nothing dropped silently.'],
                    ['Explains an empty answer', 'Zero results? It names the binding constraint.'],
                    ['Never answers uncited', 'No real report ID behind it? It says so.'],
                  ].map(([t, b]) => (
                    <li key={t} className="flex gap-3">
                      <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-600 shadow-[0_2px_6px_-1px_rgb(var(--color-brand-600)/0.5)]">
                        <Check size={11} className="text-white" aria-hidden="true" strokeWidth={3} />
                      </span>
                      <span>
                        <span className="text-sm font-bold text-fg">{t}</span>{' '}
                        <span className="text-sm text-fg-2">{b}</span>
                      </span>
                    </li>
                  ))}
                </ul>
                <Link to="/copilot" className="btn-primary mt-8 shadow-md">
                  Ask the Copilot
                  <ArrowRight size={15} aria-hidden="true" />
                </Link>
              </Reveal>

              <Reveal delay={140} className="lg:order-1">
                <div className="card overflow-hidden shadow-lifted">
                  <div className="flex items-center gap-2 border-b border-line bg-surface-2 px-4 py-2.5">
                    <Sparkles size={13} className="text-brand-500" aria-hidden="true" />
                    <p className="text-2xs font-semibold text-fg-3">AI Safety Copilot</p>
                  </div>
                  <div className="space-y-4 p-5 bg-gradient-to-b from-surface to-surface-2/10">
                    <div className="flex justify-end animate-fade-up">
                      <p className="max-w-[85%] rounded-2xl rounded-br-sm bg-brand-600 px-3.5 py-2.5 text-sm text-white shadow-sm font-medium">
                        Show all work at height incidents during monsoon having SIF &gt; 90
                      </p>
                    </div>

                    <div className="space-y-3.5 rounded-2xl border border-line bg-surface p-4 shadow-sm animate-fade-up" style={{ animationDelay: '80ms' }}>
                      <div className="flex flex-wrap gap-1.5">
                        {['hazard: work at height', 'season: monsoon (Jun–Sep)', 'SIF > 90%'].map((f) => (
                          <span
                            key={f}
                            className="rounded-lg border border-brand-200 bg-brand-50/50 dark:border-brand-500/20 dark:bg-brand-500/10 px-2.5 py-0.5 text-2xs font-bold text-brand-800 dark:text-brand-300"
                          >
                            {f}
                          </span>
                        ))}
                      </div>

                      <p className="text-sm leading-relaxed text-fg-2">
                        <strong className="font-bold text-fg">357 reports</strong> match all 3
                        filters.
                      </p>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-xl border border-line bg-gradient-to-b from-surface to-surface-2/30 p-3">
                          <p className="text-2xs uppercase font-bold tracking-wide text-fg-3">
                            Most common site
                          </p>
                          <p className="mt-1 text-sm font-bold text-fg">Refinery Block A</p>
                          <p className="text-2xs font-semibold text-fg-3">43 of 357</p>
                        </div>
                        <div className="rounded-xl border border-line bg-gradient-to-b from-surface to-surface-2/30 p-3">
                          <p className="text-2xs uppercase font-bold tracking-wide text-fg-3">
                            Repeated barrier
                          </p>
                          <p className="mt-1 text-sm font-bold text-fg">
                            Fall protection missing
                          </p>
                          <p className="text-2xs font-semibold text-fg-3">357 of 357</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1.5 border-t border-line pt-3">
                        {['INC-220891725', 'INC-220896443', 'INC-220890859'].map((c) => (
                          <span
                            key={c}
                            className="rounded-md border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-2xs text-fg-2 font-medium"
                          >
                            {c}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ---------------- Pipeline ---------------- */}
        <section id="pipeline" className="scroll-mt-20 border-y border-line bg-bg py-24 transition-colors">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <SectionHeading eyebrow="How it works" title="Five layers, one path from sentence to action.">
              A raw narrative in at the left; an assigned action out at the right.
            </SectionHeading>

            <div className="mt-14">
              <PipelineFlow />
            </div>

            {/* Capability grid */}
            <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { icon: Gauge, t: 'Explainable SIF scoring', d: 'A calibrated probability, never shown without its evidence.' },
                { icon: Activity, t: 'Fatality Twin', d: 'The escalation chain a near miss was on, traced to real cases.' },
                { icon: Brain, t: 'Safety Memory', d: 'Automatic recall, plus the patterns nobody spotted.' },
                { icon: MessageSquareText, t: 'Grounded Copilot', d: 'Plain-language questions, every answer citing real reports.' },
                { icon: GitBranch, t: 'Knowledge graph', d: 'Which single control, if fixed, breaks the most pathways.' },
                { icon: FileText, t: 'Precedent-driven CAPA', d: 'Actions plus a shift-ready toolbox talk, exportable.' },
              ].map((f, i) => (
                <Reveal key={f.t} delay={i * 60}>
                  <div className="card-interactive h-full p-6 bg-gradient-to-b from-surface to-surface-2/30">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400">
                      <f.icon size={19} aria-hidden="true" />
                    </span>
                    <h3 className="mt-4 text-base font-bold text-fg">{f.t}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-fg-2">{f.d}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------- Proof ---------------- */}
        <section id="proof" className="scroll-mt-20 bg-surface py-24 transition-colors">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <SectionHeading eyebrow="Measured, not asserted" title="The numbers, on a held-out split.">
              Straight from the metrics file — including where a target is missed.
            </SectionHeading>

            <div className="mx-auto mt-12 grid max-w-4xl gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { v: 98.8, d: 1, label: 'SIF recall', sub: 'target ≥ 90.0%', suffix: '%' },
                { v: 96.9, d: 1, label: 'ROC-AUC', sub: 'target ≥ 88.0%', suffix: '%' },
                { v: 0.052, d: 3, label: 'Brier score', sub: 'calibration (lower = better)' },
                { v: 1034, d: 0, label: 'Held-out reports', sub: 'no leakage grouping' },
              ].map((m, i) => (
                <Reveal key={m.label} delay={i * 70}>
                  <div className="card h-full p-6 text-center bg-gradient-to-b from-surface to-surface-2/20">
                    <p className="font-display text-4xl font-extrabold text-brand-600 dark:text-brand-400 tracking-tight">
                      <CountUp value={m.v} decimals={m.d} suffix={m.suffix} />
                    </p>
                    <p className="mt-2 text-sm font-bold text-fg">{m.label}</p>
                    <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-risk-low-bg/60 px-2 py-0.5 text-2xs font-semibold text-risk-low">
                      <Check size={11} strokeWidth={3} aria-hidden="true" />
                      {m.sub}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>

            <Reveal delay={140}>
              <div className="mx-auto mt-10 max-w-3xl rounded-2xl border border-amber-300 dark:border-amber-500/20 border-l-4 border-l-amber-500 bg-amber-50/50 dark:bg-amber-500/5 p-5 shadow-card">
                <p className="text-sm leading-relaxed text-amber-900 dark:text-amber-200">
                  <strong className="font-bold">Built to be checked.</strong> Site and department
                  metadata are synthesised and labelled as such in the API. Every substitution and
                  measured limitation is written down in{' '}
                  <code className="rounded-md bg-amber-100 dark:bg-amber-500/20 px-1.5 py-0.5 text-xs font-mono text-amber-800 dark:text-amber-300">docs/DEVIATIONS.md</code>.
                </p>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ---------------- CTA ---------------- */}
        <section className="relative overflow-hidden border-y border-line bg-gradient-to-b from-brand-50 to-surface dark:from-brand-950/20 py-24">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            <div className="absolute left-1/2 top-1/2 h-[26rem] w-[46rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-200/40 dark:bg-brand-500/5 blur-[120px]" />
          </div>
          <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6">
            <h2 className="text-balance font-display text-3xl font-extrabold tracking-tight text-fg sm:text-4xl">
              The whole path, from a typed sentence to an assigned action.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-sm font-semibold text-fg-3">
              Running live on {formatNumber(CORPUS_TOTAL)} real OSHA records.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3.5">
              <Link to="/dashboard" className="btn-primary px-6 py-3 shadow-lg">
                Open the dashboard
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <a
                href="https://github.com/Hardik-Bindal/SIH"
                target="_blank"
                rel="noreferrer"
                className="btn-secondary px-6 py-3 shadow-md"
              >
                View the source
                <ExternalLink size={15} aria-hidden="true" />
              </a>
            </div>
          </div>
        </section>
      </main>

      {/* ---------------- Footer ---------------- */}
      <footer className="border-t border-line bg-surface py-10 transition-colors">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 sm:px-6 md:flex-row lg:px-8">
          <div className="flex items-center gap-2.5">
            <ShieldHalf size={18} className="text-brand-600" aria-hidden="true" />
            <p className="text-sm text-fg-2">
              <span className="font-bold text-fg">Kavach AI</span> · Team The Last Commit
            </p>
          </div>
          <p className="text-center text-xs text-fg-3 md:text-right font-medium">
            Smart India Hackathon 2026 · Prototype built on public OSHA datasets. Not a substitute for
            professional safety judgement.
          </p>
        </div>
      </footer>
    </div>
  )
}