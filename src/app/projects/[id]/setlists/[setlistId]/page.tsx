'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor,
  useSensor, useSensors, type DragEndEvent
} from '@dnd-kit/core'
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  useSortable, verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ArrowLeft, Plus, GripVertical, X, Trash2, Play, Square, Calendar, MapPin } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Song, Setlist, SetlistSong } from '@/lib/database.types'
import { useMetronomeStore } from '@/stores/metronomeStore'

interface SetlistSongFull extends SetlistSong {
  song: Song | null
}

function SortableSetlistSong({ item, index, onRemove }: {
  item: SetlistSongFull; index: number; onRemove: (id: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })
  const { isPlaying, playingSongId, currentBeat, beatsPerMeasure, toggle } = useMetronomeStore()
  const song = item.song
  const isThisPlaying = isPlaying && song && playingSongId === song.id

  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1, zIndex: isDragging ? 10 : 'auto' }} {...attributes} className="group">
      <div className="flex items-center gap-2 px-3 py-3 rounded-2xl transition-all"
        style={{
          background: isThisPlaying ? 'var(--bg-elevated)' : 'var(--bg-card)',
          border: `1px solid ${isThisPlaying ? 'rgba(16,185,129,0.4)' : isDragging ? 'var(--border-bright)' : 'var(--border)'}`,
        }}
      >
        {/* Number */}
        <span className="w-6 text-center text-sm font-black flex-shrink-0 tabular-nums" style={{ color: 'var(--accent)' }}>{index + 1}</span>

        {/* Dots */}
        <div {...listeners} className="cursor-grab active:cursor-grabbing flex-shrink-0 touch-none px-0.5 flex flex-col gap-0.5">
          {[0,1,2].map(r => <div key={r} className="flex gap-0.5">{[0,1].map(c => <div key={c} className="w-1 h-1 rounded-full" style={{ background: isDragging ? 'var(--accent)' : 'var(--border-bright)' }} />)}</div>)}
        </div>

        {/* Beat dots */}
        {isThisPlaying && (
          <div className="flex gap-1 flex-shrink-0">
            {Array.from({ length: Math.min(beatsPerMeasure, 4) }).map((_, i) => (
              <div key={i} className="rounded-full transition-all duration-75" style={{
                width: i === 0 ? 9 : 6, height: i === 0 ? 9 : 6,
                background: currentBeat === i ? (i === 0 ? 'var(--accent)' : 'var(--green)') : 'var(--border)',
                transform: currentBeat === i ? 'scale(1.3)' : 'scale(1)',
              }} />
            ))}
          </div>
        )}

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm truncate" style={{ color: isThisPlaying ? 'var(--green)' : 'var(--text-primary)' }}>
            {song?.title || item.custom_title || 'Sin título'}
          </p>
          {song && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{song.bpm} BPM</p>}
          {item.notes && <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{item.notes}</p>}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {song && (
            <button
              onClick={() => toggle({ songId: song.id, songTitle: song.title, bpm: song.bpm })}
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-all"
              style={{
                background: isThisPlaying ? 'var(--red)' : 'var(--green)',
                boxShadow: isThisPlaying ? '0 0 10px rgba(239,68,68,0.3)' : '0 0 10px rgba(16,185,129,0.3)',
              }}
            >
              {isThisPlaying ? <Square size={12} color="#fff" /> : <Play size={12} color="#fff" fill="white" />}
            </button>
          )}
          <button onClick={() => onRemove(item.id)}
            className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--red)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'}
          ><X size={13} /></button>
        </div>
      </div>
    </div>
  )
}

