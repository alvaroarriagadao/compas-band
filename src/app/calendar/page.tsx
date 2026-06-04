'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, Plus, X, Trash2, Edit2, Check, MapPin, FileText } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

type GigStatus = 'tentative' | 'confirmed' | 'cancelled'

interface GigDate {
  id: string
  project_id: string | null
  title: string
  date: string
  end_date: string | null
  status: GigStatus
  venue: string | null
  notes: string | null
  setlist_id: string | null
  created_at: string
  project?: { name: string } | null
}

interface Project { id: string; name: string }

const STATUS = {
  tentative:  { label: 'Tentativo',  color: '#f59e0b', bg: 'rgba(245,158,11,0.15)',  dot: '#f59e0b',  emoji: '🟡' },
  confirmed:  { label: 'Confirmado', color: '#10b981', bg: 'rgba(16,185,129,0.15)', dot: '#10b981', emoji: '✅' },
  cancelled:  { label: 'Cancelado',  color: '#ef4444', bg: 'rgba(239,68,68,0.15)',  dot: '#ef4444',  emoji: '❌' },
} as const

const MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const DAYS_ES   = ['Lu','Ma','Mi','Ju','Vi','Sá','Do']

function getDays(year: number, month: number) {
  const first = new Date(year, month, 1).getDay()
  const total = new Date(year, month + 1, 0).getDate()
  const prev  = new Date(year, month, 0).getDate()
  const offset = (first + 6) % 7 // Monday start

  const days: { d: number; m: number; y: number; cur: boolean }[] = []
  for (let i = offset - 1; i >= 0; i--) days.push({ d: prev - i, m: month - 1, y: year, cur: false })
  for (let d = 1; d <= total; d++) days.push({ d, m: month, y: year, cur: true })
  const fill = 42 - days.length
  for (let d = 1; d <= fill; d++) days.push({ d, m: month + 1, y: year, cur: false })
  return days
}

