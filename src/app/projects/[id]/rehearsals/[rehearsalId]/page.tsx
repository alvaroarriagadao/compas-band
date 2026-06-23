'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Trash2, Play, Pause, Save } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Rehearsal, Recording } from '@/lib/database.types'
import { AudioRecorder } from '@/components/AudioRecorder'

function fmtDuration(s: number) {
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${String(r).padStart(2, '0')}`
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return null
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })
}

function RecordingRow({ recording, onDelete }: { recording: Recording; onDelete: (id: string) => void }) {
  const [playing, setPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)

  function toggle() {
    if (!audioRef.current) return
    if (playing) { audioRef.current.pause() } else { audioRef.current.play() }
  }

  return (
    <div className="flex items-center gap-3 p-3 rounded-2xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
      <button
        onClick={toggle}
        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: 'var(--bg-elevated)', color: 'var(--accent)' }}
      >
        {playing ? <Pause size={15} /> : <Play size={15} fill="currentColor" />}
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{recording.title}</p>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {fmtDuration(recording.duration_seconds)} · {new Date(recording.created_at).toLocaleDateString('es-CL')}
        </p>
      </div>
      <button
        onClick={() => onDelete(recording.id)}
        className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--red)' }}
      ><Trash2 size={13} /></button>
      <audio ref={audioRef} src={recording.audio_url} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} className="hidden" />
    </div>
  )
}

export default function RehearsalPage() {
  const { id, rehearsalId } = useParams<{ id: string; rehearsalId: string }>()
  const router = useRouter()
  const [rehearsal, setRehearsal] = useState<Rehearsal | null>(null)
  const [recordings, setRecordings] = useState<Recording[]>([])
  const [notes, setNotes] = useState('')
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { loadData() }, [rehearsalId]) // eslint-disable-line

  async function loadData() {
    const [rehRes, recsRes] = await Promise.all([
      supabase.from('rehearsals').select('*').eq('id', rehearsalId).single(),
      supabase.from('recordings').select('*').eq('rehearsal_id', rehearsalId).order('created_at', { ascending: false }),
    ])
    if (rehRes.data) { setRehearsal(rehRes.data); setNotes(rehRes.data.notes || '') }
    setRecordings(recsRes.data || [])
    setLoading(false)
  }

  useEffect(() => {
    if (!dirty || !rehearsal) return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(saveNotes, 1800)
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current) }
  }, [notes, dirty]) // eslint-disable-line

  async function saveNotes() {
    if (!rehearsal) return
    setSaving(true)
    await supabase.from('rehearsals').update({ notes, updated_at: new Date().toISOString() }).eq('id', rehearsal.id)
    setSaving(false)
    setDirty(false)
  }

  async function deleteRecording(recordingId: string) {
    if (!confirm('¿Eliminar esta grabación?')) return
    await supabase.from('recordings').delete().eq('id', recordingId)
    setRecordings(recordings.filter(r => r.id !== recordingId))
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="w-7 h-7 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--border)', borderTopColor: 'var(--accent)' }} /></div>
  }

  if (!rehearsal) {
    return <div className="min-h-screen flex flex-col items-center justify-center gap-3"><p style={{ color: 'var(--text-muted)' }}>Ensayo no encontrado</p><button onClick={() => router.push(`/projects/${id}`)} style={{ color: 'var(--accent)' }}>← Volver</button></div>
  }

  return (
    <div className="min-h-screen pb-28" style={{ background: 'var(--bg-base)' }}>
      <div className="px-4 py-6 max-w-xl mx-auto">
        <Link href={`/projects/${id}`} className="inline-flex items-center gap-1.5 text-sm mb-5" style={{ color: 'var(--text-muted)' }}>
          <ArrowLeft size={14} /> Volver
        </Link>

        <div className="mb-6 fade-in">
          <h1 className="text-xl font-bold leading-tight" style={{ color: 'var(--text-primary)' }}>{rehearsal.title}</h1>
          {rehearsal.rehearsal_date && (
            <p className="text-xs mt-1" style={{ color: 'var(--accent)' }}>📅 {formatDate(rehearsal.rehearsal_date)}</p>
          )}
        </div>

        {/* Recorder */}
        <div className="mb-6">
          <AudioRecorder
            rehearsalId={rehearsal.id}
            projectId={id}
            onSaved={rec => setRecordings([rec, ...recordings])}
          />
        </div>

        {/* Notes */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Notas</p>
            {saving && <span className="text-xs flex items-center gap-1" style={{ color: 'var(--text-muted)' }}><Save size={11} /> Guardando…</span>}
          </div>
          <textarea
            value={notes}
            onChange={e => { setNotes(e.target.value); setDirty(true) }}
            placeholder="Ideas, arreglos, cosas por mejorar…"
            rows={6}
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="none"
            className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
          />
        </div>

        {/* Recordings */}
        <div>
          <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>
            Grabaciones <span className="opacity-60">({recordings.length})</span>
          </p>
          {recordings.length === 0 ? (
            <div className="text-center py-10 fade-in">
              <div className="text-4xl mb-2">🎤</div>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Aún no hay grabaciones en este ensayo</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {recordings.map(rec => <RecordingRow key={rec.id} recording={rec} onDelete={deleteRecording} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
