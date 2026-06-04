'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, Edit3, Info, ChevronDown, ChevronUp, BookOpen } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Project, Song } from '@/lib/database.types'
import { Metronome } from '@/components/Metronome'
import { LyricsDisplay } from '@/components/LyricsDisplay'
import { useMetronomeStore } from '@/stores/metronomeStore'

type LyricsMode = 'view' | 'edit'

const CHORD_HELP = `Escribe acordes entre corchetes justo antes de la sílaba:

[Am]Hola [G]mundo cómo [C]estás
Esto es una [Em]línea sin acorde al inicio

Los acordes aparecen en morado sobre la letra.
Líneas vacías separan estrofas.`

const COMMON_CHORDS = ['Am', 'Em', 'Dm', 'G', 'C', 'F', 'E', 'A', 'D', 'Bm', 'F#m', 'Cm', 'Gm', 'Bb']

export default function SongPage() {
  const { id, songId } = useParams<{ id: string; songId: string }>()
  const router = useRouter()
  const [project, setProject] = useState<Project | null>(null)
  const [song, setSong] = useState<Song | null>(null)
  const [loading, setLoading] = useState(true)
  const [lyrics, setLyrics] = useState('')
  const [notes, setNotes] = useState('')
  const [bpm, setBpm] = useState(120)
  const [title, setTitle] = useState('')
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [bpmPendingSave, setBpmPendingSave] = useState(false)
  const [lyricsMode, setLyricsMode] = useState<LyricsMode>('view')
  const [showHelp, setShowHelp] = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)
  const [metroCollapsed, setMetroCollapsed] = useState(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const { setBpm: setStoreBpm } = useMetronomeStore()

  useEffect(() => { loadData() }, [songId]) // eslint-disable-line

  async function loadData() {
    const [projRes, songRes] = await Promise.all([
      supabase.from('projects').select('*').eq('id', id).single(),
      supabase.from('songs').select('*').eq('id', songId).single()
    ])
    setProject(projRes.data)
    if (songRes.data) {
      setSong(songRes.data)
      setLyrics(songRes.data.lyrics || '')
      setNotes(songRes.data.notes || '')
      setBpm(songRes.data.bpm)
      setTitle(songRes.data.title)
      // Sync store BPM when entering song
      setStoreBpm(songRes.data.bpm)
    }
    setLoading(false)
  }

  // Auto-save ONLY lyrics and notes — NOT bpm (multi-user safety)
  useEffect(() => {
    if (!dirty || !song) return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(saveLyricsNotes, 1800)
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current) }
  }, [lyrics, notes, title, dirty]) // eslint-disable-line

  async function saveLyricsNotes() {
    if (!song) return
    setSaving(true)
    await supabase.from('songs').update({ lyrics, notes, title }).eq('id', song.id)
    setSaving(false)
    setDirty(false)
  }

  async function saveBpm() {
    if (!song) return
    await supabase.from('songs').update({ bpm }).eq('id', song.id)
    setBpmPendingSave(false)
  }

  async function saveAll() {
    if (!song) return
    setSaving(true)
    await supabase.from('songs').update({ lyrics, notes, bpm, title }).eq('id', song.id)
    setSaving(false)
    setDirty(false)
    setBpmPendingSave(false)
  }

  function handleBpmChange(val: number) {
    setBpm(val)
    setStoreBpm(val)
    setBpmPendingSave(true) // BPM needs manual save
  }

  function insertChord(chord: string) {
    if (!textareaRef.current) return
    const ta = textareaRef.current
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const newText = `${lyrics.substring(0, start)}[${chord}]${lyrics.substring(start, end)}${lyrics.substring(end)}`
    setLyrics(newText)
    setDirty(true)
    setTimeout(() => {
      ta.focus()
      ta.setSelectionRange(start + chord.length + 2, start + chord.length + 2 + (end - start))
    }, 0)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-7 h-7 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--border)', borderTopColor: 'var(--accent)' }} />
      </div>
    )
  }

  if (!song) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p style={{ color: 'var(--text-muted)' }}>Canción no encontrada</p>
        <button onClick={() => router.push(`/projects/${id}`)} style={{ color: 'var(--accent)' }}>← Volver</button>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-base)' }}>
      {/* Top bar */}
      <div
        className="sticky top-0 z-20 px-4 py-3 flex items-center gap-3"
        style={{ background: 'rgba(7,7,15,0.96)', borderBottom: '1px solid var(--border)', backdropFilter: 'blur(12px)' }}
      >
        <Link href={`/projects/${id}`} className="p-2 rounded-xl flex-shrink-0 transition-colors" style={{ color: 'var(--text-muted)' }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'}
        ><ArrowLeft size={17} /></Link>

        <div className="flex-1 min-w-0">
          {editingTitle ? (
            <input autoFocus value={title}
              onChange={e => { setTitle(e.target.value); setDirty(true) }}
              onBlur={() => setEditingTitle(false)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') setEditingTitle(false) }}
              className="w-full font-bold text-sm outline-none bg-transparent border-b pb-0.5"
              style={{ color: 'var(--text-primary)', borderColor: 'var(--accent)' }}
            />
          ) : (
            <button onClick={() => setEditingTitle(true)}
              className="font-bold text-sm text-left truncate max-w-full block hover:opacity-70 transition-opacity"
              style={{ color: 'var(--text-primary)' }}>{title}</button>
          )}
          <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
            {project?.name} · {bpm} BPM
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {(dirty || bpmPendingSave) && !saving && (
            <button onClick={saveAll}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold"
              style={{ background: bpmPendingSave ? 'var(--red)' : 'var(--accent)', color: '#000' }}>
              <Save size={11} /> {bpmPendingSave ? 'Guardar BPM' : 'Guardar'}
            </button>
          )}
          {saving && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Guardando…</span>}
          {!dirty && !saving && !bpmPendingSave && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>✓</span>}
          <Link
            href={`/projects/${id}/songs/${songId}/read`}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
            style={{ background: 'rgba(167,139,250,0.12)', color: '#a78bfa' }}
            title="Modo lectura"
          >
            <BookOpen size={12} /> Leer
          </Link>
        </div>
      </div>

      {/* Main content — responsive layout */}
      <div className="flex-1 flex flex-col lg:flex-row gap-0 lg:gap-0">

        {/* ── LEFT: Lyrics ── */}
        <div className="flex-1 min-w-0 px-4 py-4 lg:px-6 lg:py-6 lg:overflow-y-auto">
          {/* Mode toggle */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--bg-card)' }}>
              <button
                onClick={() => setLyricsMode('view')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={{
                  background: lyricsMode === 'view' ? 'var(--bg-elevated)' : 'transparent',
                  color: lyricsMode === 'view' ? 'var(--text-primary)' : 'var(--text-muted)',
                }}
              >🎼 Ver</button>
              <button
                onClick={() => setLyricsMode('edit')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={{
                  background: lyricsMode === 'edit' ? 'var(--bg-elevated)' : 'transparent',
                  color: lyricsMode === 'edit' ? 'var(--text-primary)' : 'var(--text-muted)',
                }}
              ><Edit3 size={11} /> Editar</button>
            </div>
            {lyricsMode === 'edit' && (
              <button
                onClick={() => setShowHelp(!showHelp)}
                className="flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg transition-colors"
                style={{ color: showHelp ? 'var(--chord-color)' : 'var(--text-muted)' }}
              ><Info size={12} /> Acordes</button>
            )}
          </div>

          {/* Help */}
          {showHelp && lyricsMode === 'edit' && (
            <div className="rounded-2xl p-4 mb-4 fade-in" style={{ background: 'var(--chord-bg)', border: '1px solid rgba(167,139,250,0.4)' }}>
              <pre className="text-xs whitespace-pre-wrap font-mono leading-relaxed" style={{ color: 'var(--chord-color)' }}>{CHORD_HELP}</pre>
            </div>
          )}

          {lyricsMode === 'edit' ? (
            <>
              {/* Quick chords */}
              <div className="mb-3">
                <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>Insertar en el cursor:</p>
                <div className="flex flex-wrap gap-1.5">
                  {COMMON_CHORDS.map(chord => (
                    <button key={chord} onClick={() => insertChord(chord)}
                      className="px-2.5 py-1 rounded-lg text-xs font-bold transition-all"
                      style={{ background: 'var(--chord-bg)', color: 'var(--chord-color)', border: '1px solid rgba(167,139,250,0.25)' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(167,139,250,0.2)'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--chord-bg)'}
                    >{chord}</button>
                  ))}
                </div>
              </div>

              {/* Textarea */}
              <div className="relative mb-4">
                <textarea
                  ref={textareaRef}
                  value={lyrics}
                  onChange={e => { setLyrics(e.target.value); setDirty(true) }}
                  placeholder={'Escribe la letra aquí...\n\nEjemplo:\n[Am]Hola [G]mundo\n[C]Esta es la [Em]letra\n\nDeja líneas vacías entre estrofas'}
                  rows={16}
                  className="w-full px-4 py-4 rounded-2xl text-sm outline-none resize-none font-mono leading-loose"
                  spellCheck={false}
                  autoCorrect="off"
                  autoCapitalize="off"
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-primary)',
                    caretColor: 'var(--accent)',
                    whiteSpace: 'pre',
                    overflowWrap: 'normal',
                    overflowX: 'auto',
                  }}
                  onFocus={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-bright)'}
                  onBlur={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'}
                />
                <div className="absolute top-3 right-3 pointer-events-none">
                  <span className="text-xs px-2 py-0.5 rounded-lg" style={{ background: 'var(--chord-bg)', color: 'var(--chord-color)' }}>[Acorde]</span>
                </div>
              </div>

              {/* Notes */}
              <div>
                <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>Notas / recordatorios:</p>
                <textarea
                  value={notes}
                  onChange={e => { setNotes(e.target.value); setDirty(true) }}
                  placeholder="Intro, puente, instrucciones de ensayo..."
                  rows={3}
                  className="w-full px-4 py-3 rounded-2xl text-sm outline-none resize-none"
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
                />
              </div>
            </>
          ) : (
            /* View mode */
            <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <div className="px-5 pt-5 pb-4" style={{ borderBottom: '1px solid var(--border)' }}>
                <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{title}</h2>
                <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>{project?.name} · {bpm} BPM</p>
              </div>
              <div className="px-5 py-5">
                <LyricsDisplay lyrics={lyrics} />
              </div>
              {notes && (
                <div className="px-5 pb-5 pt-1">
                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                    <p className="text-xs font-bold mb-2 uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Notas</p>
                    <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>{notes}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── RIGHT / BOTTOM: Metronome ── */}
        <div
          className="lg:w-80 lg:flex-shrink-0 lg:sticky lg:top-14 lg:h-[calc(100vh-56px)] lg:overflow-y-auto px-4 pb-6 pt-2 lg:pt-6 lg:pr-6 lg:pl-4 lg:border-l"
          style={{ borderColor: 'var(--border)' }}
        >
          {/* Mobile: collapsible header */}
          <button
            className="flex items-center justify-between w-full py-2 mb-3 lg:hidden"
            onClick={() => setMetroCollapsed(!metroCollapsed)}
          >
            <span className="text-sm font-bold" style={{ color: 'var(--text-secondary)' }}>🥁 Metrónomo</span>
            {metroCollapsed ? <ChevronDown size={16} style={{ color: 'var(--text-muted)' }} /> : <ChevronUp size={16} style={{ color: 'var(--text-muted)' }} />}
          </button>

          <div className={metroCollapsed ? 'hidden lg:block' : 'block'}>
            <Metronome
              songId={songId}
              songTitle={title}
              initialBpm={bpm}
              onBpmChange={handleBpmChange}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
