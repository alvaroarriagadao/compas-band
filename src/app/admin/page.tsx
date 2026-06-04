'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, UserCheck, UserX, RefreshCw, Search } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

const ADMIN_EMAIL = 'alvaro.arriagada101@gmail.com'

interface Profile {
  id: string
  display_name: string | null
  email: string | null
  is_active: boolean
  created_at: string
}

export default function AdminPage() {
  const router = useRouter()
  const { user, loading } = useAuth()
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [fetching, setFetching] = useState(true)
  const [search, setSearch] = useState('')
  const [toggling, setToggling] = useState<string | null>(null)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const any = supabase as any

  useEffect(() => {
    if (!loading) {
      if (!user) { router.replace('/login'); return }
      if (user.email !== ADMIN_EMAIL) { router.replace('/'); return }
      loadProfiles()
    }
  }, [user, loading]) // eslint-disable-line

  async function loadProfiles() {
    setFetching(true)
    const { data } = await any.from('profiles').select('*').order('created_at', { ascending: false })
    setProfiles(data || [])
    setFetching(false)
  }

  async function toggleActive(profile: Profile) {
    setToggling(profile.id)
    const newStatus = !profile.is_active
    await any.from('profiles').update({ is_active: newStatus }).eq('id', profile.id)
    setProfiles(ps => ps.map(p => p.id === profile.id ? { ...p, is_active: newStatus } : p))
    setToggling(null)
  }

  const filtered = profiles.filter(p => {
    const q = search.toLowerCase()
    return (
      p.email?.toLowerCase().includes(q) ||
      p.display_name?.toLowerCase().includes(q)
    )
  })

  const active = profiles.filter(p => p.is_active).length
  const inactive = profiles.filter(p => !p.is_active).length

  if (loading || (!user && !loading)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-7 h-7 rounded-full border-2 animate-spin"
          style={{ borderColor: 'var(--border)', borderTopColor: 'var(--accent)' }} />
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-24" style={{ background: 'var(--bg-base)' }}>
      <div className="max-w-2xl mx-auto px-4 pt-6">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/" className="p-2 rounded-xl" style={{ color: 'var(--text-muted)' }}>
            <ArrowLeft size={17} />
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-black" style={{ color: 'var(--text-primary)' }}>Panel de usuarios</h1>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Admin · {ADMIN_EMAIL}</p>
          </div>
          <button
            onClick={loadProfiles}
            className="p-2.5 rounded-xl"
            style={{ background: 'var(--bg-card)', color: 'var(--text-muted)' }}
          >
            <RefreshCw size={15} className={fetching ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: 'Total', value: profiles.length, color: 'var(--text-primary)' },
            { label: 'Activos', value: active, color: 'var(--green)' },
            { label: 'Inactivos', value: inactive, color: 'var(--red)' },
          ].map(stat => (
            <div key={stat.label} className="rounded-2xl p-4 text-center"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <p className="text-2xl font-black" style={{ color: stat.color }}>{stat.value}</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Buscar por nombre o email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-3 rounded-2xl text-sm outline-none"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
            onFocus={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-bright)'}
            onBlur={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'}
          />
        </div>

        {/* User list */}
        {fetching ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 rounded-full border-2 animate-spin"
              style={{ borderColor: 'var(--border)', borderTopColor: 'var(--accent)' }} />
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.map(p => {
              const isAdmin = p.email === ADMIN_EMAIL
              const initials = p.display_name
                ? p.display_name.substring(0, 2).toUpperCase()
                : p.email?.substring(0, 2).toUpperCase() || '?'

              return (
                <div
                  key={p.id}
                  className="flex items-center gap-3 p-4 rounded-2xl"
                  style={{
                    background: 'var(--bg-card)',
                    border: `1px solid ${p.is_active ? 'var(--border)' : 'rgba(239,68,68,0.2)'}`,
                    opacity: p.is_active ? 1 : 0.7,
                  }}
                >
                  {/* Avatar */}
                  <div
                    className="w-10 h-10 rounded-2xl flex items-center justify-center text-sm font-black flex-shrink-0"
                    style={{
                      background: p.is_active ? 'var(--bg-elevated)' : 'rgba(239,68,68,0.1)',
                      color: p.is_active ? 'var(--text-primary)' : 'var(--red)',
                    }}
                  >
                    {initials}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                        {p.display_name || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Sin nombre</span>}
                      </p>
                      {isAdmin && (
                        <span className="text-xs px-1.5 py-0.5 rounded-lg font-bold flex-shrink-0"
                          style={{ background: 'rgba(245,158,11,0.15)', color: 'var(--accent)' }}>
                          admin
                        </span>
                      )}
                      {!p.is_active && (
                        <span className="text-xs px-1.5 py-0.5 rounded-lg font-bold flex-shrink-0"
                          style={{ background: 'rgba(239,68,68,0.12)', color: 'var(--red)' }}>
                          inactivo
                        </span>
                      )}
                    </div>
                    <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{p.email}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)', opacity: 0.6 }}>
                      Desde {new Date(p.created_at).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>

                  {/* Toggle — no tocar el admin */}
                  {!isAdmin && (
                    <button
                      onClick={() => toggleActive(p)}
                      disabled={toggling === p.id}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold flex-shrink-0 transition-all"
                      style={{
                        background: p.is_active ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
                        color: p.is_active ? 'var(--red)' : 'var(--green)',
                        border: `1px solid ${p.is_active ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)'}`,
                        opacity: toggling === p.id ? 0.5 : 1,
                      }}
                    >
                      {toggling === p.id ? (
                        <RefreshCw size={12} className="animate-spin" />
                      ) : p.is_active ? (
                        <><UserX size={12} /> Desactivar</>
                      ) : (
                        <><UserCheck size={12} /> Activar</>
                      )}
                    </button>
                  )}
                </div>
              )
            })}

            {filtered.length === 0 && (
              <div className="text-center py-10" style={{ color: 'var(--text-muted)' }}>
                <p>No se encontraron usuarios</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
