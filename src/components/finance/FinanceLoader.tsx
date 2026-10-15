'use client'

import { useCallback, useEffect, useState } from 'react'
import { FinanceView } from './FinanceView'
import type { FinanceSnapshot } from '@/lib/finance'

interface Props {
  query: { project?: string; code?: string }
  canEdit: boolean
  backHref: string
  backLabel: string
  onUnauthorized?: () => void
}

export function FinanceLoader({ query, canEdit, backHref, backLabel, onUnauthorized }: Props) {
  const [snap, setSnap] = useState<FinanceSnapshot | null>(null)
  const [error, setError] = useState('')
  const [localViewer, setLocalViewer] = useState<string | null>(null)
  const [picking, setPicking] = useState(false)
  const qs = query.project ? `project=${query.project}` : `code=${encodeURIComponent(query.code || '')}`

  const load = useCallback(async () => {
    const res = await fetch(`/api/finance?${qs}`, { cache: 'no-store' })
    if (res.status === 401) { onUnauthorized?.(); return }
    const json = await res.json()
    if (!res.ok) { setError(json.error || 'Error'); return }
    setSnap(json)
    if (!canEdit) { try { setLocalViewer(localStorage.getItem(`fin-viewer-${json.project.id}`)) } catch { /* sin storage */ } }
  }, [qs, onUnauthorized, canEdit])

  // La carga es asíncrona: el estado se actualiza después del fetch, no dentro del efecto.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load])

  const act = useCallback(async (action: string, payload: Record<string, unknown>) => {
    if (!snap) return false
    const res = await fetch('/api/finance', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action, project_id: snap.project.id, ...payload }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) { window.alert(json.error || 'No se pudo guardar'); return false }
    await load()
    return true
  }, [snap, load])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 text-center" style={{ background: 'var(--bg-base)' }}>
        <p className="text-sm" style={{ color: 'var(--red)' }}>{error}</p>
      </div>
    )
  }
  if (!snap) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-base)' }}>
        <div className="w-7 h-7 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--border)', borderTopColor: 'var(--accent)' }} />
      </div>
    )
  }

  // Por defecto: con sesión, el integrante vinculado a mi cuenta; sin sesión, el elegido en este dispositivo.
  // "cambiar" permite ver el resumen de cualquier integrante.
  const linked = snap.me?.member_id ?? null
  const valid = (id: string | null) => (id && snap.members.some(m => m.id === id) ? id : null)
  const viewerId = picking ? null : (valid(localViewer) ?? valid(linked))

  function onPickViewer(memberId: string) {
    if (!memberId) { setPicking(true); return }
    setPicking(false)
    setLocalViewer(memberId)
    if (!canEdit) {
      try { localStorage.setItem(`fin-viewer-${snap!.project.id}`, memberId) } catch { /* sin storage */ }
    } else if (!linked) {
      // Primera vez con sesión: vincula mi cuenta a ese integrante
      act('member.claim', { id: memberId })
    }
  }

  return (
    <FinanceView snap={snap} canEdit={canEdit} viewerId={viewerId} onPickViewer={onPickViewer} act={act} backHref={backHref} backLabel={backLabel} />
  )
}
