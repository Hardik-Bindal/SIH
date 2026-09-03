import { useState, useEffect } from 'react'
import { NavLink, Link, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Search,
  FileText,
  BrainCircuit,
  Factory,
  FlaskConical,
  ShieldCheck,
  ClipboardList,
  Share2,
  Building2,
  ShieldHalf,
  ChevronDown,
  BarChart3,
  AlertTriangle,
  MessageSquareText,
  PanelLeftClose,
  PanelLeftOpen,
  X,
} from 'lucide-react'

/* ── Grouped navigation structure ──────────────────────────────────────── */

const NAV_GROUPS = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    to: '/dashboard',
  },
  {
    id: 'intelligence',
    label: 'Safety Intelligence',
    icon: BarChart3,
    children: [
      { to: '/hazards', label: 'Hazard Analytics', icon: AlertTriangle },
      { to: '/sites', label: 'Site Risk', icon: Factory },
      { to: '/areas', label: 'Area Risk', icon: Building2 },
      { to: '/lsr', label: 'LSR Dashboard', icon: ShieldCheck },
    ],
  },
  {
    id: 'incidents',
    label: 'Incidents',
    icon: FileText,
    children: [
      { to: '/incidents', label: 'Incident Explorer', icon: Search },
      { to: '/report', label: 'Submit Narrative', icon: FileText },
      { to: '/recommendations', label: 'AI Recommendations', icon: ClipboardList },
    ],
  },
  {
    id: 'knowledge',
    label: 'Knowledge',
    icon: BrainCircuit,
    children: [
      { to: '/memory', label: 'Safety Memory', icon: BrainCircuit },
      { to: '/graph', label: 'Knowledge Graph', icon: Share2 },
      { to: '/copilot', label: 'AI Copilot', icon: MessageSquareText },
    ],
  },
]

/* ── Helper: check if any child is active ──────────────────────────────── */

function isGroupActive(group, pathname) {
  if (group.to) return pathname === group.to
  return group.children?.some(
    (c) => pathname === c.to || pathname.startsWith(c.to + '/')
  )
}

/* ── Collapsible Nav Group ─────────────────────────────────────────────── */

