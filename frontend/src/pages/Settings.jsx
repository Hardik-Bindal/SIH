import { Sun, Moon } from 'lucide-react'
import { useTheme } from '../lib/theme'

export default function Settings() {
  const { theme, setTheme } = useTheme()

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-fg">App Settings</h2>
          <p className="mt-1 text-sm text-fg-2">Manage your preferences and system settings.</p>
        </div>
      </div>

      <div className="space-y-6">
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
      </div>
    </div>
  )
}
