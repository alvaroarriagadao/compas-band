'use client'

import { useRef, useState } from 'react'
import { Mic, Square, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Recording } from '@/lib/database.types'

interface Props {
  /** Fixed rehearsal to attach recordings to. */
  rehearsalId?: string
  /** Resolved lazily when there is no fixed rehearsal (e.g. "Ideas generales"). */
  resolveRehearsalId?: () => Promise<string | null>
  projectId: string
  label?: string
  onSaved: (recording: Recording) => void
}

function pickMimeType() {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
  for (const c of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(c)) return c
  }
  return ''
}

export function AudioRecorder({ rehearsalId, resolveRehearsalId, projectId, label, onSaved }: Props) {
  const [recording, setRecording] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [error, setError] = useState('')
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const secondsRef = useRef(0)

  async function startRecording() {
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mimeType = pickMimeType()
      const mr = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
      chunksRef.current = []
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = handleStop
      mediaRecorderRef.current = mr
      mr.start()
      setRecording(true)
      setSeconds(0)
      secondsRef.current = 0
      timerRef.current = setInterval(() => {
        secondsRef.current += 1
        setSeconds(secondsRef.current)
      }, 1000)
    } catch {
      setError('No se pudo acceder al micrófono. Revisa los permisos.')
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop()
    streamRef.current?.getTracks().forEach(t => t.stop())
    if (timerRef.current) clearInterval(timerRef.current)
    setRecording(false)
  }

  async function handleStop() {
    setUploading(true)

    const targetRehearsalId = rehearsalId ?? (await resolveRehearsalId?.() ?? null)
    if (!targetRehearsalId) {
      setError('No se pudo preparar el destino de la grabación. Revisa que las tablas de ensayos existan en Supabase.')
      setUploading(false)
      setSeconds(0)
      return
    }

    const mimeType = mediaRecorderRef.current?.mimeType || 'audio/webm'
    const ext = mimeType.includes('mp4') ? 'm4a' : 'webm'
    const blob = new Blob(chunksRef.current, { type: mimeType })
    const path = `${projectId}/${targetRehearsalId}/${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('rehearsal-recordings')
      .upload(path, blob, { contentType: mimeType })

    if (!uploadError) {
      const { data: { publicUrl } } = supabase.storage
        .from('rehearsal-recordings')
        .getPublicUrl(path)

      const { data, error: insertError } = await supabase
        .from('recordings')
        .insert({
          rehearsal_id: targetRehearsalId,
          project_id: projectId,
          title: `Idea ${new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}`,
          audio_url: publicUrl,
          duration_seconds: secondsRef.current,
        })
        .select().single()
      if (data) onSaved(data)
      else if (insertError) setError(`Error al guardar: ${insertError.message}`)
    } else {
      setError(`Error al subir: ${uploadError.message}`)
    }
    setUploading(false)
    setSeconds(0)
  }

  function fmt(s: number) {
    const m = Math.floor(s / 60)
    const r = s % 60
    return `${m}:${String(r).padStart(2, '0')}`
  }

  return (
    <div className="rounded-2xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
            {recording ? 'Grabando…' : uploading ? 'Guardando…' : (label || 'Grabar idea')}
          </p>
          {recording && <p className="text-xs tabular-nums" style={{ color: 'var(--red)' }}>● {fmt(seconds)}</p>}
        </div>
        <button
          onClick={recording ? stopRecording : startRecording}
          disabled={uploading}
          className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 transition-all duration-200"
          style={{
            background: recording ? 'var(--red)' : 'var(--green)',
            boxShadow: recording ? '0 0 20px rgba(239,68,68,0.4)' : '0 0 20px rgba(16,185,129,0.4)',
            opacity: uploading ? 0.6 : 1,
          }}
        >
          {uploading ? <Loader2 size={20} color="#fff" className="animate-spin" />
            : recording ? <Square size={20} color="#fff" />
            : <Mic size={20} color="#fff" />}
        </button>
      </div>
      {error && <p className="text-xs mt-2" style={{ color: 'var(--red)' }}>{error}</p>}
    </div>
  )
}
