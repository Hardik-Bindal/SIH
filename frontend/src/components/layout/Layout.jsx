import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import FloatingAssistant from '../copilot/FloatingAssistant'

const TITLES = {
  '/dashboard': 'Executive Dashboard',
  '/incidents': 'Incident Explorer',
  '/memory': 'Safety Memory',
  '/sites': 'Site Intelligence',
  '/areas': 'Area Intelligence',
  '/hazards': 'Hazard Analytics',
  '/lsr': 'Life Saving Rule Dashboard',
  '/recommendations': 'AI Recommendations',
  '/copilot': 'Kavach AI Assistant',
  '/graph': 'Knowledge Graph',
  '/report': 'Report Incident',
}

function titleFor(pathname) {
  if (TITLES[pathname]) return TITLES[pathname]
  if (pathname.startsWith('/incidents/')) return 'Incident Deep Analysis'
  return 'Kavach AI'
}

const COLLAPSE_KEY = 'kavach.sidebar.collapsed'

export default function Layout() {
  const [navOpen, setNavOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === '1'
    } catch {
      return false
    }
  })
  const location = useLocation()

  const toggleCollapse = () => {
    setCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0')
      } catch { /* noop */ }
      return next
    })
  }

  return (
    <div className="flex h-screen overflow-hidden bg-bg">
      {/* Ambient background mesh — subtle premium touch */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 opacity-60 dark:opacity-40"
        style={{
          backgroundImage:
            'radial-gradient(circle at 15% 10%, rgb(var(--color-brand-500) / 0.06), transparent 45%), radial-gradient(circle at 85% 90%, rgb(var(--color-brand-400) / 0.05), transparent 45%)',
        }}
      />

      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <Sidebar
        open={navOpen}
        onClose={() => setNavOpen(false)}
        collapsed={collapsed}
        onToggleCollapse={toggleCollapse}
      />
      <div className="relative flex min-w-0 flex-1 flex-col overflow-y-auto">
        <Topbar onMenuClick={() => setNavOpen(true)} title={titleFor(location.pathname)} />
        <main id="main-content" tabIndex={-1} className="flex-1 p-4 lg:p-6 xl:p-8">
          <div className="animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>
      <FloatingAssistant />
    </div>
  )
}