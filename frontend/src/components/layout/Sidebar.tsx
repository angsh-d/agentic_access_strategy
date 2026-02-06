import { NavLink, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  LayoutGrid,
  FolderOpen,
  FileText,
  Settings,
  Plus,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui'

interface NavItem {
  path: string
  label: string
  icon: React.ReactNode
}

const navItems: NavItem[] = [
  { path: '/', label: 'Dashboard', icon: <LayoutGrid className="w-5 h-5" /> },
  { path: '/cases', label: 'Cases', icon: <FolderOpen className="w-5 h-5" /> },
  { path: '/policies', label: 'Policies', icon: <FileText className="w-5 h-5" /> },
  { path: '/settings', label: 'Settings', icon: <Settings className="w-5 h-5" /> },
]

export function Sidebar() {
  const location = useLocation()

  return (
    <aside className="glass-sidebar fixed left-0 top-0 h-full w-64 flex flex-col z-40">
      {/* Logo / Brand */}
      <div className="h-16 flex items-center px-6 border-b border-grey-200/50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-grey-900 flex items-center justify-center">
            <svg
              className="w-5 h-5 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
          </div>
          <span className="font-semibold text-grey-900 tracking-tight">
            Access Strategy
          </span>
        </div>
      </div>

      {/* Quick Action */}
      <div className="px-4 py-4">
        <NavLink to="/cases/new">
          <Button
            variant="primary"
            size="md"
            className="w-full justify-start"
            leftIcon={<Plus className="w-4 h-4" />}
          >
            New Case
          </Button>
        </NavLink>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2 space-y-1">
        {navItems.map((item) => {
          const isActive = item.path === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(item.path)

          return (
            <NavLink
              key={item.path}
              to={item.path}
              className="block"
            >
              <motion.div
                className={cn(
                  'glass-nav-item flex items-center gap-3',
                  isActive && 'active'
                )}
                whileHover={{ x: 2 }}
                whileTap={{ scale: 0.98 }}
                transition={{ duration: 0.15 }}
              >
                <span className={cn(
                  'text-grey-500',
                  isActive && 'text-grey-900'
                )}>
                  {item.icon}
                </span>
                <span className={cn(
                  'text-sm text-grey-600',
                  isActive && 'text-grey-900 font-medium'
                )}>
                  {item.label}
                </span>
                {isActive && (
                  <ChevronRight className="w-4 h-4 text-grey-400 ml-auto" />
                )}
              </motion.div>
            </NavLink>
          )
        })}
      </nav>

      {/* Scenario Selector (Demo Mode) */}
      <div className="px-4 py-4 border-t border-grey-200/50">
        <div className="p-3 rounded-xl bg-grey-100/80">
          <p className="text-label mb-2">Demo Scenario</p>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-grey-700">
              Maria R.
            </span>
            <span className="text-xs text-grey-500">
              Ozempic PA
            </span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-grey-200/50">
        <p className="text-xs text-grey-400 text-center">
          Agentic Access v1.0
        </p>
      </div>
    </aside>
  )
}

export default Sidebar
