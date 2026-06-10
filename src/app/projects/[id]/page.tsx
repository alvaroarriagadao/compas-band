'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, type DragEndEvent
} from '@dnd-kit/core'
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  useSortable, verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ArrowLeft, Plus, GripVertical, Music, ChevronRight, Edit2, Check, X, Trash2, Copy, CalendarDays } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Project, Song, Setlist } from '@/lib/database.types'
import { useMetronomeStore, type ClickSound } from '@/stores/metronomeStore'
import { MetronomePlayButton } from '@/components/Metronome'
import { ProjectLogoUpload } from '@/components/ProjectLogoUpload'
import { useAuth } from '@/contexts/AuthContext'

type Tab = 'songs' | 'setlists'

const SOUNDS: { id: ClickSound; emoji: string; label: string }[] = [
  { id: 'classic', emoji: '🎯', label: 'Click' },
  { id: 'wood', emoji: '🪵', label: 'Madera' },
  { id: 'soft', emoji: '🥁', label: 'Hi-hat' },
]

function SortableSong({ song, index, onDelete, onEdit }: {
  song: Song; index: number; onDelete: (id: string) => void; onEdit: (id: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: song.id })
  const { isPlaying, playingSongId, currentBeat, beatsPerMeasure } = useMetronomeStore()
  const isThisSongPlaying = isPlaying && playingSongId === song.id

  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1, zIndex: isDragging ? 10 : 'auto' }} {...attributes} className="group">
      <div className="flex items-center gap-2 px-3 py-3 rounded-2xl transition-all duration-150"
        style={{
          background: isThisSongPlaying ? 'var(--bg-elevated)' : 'var(--bg-card)',
          border: `1px solid ${isThisSongPlaying ? 'rgba(16,185,129,0.5)' : isDragging ? 'var(--border-bright)' : 'var(--border)'}`,
          boxShadow: isThisSongPlaying ? '0 0 16px rgba(16,185,129,0.1)' : isDragging ? '0 8px 24px rgba(0,0,0,0.4)' : 'none',
        }}
      >
        {/* Number */}
        <span className="w-5 text-center text-xs font-bold flex-shrink-0 tabular-nums" style={{ color: 'var(--text-muted)' }}>
          {index + 1}
        </span>

        {/* Drag handle — always visible dots */}
        <div {...listeners} className="cursor-grab active:cursor-grabbing flex-shrink-0 touch-none px-0.5 flex flex-col gap-0.5">
          {[0,1,2].map(r => (
            <div key={r} className="flex gap-0.5">
              {[0,1].map(c => (
                <div key={c} className="w-1 h-1 rounded-full transition-colors" style={{ background: isDragging ? 'var(--accent)' : 'var(--border-bright)' }} />
              ))}
            </div>
          ))}
        </div>

        {/* Beat indicators */}
        {isThisSongPlaying ? (
          <div className="flex gap-1 flex-shrink-0">
            {Array.from({ length: Math.min(beatsPerMeasure, 4) }).map((_, i) => (
              <div key={i} className="rounded-full transition-all duration-75" style={{
                width: i === 0 ? 9 : 6, height: i === 0 ? 9 : 6,
                background: currentBeat === i ? (i === 0 ? 'var(--accent)' : 'var(--green)') : 'var(--border)',
                transform: currentBeat === i ? 'scale(1.3)' : 'scale(1)',
                border: `1.5px solid ${i === 0 ? 'rgba(245,158,11,0.4)' : 'var(--border)'}`,
              }} />
            ))}
          </div>
        ) : (
          <Music size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        )}

        {/* Info */}
        <Link href={`/projects/${song.project_id}/songs/${song.id}`} className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate" style={{ color: isThisSongPlaying ? 'var(--green)' : 'var(--text-primary)' }}>{song.title}</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {song.bpm} BPM {song.lyrics && '· 📝'}
          </p>
        </Link>

        {/* Actions — always visible */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={e => { e.stopPropagation(); onEdit(song.id) }}
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}
            title="Editar"
          ><Edit2 size={13} /></button>
          <button
            onClick={e => { e.stopPropagation(); if (window.confirm(`¿Eliminar "${song.title}"?`)) onDelete(song.id) }}
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--red)' }}
            title="Eliminar"
          ><Trash2 size={13} /></button>
          <MetronomePlayButton
            songId={song.id}
            songTitle={song.title}
            bpm={song.bpm}
            sound={(song.metro_sound as 'classic' | 'wood' | 'soft') || 'classic'}
            volume={song.metro_volume ?? 1.0}
            subdivision={(song.metro_subdivision as 1|2|3|4) || 1}
            beatsPerMeasure={song.metro_beats ?? 4}
            accentDownbeat={song.metro_accent ?? true}
          />
        </div>
      </div>
    </div>
  )
}

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { user } = useAuth()
  const [project, setProject] = useState<Project | null>(null)
  const [songs, setSongs] = useState<Song[]>([])
  const [setlists, setSetlists] = useState<Setlist[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('songs')
  const [showNew, setShowNew] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newBpm, setNewBpm] = useState(120)
  const [newBpmInput, setNewBpmInput] = useState('120')
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editBpm, setEditBpm] = useState(120)
  const [editBpmInput, setEditBpmInput] = useState('120')
  const [showNewSetlist, setShowNewSetlist] = useState(false)
  const [newSetlistName, setNewSetlistName] = useState('')
  const [newSetlistDate, setNewSetlistDate] = useState('')
  const [newSetlistVenue, setNewSetlistVenue] = useState('')
  const [codeCopied, setCodeCopied] = useState(false)

  const { isPlaying, playingSongId, playingSongTitle, bpm, stop, sound, setSound } = useMetronomeStore()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  useEffect(() => { loadData() }, [id]) // eslint-disable-line

  async function loadData() {
    const [projRes, songsRes, setlistsRes] = await Promise.all([
      supabase.from('projects').select('*').eq('id', id).single(),
      supabase.from('songs').select('*').eq('project_id', id).order('song_order', { ascending: true }),
      supabase.from('setlists').select('*').eq('project_id', id).order('setlist_order', { ascending: true }),
    ])
    setProject(projRes.data)
    setSongs(songsRes.data || [])
    setSetlists(setlistsRes.data || [])
    setLoading(false)
  }

  async function createSong() {
    if (!newTitle.trim()) return
    setSaving(true)
    const { data } = await supabase
      .from('songs')
      .insert({ project_id: id, title: newTitle.trim(), bpm: newBpm, song_order: songs.length })
      .select().single()
    if (data) setSongs([...songs, data])
    setNewTitle(''); setNewBpm(120); setNewBpmInput('120'); setShowNew(false); setSaving(false)
  }

  async function deleteSong(songId: string) {
    if (playingSongId === songId) stop()
    await supabase.from('songs').delete().eq('id', songId)
    setSongs(songs.filter(s => s.id !== songId))
  }

  async function saveEdit(songId: string) {
    await supabase.from('songs').update({ title: editTitle, bpm: editBpm }).eq('id', songId)
    setSongs(songs.map(s => s.id === songId ? { ...s, title: editTitle, bpm: editBpm } : s))
    setEditingId(null)
  }

  async function createSetlist() {
    if (!newSetlistName.trim()) return
    const { data } = await supabase
      .from('setlists')
      .insert({
        project_id: id,
        name: newSetlistName.trim(),
        event_date: newSetlistDate || null,
        venue: newSetlistVenue.trim() || null,
        setlist_order: setlists.length,
      })
      .select().single()
    if (data) setSetlists([...setlists, data])
    setNewSetlistName(''); setNewSetlistDate(''); setNewSetlistVenue(''); setShowNewSetlist(false)
  }

  async function deleteSetlist(setlistId: string) {
    if (!confirm('¿Eliminar este setlist?')) return
    await supabase.from('setlists').delete().eq('id', setlistId)
    setSetlists(setlists.filter(s => s.id !== setlistId))
  }

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIdx = songs.findIndex(s => s.id === active.id)
    const newIdx = songs.findIndex(s => s.id === over.id)
    const reordered = arrayMove(songs, oldIdx, newIdx)
    setSongs(reordered)
    await Promise.all(reordered.map((s, i) => supabase.from('songs').update({ song_order: i }).eq('id', s.id)))
  }, [songs])

  function copyCode() {
    if (!project?.access_code) return
    navigator.clipboard.writeText(project.access_code)
    setCodeCopied(true)
    setTimeout(() => setCodeCopied(false), 2000)
  }

  function formatDate(dateStr: string | null) {
    if (!dateStr) return null
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="w-7 h-7 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--border)', borderTopColor: 'var(--accent)' }} /></div>
  }

  if (!project) {
    return <div className="min-h-screen flex flex-col items-center justify-center gap-3"><p style={{ color: 'var(--text-muted)' }}>Proyecto no encontrado</p><button onClick={() => router.push('/')} style={{ color: 'var(--accent)' }}>← Volver</button></div>
  }

  const isOwner = project.owner_id === user?.id

  return (
    <div className="min-h-screen pb-28" style={{ background: 'var(--bg-base)' }}>
      <div className="px-4 py-6 max-w-xl mx-auto">
        {/* Back */}
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm mb-5 transition-colors" style={{ color: 'var(--text-muted)' }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'}
        ><ArrowLeft size={14} /> Proyectos</Link>

        {/* Header */}
        <div className="flex items-start gap-3 mb-6 fade-in">
          <ProjectLogoUpload
            projectId={project.id}
            currentUrl={project.logo_url}
            onUploaded={url => setProject({ ...project, logo_url: url })}
          />
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold leading-tight" style={{ color: 'var(--text-primary)' }}>{project.name}</h1>
            {project.description && <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{project.description}</p>}
            {project.access_code && (
              <button onClick={copyCode}
                className="mt-1.5 inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg transition-all"
                style={{ background: codeCopied ? 'rgba(16,185,129,0.15)' : 'var(--bg-elevated)', color: codeCopied ? 'var(--green)' : 'var(--text-muted)', border: '1px solid var(--border)' }}
              >
                <Copy size={10} />
                {codeCopied ? '¡Copiado!' : `Código: ${project.access_code}`}
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-2xl mb-5" style={{ background: 'var(--bg-card)' }}>
          {(['songs', 'setlists'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold transition-all"
              style={{
                background: tab === t ? 'var(--bg-elevated)' : 'transparent',
                color: tab === t ? 'var(--text-primary)' : 'var(--text-muted)',
              }}
            >
              {t === 'songs' ? <><Music size={13} /> Canciones <span className="text-xs opacity-60">({songs.length})</span></> : <><CalendarDays size={13} /> Setlists <span className="text-xs opacity-60">({setlists.length})</span></>}
            </button>
          ))}
        </div>

        {/* ── SONGS TAB ── */}
        {tab === 'songs' && (
          <>
            {!showNew ? (
              <button onClick={() => setShowNew(true)}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed mb-4 text-sm font-medium transition-all duration-200"
                style={{ borderColor: 'var(--border-bright)', color: 'var(--text-secondary)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'; (e.currentTarget as HTMLElement).style.color = 'var(--accent)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-bright)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)' }}
              ><Plus size={14} /> Agregar canción</button>
            ) : (
              <div className="rounded-2xl p-4 mb-4 fade-in" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-bright)' }}>
                <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--accent)' }}>Nueva canción</p>
                <input autoFocus type="text" placeholder="Título de la canción"
                  value={newTitle} onChange={e => setNewTitle(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') createSong(); if (e.key === 'Escape') setShowNew(false) }}
                  className="w-full px-3 py-2.5 rounded-xl text-sm mb-3 outline-none"
                  style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                />
                {/* BPM — precise input */}
                <div className="mb-4">
                  <label className="text-xs mb-1.5 block" style={{ color: 'var(--text-muted)' }}>BPM</label>
                  <div className="flex items-center gap-2">
                    <button onClick={() => { const v = Math.max(40, newBpm - 1); setNewBpm(v); setNewBpmInput(String(v)) }}
                      className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-lg flex-shrink-0"
                      style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>−</button>
                    <input
                      type="text" inputMode="numeric" pattern="[0-9]*"
                      value={newBpmInput}
                      onChange={e => {
                        setNewBpmInput(e.target.value)
                        const n = parseInt(e.target.value)
                        if (!isNaN(n) && n >= 40 && n <= 240) setNewBpm(n)
                      }}
                      onBlur={() => {
                        const n = parseInt(newBpmInput)
                        const clamped = isNaN(n) ? 120 : Math.min(240, Math.max(40, n))
                        setNewBpm(clamped); setNewBpmInput(String(clamped))
                      }}
                      className="w-20 text-center font-black text-xl rounded-xl outline-none py-1.5"
                      style={{ background: 'var(--bg-elevated)', color: 'var(--accent)', border: '1px solid var(--border-bright)' }}
                    />
                    <button onClick={() => { const v = Math.min(240, newBpm + 1); setNewBpm(v); setNewBpmInput(String(v)) }}
                      className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-lg flex-shrink-0"
                      style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>+</button>
                    <input type="range" min={40} max={240} value={newBpm}
                      onChange={e => { const v = Number(e.target.value); setNewBpm(v); setNewBpmInput(String(v)) }}
                      className="flex-1" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={createSong} disabled={saving || !newTitle.trim()}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold"
                    style={{ background: 'var(--accent)', color: '#000', opacity: (!newTitle.trim() || saving) ? 0.5 : 1 }}>
                    {saving ? 'Guardando...' : 'Agregar'}
                  </button>
                  <button onClick={() => { setShowNew(false); setNewTitle('') }}
                    className="px-3 py-2.5 rounded-xl text-sm"
                    style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>Cancelar</button>
                </div>
              </div>
            )}

            {songs.length === 0 ? (
              <div className="text-center py-14 fade-in">
                <div className="text-5xl mb-3">🎶</div>
                <p className="font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>No hay canciones</p>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Agrega la primera canción del proyecto</p>
              </div>
            ) : (
              <>
                <p className="text-xs mb-2 flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                  <span>⋮⋮</span> Arrastra para reordenar
                </p>
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={songs.map(s => s.id)} strategy={verticalListSortingStrategy}>
                    <div className="flex flex-col gap-2">
                      {songs.map((song, idx) => {
                        if (editingId === song.id) {
                          return (
                            <div key={song.id} className="rounded-2xl p-4 fade-in" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-bright)' }}>
                              <input autoFocus value={editTitle} onChange={e => setEditTitle(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') saveEdit(song.id); if (e.key === 'Escape') setEditingId(null) }}
                                className="w-full px-3 py-2 rounded-lg text-sm outline-none mb-3"
                                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
                              <div className="flex items-center gap-2 mb-3">
                                <button onClick={() => { const v = Math.max(40, editBpm - 1); setEditBpm(v); setEditBpmInput(String(v)) }}
                                  className="w-8 h-8 rounded-lg flex items-center justify-center font-bold flex-shrink-0"
                                  style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>−</button>
                                <input
                                  type="text" inputMode="numeric"
                                  value={editBpmInput}
                                  onChange={e => { setEditBpmInput(e.target.value); const n = parseInt(e.target.value); if (!isNaN(n) && n >= 40 && n <= 240) setEditBpm(n) }}
                                  onBlur={() => { const n = parseInt(editBpmInput); const c = isNaN(n) ? 120 : Math.min(240, Math.max(40, n)); setEditBpm(c); setEditBpmInput(String(c)) }}
                                  className="w-16 text-center font-black text-lg rounded-lg outline-none py-1"
                                  style={{ background: 'var(--bg-elevated)', color: 'var(--accent)', border: '1px solid var(--border-bright)' }}
                                />
                                <button onClick={() => { const v = Math.min(240, editBpm + 1); setEditBpm(v); setEditBpmInput(String(v)) }}
                                  className="w-8 h-8 rounded-lg flex items-center justify-center font-bold flex-shrink-0"
                                  style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>+</button>
                                <input type="range" min={40} max={240} value={editBpm}
                                  onChange={e => { const v = Number(e.target.value); setEditBpm(v); setEditBpmInput(String(v)) }}
                                  className="flex-1" />
                              </div>
                              <div className="flex gap-2">
                                <button onClick={() => saveEdit(song.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold" style={{ background: 'var(--green)', color: '#fff' }}><Check size={12} /> Guardar</button>
                                <button onClick={() => setEditingId(null)} className="px-3 py-1.5 rounded-lg text-xs" style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}><X size={12} /></button>
                              </div>
                            </div>
                          )
                        }
                        return (
                          <SortableSong key={song.id} song={song} index={idx}
                            onDelete={deleteSong}
                            onEdit={sid => { setEditingId(sid); setEditTitle(song.title); setEditBpm(song.bpm); setEditBpmInput(String(song.bpm)) }}
                          />
                        )
                      })}
                    </div>
                  </SortableContext>
                </DndContext>
              </>
            )}
          </>
        )}

        {/* ── SETLISTS TAB ── */}
        {tab === 'setlists' && (
          <>
            {!showNewSetlist ? (
              <button onClick={() => setShowNewSetlist(true)}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed mb-4 text-sm font-medium transition-all duration-200"
                style={{ borderColor: 'var(--border-bright)', color: 'var(--text-secondary)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'; (e.currentTarget as HTMLElement).style.color = 'var(--accent)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-bright)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)' }}
              ><Plus size={14} /> Nuevo Setlist</button>
            ) : (
              <div className="rounded-2xl p-4 mb-4 fade-in" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-bright)' }}>
                <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--accent)' }}>Nuevo setlist</p>
                <input autoFocus type="text" placeholder='Ej: "Presentación Casona" o "Grabación Disco"'
                  value={newSetlistName} onChange={e => setNewSetlistName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Escape') setShowNewSetlist(false) }}
                  className="w-full px-3 py-2.5 rounded-xl text-sm mb-3 outline-none"
                  style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                />
                <div className="grid grid-cols-2 gap-2 mb-4">
                  <div>
                    <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>Fecha</label>
                    <input type="date" value={newSetlistDate} onChange={e => setNewSetlistDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                      style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)', colorScheme: 'dark' }}
                    />
                  </div>
                  <div>
                    <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>Lugar / Venue</label>
                    <input type="text" placeholder="Club de Jazz..." value={newSetlistVenue} onChange={e => setNewSetlistVenue(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                      style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={createSetlist} disabled={!newSetlistName.trim()}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold"
                    style={{ background: 'var(--accent)', color: '#000', opacity: !newSetlistName.trim() ? 0.5 : 1 }}>
                    Crear setlist
                  </button>
                  <button onClick={() => { setShowNewSetlist(false); setNewSetlistName('') }}
                    className="px-3 py-2.5 rounded-xl text-sm"
                    style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>Cancelar</button>
                </div>
              </div>
            )}

            {setlists.length === 0 ? (
              <div className="text-center py-14 fade-in">
                <div className="text-5xl mb-3">📋</div>
                <p className="font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>No hay setlists aún</p>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Crea uno para organizar tus presentaciones</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {setlists.map((sl, i) => (
                  <Link key={sl.id} href={`/projects/${id}/setlists/${sl.id}`}
                    className="group flex items-center gap-4 p-4 rounded-2xl transition-all fade-in"
                    style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', animationDelay: `${i * 40}ms` }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-bright)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'}
                  >
                    <div className="w-11 h-11 rounded-xl flex-shrink-0 flex items-center justify-center text-xl" style={{ background: 'var(--bg-elevated)' }}>📋</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold truncate" style={{ color: 'var(--text-primary)' }}>{sl.name}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {sl.event_date && <span className="text-xs" style={{ color: 'var(--accent)' }}>📅 {formatDate(sl.event_date)}</span>}
                        {sl.venue && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>📍 {sl.venue}</span>}
                      </div>
                    </div>
                    <button
                      onClick={e => { e.preventDefault(); deleteSetlist(sl.id) }}
                      className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--red)' }}
                    ><Trash2 size={13} /></button>
                    <ChevronRight size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  </Link>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Metronome status bar */}
      {isPlaying && (
        <div className="fixed bottom-0 left-0 right-0 fade-in"
          style={{ background: 'rgba(14,14,26,0.97)', borderTop: '1px solid rgba(16,185,129,0.4)', backdropFilter: 'blur(16px)' }}>
          <div className="flex items-center justify-center gap-1 px-4 pt-2.5">
            <span className="text-xs mr-1" style={{ color: 'var(--text-muted)' }}>Sonido:</span>
            {SOUNDS.map(s => (
              <button key={s.id} onClick={() => setSound(s.id)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs transition-all"
                style={{ background: sound === s.id ? 'var(--bg-elevated)' : 'transparent', color: sound === s.id ? 'var(--text-primary)' : 'var(--text-muted)', border: `1px solid ${sound === s.id ? 'var(--border-bright)' : 'transparent'}` }}
              >{s.emoji} {s.label}</button>
            ))}
          </div>
          <div className="flex items-center justify-between px-4 py-2.5">
            <div className="min-w-0">
              <p className="text-sm font-bold truncate" style={{ color: 'var(--green)' }}>▶ {playingSongTitle}</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{bpm} BPM</p>
            </div>
            <button onClick={stop} className="px-4 py-2 rounded-xl text-sm font-bold flex-shrink-0 ml-4" style={{ background: 'var(--red)', color: '#fff' }}>Detener</button>
          </div>
        </div>
      )}
    </div>
  )
}
