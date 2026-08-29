import { Menu, RotateCcw, Sun, Moon, Bell, Search as SearchIcon } from 'lucide-react'
import { useFilterStore, AREAS } from '../../store/filterStore'
import { useSiteAnalytics } from '../../api/queries'
import { rowLabel } from '../../lib/format'
import { useTheme } from '../../lib/theme'

function ThemeToggle() {
  const { theme, toggle, isDark } = useTheme()
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} theme`}
      title={`Switch to ${isDark ? 'light' : 'dark'} theme`}
      className="group relative grid h-9 w-9 place-items-center overflow-hidden rounded-lg border border-line bg-surface text-fg-2
        transition-all duration-250 ease-out-standard hover:border-line-2 hover:bg-surface-2 hover:text-fg
        focus-visible:ring-2 focus-visible:ring-brand-500/40"
    >
      {/* Sun */}
      <Sun
        size={16}
        className={`absolute transition-all duration-400 ease-spring
          ${theme === 'light' ? 'translate-y-0 rotate-0 opacity-100' : '-translate-y-6 rotate-90 opacity-0'}`}
        aria-hidden="true"
      />
      {/* Moon */}
      <Moon
        size={16}
        className={`absolute transition-all duration-400 ease-spring
          ${theme === 'dark' ? 'translate-y-0 rotate-0 opacity-100' : 'translate-y-6 -rotate-90 opacity-0'}`}
        aria-hidden="true"
      />
      {/* Glow on hover */}
      <span
        aria-hidden="true"
        className="absolute inset-0 rounded-lg bg-gradient-to-br from-brand-500/0 to-brand-500/0 transition-all duration-400
          group-hover:from-brand-500/10 group-hover:to-brand-700/10"
      />
    </button>
  )
}

const CONTROL =
  'h-9 rounded-lg border border-line bg-surface px-2.5 text-xs font-medium text-fg-2 transition-all duration-180 ' +
  'hover:border-line-2 hover:bg-surface-2 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20'

export default function Topbar({ onMenuClick, title }) {
  const { site, area, dateFrom, dateTo, setSite, setArea, setDateFrom, setDateTo, reset } = useFilterStore()
  const sitesQuery = useSiteAnalytics()
  const siteOptions = (sitesQuery.data || []).map((row) => rowLabel(row, 'site'))
  const hasFilters = Boolean(site || area || dateFrom || dateTo)

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-surface/70 backdrop-blur-xl backdrop-saturate-150">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 lg:px-6">
        <button
          type="button"
          onClick={onMenuClick}
          className="rounded-lg p-2 text-fg-2 transition-colors hover:bg-surface-2 lg:hidden"
          aria-label="Open navigation"
        >
          <Menu size={20} aria-hidden="true" />
        </button>

        <div className="mr-auto flex items-center gap-2.5 min-w-0">
          {/* Live indicator */}
          <span className="hidden items-center gap-1.5 rounded-full border border-risk-low-border/60 bg-risk-low-bg/50 px-2 py-0.5 text-2xs font-semibold uppercase tracking-wider text-risk-low sm:inline-flex">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-risk-low-solid opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-risk-low-solid" />
            </span>
            Live
          </span>
          <h1 className="truncate font-display text-base font-bold tracking-tight text-fg lg:text-lg">
            {title}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm">
          {/* Site filter */}
          <div className="relative">
            <label className="sr-only" htmlFor="global-site">Filter by site</label>
            <select
              id="global-site"
              value={site}
              onChange={(e) => setSite(e.target.value)}
              className={`${CONTROL} pl-2.5 pr-7 max-w-[9rem] appearance-none`}
              style={{ backgroundImage: 'none' }}
            >
              <option value="">All sites</option>
              {siteOptions.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <label className="sr-only" htmlFor="global-area">Filter by area</label>
          <select
            id="global-area"
            value={area}
            onChange={(e) => setArea(e.target.value)}
            className={`${CONTROL} pr-7 max-w-[8rem]`}
          >
            <option value="">All areas</option>
            {AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>

          <label className="sr-only" htmlFor="global-date-from">From date</label>
          <input
            id="global-date-from"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className={CONTROL}
          />
          <span className="text-xs text-fg-3">→</span>
          <label className="sr-only" htmlFor="global-date-to">To date</label>
          <input
            id="global-date-to"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className={CONTROL}
          />

          {hasFilters && (
            <button
              type="button"
              onClick={reset}
              className="inline-flex h-9 items-center gap-1 rounded-lg border border-brand-200 bg-brand-50 px-2.5 text-xs font-semibold text-brand-700 transition-all duration-180 hover:border-brand-300 hover:bg-brand-100 hover:shadow-glow"
            >
              <RotateCcw size={13} aria-hidden="true" />
              Reset
            </button>
          )}

          {/* Notification bell (visual only, ready for future feature) */}
          <button
            type="button"
            className="relative hidden h-9 w-9 items-center justify-center rounded-lg border border-line bg-surface text-fg-2 transition-all duration-180 hover:border-line-2 hover:bg-surface-2 hover:text-fg sm:inline-flex"
            aria-label="Notifications"
          >
            <Bell size={16} aria-hidden="true" />
            <span
              aria-hidden="true"
              className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-risk-critical-solid shadow-[0_0_6px_0_rgb(220_38_38/0.7)]"
            />
          </button>

          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}