export default function SetlistPage() {
  const { id, setlistId } = useParams<{ id: string; setlistId: string }>()
  const router = useRouter()
  const [setlist, setSetlist] = useState<Setlist | null>(null)
  const [items, setItems] = useState<SetlistSongFull[]>([])
  const [availableSongs, setAvailableSongs] = useState<Song[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')

  const { isPlaying, stop } = useMetronomeStore()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  useEffect(() => { loadData() }, [setlistId]) // eslint-disable-line

  async function loadData() {
    const [slRes, songsRes] = await Promise.all([
      supabase.from('setlists').select('*').eq('id', setlistId).single(),
      supabase.from('songs').select('*').eq('project_id', id).order('song_order'),
    ])
    setSetlist(slRes.data)
    setEditName(slRes.data?.name || '')
    setAvailableSongs(songsRes.data || [])

    // Load setlist songs with joined song data
    const { data: slSongs } = await supabase
      .from('setlist_songs')
      .select('*')
      .eq('setlist_id', setlistId)
      .order('song_order')

    const songMap = new Map((songsRes.data || []).map(s => [s.id, s]))
    setItems((slSongs || []).map(ss => ({ ...ss, song: ss.song_id ? (songMap.get(ss.song_id) || null) : null })))
    setLoading(false)
  }

  async function addSong(song: Song) {
    const order = items.length
    const { data } = await supabase
      .from('setlist_songs')
      .insert({ setlist_id: setlistId, song_id: song.id, song_order: order })
      .select().single()
    if (data) setItems([...items, { ...data, song }])
    setShowAdd(false)
  }

  async function removeItem(itemId: string) {
    await supabase.from('setlist_songs').delete().eq('id', itemId)
    setItems(items.filter(i => i.id !== itemId))
  }

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIdx = items.findIndex(i => i.id === active.id)
    const newIdx = items.findIndex(i => i.id === over.id)
    const reordered = arrayMove(items, oldIdx, newIdx)
    setItems(reordered)
    await Promise.all(reordered.map((item, idx) =>
      supabase.from('setlist_songs').update({ song_order: idx }).eq('id', item.id)
    ))
  }, [items])

  async function saveSetlistName() {
    if (!editName.trim() || !setlist) return
    await supabase.from('setlists').update({ name: editName.trim() }).eq('id', setlistId)
    setSetlist({ ...setlist, name: editName.trim() })
    setEditing(false)
  }

  function formatDate(dateStr: string | null) {
    if (!dateStr) return null
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  }

  const addedIds = new Set(items.map(i => i.song_id).filter(Boolean))
  const notAdded = availableSongs.filter(s => !addedIds.has(s.id))

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-7 h-7 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--border)', borderTopColor: 'var(--accent)' }} />
    </div>
  )

  return (
    <div className="min-h-screen pb-24" style={{ background: 'var(--bg-base)' }}>
      <div className="px-4 py-6 max-w-xl mx-auto">
        {/* Back */}
        <Link href={`/projects/${id}`} className="inline-flex items-center gap-1.5 text-sm mb-5" style={{ color: 'var(--text-muted)' }}>
          <ArrowLeft size={14} /> Setlists
        </Link>

        {/* Header */}
        <div className="mb-6 fade-in">
          {editing ? (
            <div className="flex gap-2 items-center mb-2">
              <input autoFocus value={editName} onChange={e => setEditName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveSetlistName(); if (e.key === 'Escape') setEditing(false) }}
                className="flex-1 px-3 py-2 rounded-xl font-bold text-xl outline-none"
                style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--accent)' }}
              />
              <button onClick={saveSetlistName} className="px-3 py-2 rounded-xl text-sm font-bold" style={{ background: 'var(--accent)', color: '#000' }}>✓</button>
              <button onClick={() => setEditing(false)} className="px-3 py-2 rounded-xl text-sm" style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>✕</button>
            </div>
          ) : (
            <button onClick={() => setEditing(true)} className="text-left mb-1 hover:opacity-70 transition-opacity">
              <h1 className="text-2xl font-black" style={{ color: 'var(--text-primary)' }}>{setlist?.name}</h1>
            </button>
          )}
          <div className="flex items-center gap-4 flex-wrap">
            {setlist?.event_date && (
              <span className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--accent)' }}>
                <Calendar size={13} /> {formatDate(setlist.event_date)}
              </span>
            )}
            {setlist?.venue && (
              <span className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--text-muted)' }}>
                <MapPin size={13} /> {setlist.venue}
              </span>
            )}
          </div>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            {items.length} {items.length === 1 ? 'canción' : 'canciones'} · Toca el título para editar
          </p>
        </div>

        {/* Add song button */}
        {notAdded.length > 0 && (
          <button onClick={() => setShowAdd(!showAdd)}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed mb-4 text-sm font-medium transition-all duration-200"
            style={{ borderColor: showAdd ? 'var(--accent)' : 'var(--border-bright)', color: showAdd ? 'var(--accent)' : 'var(--text-secondary)' }}
          ><Plus size={14} /> {showAdd ? 'Cancelar' : 'Agregar canción al setlist'}</button>
        )}

        {/* Song picker */}
        {showAdd && notAdded.length > 0 && (
          <div className="rounded-2xl overflow-hidden mb-4 fade-in" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-bright)' }}>
            <p className="text-xs font-bold uppercase tracking-widest px-4 pt-3 pb-2" style={{ color: 'var(--accent)' }}>Canciones del proyecto</p>
            {notAdded.map(song => (
              <button key={song.id} onClick={() => addSong(song)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
                style={{ borderTop: '1px solid var(--border)' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-elevated)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
              >
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'var(--bg-elevated)' }}>
                  <span className="text-xs font-bold" style={{ color: 'var(--accent)' }}>+</span>
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{song.title}</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{song.bpm} BPM</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Setlist */}
        {items.length === 0 ? (
          <div className="text-center py-14">
            <div className="text-5xl mb-3">🎤</div>
            <p className="font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>Setlist vacío</p>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Agrega canciones para armar tu setlist</p>
          </div>
        ) : (
          <>
            <p className="text-xs mb-2 flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>⋮⋮ Arrastra para reordenar</p>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
                <div className="flex flex-col gap-2">
                  {items.map((item, idx) => (
                    <SortableSetlistSong key={item.id} item={item} index={idx} onRemove={removeItem} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>

            {/* Total duration hint */}
            <div className="mt-4 pt-4 flex justify-between text-sm" style={{ borderTop: '1px solid var(--border)', color: 'var(--text-muted)' }}>
              <span>{items.length} canciones</span>
              <span>~{Math.round(items.length * 3.5)} min aprox</span>
            </div>
          </>
        )}
      </div>

      {/* Metronome status */}
      {isPlaying && (
        <div className="fixed bottom-0 left-0 right-0" style={{ background: 'rgba(14,14,26,0.97)', borderTop: '1px solid rgba(16,185,129,0.4)', backdropFilter: 'blur(16px)', padding: '12px 16px' }}>
          <div className="flex items-center justify-between max-w-xl mx-auto">
            <p className="text-sm font-bold" style={{ color: 'var(--green)' }}>▶ Metrónomo activo</p>
            <button onClick={stop} className="px-4 py-1.5 rounded-xl text-sm font-bold" style={{ background: 'var(--red)', color: '#fff' }}>Detener</button>
          </div>
        </div>
      )}
    </div>
  )
}
