'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, Plus, X, Edit2, MapPin, Clock, Share2, Copy, Check, Users } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

type GigStatus = 'tentative' | 'confirmed' | 'cancelled'
type RsvpStatus = 'yes' | 'maybe' | 'no' | 'pending'

interface GigDate {
  id: string
  project_id: string | null
  title: string
  date: string
  end_date: string | null
  start_time: string | null
  end_time: string | null
  status: GigStatus
  venue: string | null
  notes: string | null
  project?: { name: string; access_code: string | null } | null
}

interface Attendance {
  id: string
  gig_id: string
  user_id: string
  user_email: string | null
  display_name: string | null
  status: RsvpStatus
}

interface Project { id: string; name: string; access_code: string | null }

const STATUS = {
  tentative: { label: 'Tentativo',  color: '#f59e0b', bg: 'rgba(245,158,11,0.15)',  dot: '#f59e0b',  emoji: '🟡' },
  confirmed:  { label: 'Confirmado', color: '#10b981', bg: 'rgba(16,185,129,0.15)', dot: '#10b981', emoji: '✅' },
  cancelled:  { label: 'Cancelado',  color: '#ef4444', bg: 'rgba(239,68,68,0.15)',  dot: '#ef4444',  emoji: '❌' },
} as const

const RSVP = {
  yes:     { label: 'Sí puedo',   color: '#10b981', bg: 'rgba(16,185,129,0.2)',  emoji: '✅' },
  maybe:   { label: 'Quizás',     color: '#f59e0b', bg: 'rgba(245,158,11,0.2)',  emoji: '🤔' },
  no:      { label: 'No puedo',   color: '#ef4444', bg: 'rgba(239,68,68,0.2)',   emoji: '❌' },
  pending: { label: 'Sin confirmar', color: '#555577', bg: 'transparent',         emoji: '❓' },
} as const

const MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const DAYS_ES = ['Lu','Ma','Mi','Ju','Vi','Sá','Do']

function isoToday() {
  const n = new Date()
  return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`
}

function toISO(y:number,m:number,d:number) {
  return `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
}

function getDays(year:number,month:number) {
  const first = new Date(year,month,1).getDay()
  const total = new Date(year,month+1,0).getDate()
  const prev  = new Date(year,month,0).getDate()
  const offset = (first+6)%7
  const days:{ d:number; m:number; y:number; cur:boolean }[] = []
  for(let i=offset-1;i>=0;i--) days.push({d:prev-i,m:month-1,y:year,cur:false})
  for(let d=1;d<=total;d++) days.push({d,m:month,y:year,cur:true})
  const fill = 42-days.length
  for(let d=1;d<=fill;d++) days.push({d,m:month+1,y:year,cur:false})
  return days
}

/** Expand multi-day events to all their dates */
function buildGigsByDate(gigs: GigDate[]): Record<string,GigDate[]> {
  const byDate: Record<string,GigDate[]> = {}
  for (const g of gigs) {
    const start = new Date(g.date + 'T12:00:00')
    const end   = g.end_date ? new Date(g.end_date + 'T12:00:00') : start
    const cur   = new Date(start)
    while (cur <= end) {
      const iso = cur.toISOString().split('T')[0]
      ;(byDate[iso] ??= []).push(g)
      cur.setDate(cur.getDate() + 1)
    }
  }
  return byDate
}

function formatDateRange(g: GigDate) {
  const s = new Date(g.date + 'T12:00:00')
  const sLabel = s.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })
  if (!g.end_date || g.end_date === g.date) return sLabel
  const e = new Date(g.end_date + 'T12:00:00')
  const eLabel = e.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })
  const days = Math.round((e.getTime() - s.getTime()) / 86400000) + 1
  return `${sLabel} → ${eLabel} (${days} días)`
}

function formatTime(t: string | null) {
  if (!t) return ''
  return t.substring(0, 5)
}

