'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plus, ChevronRight, LogOut, Users, Music2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { signOut, generateAccessCode, slugify } from '@/lib/auth'
import { useAuth } from '@/contexts/AuthContext'
import type { Project } from '@/lib/database.types'

export default function HomePage() {
  const router = useRouter()
  const { user, loading } = useAuth()
  const [projects, setProjects] = useState<Project[]>([])
  const [fetching, setFetching] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [user, loading, router])

  useEffect(() => {
    if (user) loadProjects()
  }, [user]) // eslint-disable-line

  async function loadProjects() {
    if (!user) return

    // Get owned + member projects
    const [owned, memberships] = await Promise.all([
      supabase.from('projects').select('*').eq('owner_id', user.id).order('created_at', { ascending: false }),
      supabase.from('project_members').select('project_id').eq('user_id', user.id),
    ])

    const memberIds = (memberships.data || []).map(m => m.project_id)
    let allProjects = owned.data || []

    if (memberIds.length > 0) {
      const { data: memberProjects } = await supabase
        .from('projects')
        .select('*')
        .in('id', memberIds)
        .neq('owner_id', user.id)
      allProjects = [...allProjects, ...(memberProjects || [])]
    }

    setProjects(allProjects)
    setFetching(false)
  }

  async function createProject() {
    if (!newName.trim() || !user) return
    setSaving(true)
    const slug = slugify(newName)
    const code = generateAccessCode()
    const { data } = await supabase
      .from('projects')
      .insert({
        name: newName.trim(),
        description: newDesc.trim() || null,
        owner_id: user.id,
        slug,
        access_code: code,
      })
      .select().single()
    if (data) setProjects([data, ...projects])
    setNewName(''); setNewDesc(''); setShowNew(false); setSaving(false)
  }

  async function handleSignOut() {
    await signOut()
    router.replace('/login')
  }

  if (loading || (!user && !loading)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-7 h-7 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--border)', borderTopColor: 'var(--accent)' }} />
      </div>
    )
  }

  return (
    <div className="min-h-screen px-4 py-8 max-w-xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-10 fade-in">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', boxShadow: '0 0 24px rgba(245,158,11,0.3)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="#000">
              <path d="M9 3v11.55A4 4 0 1 0 11 18V7h6V3H9z"/>
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight leading-none" style={{ color: 'var(--text-primary)' }}>Compás</h1>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{user?.email}</p>
          </div>
        </div>
        <button onClick={handleSignOut} className="p-2.5 rounded-xl transition-colors" style={{ color: 'var(--text-muted)' }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'}
          title="Cerrar sesión"
        >
          <LogOut size={16} />
        </button>
      </div>

      {/* New project */}
      {!showNew ? (
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setShowNew(true)}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed text-sm font-medium transition-all duration-200"
            style={{ borderColor: 'var(--border-bright)', color: 'var(--text-secondary)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'; (e.currentTarget as HTMLElement).style.color = 'var(--accent)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-bright)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)' }}
          ><Plus size={15} /> Nuevo Proyecto</button>
          <Link href="/join"
            className="flex items-center gap-1.5 px-4 py-3 rounded-2xl text-sm font-medium transition-all"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-bright)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'}
          >
            <Users size={14} /> Unirse
          </Link>
        </div>
      ) : (
        <div className="rounded-2xl p-5 mb-6 fade-in" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-bright)' }}>
          <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--accent)' }}>Nuevo proyecto</p>
          <input autoFocus type="text" placeholder="Nombre del proyecto"
            value={newName} onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') createProject(); if (e.key === 'Escape') setShowNew(false) }}
            className="w-full px-4 py-3 rounded-xl text-sm mb-3 outline-none"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
          />
          <input type="text" placeholder="Descripción (opcional)"
            value={newDesc} onChange={e => setNewDesc(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') createProject(); if (e.key === 'Escape') setShowNew(false) }}
            className="w-full px-4 py-3 rounded-xl text-sm mb-4 outline-none"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
          />
          <div className="flex gap-2">
            <button onClick={createProject} disabled={saving || !newName.trim()}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold"
              style={{ background: 'var(--accent)', color: '#000', opacity: (!newName.trim() || saving) ? 0.5 : 1 }}>
              {saving ? 'Creando...' : 'Crear proyecto'}
            </button>
            <button onClick={() => { setShowNew(false); setNewName(''); setNewDesc('') }}
              className="px-4 py-2.5 rounded-xl text-sm"
              style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Projects */}
      {fetching ? (
        <div className="flex justify-center py-16">
          <div className="w-7 h-7 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--border)', borderTopColor: 'var(--accent)' }} />
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-20 fade-in">
          <div className="text-6xl mb-4">🎸</div>
          <p className="font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>Aún no tienes proyectos</p>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Crea uno o únete con un código de banda</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {projects.map((project, i) => (
            <Link key={project.id} href={`/projects/${project.id}`}
              className="group flex items-center p-4 gap-4 rounded-2xl transition-all duration-200 fade-in"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', animationDelay: `${i * 40}ms` }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-bright)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'}
            >
              {project.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={project.logo_url} alt="" className="w-12 h-12 rounded-2xl object-cover flex-shrink-0" />
              ) : (
                <div className="w-12 h-12 rounded-2xl flex-shrink-0 flex items-center justify-center" style={{ background: 'var(--bg-elevated)' }}>
                  <Music2 size={20} style={{ color: 'var(--text-muted)' }} />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-bold truncate" style={{ color: 'var(--text-primary)' }}>{project.name}</p>
                {project.description && <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>{project.description}</p>}
                {project.access_code && (
                  <p className="text-xs mt-1 font-mono font-bold" style={{ color: 'var(--text-muted)' }}>
                    Código: <span style={{ color: 'var(--accent)' }}>{project.access_code}</span>
                  </p>
                )}
              </div>
              {project.owner_id !== user?.id && (
                <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>
                  colaborador
                </span>
              )}
              <ChevronRight size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
