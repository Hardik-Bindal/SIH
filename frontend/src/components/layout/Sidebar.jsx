import { NavLink, Link } from 'react-router-dom'
import {
  LayoutDashboard,
  Search,
  BrainCircuit,
  Factory,
  Map as MapIcon,
  FlaskConical,
  ShieldCheck,
  ClipboardList,
  MessageSquareText,
  Share2,
  Building2,
  ShieldHalf,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react'

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Executive Dashboard', icon: LayoutDashboard, end: true },
  { to: '/incidents', label: 'Incident Explorer', icon: Search },
  { to: '/memory', label: 'Safety Memory', icon: BrainCircuit },
  { to: '/sites', label: 'Site Intelligence', icon: Factory },
  { to: '/areas', label: 'Area Intelligence', icon: Building2 },
  { to: '/hazards', label: 'Hazard Analytics', icon: MapIcon },
  { to: '/lsr', label: 'Life Saving Rules', icon: ShieldCheck },
  { to: '/recommendations', label: 'AI Recommendations', icon: ClipboardList },
  { to: '/copilot', label: 'AI Safety Copilot', icon: MessageSquareText },
  { to: '/graph', label: 'Knowledge Graph', icon: Share2 },
]

export default function Sidebar({ open, onClose, collapsed, onToggleCollapse }) {
  return (
    <>
      {open && (
        <button
          aria-label="Close navigation"
          className="fixed inset-0 z-30 bg-fg/60 backdrop-blur-sm animate-fade-in lg:hidden"
          onClick={onClose}
        />
      )}
      <nav
        id="primary-nav"
        aria-label="Primary"
        className={`fixed inset-y-0 left-0 z-40 flex shrink-0 flex-col gap-1 overflow-y-auto overflow-x-hidden
          border-r border-line bg-surface/95 backdrop-blur-xl px-3 py-4 scrollbar-slim
          transition-all duration-250 ease-out-standard lg:static lg:z-0 lg:translate-x-0
          ${open ? 'translate-x-0 shadow-lifted' : '-translate-x-full'}
          ${collapsed ? 'w-64 lg:w-[4.75rem]' : 'w-64'}`}
      >
        {/* Brand header */}
        <div className="mb-5 flex items-center gap-1">
          <Link
            to="/"
            onClick={onClose}
            title="SIF Sentinel AI — back to overview"
            className={`group flex min-w-0 items-center gap-2.5 rounded-lg py-1.5 transition-all duration-250
              hover:bg-surface-2 ${collapsed ? 'lg:justify-center lg:px-0' : 'px-2'}`}
          >
            <span className="relative grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-lg shadow-card-hover">
              {/* Animated gradient bg */}
              <span
                className="absolute inset-0 bg-gradient-to-br from-brand-400 via-brand-600 to-brand-800"
                style={{ backgroundSize: '200% 200%' }}
              />
              <span className="absolute inset-0 bg-gradient-conic from-brand-500/40 via-transparent to-brand-700/40 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
              <ShieldHalf className="relative text-white drop-shadow-sm" size={19} aria-hidden="true" />
            </span>
            <span className={`min-w-0 ${collapsed ? 'lg:hidden' : ''}`}>
              <span className="block truncate font-display text-sm font-bold leading-tight text-fg">
                SIF Sentinel AI
              </span>
              <span className="block truncate text-2xs leading-tight text-fg-3">Oil India Limited</span>
            </span>
          </Link>

          {!collapsed && (
            <button
              type="button"
              onClick={onToggleCollapse}
              aria-expanded
              aria-controls="primary-nav"
              aria-label="Collapse sidebar"
              title="Collapse sidebar"
              className="ml-auto hidden shrink-0 rounded-lg p-1.5 text-fg-3 transition-all duration-180
                hover:bg-surface-2 hover:text-fg lg:block"
            >
              <PanelLeftClose size={17} aria-hidden="true" />
            </button>
          )}
        </div>

        {collapsed && (
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-expanded={false}
            aria-controls="primary-nav"
            aria-label="Expand sidebar"
            title="Expand sidebar"
            className="mx-auto mb-1 hidden rounded-lg p-2 text-fg-3 transition-all duration-180 hover:bg-surface-2 hover:text-fg lg:block"
          >
            <PanelLeftOpen size={17} aria-hidden="true" />
          </button>
        )}

        {/* Nav items */}
        <div className="flex flex-col gap-0.5">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }, i) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={onClose}
              title={collapsed ? label : undefined}
              style={{ animationDelay: `${i * 30}ms` }}
              className={({ isActive }) =>
                `nav-link animate-fade-up ${isActive ? 'nav-link-active' : ''} ${
                  collapsed ? 'lg:justify-center lg:px-2' : ''
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    size={18}
                    className={`shrink-0 transition-transform duration-180 ${
                      isActive ? 'scale-110' : 'group-hover:scale-110'
                    }`}
                    aria-hidden="true"
                  />
                  <span className={`truncate ${collapsed ? 'lg:hidden' : ''}`}>{label}</span>
                  {isActive && !collapsed && (
                    <span
                      aria-hidden="true"
                      className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500 shadow-[0_0_8px_1px_rgb(var(--color-brand-500)/0.8)]"
                    />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </div>

        {/* Footer disclosure */}
        <div
          className={`mt-auto flex items-start gap-1.5 rounded-xl border border-line bg-gradient-to-br from-surface-2 to-surface-3/50 px-2.5 py-2.5 text-[11px] leading-snug text-fg-3
            ${collapsed ? 'lg:justify-center lg:px-2' : ''}`}
          title={
            collapsed
              ? 'Some fields shown are honestly-disclosed demo/synthetic data. See docs/DEVIATIONS.md.'
              : undefined
          }
        >
          <FlaskConical size={13} className="mt-0.5 shrink-0 text-brand-500" aria-hidden="true" />
          <span className={collapsed ? 'lg:hidden' : ''}>
            Some fields shown are honestly-disclosed demo/synthetic data. See{' '}
            <span className="font-mono text-fg-2">docs/DEVIATIONS.md</span>.
          </span>
        </div>
      </nav>
    </>
  )
}