function NavGroup({ group, onNavigate, collapsed, onExpand }) {
  const location = useLocation()
  const childActive = isGroupActive(group, location.pathname)

  // Auto-open if a child is active
  const [open, setOpen] = useState(childActive)

  useEffect(() => {
    if (childActive) setOpen(true)
  }, [childActive])

  const Icon = group.icon

  // Direct link (e.g. Dashboard)
  if (group.to) {
    return (
      <NavLink
        to={group.to}
        end
        onClick={(e) => {
          if (collapsed) { onExpand(); }
          onNavigate?.();
        }}
        title={collapsed ? group.label : undefined}
        className={({ isActive }) =>
          `sidebar-link ${isActive ? 'sidebar-link--active' : ''} ${
            collapsed ? 'lg:justify-center lg:px-2' : ''
          }`
        }
      >
        <Icon size={18} className="sidebar-link__icon" aria-hidden="true" />
        <span className={`sidebar-link__label ${collapsed ? 'lg:hidden' : ''}`}>{group.label}</span>
      </NavLink>
    )
  }

  // Group with children — click to expand/collapse
  return (
    <div className="sidebar-group">
      <button
        type="button"
        onClick={() => {
          if (collapsed) { onExpand(); setOpen(true); return; }
          setOpen((v) => !v)
        }}
        title={collapsed ? group.label : undefined}
        className={`sidebar-group__header ${childActive ? 'sidebar-group__header--active' : ''} ${
          collapsed ? 'lg:justify-center lg:px-2' : ''
        }`}
        aria-expanded={open && !collapsed}
      >
        <Icon size={18} className="sidebar-link__icon" aria-hidden="true" />
        <span className={`sidebar-link__label ${collapsed ? 'lg:hidden' : ''}`}>{group.label}</span>
        {!collapsed && (
          <ChevronDown
            size={15}
            className={`sidebar-group__chevron ${open ? 'sidebar-group__chevron--open' : ''}`}
            aria-hidden="true"
          />
        )}
        {childActive && collapsed && (
          <span
            aria-hidden="true"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full bg-brand-500 shadow-[0_0_6px_1px_rgb(var(--color-brand-500)/0.7)] lg:block hidden"
          />
        )}
      </button>

      {/* Animated submenu — hidden when sidebar is collapsed */}
      {!collapsed && (
        <div
          className="sidebar-submenu"
          style={{
            gridTemplateRows: open ? '1fr' : '0fr',
          }}
        >
          <div className="sidebar-submenu__inner">
            {group.children.map((child) => {
              const CIcon = child.icon
              return (
                <NavLink
                  key={child.to}
                  to={child.to}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    `sidebar-sublink ${isActive ? 'sidebar-sublink--active' : ''}`
                  }
                >
                  <CIcon size={15} className="sidebar-sublink__icon" aria-hidden="true" />
                  <span className="sidebar-sublink__label">{child.label}</span>
                </NavLink>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Main Sidebar ──────────────────────────────────────────────────────── */

export default function Sidebar({ open, onClose, collapsed, onToggleCollapse }) {
  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <button
          aria-label="Close navigation"
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      <nav
        id="primary-nav"
        aria-label="Primary"
        className={`sidebar ${open ? 'sidebar--open' : ''} ${
          collapsed ? 'lg:w-[4.5rem]' : ''
        }`}
      >
        {/* Brand header */}
        <div className="sidebar__brand">
          <Link
            to="/"
            onClick={onClose}
            title="Kavach AI — Knowledge-driven AI for Vigilance and Critical Hazard Prevention"
            className={`sidebar__brand-link ${collapsed ? 'lg:justify-center lg:px-0' : ''}`}
          >
            <span className="sidebar__brand-icon">
              <span className="sidebar__brand-icon-bg" />
              <ShieldHalf className="relative text-white drop-shadow-sm" size={20} aria-hidden="true" />
            </span>
            <span className={`sidebar__brand-text ${collapsed ? 'lg:hidden' : ''}`}>
              <span className="sidebar__brand-name">KAVACH AI</span>
              <span className="sidebar__brand-tagline">Safety Intelligence</span>
            </span>
          </Link>

          {/* Desktop collapse toggle */}
          {!collapsed && (
            <button
              type="button"
              onClick={onToggleCollapse}
              aria-label="Collapse sidebar"
              title="Collapse sidebar"
              className="sidebar__collapse-btn hidden lg:block"
            >
              <PanelLeftClose size={17} aria-hidden="true" />
            </button>
          )}

          {/* Mobile close button */}
          <button
            type="button"
            onClick={onClose}
            className="sidebar__close-btn lg:hidden"
            aria-label="Close sidebar"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {/* Expand button (when collapsed) */}
        {collapsed && (
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label="Expand sidebar"
            title="Expand sidebar"
            className="sidebar__collapse-btn mx-auto mb-1 hidden lg:block"
          >
            <PanelLeftOpen size={17} aria-hidden="true" />
          </button>
        )}

        {/* Section label */}
        {!collapsed && <p className="sidebar__section-label">Navigation</p>}

        {/* Nav groups */}
        <div className="sidebar__nav">
          {NAV_GROUPS.map((group) => (
            <NavGroup
              key={group.id}
              group={group}
              collapsed={collapsed}
              onNavigate={onClose}
              onExpand={() => onToggleCollapse?.()}
            />
          ))}
        </div>

        {/* Footer disclosure */}
        <div className={`sidebar__footer ${collapsed ? 'lg:justify-center lg:px-2' : ''}`}
          title={collapsed ? 'Demo data — synthetic fields. See DEVIATIONS.md.' : undefined}
        >
          <FlaskConical size={13} className="mt-0.5 shrink-0 text-brand-500" aria-hidden="true" />
          <span className={collapsed ? 'lg:hidden' : ''}>
            <span className="font-semibold text-brand-400">Demo data</span> — some fields are
            synthetic. See{' '}
            <span className="font-mono text-[10px] text-fg-2">DEVIATIONS.md</span>
          </span>
        </div>
      </nav>
    </>
  )
}