function toISO(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function today() {
  const n = new Date()
  return toISO(n.getFullYear(), n.getMonth(), n.getDate())
}

export default function CalendarPage() {
  const router = useRouter()
  const { user, loading } = useAuth()
  const now = new Date()
  const [year,  setYear]  = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [selected, setSelected] = useState(today())
  const [gigs, setGigs] = useState<GigDate[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)

  // Form state
  const [fTitle,   setFTitle]   = useState('')
  const [fDate,    setFDate]    = useState(today())
  const [fStatus,  setFStatus]  = useState<GigStatus>('tentative')
  const [fVenue,   setFVenue]   = useState('')
  const [fNotes,   setFNotes]   = useState('')
  const [fProject, setFProject] = useState('')
  const [saving,   setSaving]   = useState(false)

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [user, loading, router])

  useEffect(() => { if (user) loadData() }, [user]) // eslint-disable-line

  async function loadData() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any
    const [gigsRes, projRes] = await Promise.all([
      db.from('gig_dates').select('*, project:project_id(name)').order('date'),
      supabase.from('projects').select('id, name'),
    ])
    setGigs((gigsRes.data || []) as GigDate[])
    setProjects(projRes.data || [])
  }

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }

  const days = getDays(year, month)

  // Group gigs by date string
  const gigsByDate: Record<string, GigDate[]> = {}
  gigs.forEach(g => {
    if (!gigsByDate[g.date]) gigsByDate[g.date] = []
    gigsByDate[g.date].push(g)
  })

  const selectedGigs = gigsByDate[selected] || []

  function openAdd(date?: string) {
    setFTitle(''); setFDate(date || selected); setFStatus('tentative')
    setFVenue(''); setFNotes(''); setFProject('')
    setEditId(null); setShowAdd(true)
  }

  function openEdit(g: GigDate) {
    setFTitle(g.title); setFDate(g.date); setFStatus(g.status)
    setFVenue(g.venue || ''); setFNotes(g.notes || ''); setFProject(g.project_id || '')
    setEditId(g.id); setShowAdd(true)
  }

  async function saveGig() {
    if (!fTitle.trim() || !fDate) return
    setSaving(true)
    const payload = {
      title: fTitle.trim(), date: fDate, status: fStatus,
      venue: fVenue.trim() || null, notes: fNotes.trim() || null,
      project_id: fProject || null,
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any
    if (editId) {
      const { data } = await db.from('gig_dates').update(payload).eq('id', editId).select('*, project:project_id(name)').single()
      if (data) setGigs(gs => gs.map(g => g.id === editId ? data as GigDate : g))
    } else {
      const { data } = await db.from('gig_dates').insert(payload).select('*, project:project_id(name)').single()
      if (data) { setGigs(gs => [...gs, data as GigDate]); setSelected(fDate) }
    }
    setShowAdd(false); setSaving(false)
  }

  function confirmDelete(id: string, title: string) {
    if (!window.confirm(`¿Eliminar "${title}"?\nEsta acción no se puede deshacer.`)) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(supabase as any).from('gig_dates').delete().eq('id', id)
    setGigs(gs => gs.filter(g => g.id !== id))
  }

  async function setGigStatus(g: GigDate, status: GigStatus) {
    if (g.status === status) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('gig_dates').update({ status }).eq('id', g.id)
    setGigs(gs => gs.map(x => x.id === g.id ? { ...x, status } : x))
  }

  const todayStr = today()
  const [selY, selM, selD] = selected.split('-').map(Number)
  const selDateLabel = new Date(selY, selM - 1, selD).toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="min-h-screen pb-24" style={{ background: 'var(--bg-base)' }}>
      <div className="max-w-xl mx-auto px-4 pt-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-xl font-black" style={{ color: 'var(--text-primary)' }}>Calendario</h1>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Fechas y presentaciones de la banda</p>
          </div>
          <button
            onClick={() => openAdd()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold transition-all"
            style={{ background: 'var(--accent)', color: '#000', boxShadow: '0 0 16px rgba(245,158,11,0.25)' }}
          >
            <Plus size={15} /> Agregar
          </button>
        </div>

        {/* Legend */}
        <div className="flex gap-3 mb-4 flex-wrap">
          {(Object.entries(STATUS) as [GigStatus, typeof STATUS[GigStatus]][]).map(([k, v]) => (
            <div key={k} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: v.dot }} />
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{v.label}</span>
            </div>
          ))}
        </div>

        {/* Month navigator */}
        <div className="rounded-3xl overflow-hidden mb-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between px-5 pt-4 pb-3">
            <button onClick={prevMonth} className="w-8 h-8 rounded-xl flex items-center justify-center transition-all"
              style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>
              <ChevronLeft size={16} />
            </button>
            <h2 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>
              {MONTHS_ES[month]} {year}
            </h2>
            <button onClick={nextMonth} className="w-8 h-8 rounded-xl flex items-center justify-center transition-all"
              style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 px-2 pb-1">
            {DAYS_ES.map(d => (
              <div key={d} className="text-center py-1 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>{d}</div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 gap-0.5 px-2 pb-3">
            {days.map((cell, i) => {
              const iso = toISO(cell.y, cell.m, cell.d)
              const dayGigs = gigsByDate[iso] || []
              const isToday = iso === todayStr
              const isSel = iso === selected
              const isPast = iso < todayStr && cell.cur

              return (
                <button
                  key={i}
                  onClick={() => { setSelected(iso); if (!cell.cur) { setMonth(cell.m < 0 ? 11 : cell.m > 11 ? 0 : cell.m); if (cell.m < 0) setYear(y => y - 1); else if (cell.m > 11) setYear(y => y + 1) } }}
                  className="relative flex flex-col items-center py-1.5 px-1 rounded-xl transition-all"
                  style={{
                    background: isSel ? 'var(--accent)' : isToday ? 'rgba(245,158,11,0.1)' : 'transparent',
                    border: isToday && !isSel ? '1px solid rgba(245,158,11,0.4)' : '1px solid transparent',
                    opacity: cell.cur ? 1 : 0.3,
                  }}
                >
                  <span
                    className="text-sm font-semibold leading-none"
                    style={{ color: isSel ? '#000' : isPast ? 'var(--text-muted)' : 'var(--text-primary)' }}
                  >{cell.d}</span>

                  {/* Event dots */}
                  {dayGigs.length > 0 && (
                    <div className="flex gap-0.5 mt-1">
                      {dayGigs.slice(0, 3).map((g, gi) => (
                        <div key={gi} className="w-1.5 h-1.5 rounded-full"
                          style={{ background: isSel ? 'rgba(0,0,0,0.5)' : STATUS[g.status].dot }} />
                      ))}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Selected day panel */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold capitalize text-sm" style={{ color: 'var(--text-primary)' }}>{selDateLabel}</h3>
            <button
              onClick={() => openAdd(selected)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold"
              style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
            >
              <Plus size={12} /> Evento
            </button>
          </div>

          {selectedGigs.length === 0 ? (
            <div
              className="rounded-2xl py-8 text-center cursor-pointer transition-all"
              style={{ background: 'var(--bg-card)', border: '2px dashed var(--border)' }}
              onClick={() => openAdd(selected)}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'}
            >
              <p className="text-2xl mb-1">📅</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Sin eventos — toca para agregar</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {selectedGigs.map(g => (
                <div
                  key={g.id}
                  className="rounded-2xl overflow-hidden"
                  style={{ background: 'var(--bg-card)', border: `1px solid ${STATUS[g.status].color}40` }}
                >
                  {/* Event body */}
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-bold flex-1" style={{ color: 'var(--text-primary)' }}>{g.title}</p>
                      {/* Actions — always visible */}
                      <div className="flex gap-1 flex-shrink-0">
                        <button
                          onClick={() => openEdit(g)}
                          className="w-8 h-8 rounded-xl flex items-center justify-center"
                          style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}
                        ><Edit2 size={13} /></button>
                        <button
                          onClick={() => confirmDelete(g.id, g.title)}
                          className="w-8 h-8 rounded-xl flex items-center justify-center"
                          style={{ background: 'rgba(239,68,68,0.12)', color: 'var(--red)' }}
                        ><Trash2 size={13} /></button>
                      </div>
                    </div>

                    {/* Meta */}
                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
                      {g.venue && (
                        <span className="text-xs flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                          <MapPin size={10} /> {g.venue}
                        </span>
                      )}
                      {g.project && (
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          🎵 {(g.project as { name: string }).name}
                        </span>
                      )}
                    </div>
                    {g.notes && (
                      <p className="text-xs mt-2" style={{ color: 'var(--text-secondary)' }}>{g.notes}</p>
                    )}
                  </div>

                  {/* Status bar — 3 tappable pills, always visible */}
                  <div
                    className="flex border-t"
                    style={{ borderColor: `${STATUS[g.status].color}25` }}
                  >
                    {(Object.entries(STATUS) as [GigStatus, typeof STATUS[GigStatus]][]).map(([k, v]) => {
                      const isActive = g.status === k
                      return (
                        <button
                          key={k}
                          onClick={() => setGigStatus(g, k)}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold transition-all"
                          style={{
                            background: isActive ? v.bg : 'transparent',
                            color: isActive ? v.color : 'var(--text-muted)',
                            borderRight: k !== 'cancelled' ? `1px solid ${STATUS[g.status].color}20` : 'none',
                          }}
                        >
                          <span>{v.emoji}</span>
                          <span className="hidden sm:inline">{v.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Upcoming events */}
        {(() => {
          const upcoming = gigs
            .filter(g => g.date >= todayStr && g.status !== 'cancelled')
            .slice(0, 5)
          if (upcoming.length === 0) return null
          return (
            <div className="mb-4">
              <h3 className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>Próximas fechas</h3>
              <div className="flex flex-col gap-2">
                {upcoming.map(g => {
                  const [gy, gm, gd] = g.date.split('-').map(Number)
                  const label = new Date(gy, gm - 1, gd).toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short' })
                  return (
                    <button
                      key={g.id}
                      onClick={() => { setYear(gy); setMonth(gm - 1); setSelected(g.date) }}
                      className="flex items-center gap-3 p-3 rounded-2xl text-left transition-all"
                      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = STATUS[g.status].color + '60'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'}
                    >
                      <div className="w-2 h-10 rounded-full flex-shrink-0" style={{ background: STATUS[g.status].dot }} />
                      <div>
                        <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{g.title}</p>
                        <p className="text-xs capitalize" style={{ color: 'var(--text-muted)' }}>
                          {label}{g.venue ? ` · ${g.venue}` : ''}
                        </p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })()}
      </div>

      {/* Add / Edit modal */}
      {showAdd && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-0"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowAdd(false) }}
        >
          <div className="w-full max-w-sm rounded-3xl p-6 fade-in" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-bright)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold" style={{ color: 'var(--text-primary)' }}>
                {editId ? 'Editar evento' : 'Nuevo evento'}
              </h2>
              <button onClick={() => setShowAdd(false)} style={{ color: 'var(--text-muted)' }}><X size={18} /></button>
            </div>

            <div className="space-y-3">
              {/* Title */}
              <div>
                <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--text-muted)' }}>Nombre del evento</label>
                <input
                  autoFocus type="text"
                  placeholder='Ej: "Show en La Casona" o "Ensayo general"'
                  value={fTitle} onChange={e => setFTitle(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveGig() }}
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                  style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                  onFocus={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'}
                  onBlur={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'}
                />
              </div>

              {/* Date */}
              <div>
                <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--text-muted)' }}>Fecha</label>
                <input
                  type="date" value={fDate} onChange={e => setFDate(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                  style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)', colorScheme: 'dark' }}
                />
              </div>

              {/* Status */}
              <div>
                <label className="text-xs font-semibold block mb-1.5" style={{ color: 'var(--text-muted)' }}>Estado</label>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.entries(STATUS) as [GigStatus, typeof STATUS[GigStatus]][]).map(([k, v]) => (
                    <button
                      key={k}
                      onClick={() => setFStatus(k)}
                      className="py-2.5 rounded-xl text-xs font-bold transition-all"
                      style={{
                        background: fStatus === k ? v.bg : 'var(--bg-elevated)',
                        border: `1px solid ${fStatus === k ? v.color : 'var(--border)'}`,
                        color: fStatus === k ? v.color : 'var(--text-muted)',
                      }}
                    >
                      {v.emoji} {v.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Venue */}
              <div>
                <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--text-muted)' }}>Lugar / Venue (opcional)</label>
                <input
                  type="text" placeholder="Club de Jazz, Teatro Municipal..."
                  value={fVenue} onChange={e => setFVenue(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                  style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                />
              </div>

              {/* Project */}
              {projects.length > 0 && (
                <div>
                  <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--text-muted)' }}>Proyecto (opcional)</label>
                  <select
                    value={fProject} onChange={e => setFProject(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                    style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: fProject ? 'var(--text-primary)' : 'var(--text-muted)', colorScheme: 'dark' }}
                  >
                    <option value="">Sin proyecto</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--text-muted)' }}>Notas (opcional)</label>
                <textarea
                  placeholder="Horario, requisitos, contacto..."
                  value={fNotes} onChange={e => setFNotes(e.target.value)}
                  rows={2}
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none"
                  style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                />
              </div>

              <button
                onClick={saveGig} disabled={saving || !fTitle.trim() || !fDate}
                className="w-full py-3 rounded-xl font-bold text-sm"
                style={{ background: STATUS[fStatus].dot, color: '#000', opacity: (saving || !fTitle.trim() || !fDate) ? 0.5 : 1 }}
              >
                {saving ? 'Guardando...' : editId ? 'Guardar cambios' : `Agregar evento ${STATUS[fStatus].emoji}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
