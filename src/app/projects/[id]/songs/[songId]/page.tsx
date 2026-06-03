'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, Eye, Edit3, Info } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Project, Song } from '@/lib/database.types'
import { Metronome } from '@/components/Metronome'
import { LyricsDisplay } from '@/components/LyricsDisplay'

type Tab = 'lyrics' | 'metronome'
type LyricsMode = 'edit' | 'view'

const CHORD_HELP = `Escribe acordes entre corchetes antes de la sílaba:

[Am]Hola [G]mundo cómo [C]estás
Esto es una [Em]línea sin acorde

Los acordes aparecerán sobre la letra en morado.
Líneas vacías = separador de estrofa.`

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
  const [tab, setTab] = useState<Tab>('lyrics')
  const [lyricsMode, setLyricsMode] = useState<LyricsMode>('edit')
  const [showHelp, setShowHelp] = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

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
    }
    setLoading(false)
  }

  // Auto-save with debounce
  useEffect(() => {
    if (!dirty || !song) return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => saveAll(), 1500)
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current) }
  }, [lyrics, notes, bpm, title, dirty]) // eslint-disable-line

  async function saveAll() {
    if (!song) return
    setSaving(true)
    await supabase.from('songs').update({ lyrics, notes, bpm, title }).eq('id', song.id)
    setSaving(false)
    setDirty(false)
  }

  function handleLyricsChange(val: string) {
    setLyrics(val)
    setDirty(true)
  }

  function handleBpmChange(val: number) {
    setBpm(val)
    setDirty(true)
  }

  // Insert chord at cursor
  function insertChord(chord: string) {
    if (!textareaRef.current) return
    const ta = textareaRef.current
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const before = lyrics.substring(0, start)
    const selected = lyrics.substring(start, end)
    const after = lyrics.substring(end)
    const newText = `${before}[${chord}]${selected}${after}`
    setLyrics(newText)
    setDirty(true)
    setTimeout(() => {
      ta.focus()
      ta.setSelectionRange(start + chord.length + 2, start + chord.length + 2 + selected.length)
    }, 0)
  }

  const commonChords = ['Am', 'Em', 'Dm', 'G', 'C', 'F', 'E', 'A', 'D', 'Bm', 'F#m', 'Cm']

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
    <div className="min-h-screen pb-24" style={{ background: 'var(--bg-base)' }}>
      {/* Top bar */}
      <div
        className="sticky top-0 z-10 px-4 py-3 flex items-center gap-3"
        style={{ background: 'rgba(7,7,15,0.95)', borderBottom: '1px solid var(--border)', backdropFilter: 'blur(12px)' }}
      >
        <Link
          href={`/projects/${id}`}
          className="p-2 rounded-xl transition-colors flex-shrink-0"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'}
        >
          <ArrowLeft size={18} />
        </Link>

        <div className="flex-1 min-w-0">
          {editingTitle ? (
            <input
              autoFocus
              value={title}
              onChange={e => { setTitle(e.target.value); setDirty(true) }}
              onBlur={() => setEditingTitle(false)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') setEditingTitle(false) }}
              className="w-full font-bold text-base outline-none bg-transparent border-b pb-0.5"
              style={{ color: 'var(--text-primary)', borderColor: 'var(--accent)' }}
            />
          ) : (
            <button
              onClick={() => setEditingTitle(true)}
              className="font-bold text-base text-left hover:opacity-70 transition-opacity truncate max-w-full block"
              style={{ color: 'var(--text-primary)' }}
            >
              {title}
            </button>
          )}
          {project && (
            <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{project.name} · {bpm} BPM</p>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {dirty && !saving && (
            <button
              onClick={saveAll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
              style={{ background: 'var(--accent)', color: '#000' }}
            >
              <Save size={12} /> Guardar
            </button>
          )}
          {saving && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Guardando…</span>}
          {!dirty && !saving && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>✓ Guardado</span>}
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex px-4 pt-4 gap-2 mb-4">
        {(['lyrics', 'metronome'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-4 py-2 rounded-xl text-sm font-semibold transition-all"
            style={{
              background: tab === t ? 'var(--bg-elevated)' : 'transparent',
              color: tab === t ? 'var(--text-primary)' : 'var(--text-muted)',
              border: `1px solid ${tab === t ? 'var(--border-bright)' : 'transparent'}`,
            }}
          >
            {t === 'lyrics' ? '🎼 Letra' : '🥁 Metrónomo'}
          </button>
        ))}
      </div>

      <div className="px-4">
        {/* ── LYRICS TAB ── */}
        {tab === 'lyrics' && (
          <div className="fade-in">
            {/* Mode toggle */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--bg-card)' }}>
                <button
                  onClick={() => setLyricsMode('edit')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                  style={{
                    background: lyricsMode === 'edit' ? 'var(--bg-elevated)' : 'transparent',
                    color: lyricsMode === 'edit' ? 'var(--text-primary)' : 'var(--text-muted)',
                  }}
                >
                  <Edit3 size={11} /> Editar
                </button>
                <button
                  onClick={() => setLyricsMode('view')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                  style={{
                    background: lyricsMode === 'view' ? 'var(--bg-elevated)' : 'transparent',
                    color: lyricsMode === 'view' ? 'var(--text-primary)' : 'var(--text-muted)',
                  }}
                >
                  <Eye size={11} /> Vista final
                </button>
              </div>
              <button
                onClick={() => setShowHelp(!showHelp)}
                className="flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg transition-colors"
                style={{ color: showHelp ? 'var(--chord-color)' : 'var(--text-muted)' }}
              >
                <Info size={12} /> Acordes
              </button>
            </div>

            {/* Help panel */}
            {showHelp && (
              <div className="rounded-2xl p-4 mb-4 fade-in" style={{ background: 'var(--chord-bg)', border: '1px solid rgba(167,139,250,0.4)' }}>
                <pre className="text-xs whitespace-pre-wrap font-mono" style={{ color: 'var(--chord-color)' }}>{CHORD_HELP}</pre>
              </div>
            )}

            {lyricsMode === 'edit' ? (
              <>
                {/* Quick chord buttons */}
                <div className="mb-3">
                  <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>Acordes rápidos (inserta en el cursor):</p>
                  <div className="flex flex-wrap gap-1.5">
                    {commonChords.map(chord => (
                      <button
                        key={chord}
                        onClick={() => insertChord(chord)}
                        className="px-2.5 py-1 rounded-lg text-xs font-bold transition-all"
                        style={{
                          background: 'var(--chord-bg)',
                          color: 'var(--chord-color)',
                          border: '1px solid rgba(167,139,250,0.3)',
                        }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(167,139,250,0.2)'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--chord-bg)'}
                      >
                        {chord}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Lyrics textarea */}
                <div className="relative">
                  <textarea
                    ref={textareaRef}
                    value={lyrics}
                    onChange={e => handleLyricsChange(e.target.value)}
                    placeholder={`Escribe la letra aquí...\n\nEjemplo:\n[Am]Hola [G]mundo\n[C]Esta es la [Em]letra\n\nDeja líneas vacías entre estrofas`}
                    rows={20}
                    className="w-full px-4 py-4 rounded-2xl text-sm outline-none resize-none font-mono leading-loose"
                    style={{
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-primary)',
                      caretColor: 'var(--accent)',
                    }}
                    onFocus={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-bright)'}
                    onBlur={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'}
                  />
                  {/* Chord highlight hint */}
                  <div className="absolute top-3 right-3 pointer-events-none">
                    <span className="text-xs px-2 py-0.5 rounded-lg" style={{ background: 'var(--chord-bg)', color: 'var(--chord-color)' }}>
                      [Acorde]
                    </span>
                  </div>
                </div>

                {/* Notes */}
                <div className="mt-4">
                  <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>Notas / recordatorios:</p>
                  <textarea
                    value={notes}
                    onChange={e => { setNotes(e.target.value); setDirty(true) }}
                    placeholder="Intro, puente, instrucciones de ensayo..."
                    rows={3}
                    className="w-full px-4 py-3 rounded-2xl text-sm outline-none resize-none"
                    style={{
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-secondary)',
                    }}
                  />
                </div>
              </>
            ) : (
              /* View mode */
              <div className="rounded-2xl p-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                <div className="mb-6 pb-4" style={{ borderBottom: '1px solid var(--border)' }}>
                  <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{title}</h2>
                  <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{project?.name} · {bpm} BPM</p>
                </div>
                <LyricsDisplay lyrics={lyrics} />
                {notes && (
                  <div className="mt-6 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
                    <p className="text-xs font-bold mb-2" style={{ color: 'var(--text-muted)' }}>NOTAS</p>
                    <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>{notes}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── METRONOME TAB ── */}
        {tab === 'metronome' && (
          <div className="fade-in max-w-sm mx-auto">
            <Metronome
              initialBpm={bpm}
              onBpmChange={handleBpmChange}
            />
          </div>
        )}
      </div>
    </div>
  )
}
