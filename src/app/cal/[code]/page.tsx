'use client'

import { useEffect, useState, useMemo } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, MapPin, Clock, Users, LogIn } from 'lucide-react'
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
}

interface Attendance {
  id: string; gig_id: string; user_id: string
  user_email: string | null; display_name: string | null; status: RsvpStatus
}

const STATUS = {
  tentative: { label: 'Tentativo',  color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', dot: '#f59e0b', emoji: '🟡' },
  confirmed:  { label: 'Confirmado', color: '#10b981', bg: 'rgba(16,185,129,0.15)', dot: '#10b981', emoji: '✅' },
  cancelled:  { label: 'Cancelado',  color: '#ef4444', bg: 'rgba(239,68,68,0.15)', dot: '#ef4444', emoji: '❌' },
} as const
const RSVP = {
  yes:     { label: 'Puedo',    color: '#10b981', bg: 'rgba(16,185,129,0.2)', emoji: '✅' },
  maybe:   { label: 'Quizás',   color: '#f59e0b', bg: 'rgba(245,158,11,0.2)', emoji: '🤔' },
  no:      { label: 'No puedo', color: '#ef4444', bg: 'rgba(239,68,68,0.2)',  emoji: '❌' },
  pending: { label: 'Sin resp', color: '#555577', bg: 'transparent',           emoji: '❓' },
} as const

const MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const DAYS_ES = ['Lu','Ma','Mi','Ju','Vi','Sá','Do']

function isoToday() {
  const n = new Date()
  return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`
}
function toISO(y:number,m:number,d:number) { return `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}` }
function getDays(year:number,month:number) {
  const first=new Date(year,month,1).getDay(),total=new Date(year,month+1,0).getDate(),prev=new Date(year,month,0).getDate()
  const offset=(first+6)%7,days:{ d:number;m:number;y:number;cur:boolean }[]=[]
  for(let i=offset-1;i>=0;i--)days.push({d:prev-i,m:month-1,y:year,cur:false})
  for(let d=1;d<=total;d++)days.push({d,m:month,y:year,cur:true})
  for(let d=1;d<=42-days.length;d++)days.push({d,m:month+1,y:year,cur:false})
  return days
}
function buildGigsByDate(gigs:GigDate[]):Record<string,GigDate[]>{
  const r:Record<string,GigDate[]>={}
  for(const g of gigs){
    const s=new Date(g.date+'T12:00:00'),e=g.end_date?new Date(g.end_date+'T12:00:00'):s,c=new Date(s)
    while(c<=e){const iso=c.toISOString().split('T')[0];(r[iso]??=[]).push(g);c.setDate(c.getDate()+1)}
  }
  return r
}

export default function SharedCalendarPage() {
  const { code } = useParams<{ code: string }>()
  const { user } = useAuth()
  const now = new Date()
  const [project, setProject] = useState<{ id: string; name: string; description: string | null } | null>(null)
  const [gigs, setGigs] = useState<GigDate[]>([])
  const [attendance, setAttendance] = useState<Attendance[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [selected, setSelected] = useState(isoToday())

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const any = supabase as any

  useEffect(() => { loadData() }, [code]) // eslint-disable-line

  async function loadData() {
    const { data: proj, error: projErr } = await supabase
      .from('projects').select('id, name, description')
      .eq('access_code', code.toUpperCase()).single()
    if (!proj || projErr) { setNotFound(true); setLoading(false); return }
    setProject(proj)

    const { data: gigsData } = await any
      .from('gig_dates').select('*')
      .eq('project_id', proj.id).order('date')
    setGigs((gigsData || []) as GigDate[])

    if (gigsData && gigsData.length > 0) {
      const gigIds = gigsData.map((g: GigDate) => g.id)
      const { data: attData } = await any
        .from('gig_attendance').select('*')
        .in('gig_id', gigIds)
      setAttendance((attData || []) as Attendance[])
    }
    setLoading(false)
  }

  async function rsvp(gigId: string, status: RsvpStatus) {
    if (!user) return
    const existing = attendance.find(a => a.gig_id===gigId && a.user_id===user.id)
    const payload = { gig_id: gigId, user_id: user.id, user_email: user.email, display_name: user.email?.split('@')[0], status }
    if (existing) {
      await any.from('gig_attendance').update({status}).eq('id',existing.id)
      setAttendance(as => as.map(a => a.id===existing.id ? {...a,status} : a))
    } else {
      const { data } = await any.from('gig_attendance').insert(payload).select().single()
      if (data) setAttendance(as => [...as, data as Attendance])
    }
  }

  const gigsByDate = useMemo(() => buildGigsByDate(gigs), [gigs])
  const days = getDays(year, month)
  const todayStr = isoToday()
  const selectedGigs = gigsByDate[selected] || []
  const upcoming = gigs.filter(g => g.date >= todayStr && g.status !== 'cancelled').slice(0, 8)

  function formatTime(t:string|null){return t?t.substring(0,5):''}

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-base)' }}>
      <div className="w-7 h-7 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--border)', borderTopColor: 'var(--accent)' }} />
    </div>
  )

  if (notFound) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4" style={{ background: 'var(--bg-base)' }}>
      <div className="text-5xl">🎵</div>
      <h1 className="text-xl font-bold text-center" style={{ color: 'var(--text-primary)' }}>Proyecto no encontrado</h1>
      <p className="text-sm text-center" style={{ color: 'var(--text-muted)' }}>El código <strong>{code}</strong> no corresponde a ningún proyecto.</p>
      <Link href="/" className="px-4 py-2 rounded-xl text-sm font-bold" style={{ background: 'var(--accent)', color: '#000' }}>Ir a Compás</Link>
    </div>
  )

  const [selY,selM,selD] = selected.split('-').map(Number)
  const selLabel = new Date(selY,selM-1,selD).toLocaleDateString('es-CL',{weekday:'long',day:'numeric',month:'long'})

  return (
    <div className="min-h-screen pb-10" style={{ background: 'var(--bg-base)' }}>
      {/* Top bar */}
      <div className="px-4 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)', background: 'rgba(7,7,15,0.95)', backdropFilter: 'blur(12px)' }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="#000"><path d="M9 3v11.55A4 4 0 1 0 11 18V7h6V3H9z"/></svg>
          </div>
          <div>
            <p className="font-black text-sm" style={{ color: 'var(--text-primary)' }}>{project?.name}</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Calendario compartido · Compás</p>
          </div>
        </div>
        {!user ? (
          <Link href={`/login?join=${code}`}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold"
            style={{ background: 'var(--accent)', color: '#000' }}>
            <LogIn size={13} /> Unirse
          </Link>
        ) : (
          <Link href="/" className="text-xs px-3 py-2 rounded-xl" style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>
            Mi cuenta
          </Link>
        )}
      </div>

      <div className="max-w-xl mx-auto px-4 pt-5">
        {!user && (
          <div className="rounded-2xl p-4 mb-5 flex items-center gap-3"
            style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)' }}>
            <span className="text-2xl">👋</span>
            <div>
              <p className="text-sm font-bold" style={{ color: 'var(--accent)' }}>Eres invitado</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                <Link href={`/login?join=${code}`} className="underline">Inicia sesión</Link> para confirmar tu asistencia a los eventos.
              </p>
            </div>
          </div>
        )}

        {/* Calendar */}
        <div className="rounded-3xl overflow-hidden mb-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between px-5 pt-4 pb-3">
            <button onClick={() => { if(month===0){setMonth(11);setYear(y=>y-1)}else setMonth(m=>m-1) }}
              className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>
              <ChevronLeft size={16}/>
            </button>
            <h2 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>{MONTHS_ES[month]} {year}</h2>
            <button onClick={() => { if(month===11){setMonth(0);setYear(y=>y+1)}else setMonth(m=>m+1) }}
              className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>
              <ChevronRight size={16}/>
            </button>
          </div>
          <div className="grid grid-cols-7 px-2 pb-1">
            {DAYS_ES.map(d => <div key={d} className="text-center py-0.5 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-0.5 px-2 pb-3">
            {days.map((cell,i) => {
              const iso=toISO(cell.y,cell.m,cell.d)
              const dayGigs=gigsByDate[iso]||[]
              const isToday=iso===todayStr,isSel=iso===selected
              return (
                <button key={i} onClick={() => setSelected(iso)}
                  className="flex flex-col items-center py-1.5 rounded-xl transition-all"
                  style={{ opacity:cell.cur?1:0.25, background:isSel?'var(--bg-elevated)':'transparent', border:`2px solid ${isSel?'rgba(255,255,255,0.2)':'transparent'}`, outline:isToday?'2px solid var(--accent)':'none', outlineOffset:'-2px' }}>
                  <span className="text-sm font-semibold leading-none" style={{ color:isToday?'var(--accent)':'var(--text-primary)' }}>{cell.d}</span>
                  {dayGigs.length>0&&(
                    <div className="w-full px-0.5 mt-1 flex flex-col gap-0.5">
                      {dayGigs.slice(0,3).map((g,gi)=><div key={gi} className="rounded-full" style={{height:3,background:STATUS[g.status].dot}}/>)}
                      {dayGigs.length>3&&<span style={{fontSize:7,color:'var(--text-muted)',textAlign:'center'}}>+{dayGigs.length-3}</span>}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Selected day */}
        <div className="mb-5">
          <h3 className="font-bold capitalize text-sm mb-3" style={{ color: 'var(--text-primary)' }}>{selLabel}</h3>
          {selectedGigs.length === 0 ? (
            <div className="rounded-2xl py-7 text-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Sin eventos este día</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {selectedGigs.map(g => {
                const myRsvp = attendance.find(a => a.gig_id===g.id && a.user_id===user?.id)?.status || 'pending'
                const gigAtt = attendance.filter(a => a.gig_id===g.id)
                return (
                  <div key={g.id} className="rounded-2xl overflow-hidden"
                    style={{ background: 'var(--bg-card)', border: `1px solid ${STATUS[g.status].color}40` }}>
                    <div className="p-4">
                      <p className="font-bold mb-1" style={{ color: 'var(--text-primary)' }}>{g.title}</p>
                      <div className="flex flex-wrap gap-x-3 gap-y-1">
                        <span className="text-xs font-semibold" style={{ color: STATUS[g.status].color }}>{STATUS[g.status].emoji} {STATUS[g.status].label}</span>
                        {g.start_time && <span className="text-xs flex items-center gap-1" style={{ color: 'var(--text-muted)' }}><Clock size={10}/>{formatTime(g.start_time)}{g.end_time?` – ${formatTime(g.end_time)}`:''}</span>}
                        {g.venue && <span className="text-xs flex items-center gap-1" style={{ color: 'var(--text-muted)' }}><MapPin size={10}/>{g.venue}</span>}
                        {g.end_date && g.end_date!==g.date && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Hasta {new Date(g.end_date+'T12:00:00').toLocaleDateString('es-CL',{day:'numeric',month:'short'})}</span>}
                      </div>
                      {g.notes && <p className="text-xs mt-2" style={{ color: 'var(--text-secondary)' }}>{g.notes}</p>}
                      {gigAtt.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-3 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
                          <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}><Users size={11}/></span>
                          {gigAtt.map(a => (
                            <span key={a.id} className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
                              style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>
                              {RSVP[a.status as RsvpStatus]?.emoji} {a.display_name||a.user_email?.split('@')[0]}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    {/* RSVP */}
                    {user ? (
                      <div className="flex border-t" style={{ borderColor: `${STATUS[g.status].color}20` }}>
                        {(['yes','maybe','no'] as RsvpStatus[]).map((r,ri) => (
                          <button key={r} onClick={() => rsvp(g.id, r)}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold"
                            style={{ background:myRsvp===r?RSVP[r].bg:'transparent', color:myRsvp===r?RSVP[r].color:'var(--text-muted)', borderRight:ri<2?'1px solid var(--border)':'none' }}>
                            {RSVP[r].emoji} <span className="hidden sm:inline">{RSVP[r].label}</span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center py-2.5 border-t text-xs" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                        <Link href={`/login?join=${code}`} className="underline" style={{ color: 'var(--accent)' }}>Inicia sesión</Link>
                        &nbsp;para confirmar asistencia
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Upcoming */}
        {upcoming.length > 0 && (
          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>Próximas fechas</h3>
            <div className="flex flex-col gap-2">
              {upcoming.map(g => {
                const [gy,gm,gd]=g.date.split('-').map(Number)
                const label=new Date(gy,gm-1,gd).toLocaleDateString('es-CL',{weekday:'short',day:'numeric',month:'short'})
                return (
                  <button key={g.id} onClick={() => { setYear(gy);setMonth(gm-1);setSelected(g.date) }}
                    className="flex items-center gap-3 p-3 rounded-2xl text-left"
                    style={{ background:'var(--bg-card)', border:`1px solid ${STATUS[g.status].color}30` }}>
                    <div className="w-2 h-10 rounded-full flex-shrink-0" style={{ background:STATUS[g.status].dot }}/>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate" style={{ color:'var(--text-primary)' }}>{g.title}</p>
                      <p className="text-xs" style={{ color:'var(--text-muted)' }}>
                        {label}{g.start_time?` · ${formatTime(g.start_time)}`:''}{g.venue?` · ${g.venue}`:''}
                      </p>
                    </div>
                    <div className="flex gap-0.5">
                      {attendance.filter(a=>a.gig_id===g.id).slice(0,4).map(a=>(
                        <span key={a.id} style={{fontSize:14}}>{RSVP[a.status as RsvpStatus]?.emoji}</span>
                      ))}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <p className="text-center text-xs mt-8 pb-4" style={{ color: 'var(--text-muted)', opacity: 0.5 }}>
          Compás · © {new Date().getFullYear()} Álvaro Arriagada Ortega
        </p>
      </div>
    </div>
  )
}
