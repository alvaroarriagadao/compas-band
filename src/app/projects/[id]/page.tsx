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
import { ArrowLeft, Plus, GripVertical, Music, ChevronRight, Edit2, Check, X, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Project, Song } from '@/lib/database.types'
import { useMetronomeStore, type ClickSound } from '@/stores/metronomeStore'
import { MetronomePlayButton } from '@/components/Metronome'

const SOUNDS: { id: ClickSound; emoji: string; label: string }[] = [
  { id: 'classic', emoji: '🎯', label: 'Click' },
  { id: 'wood', emoji: '🪵', label: 'Madera' },
  { id: 'soft', emoji: '🥁', label: 'Hi-hat' },
]

function SortableSong({
  song, onDelete, onEdit,
}: {
  song: Song
  onDelete: (id: string) => void
  onEdit: (id: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: song.id })
  const { isPlaying, playingSongId, currentBeat, beatsPerMeasure, subdivision, currentSubdivision } = useMetronomeStore()
  const isThisSongPlaying = isPlaying && playingSongId === song.id

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : 1,
    zIndex: isDragging ? 10 : undefined,
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} className="group">
      <div
        className="flex items-center gap-2.5 px-3 py-3 rounded-2xl transition-all duration-150"
        style={{
          background: isThisSongPlaying ? 'var(--bg-elevated)' : 'var(--bg-card)',
          border: `1px solid ${isThisSongPlaying ? 'rgba(16,185,129,0.5)' : 'var(--border)'}`,
          boxShadow: isThisSongPlaying ? '0 0 16px rgba(16,185,129,0.1)' : 'none',
        }}
      >
        {/* Drag handle */}
        <div
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 touch-none"
          style={{ color: 'var(--text-muted)' }}
        >
          <GripVertical size={14} />
        </div>

        {/* Beat indicators */}
        {isThisSongPlaying ? (
          <div className="flex gap-1 flex-shrink-0">
            {Array.from({ length: Math.min(beatsPerMeasure, 4) }).map((_, i) => {
              const isActive = currentBeat === i
              return (
                <div key={i} className="rounded-full transition-all duration-75" style={{
                  width: i === 0 ? 10 : 7, height: i === 0 ? 10 : 7,
                  background: isActive ? (i === 0 ? 'var(--accent)' : 'var(--green)') : 'var(--border)',
                  boxShadow: isActive ? `0 0 6px ${i === 0 ? 'var(--accent)' : 'var(--green)'}` : 'none',
                  transform: isActive ? 'scale(1.2)' : 'scale(1)',
                  border: `1.5px solid ${i === 0 ? 'rgba(245,158,11,0.4)' : 'var(--border)'}`,
                }} />
              )
            })}
          </div>
        ) : (
          <div className="w-7 flex-shrink-0 flex items-center justify-center">
            <Music size={13} style={{ color: 'var(--text-muted)' }} />
          </div>
        )}

        {/* Info */}
        <Link href={`/projects/${song.project_id}/songs/${song.id}`} className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate" style={{ color: isThisSongPlaying ? 'var(--green)' : 'var(--text-primary)' }}>
            {song.title}
          </p>
          <p className="text-xs mt-0.5 flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
            <span>{song.bpm} BPM</span>
            {song.lyrics && <span>📝</span>}
          </p>
        </Link>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <Link
            href={`/projects/${song.project_id}/songs/${song.id}`}
            className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hidden sm:flex"
            style={{ color: 'var(--text-muted)' }}
          ><ChevronRight size={13} /></Link>
          <button
            onClick={e => { e.stopPropagation(); onEdit(song.id) }}
            className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'}
          ><Edit2 size={13} /></button>
          <button
            onClick={e => { e.stopPropagation(); onDelete(song.id) }}
            className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--red)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'}
          ><Trash2 size={13} /></button>
          <MetronomePlayButton songId={song.id} songTitle={song.title} bpm={song.bpm} />
        </div>
      </div>
    </div>
  )
}

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [project, setProject] = useState<Project | null>(null)
  const [songs, setSongs] = useState<Song[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newBpm, setNewBpm] = useState(120)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editBpm, setEditBpm] = useState(120)

  const { isPlaying, playingSongId, playingSongTitle, bpm, stop, sound, setSound } = useMetronomeStore()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  useEffect(() => { loadData() }, [id]) // eslint-disable-line

  async function loadData() {
    const [projRes, songsRes] = await Promise.all([
      supabase.from('projects').select('*').eq('id', id).single(),
      supabase.from('songs').select('*').eq('project_id', id).order('song_order', { ascending: true })
    ])
    setProject(projRes.data)
    setSongs(songsRes.data || [])
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
    setNewTitle(''); setNewBpm(120); setShowNew(false); setSaving(false)
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

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = songs.findIndex(s => s.id === active.id)
    const newIndex = songs.findIndex(s => s.id === over.id)
    const reordered = arrayMove(songs, oldIndex, newIndex)
    setSongs(reordered)
    await Promise.all(reordered.map((song, idx) =>
      supabase.from('songs').update({ song_order: idx }).eq('id', song.id)
    ))
  }, [songs])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-7 h-7 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--border)', borderTopColor: 'var(--accent)' }} />
      </div>
    )
  }

  if (!project) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p style={{ color: 'var(--text-muted)' }}>Proyecto no encontrado</p>
        <button onClick={() => router.push('/')} style={{ color: 'var(--accent)' }}>← Volver</button>
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-28" style={{ background: 'var(--bg-base)' }}>
      <div className="px-4 py-8 max-w-xl mx-auto">
        {/* Back */}
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm mb-6 transition-colors" style={{ color: 'var(--text-muted)' }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'}
        ><ArrowLeft size={14} /> Proyectos</Link>

        {/* Header */}
        <div className="mb-7 fade-in">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl flex-shrink-0" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>🎵</div>
            <div>
              <h1 className="text-xl font-bold leading-tight" style={{ color: 'var(--text-primary)' }}>{project.name}</h1>
              {project.description && <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{project.description}</p>}
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                {songs.length} {songs.length === 1 ? 'canción' : 'canciones'} · Arrastra para reordenar
              </p>
            </div>
          </div>
        </div>

        {/* Add song */}
        {!showNew ? (
          <button
            onClick={() => setShowNew(true)}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed mb-4 text-sm font-medium transition-all duration-200"
            style={{ borderColor: 'var(--border-bright)', color: 'var(--text-secondary)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'; (e.currentTarget as HTMLElement).style.color = 'var(--accent)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-bright)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)' }}
          ><Plus size={14} /> Agregar canción</button>
        ) : (
          <div className="rounded-2xl p-4 mb-4 fade-in" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-bright)' }}>
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--accent)' }}>Nueva canción</p>
            <input
              autoFocus type="text" placeholder="Título de la canción"
              value={newTitle} onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') createSong(); if (e.key === 'Escape') setShowNew(false) }}
              className="w-full px-3 py-2.5 rounded-xl text-sm mb-3 outline-none"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
            />
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-secondary)' }}>BPM</span>
              <input type="range" min={40} max={240} value={newBpm} onChange={e => setNewBpm(Number(e.target.value))} className="flex-1" />
              <input
                type="number" min={40} max={240} value={newBpm}
                onChange={e => setNewBpm(Math.min(240, Math.max(40, Number(e.target.value))))}
                className="w-14 text-center py-1.5 rounded-lg text-sm font-bold outline-none"
                style={{ background: 'var(--bg-elevated)', color: 'var(--accent)', border: '1px solid var(--border)' }}
              />
            </div>
            <div className="flex gap-2">
              <button onClick={createSong} disabled={saving || !newTitle.trim()}
                className="flex-1 py-2 rounded-xl text-sm font-bold"
                style={{ background: 'var(--accent)', color: '#000', opacity: (!newTitle.trim() || saving) ? 0.5 : 1 }}>
                {saving ? 'Guardando...' : 'Agregar'}
              </button>
              <button onClick={() => { setShowNew(false); setNewTitle('') }}
                className="px-3 py-2 rounded-xl text-sm"
                style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Songs */}
        {songs.length === 0 ? (
          <div className="text-center py-16 fade-in">
            <div className="text-5xl mb-4">🎶</div>
            <p className="font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>No hay canciones aún</p>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Agrega la primera canción del proyecto</p>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={songs.map(s => s.id)} strategy={verticalListSortingStrategy}>
              <div className="flex flex-col gap-2">
                {songs.map(song => {
                  if (editingId === song.id) {
                    return (
                      <div key={song.id} className="rounded-2xl p-4 fade-in" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-bright)' }}>
                        <input autoFocus value={editTitle} onChange={e => setEditTitle(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg text-sm outline-none mb-2"
                          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>BPM</span>
                          <input type="range" min={40} max={240} value={editBpm} onChange={e => setEditBpm(Number(e.target.value))} className="flex-1" />
                          <input type="number" min={40} max={240} value={editBpm}
                            onChange={e => setEditBpm(Math.min(240, Math.max(40, Number(e.target.value))))}
                            className="w-14 text-center py-1 rounded-lg text-xs font-bold outline-none"
                            style={{ background: 'var(--bg-elevated)', color: 'var(--accent)', border: '1px solid var(--border)' }} />
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => saveEdit(song.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold" style={{ background: 'var(--green)', color: '#fff' }}>
                            <Check size={12} /> Guardar
                          </button>
                          <button onClick={() => setEditingId(null)} className="px-3 py-1.5 rounded-lg text-xs" style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>
                            <X size={12} />
                          </button>
                        </div>
                      </div>
                    )
                  }
                  return (
                    <SortableSong
                      key={song.id} song={song}
                      onDelete={deleteSong}
                      onEdit={(sid) => { setEditingId(sid); setEditTitle(song.title); setEditBpm(song.bpm) }}
                    />
                  )
                })}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* Status bar */}
      {isPlaying && (
        <div
          className="fixed bottom-0 left-0 right-0 fade-in"
          style={{ background: 'rgba(14,14,26,0.97)', borderTop: '1px solid rgba(16,185,129,0.4)', backdropFilter: 'blur(16px)' }}
        >
          {/* Sound selector strip */}
          <div className="flex items-center justify-center gap-1 px-4 pt-2.5">
            <span className="text-xs mr-1" style={{ color: 'var(--text-muted)' }}>Sonido:</span>
            {SOUNDS.map(s => (
              <button
                key={s.id}
                onClick={() => setSound(s.id)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs transition-all"
                style={{
                  background: sound === s.id ? 'var(--bg-elevated)' : 'transparent',
                  color: sound === s.id ? 'var(--text-primary)' : 'var(--text-muted)',
                  border: `1px solid ${sound === s.id ? 'var(--border-bright)' : 'transparent'}`,
                }}
              >{s.emoji} {s.label}</button>
            ))}
          </div>

          <div className="flex items-center justify-between px-4 py-2.5">
            <div className="min-w-0">
              <p className="text-sm font-bold truncate" style={{ color: 'var(--green)' }}>▶ {playingSongTitle}</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{bpm} BPM</p>
            </div>
            <button onClick={stop} className="px-4 py-2 rounded-xl text-sm font-bold flex-shrink-0 ml-4" style={{ background: 'var(--red)', color: '#fff' }}>
              Detener
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
