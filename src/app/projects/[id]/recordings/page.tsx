'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Play, Pause, Trash2, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Recording, Rehearsal } from '@/lib/database.types'

function fmtDuration(s: number) {
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${String(r).padStart(2, '0')}`
}

function RecordingRow({ recording, rehearsalTitle, projectId, onDelete }: {
  recording: Recording; rehearsalTitle: string; projectId: string; onDelete: (id: string) => void
}) {
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
        <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
          {fmtDuration(recording.duration_seconds)} · {new Date(recording.created_at).toLocaleDateString('es-CL')}
        </p>
      </div>
      <Link href={`/projects/${projectId}/rehearsals/${recording.rehearsal_id}`}
        className="hidden sm:flex items-center gap-1 text-xs px-2 py-1 rounded-lg flex-shrink-0"
        style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}
      >{rehearsalTitle} <ChevronRight size={11} /></Link>
      <button
        onClick={() => onDelete(recording.id)}
        className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--red)' }}
      ><Trash2 size={13} /></button>
      <audio ref={audioRef} src={recording.audio_url} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} className="hidden" />
    </div>
  )
}

export default function ProjectRecordingsPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [recordings, setRecordings] = useState<Recording[]>([])
  const [rehearsalTitles, setRehearsalTitles] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [id]) // eslint-disable-line

  async function loadData() {
    const [recsRes, rehsRes] = await Promise.all([
      supabase.from('recordings').select('*').eq('project_id', id).order('created_at', { ascending: false }),
      supabase.from('rehearsals').select('*').eq('project_id', id),
    ])
    setRecordings(recsRes.data || [])
    const titles: Record<string, string> = {}
    ;(rehsRes.data as Rehearsal[] || []).forEach(r => { titles[r.id] = r.title })
    setRehearsalTitles(titles)
    setLoading(false)
  }

  async function deleteRecording(recordingId: string) {
    if (!confirm('¿Eliminar esta grabación?')) return
    await supabase.from('recordings').delete().eq('id', recordingId)
    setRecordings(recordings.filter(r => r.id !== recordingId))
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="w-7 h-7 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--border)', borderTopColor: 'var(--accent)' }} /></div>
  }

  return (
    <div className="min-h-screen pb-28" style={{ background: 'var(--bg-base)' }}>
      <div className="px-4 py-6 max-w-xl mx-auto">
        <Link href={`/projects/${id}`} className="inline-flex items-center gap-1.5 text-sm mb-5" style={{ color: 'var(--text-muted)' }}>
          <ArrowLeft size={14} /> Volver
        </Link>

        <div className="mb-6 fade-in">
          <h1 className="text-xl font-bold leading-tight" style={{ color: 'var(--text-primary)' }}>Grabaciones</h1>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Todas las ideas grabadas en cualquier ensayo</p>
        </div>

        {recordings.length === 0 ? (
          <div className="text-center py-14 fade-in">
            <div className="text-5xl mb-3">🎤</div>
            <p className="font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>No hay grabaciones aún</p>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Entra a un ensayo y presiona grabar para capturar una idea</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {recordings.map(rec => (
              <RecordingRow
                key={rec.id}
                recording={rec}
                rehearsalTitle={rehearsalTitles[rec.rehearsal_id] || 'Ensayo'}
                projectId={id}
                onDelete={deleteRecording}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
