'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Music2, CalendarDays } from 'lucide-react'

export function BottomNav() {
  const path = usePathname()
  const isLogin = path === '/login' || path === '/join'
  if (isLogin) return null

  const tabs = [
    { href: '/', icon: Music2, label: 'Proyectos', active: path === '/' },
    { href: '/calendar', icon: CalendarDays, label: 'Calendario', active: path.startsWith('/calendar') },
  ]

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 flex"
      style={{
        background: 'rgba(10,10,18,0.97)',
        borderTop: '1px solid var(--border)',
        backdropFilter: 'blur(16px)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {tabs.map(tab => {
        const Icon = tab.icon
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className="flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-all"
            style={{ color: tab.active ? 'var(--accent)' : 'var(--text-muted)' }}
          >
            <Icon size={20} strokeWidth={tab.active ? 2.5 : 1.8} />
            <span style={{ fontSize: 10, fontWeight: tab.active ? 700 : 500 }}>{tab.label}</span>
            {tab.active && (
              <div className="absolute top-0" style={{ width: 32, height: 2, background: 'var(--accent)', borderRadius: '0 0 2px 2px' }} />
            )}
          </Link>
        )
      })}
    </nav>
  )
}
