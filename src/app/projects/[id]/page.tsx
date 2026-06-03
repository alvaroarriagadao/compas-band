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
import { ArrowLeft, Plus, GripVertical, Play, Square, Trash2, Music, ChevronRight, Edit2, Check, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Project, Song } from '@/lib/database.types'
import { useMetronome } from '@/hooks/useMetronome'

function SortableSong({
  song, isPlaying, currentBeat, beatsPerMeasure, onPlay, onStop, onDelete, onEdit
}: {
  song: Song
  isPlaying: boolean
  currentBeat: number
  beatsPerMeasure: number
  onPlay: (song: Song) => void
  onStop: () => void
  onDelete: (id: string) => void
  onEdit: (id: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: song.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group rounded-2xl transition-all duration-150"
      {...attributes}
    >
      <div
        className="flex items-center gap-3 p-3.5 rounded-2xl"
        style={{
          background: isPlaying ? 'var(--bg-elevated)' : 'var(--bg-card)',
          border: `1px solid ${isPlaying ? 'var(--green)' : 'var(--border)'}`,
          boxShadow: isPlaying ? '0 0 20px rgba(16,185,129,0.15)' : 'none',
        }}
      >
        {/* Drag handle */}
        <div
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
          style={{ color: 'var(--text-muted)' }}
        >
          <GripVertical size={16} />
        </div>

        {/* Beat indicators (when playing) */}
        {isPlaying ? (
          <div className="flex gap-1 flex-shrink-0">
            {Array.from({ length: Math.min(beatsPerMeasure, 4) }).map((_, i) => (
              <div
                key={i}
                className="rounded-full transition-all duration-75"
                style={{
                  width: i === 0 ? 10 : 7,
                  height: i === 0 ? 10 : 7,
                  background: currentBeat === i
                    ? (i === 0 ? 'var(--accent)' : 'var(--green)')
                    : 'var(--bg-elevated)',
                  boxShadow: currentBeat === i ? '0 0 8px var(--accent)' : 'none',
                  border: `1.5px solid ${i === 0 ? 'var(--accent-dim)' : 'var(--border)'}`,
                }}
              />
            ))}
          </div>
        ) : (
          <div className="w-8 flex-shrink-0 flex items-center justify-center">
            <Music size={14} style={{ color: 'var(--text-muted)' }} />
          </div>
        )}

        {/* Song info */}
        <Link href={`/projects/${song.project_id}/songs/${song.id}`} className="flex-1 min-w-0 group/link">
          <p className="font-semibold text-sm truncate transition-colors" style={{ color: isPlaying ? 'var(--green)' : 'var(--text-primary)' }}>
            {song.title}
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {song.bpm} BPM
            {song.lyrics && <span className="ml-2">📝</span>}
          </p>
        </Link>

        {/* Actions */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <Link
            href={`/projects/${song.project_id}/songs/${song.id}`}
            className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ color: 'var(--text-muted)' }}
          >
            <ChevronRight size={14} />
          </Link>
          <button
            onClick={e => { e.stopPropagation(); onEdit(song.id) }}
            className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'}
          >
            <Edit2 size={13} />
          </button>
          <button
            onClick={e => { e.stopPropagation(); onDelete(song.id) }}
            className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--red)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'}
          >
            <Trash2 size={13} />
          </button>
          <button
            onClick={() => isPlaying ? onStop() : onPlay(song)}
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-150"
            style={{
              background: isPlaying ? 'var(--red)' : 'var(--green)',
              boxShadow: isPlaying ? '0 0 12px rgba(239,68,68,0.3)' : '0 0 12px rgba(16,185,129,0.3)',
              color: '#fff',
            }}
          >
            {isPlaying ? <Square size={13} /> : <Play size={13} fill="white" />}
          </button>
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
  const [playingSongId, setPlayingSongId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editBpm, setEditBpm] = useState(120)

  const metro = useMetronome()

  const sensors = useSensors(
    useSensor(PointerSensor),
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
    const order = songs.length
    const { data } = await supabase
      .from('songs')
      .insert({ project_id: id, title: newTitle.trim(), bpm: newBpm, song_order: order })
      .select().single()
    if (data) setSongs([...songs, data])
    setNewTitle(''); setNewBpm(120); setShowNew(false); setSaving(false)
  }

  async function deleteSong(songId: string) {
    if (playingSongId === songId) { metro.stop(); setPlayingSongId(null) }
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

    await Promise.all(
      reordered.map((song, idx) =>
        supabase.from('songs').update({ song_order: idx }).eq('id', song.id)
      )
    )
  }, [songs])

  function playSong(song: Song) {
    setPlayingSongId(song.id)
    metro.start(song.bpm)
  }

  function stopMetronome() {
    metro.stop()
    setPlayingSongId(null)
  }

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
    <div className="min-h-screen px-4 py-8 max-w-xl mx-auto">
      {/* Back nav */}
      <Link href="/" className="inline-flex items-center gap-2 text-sm mb-6 transition-colors" style={{ color: 'var(--text-muted)' }}
        onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'}
        onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'}
      >
        <ArrowLeft size={15} /> Proyectos
      </Link>

      {/* Header */}
      <div className="mb-8 fade-in">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-2xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>🎵</div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{project.name}</h1>
            {project.description && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{project.description}</p>}
          </div>
        </div>
        <p className="text-xs ml-14" style={{ color: 'var(--text-muted)' }}>
          {songs.length} {songs.length === 1 ? 'canción' : 'canciones'} · Arrastra para reordenar
        </p>
      </div>

      {/* Add song */}
      {!showNew ? (
        <button
          onClick={() => setShowNew(true)}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed mb-5 text-sm font-medium transition-all duration-200"
          style={{ borderColor: 'var(--border-bright)', color: 'var(--text-secondary)' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'; (e.currentTarget as HTMLElement).style.color = 'var(--accent)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-bright)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)' }}
        >
          <Plus size={15} /> Agregar canción
        </button>
      ) : (
        <div className="rounded-2xl p-5 mb-5 fade-in" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-bright)' }}>
          <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--accent)' }}>Nueva canción</p>
          <input
            autoFocus
            type="text"
            placeholder="Título de la canción"
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') createSong(); if (e.key === 'Escape') setShowNew(false) }}
            className="w-full px-4 py-3 rounded-xl text-sm mb-3 outline-none"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
          />
          <div className="flex items-center gap-3 mb-4">
            <span className="text-sm flex-shrink-0" style={{ color: 'var(--text-secondary)' }}>BPM</span>
            <input
              type="range" min={40} max={240} value={newBpm}
              onChange={e => setNewBpm(Number(e.target.value))}
              className="flex-1"
            />
            <input
              type="number" min={40} max={240} value={newBpm}
              onChange={e => setNewBpm(Math.min(240, Math.max(40, Number(e.target.value))))}
              className="w-16 text-center py-1.5 rounded-lg text-sm font-bold outline-none"
              style={{ background: 'var(--bg-elevated)', color: 'var(--accent)', border: '1px solid var(--border)' }}
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={createSong}
              disabled={saving || !newTitle.trim()}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold"
              style={{ background: 'var(--accent)', color: '#000', opacity: (!newTitle.trim() || saving) ? 0.5 : 1 }}
            >
              {saving ? 'Guardando...' : 'Agregar canción'}
            </button>
            <button
              onClick={() => { setShowNew(false); setNewTitle('') }}
              className="px-4 py-2.5 rounded-xl text-sm"
              style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}
            >Cancelar</button>
          </div>
        </div>
      )}

      {/* Song list */}
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
                      <input
                        autoFocus
                        value={editTitle}
                        onChange={e => setEditTitle(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg text-sm outline-none mb-2"
                        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                      />
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>BPM</span>
                        <input type="range" min={40} max={240} value={editBpm} onChange={e => setEditBpm(Number(e.target.value))} className="flex-1" />
                        <input
                          type="number" min={40} max={240} value={editBpm}
                          onChange={e => setEditBpm(Math.min(240, Math.max(40, Number(e.target.value))))}
                          className="w-14 text-center py-1 rounded-lg text-xs font-bold outline-none"
                          style={{ background: 'var(--bg-elevated)', color: 'var(--accent)', border: '1px solid var(--border)' }}
                        />
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => saveEdit(song.id)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold" style={{ background: 'var(--green)', color: '#fff' }}><Check size={12} /> Guardar</button>
                        <button onClick={() => setEditingId(null)} className="px-3 py-1.5 rounded-lg text-xs" style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}><X size={12} /></button>
                      </div>
                    </div>
                  )
                }
                return (
                  <SortableSong
                    key={song.id}
                    song={song}
                    isPlaying={playingSongId === song.id}
                    currentBeat={metro.currentBeat}
                    beatsPerMeasure={metro.beatsPerMeasure}
                    onPlay={playSong}
                    onStop={stopMetronome}
                    onDelete={deleteSong}
                    onEdit={(sid) => { setEditingId(sid); setEditTitle(song.title); setEditBpm(song.bpm) }}
                  />
                )
              })}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Active metronome status bar */}
      {playingSongId && (
        <div
          className="fixed bottom-0 left-0 right-0 flex items-center justify-between px-4 py-3 fade-in"
          style={{ background: 'var(--bg-elevated)', borderTop: '1px solid var(--green)', backdropFilter: 'blur(12px)' }}
        >
          <div>
            <p className="text-sm font-bold" style={{ color: 'var(--green)' }}>
              ▶ {songs.find(s => s.id === playingSongId)?.title}
            </p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {metro.bpm} BPM · Beat {metro.currentBeat + 1}/{metro.beatsPerMeasure}
            </p>
          </div>
          <button
            onClick={stopMetronome}
            className="px-4 py-2 rounded-xl text-sm font-bold"
            style={{ background: 'var(--red)', color: '#fff' }}
          >
            Detener
          </button>
        </div>
      )}
    </div>
  )
}
