'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Music2, ChevronRight, Trash2, Edit2, Check, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Project } from '@/lib/database.types'

export default function HomePage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  useEffect(() => { loadProjects() }, [])

  async function loadProjects() {
    const { data } = await supabase.from('projects').select('*').order('created_at', { ascending: false })
    setProjects(data || [])
    setLoading(false)
  }

  async function createProject() {
    if (!newName.trim()) return
    setSaving(true)
    const { data } = await supabase
      .from('projects')
      .insert({ name: newName.trim(), description: newDesc.trim() || null })
      .select().single()
    if (data) setProjects([data, ...projects])
    setNewName(''); setNewDesc(''); setShowNew(false); setSaving(false)
  }

  async function deleteProject(id: string) {
    if (!confirm('¿Eliminar este proyecto y todas sus canciones?')) return
    await supabase.from('projects').delete().eq('id', id)
    setProjects(projects.filter(p => p.id !== id))
  }

  async function saveEdit(id: string) {
    if (!editName.trim()) return
    await supabase.from('projects').update({ name: editName.trim() }).eq('id', id)
    setProjects(projects.map(p => p.id === id ? { ...p, name: editName.trim() } : p))
    setEditingId(null)
  }

  return (
    <div className="min-h-screen px-4 py-10 max-w-xl mx-auto">
      {/* Header */}
      <div className="mb-10 fade-in">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: 'var(--accent)', boxShadow: '0 0 24px rgba(245,158,11,0.35)' }}>
            <Music2 size={22} color="#000" strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>BandUtils</h1>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Letras · Acordes · BPM</p>
          </div>
        </div>
      </div>

      {/* New project */}
      {!showNew ? (
        <button
          onClick={() => setShowNew(true)}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl border-2 border-dashed mb-6 text-sm font-medium transition-all duration-200"
          style={{ borderColor: 'var(--border-bright)', color: 'var(--text-secondary)' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'; (e.currentTarget as HTMLElement).style.color = 'var(--accent)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-bright)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)' }}
        >
          <Plus size={16} /> Nuevo Proyecto
        </button>
      ) : (
        <div className="rounded-2xl p-5 mb-6 fade-in" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-bright)' }}>
          <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--accent)' }}>Nuevo proyecto</p>
          <input
            autoFocus
            type="text"
            placeholder="Nombre del proyecto (ej: Pasó La Vieja)"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') createProject(); if (e.key === 'Escape') setShowNew(false) }}
            className="w-full px-4 py-3 rounded-xl text-sm mb-3 outline-none"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
          />
          <input
            type="text"
            placeholder="Descripción (opcional)"
            value={newDesc}
            onChange={e => setNewDesc(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') createProject(); if (e.key === 'Escape') setShowNew(false) }}
            className="w-full px-4 py-3 rounded-xl text-sm mb-4 outline-none"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
          />
          <div className="flex gap-2">
            <button
              onClick={createProject}
              disabled={saving || !newName.trim()}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all"
              style={{ background: 'var(--accent)', color: '#000', opacity: (!newName.trim() || saving) ? 0.5 : 1 }}
            >
              {saving ? 'Creando...' : 'Crear proyecto'}
            </button>
            <button
              onClick={() => { setShowNew(false); setNewName(''); setNewDesc('') }}
              className="px-4 py-2.5 rounded-xl text-sm"
              style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}
            >Cancelar</button>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-7 h-7 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--border)', borderTopColor: 'var(--accent)' }} />
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-20 fade-in">
          <div className="text-6xl mb-4">🎸</div>
          <p className="font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>No hay proyectos aún</p>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Crea uno para empezar a organizar tu banda</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {projects.map((project, i) => (
            <div
              key={project.id}
              className="group rounded-2xl transition-all duration-200 fade-in"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', animationDelay: `${i * 40}ms` }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-bright)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'}
            >
              {editingId === project.id ? (
                <div className="p-4 flex gap-2 items-center">
                  <input
                    autoFocus
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveEdit(project.id); if (e.key === 'Escape') setEditingId(null) }}
                    className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
                    style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-bright)', color: 'var(--text-primary)' }}
                  />
                  <button onClick={() => saveEdit(project.id)} className="p-2 rounded-lg" style={{ color: 'var(--green)' }}><Check size={15} /></button>
                  <button onClick={() => setEditingId(null)} className="p-2 rounded-lg" style={{ color: 'var(--text-muted)' }}><X size={15} /></button>
                </div>
              ) : (
                <Link href={`/projects/${project.id}`} className="flex items-center p-4 gap-3">
                  <div className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center text-xl" style={{ background: 'var(--bg-elevated)' }}>🎵</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{project.name}</p>
                    {project.description && (
                      <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>{project.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={e => { e.preventDefault(); setEditingId(project.id); setEditName(project.name) }}
                      className="p-2 rounded-lg transition-colors"
                      style={{ color: 'var(--text-muted)' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'}
                    ><Edit2 size={13} /></button>
                    <button
                      onClick={e => { e.preventDefault(); deleteProject(project.id) }}
                      className="p-2 rounded-lg"
                      style={{ color: 'var(--text-muted)' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--red)'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'}
                    ><Trash2 size={13} /></button>
                  </div>
                  <ChevronRight size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                </Link>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