// ─── CalendarPage ─────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const router = useRouter()
  const { user, loading } = useAuth()
  const now = new Date()
  const [year,  setYear]  = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [selected, setSelected] = useState(isoToday())
  const [gigs, setGigs] = useState<GigDate[]>([])
  const [attendance, setAttendance] = useState<Attendance[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [editId, setEditId] = useState<string|null>(null)
  const [copiedCode, setCopiedCode] = useState<string|null>(null)

  // Form
  const [fTitle,  setFTitle]  = useState('')
  const [fDate,   setFDate]   = useState(isoToday())
  const [fEndDate,setFEndDate]= useState('')
  const [fStartT, setFStartT] = useState('')
  const [fEndT,   setFEndT]   = useState('')
  const [fStatus, setFStatus] = useState<GigStatus>('tentative')
  const [fVenue,  setFVenue]  = useState('')
  const [fNotes,  setFNotes]  = useState('')
  const [fProject,setFProject]= useState('')
  const [saving,  setSaving]  = useState(false)

  useEffect(() => { if (!loading && !user) router.replace('/login') }, [user,loading,router])
  useEffect(() => { if (user) loadData() }, [user]) // eslint-disable-line

  const db = supabase as unknown as Record<string, (...args: unknown[]) => unknown>

  async function loadData() {
    const [gigsRes, projRes, attRes] = await Promise.all([
      (db.from as Function)('gig_dates').select('*, project:project_id(name, access_code)').order('date'),
      supabase.from('projects').select('id, name, access_code'),
      (db.from as Function)('gig_attendance').select('*'),
    ])
    setGigs((gigsRes.data || []) as GigDate[])
    setProjects(projRes.data || [])
    setAttendance((attRes.data || []) as Attendance[])
  }

  const gigsByDate = useMemo(() => buildGigsByDate(gigs), [gigs])
  const days = getDays(year, month)
  const todayStr = isoToday()
  const selectedGigs = gigsByDate[selected] || []

  function prevMonth() { if(month===0){setMonth(11);setYear(y=>y-1)}else setMonth(m=>m-1) }
  function nextMonth() { if(month===11){setMonth(0);setYear(y=>y+1)}else setMonth(m=>m+1) }

  function openAdd(date?: string) {
    setFTitle(''); setFDate(date||selected); setFEndDate(''); setFStartT(''); setFEndT('')
    setFStatus('tentative'); setFVenue(''); setFNotes(''); setFProject(''); setEditId(null); setShowAdd(true)
  }
  function openEdit(g: GigDate) {
    setFTitle(g.title); setFDate(g.date); setFEndDate(g.end_date||''); setFStartT(g.start_time||''); setFEndT(g.end_time||'')
    setFStatus(g.status); setFVenue(g.venue||''); setFNotes(g.notes||''); setFProject(g.project_id||''); setEditId(g.id); setShowAdd(true)
  }

  async function saveGig() {
    if (!fTitle.trim() || !fDate) return
    setSaving(true)
    const payload = {
      title: fTitle.trim(), date: fDate,
      end_date: fEndDate||null, start_time: fStartT||null, end_time: fEndT||null,
      status: fStatus, venue: fVenue.trim()||null, notes: fNotes.trim()||null,
      project_id: fProject||null,
    }
    if (editId) {
      const { data } = await (db.from as Function)('gig_dates').update(payload).eq('id',editId).select('*, project:project_id(name, access_code)').single()
      if (data) setGigs(gs => gs.map(g => g.id === editId ? data as GigDate : g))
    } else {
      const { data } = await (db.from as Function)('gig_dates').insert(payload).select('*, project:project_id(name, access_code)').single()
      if (data) { setGigs(gs => [...gs, data as GigDate]); setSelected(fDate) }
    }
    setShowAdd(false); setSaving(false)
  }

  function confirmDelete(id: string, title: string) {
    if (!window.confirm(`¿Eliminar "${title}"?`)) return
    ;(db.from as Function)('gig_dates').delete().eq('id',id)
    setGigs(gs => gs.filter(g => g.id !== id))
    setAttendance(as => as.filter(a => a.gig_id !== id))
  }

  async function setGigStatus(g: GigDate, status: GigStatus) {
    if (g.status === status) return
    await (db.from as Function)('gig_dates').update({status}).eq('id',g.id)
    setGigs(gs => gs.map(x => x.id===g.id ? {...x,status} : x))
  }

  async function rsvp(gigId: string, status: RsvpStatus) {
    if (!user) return
    const existing = attendance.find(a => a.gig_id===gigId && a.user_id===user.id)
    const payload = { gig_id: gigId, user_id: user.id, user_email: user.email, display_name: user.email?.split('@')[0], status }
    if (existing) {
      await (db.from as Function)('gig_attendance').update({status}).eq('id',existing.id)
      setAttendance(as => as.map(a => a.id===existing.id ? {...a,status} : a))
    } else {
      const { data } = await (db.from as Function)('gig_attendance').insert(payload).select().single()
      if (data) setAttendance(as => [...as, data as Attendance])
    }
  }

  function copyShareLink(code: string) {
    const url = `${window.location.origin}/cal/${code}`
    navigator.clipboard.writeText(url)
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(null), 2500)
  }

  function selectDay(iso: string, cellM: number) {
    setSelected(iso)
    // Navigate month if clicking adjacent month day
    const diff = cellM - month
    if (diff !== 0) {
      if (diff === 1 || diff === -11) nextMonth()
      else if (diff === -1 || diff === 11) prevMonth()
    }
  }

  const [selY, selM, selD] = selected.split('-').map(Number)
  const selLabel = new Date(selY,selM-1,selD).toLocaleDateString('es-CL',{weekday:'long',day:'numeric',month:'long'})

  const upcoming = useMemo(() =>
    gigs.filter(g => g.date >= todayStr && g.status !== 'cancelled').slice(0, 6),
  [gigs, todayStr])

  return (
    <div className="min-h-screen pb-24" style={{ background: 'var(--bg-base)' }}>
      <div className="max-w-xl mx-auto px-4 pt-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-xl font-black" style={{ color: 'var(--text-primary)' }}>Calendario</h1>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Fechas y presentaciones</p>
          </div>
          <button onClick={() => openAdd()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold"
            style={{ background: 'var(--accent)', color: '#000', boxShadow: '0 0 16px rgba(245,158,11,0.25)' }}>
            <Plus size={15} /> Agregar
          </button>
        </div>

        {/* Legend */}
        <div className="flex gap-4 mb-4">
          {(Object.entries(STATUS) as [GigStatus, typeof STATUS[GigStatus]][]).map(([k,v]) => (
            <div key={k} className="flex items-center gap-1.5">
              <div className="w-2.5 h-1.5 rounded-full" style={{ background: v.dot }} />
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{v.label}</span>
            </div>
          ))}
        </div>

        {/* ── Calendar grid ── */}
        <div className="rounded-3xl overflow-hidden mb-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          {/* Month nav */}
          <div className="flex items-center justify-between px-5 pt-4 pb-3">
            <button onClick={prevMonth} className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>
              <ChevronLeft size={16} />
            </button>
            <h2 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>
              {MONTHS_ES[month]} {year}
            </h2>
            <button onClick={nextMonth} className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 px-2 pb-1">
            {DAYS_ES.map(d => (
              <div key={d} className="text-center py-0.5 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>{d}</div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-0.5 px-2 pb-3">
            {days.map((cell,i) => {
              const iso = toISO(cell.y, cell.m, cell.d)
              const dayGigs = gigsByDate[iso] || []
              const isToday = iso === todayStr
              const isSel = iso === selected
              const isPast = iso < todayStr

              return (
                <button key={i} onClick={() => selectDay(iso, cell.m)}
                  className="relative flex flex-col items-center py-1.5 rounded-xl transition-all"
                  style={{
                    opacity: cell.cur ? 1 : 0.25,
                    background: isSel ? 'var(--bg-elevated)' : 'transparent',
                    border: isSel ? '2px solid rgba(255,255,255,0.25)' : '2px solid transparent',
                    outline: isToday ? '2px solid var(--accent)' : 'none',
                    outlineOffset: '-2px',
                  }}
                >
                  <span className="text-sm font-semibold leading-none"
                    style={{ color: isToday ? 'var(--accent)' : isPast && cell.cur ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                    {cell.d}
                  </span>

                  {/* Event bars — colored by status */}
                  {dayGigs.length > 0 && (
                    <div className="w-full px-0.5 mt-1 flex flex-col gap-0.5">
                      {dayGigs.slice(0,3).map((g,gi) => (
                        <div key={gi} className="rounded-full" style={{ height: 3, background: STATUS[g.status].dot, opacity: 0.9 }} />
                      ))}
                      {dayGigs.length > 3 && (
                        <span style={{ fontSize: 7, color: 'var(--text-muted)', lineHeight: 1, textAlign: 'center' }}>+{dayGigs.length-3}</span>
                      )}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Selected day events ── */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold capitalize text-sm" style={{ color: 'var(--text-primary)' }}>{selLabel}</h3>
            <button onClick={() => openAdd(selected)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold"
              style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
              <Plus size={12} /> Evento
            </button>
          </div>

          {selectedGigs.length === 0 ? (
            <button onClick={() => openAdd(selected)}
              className="w-full rounded-2xl py-7 text-center transition-all"
              style={{ background: 'var(--bg-card)', border: '2px dashed var(--border)' }}>
              <p className="text-xl mb-1">📅</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Sin eventos — toca para agregar</p>
            </button>
          ) : (
            <div className="flex flex-col gap-3">
              {selectedGigs.map(g => {
                const myRsvp = attendance.find(a => a.gig_id===g.id && a.user_id===user?.id)?.status || 'pending'
                const gigAtt = attendance.filter(a => a.gig_id===g.id)
                const proj = g.project as { name: string; access_code: string | null } | null

                return (
                  <div key={g.id} className="rounded-2xl overflow-hidden"
                    style={{ background: 'var(--bg-card)', border: `1px solid ${STATUS[g.status].color}40`, boxShadow: `0 2px 12px ${STATUS[g.status].color}10` }}>

                    {/* Header */}
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-bold" style={{ color: 'var(--text-primary)' }}>{g.title}</p>
                          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5">
                            {/* Date range */}
                            <span className="text-xs font-medium" style={{ color: STATUS[g.status].color }}>
                              {g.end_date && g.end_date !== g.date ? formatDateRange(g) : ''}
                            </span>
                            {/* Time */}
                            {g.start_time && (
                              <span className="text-xs flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                                <Clock size={10} /> {formatTime(g.start_time)}{g.end_time ? ` – ${formatTime(g.end_time)}` : ''}
                              </span>
                            )}
                            {/* Venue */}
                            {g.venue && (
                              <span className="text-xs flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                                <MapPin size={10} /> {g.venue}
                              </span>
                            )}
                            {/* Project + share */}
                            {proj && (
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>🎵 {proj.name}</span>
                                {proj.access_code && (
                                  <button onClick={() => copyShareLink(proj.access_code!)}
                                    className="flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-lg"
                                    style={{ background: copiedCode===proj.access_code ? 'rgba(16,185,129,0.15)' : 'var(--bg-elevated)', color: copiedCode===proj.access_code ? 'var(--green)' : 'var(--text-muted)' }}>
                                    {copiedCode===proj.access_code ? <Check size={10}/> : <Share2 size={10}/>}
                                    {copiedCode===proj.access_code ? 'Copiado' : 'Compartir'}
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                          {g.notes && <p className="text-xs mt-2" style={{ color: 'var(--text-secondary)' }}>{g.notes}</p>}
                        </div>
                        {/* Edit / Delete */}
                        <div className="flex gap-1 flex-shrink-0">
                          <button onClick={() => openEdit(g)}
                            className="w-8 h-8 rounded-xl flex items-center justify-center"
                            style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>
                            <Edit2 size={13} />
                          </button>
                          <button onClick={() => confirmDelete(g.id, g.title)}
                            className="w-8 h-8 rounded-xl flex items-center justify-center"
                            style={{ background: 'rgba(239,68,68,0.12)', color: 'var(--red)' }}>
                            <X size={13} />
                          </button>
                        </div>
                      </div>

                      {/* Attendance summary */}
                      {gigAtt.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {gigAtt.map(a => (
                            <span key={a.id} className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
                              style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>
                              {RSVP[a.status as RsvpStatus]?.emoji}
                              <span>{a.display_name || a.user_email?.split('@')[0]}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* RSVP row */}
                    <div className="flex border-t" style={{ borderColor: `${STATUS[g.status].color}20` }}>
                      <div className="flex items-center px-3 border-r text-xs flex-shrink-0" style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
                        <Users size={11} />
                      </div>
                      {(['yes','maybe','no'] as RsvpStatus[]).map((r,ri) => (
                        <button key={r} onClick={() => rsvp(g.id, r)}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold transition-all"
                          style={{
                            background: myRsvp===r ? RSVP[r].bg : 'transparent',
                            color: myRsvp===r ? RSVP[r].color : 'var(--text-muted)',
                            borderRight: ri < 2 ? `1px solid var(--border)` : 'none',
                          }}>
                          <span>{RSVP[r].emoji}</span>
                          <span className="hidden sm:inline">{RSVP[r].label}</span>
                        </button>
                      ))}
                    </div>

                    {/* Status row */}
                    <div className="flex border-t" style={{ borderColor: `${STATUS[g.status].color}20` }}>
                      {(Object.entries(STATUS) as [GigStatus, typeof STATUS[GigStatus]][]).map(([k,v],ki) => (
                        <button key={k} onClick={() => setGigStatus(g,k)}
                          className="flex-1 flex items-center justify-center gap-1 py-2 text-xs font-bold transition-all"
                          style={{
                            background: g.status===k ? v.bg : 'transparent',
                            color: g.status===k ? v.color : 'var(--text-muted)',
                            borderRight: ki < 2 ? `1px solid ${STATUS[g.status].color}20` : 'none',
                          }}>
                          <span>{v.emoji}</span>
                          <span className="hidden sm:inline text-xs">{v.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Upcoming ── */}
        {upcoming.length > 0 && (
          <div className="mb-4">
            <h3 className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>Próximas fechas</h3>
            <div className="flex flex-col gap-2">
              {upcoming.map(g => {
                const [gy,gm,gd] = g.date.split('-').map(Number)
                const label = new Date(gy,gm-1,gd).toLocaleDateString('es-CL',{weekday:'short',day:'numeric',month:'short'})
                const gigAtt = attendance.filter(a => a.gig_id===g.id)
                return (
                  <button key={g.id}
                    onClick={() => { setYear(gy); setMonth(gm-1); setSelected(g.date) }}
                    className="flex items-center gap-3 p-3 rounded-2xl text-left transition-all"
                    style={{ background: 'var(--bg-card)', border: `1px solid ${STATUS[g.status].color}30` }}>
                    <div className="w-2 h-10 rounded-full flex-shrink-0" style={{ background: STATUS[g.status].dot }} />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>{g.title}</p>
                      <p className="text-xs capitalize" style={{ color: 'var(--text-muted)' }}>
                        {label}{g.end_date && g.end_date!==g.date ? ` → ${new Date(g.end_date+'T12:00:00').toLocaleDateString('es-CL',{day:'numeric',month:'short'})}` : ''}
                        {g.start_time ? ` · ${formatTime(g.start_time)}` : ''}
                        {g.venue ? ` · ${g.venue}` : ''}
                      </p>
                    </div>
                    {gigAtt.length > 0 && (
                      <div className="flex gap-0.5 flex-shrink-0">
                        {gigAtt.slice(0,4).map(a => (
                          <span key={a.id} style={{ fontSize: 14 }}>{RSVP[a.status as RsvpStatus]?.emoji}</span>
                        ))}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Project share cards ── */}
        {projects.filter(p => p.access_code).length > 0 && (
          <div className="mb-4">
            <h3 className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>Compartir calendario</h3>
            <div className="flex flex-col gap-2">
              {projects.filter(p => p.access_code).map(p => (
                <div key={p.id} className="flex items-center gap-3 px-4 py-3 rounded-2xl"
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{p.name}</p>
                    <p className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                      /cal/{p.access_code}
                    </p>
                  </div>
                  <button onClick={() => copyShareLink(p.access_code!)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all"
                    style={{ background: copiedCode===p.access_code ? 'rgba(16,185,129,0.15)' : 'var(--bg-elevated)', color: copiedCode===p.access_code ? 'var(--green)' : 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                    {copiedCode===p.access_code ? <><Check size={12}/> Copiado</> : <><Copy size={12}/> Copiar link</>}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Add / Edit Modal ── */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-4"
          style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(8px)' }}
          onClick={e => { if (e.target===e.currentTarget) setShowAdd(false) }}>
          <div className="w-full max-w-sm rounded-3xl p-5 fade-in"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-bright)', maxHeight: '92vh', overflowY: 'auto' }}>

            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold" style={{ color: 'var(--text-primary)' }}>{editId ? 'Editar evento' : 'Nuevo evento'}</h2>
              <button onClick={() => setShowAdd(false)} style={{ color: 'var(--text-muted)' }}><X size={18} /></button>
            </div>

            <div className="space-y-3">
              {/* Title */}
              <input autoFocus type="text" placeholder='Ej: "Grabación disco" o "Show en La Casona"'
                value={fTitle} onChange={e => setFTitle(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                onFocus={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'}
                onBlur={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'}
              />

              {/* Dates */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--text-muted)' }}>Fecha inicio</label>
                  <input type="date" value={fDate} onChange={e => { setFDate(e.target.value); if (!fEndDate) setFEndDate(e.target.value) }}
                    className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                    style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)', colorScheme: 'dark' }}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--text-muted)' }}>Fecha fin <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(opcional)</span></label>
                  <input type="date" value={fEndDate} min={fDate} onChange={e => setFEndDate(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                    style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: fEndDate ? 'var(--text-primary)' : 'var(--text-muted)', colorScheme: 'dark' }}
                  />
                </div>
              </div>

              {/* Times */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--text-muted)' }}>Hora inicio <span style={{ fontWeight: 400 }}>(opc)</span></label>
                  <input type="time" value={fStartT} onChange={e => setFStartT(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                    style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: fStartT ? 'var(--text-primary)' : 'var(--text-muted)', colorScheme: 'dark' }}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--text-muted)' }}>Hora fin <span style={{ fontWeight: 400 }}>(opc)</span></label>
                  <input type="time" value={fEndT} onChange={e => setFEndT(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                    style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: fEndT ? 'var(--text-primary)' : 'var(--text-muted)', colorScheme: 'dark' }}
                  />
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="text-xs font-semibold block mb-1.5" style={{ color: 'var(--text-muted)' }}>Estado</label>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.entries(STATUS) as [GigStatus, typeof STATUS[GigStatus]][]).map(([k,v]) => (
                    <button key={k} onClick={() => setFStatus(k)}
                      className="py-2.5 rounded-xl text-xs font-bold transition-all"
                      style={{ background: fStatus===k ? v.bg : 'var(--bg-elevated)', border: `1px solid ${fStatus===k ? v.color : 'var(--border)'}`, color: fStatus===k ? v.color : 'var(--text-muted)' }}>
                      {v.emoji} {v.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Venue */}
              <input type="text" placeholder="Lugar / Venue (opcional)"
                value={fVenue} onChange={e => setFVenue(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
              />

              {/* Project */}
              {projects.length > 0 && (
                <select value={fProject} onChange={e => setFProject(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                  style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: fProject ? 'var(--text-primary)' : 'var(--text-muted)', colorScheme: 'dark' }}>
                  <option value="">Sin proyecto</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              )}

              {/* Notes */}
              <textarea placeholder="Notas: horario, requisitos, contacto..." rows={2}
                value={fNotes} onChange={e => setFNotes(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none"
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
              />

              <button onClick={saveGig} disabled={saving || !fTitle.trim() || !fDate}
                className="w-full py-3 rounded-xl font-bold text-sm transition-all"
                style={{ background: STATUS[fStatus].dot, color: '#000', opacity: (saving||!fTitle.trim()||!fDate) ? 0.5 : 1 }}>
                {saving ? 'Guardando...' : editId ? 'Guardar cambios' : `Crear evento ${STATUS[fStatus].emoji}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
