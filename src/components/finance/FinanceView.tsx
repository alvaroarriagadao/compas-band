'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Share2, Check, Wallet, PiggyBank, History, Users, Plus, UserCheck } from 'lucide-react'
import { Card, Btn, Chip, Input, Avatar, Empty, SectionTitle } from './ui'
import { GastosModule, type Act } from './GastosModule'
import { CajaModule } from './CajaModule'
import { type FinanceSnapshot, relativeTime } from '@/lib/finance'

type Tab = 'gastos' | 'caja' | 'historial'

interface Props {
  snap: FinanceSnapshot
  canEdit: boolean
  viewerId: string | null
  onPickViewer: (memberId: string) => void
  act: Act
  backHref: string
  backLabel: string
}

export function FinanceView({ snap, canEdit, viewerId, onPickViewer, act, backHref, backLabel }: Props) {
  const [tab, setTab] = useState<Tab>('gastos')
  const [copied, setCopied] = useState(false)
  const [showMembers, setShowMembers] = useState(false)
  const viewer = snap.members.find(m => m.id === viewerId)
  const active = snap.members.filter(m => m.active)

  function share() {
    if (!snap.project.access_code) return
    const url = `${window.location.origin}/fin/${snap.project.access_code}`
    navigator.clipboard?.writeText(url)
    setCopied(true); setTimeout(() => setCopied(false), 2500)
  }

  return (
    <div className="min-h-screen pb-28" style={{ background: 'var(--bg-base)' }}>
      <div className="px-4 py-6 max-w-xl mx-auto">
        <Link href={backHref} className="inline-flex items-center gap-1.5 text-sm mb-4" style={{ color: 'var(--text-muted)' }}><ArrowLeft size={14} /> {backLabel}</Link>

        <div className="flex items-center justify-between gap-3 mb-4 fade-in">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--accent)' }}>Finanzas</p>
            <h1 className="text-xl font-black leading-tight truncate" style={{ color: 'var(--text-primary)' }}>{snap.project.name}</h1>
          </div>
          {snap.project.access_code && (
            <Btn small variant={copied ? 'success' : 'ghost'} onClick={share}>
              {copied ? <><Check size={12} /> Enlace copiado</> : <><Share2 size={12} /> Compartir</>}
            </Btn>
          )}
        </div>

        {/* Quién soy */}
        {active.length > 0 && (
          viewer ? (
            <div className="flex items-center gap-2 mb-4 text-xs" style={{ color: 'var(--text-muted)' }}>
              <Avatar name={viewer.name} size={22} />
              <span>Viendo como <b style={{ color: 'var(--text-primary)' }}>{viewer.name}</b></span>
              <button className="underline" onClick={() => onPickViewer('')}>cambiar</button>
            </div>
          ) : (
            <Card className="mb-4" style={{ borderColor: 'var(--border-bright)' }}>
              <p className="text-sm font-bold mb-2" style={{ color: 'var(--text-primary)' }}>¿Quién eres?</p>
              <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>Así ves tu resumen: qué debes, a quién y cuánto te deben.</p>
              <div className="flex flex-wrap gap-1.5">
                {active.map(m => <Chip key={m.id} onClick={() => onPickViewer(m.id)}>{m.name}</Chip>)}
              </div>
            </Card>
          )
        )}

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-2xl mb-2" style={{ background: 'var(--bg-card)' }}>
          {([['gastos', 'Gastos', Wallet], ['caja', 'Caja', PiggyBank], ['historial', 'Historial', History]] as const).map(([t, label, Icon]) => (
            <button key={t} onClick={() => setTab(t)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold transition-all"
              style={{ background: tab === t ? 'var(--bg-elevated)' : 'transparent', color: tab === t ? 'var(--text-primary)' : 'var(--text-muted)' }}>
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>

        {tab === 'gastos' && <GastosModule snap={snap} canEdit={canEdit} viewerId={viewerId} act={act} />}
        {tab === 'caja' && <CajaModule snap={snap} canEdit={canEdit} act={act} />}
        {tab === 'historial' && <Historial snap={snap} />}

        {/* Integrantes */}
        {canEdit && (
          <>
            <SectionTitle right={<Btn small variant="ghost" onClick={() => setShowMembers(!showMembers)}><Users size={12} /> {showMembers ? 'Cerrar' : `Integrantes (${active.length})`}</Btn>}>
              Integrantes
            </SectionTitle>
            {(showMembers || active.length === 0) && <MembersManager snap={snap} act={act} />}
          </>
        )}
      </div>
    </div>
  )
}

function Historial({ snap }: { snap: FinanceSnapshot }) {
  if (snap.log.length === 0) return <Empty emoji="🕓" text="Todavía no hay movimientos registrados." />
  return (
    <Card style={{ padding: 0 }} className="mt-2">
      {snap.log.map(l => (
        <div key={l.id} className="px-4 py-3 flex gap-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded h-fit mt-0.5 flex-shrink-0"
            style={{ background: l.module === 'caja' ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)', color: l.module === 'caja' ? 'var(--green)' : 'var(--accent)' }}>
            {l.module}
          </span>
          <div className="min-w-0">
            <p className="text-xs leading-snug" style={{ color: 'var(--text-primary)' }}>{l.detail}</p>
            <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{l.user_name || 'Alguien'} · {relativeTime(l.created_at)}</p>
          </div>
        </div>
      ))}
    </Card>
  )
}

function MembersManager({ snap, act }: { snap: FinanceSnapshot; act: Act }) {
  const [name, setName] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const myId = snap.me?.user_id
  const mine = snap.members.find(m => m.user_id === myId)

  return (
    <Card className="fade-in">
      <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
        Las personas entre las que se reparten los gastos y las cuotas. No necesitan tener cuenta en la app.
      </p>
      <div className="flex flex-col gap-1.5 mb-3">
        {snap.members.map(m => (
          <div key={m.id} className="flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: 'var(--bg-elevated)', opacity: m.active ? 1 : 0.5 }}>
            <Avatar name={m.name} size={24} />
            {editing === m.id ? (
              <input autoFocus value={editName} onChange={e => setEditName(e.target.value)}
                onKeyDown={async e => { if (e.key === 'Enter') { await act('member.update', { id: m.id, name: editName, active: m.active }); setEditing(null) } if (e.key === 'Escape') setEditing(null) }}
                className="flex-1 bg-transparent outline-none text-sm" style={{ color: 'var(--text-primary)' }} />
            ) : (
              <button className="flex-1 text-left text-sm font-semibold" style={{ color: 'var(--text-primary)' }} onClick={() => { setEditing(m.id); setEditName(m.name) }}>
                {m.name}{!m.active && ' (inactivo)'}{m.user_id === myId && <span className="text-[10px] ml-1.5" style={{ color: 'var(--accent)' }}>tú</span>}
              </button>
            )}
            {!mine && !m.user_id && (
              <button className="text-[10px] font-bold" style={{ color: 'var(--accent)' }} onClick={() => act('member.claim', { id: m.id })} title="Este soy yo"><UserCheck size={14} /></button>
            )}
            <button className="text-[10px]" style={{ color: 'var(--text-muted)' }} onClick={() => act('member.update', { id: m.id, name: m.name, active: !m.active })}>
              {m.active ? 'desactivar' : 'activar'}
            </button>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <Input placeholder="Nombre del integrante" value={name} onChange={e => setName(e.target.value)}
          onKeyDown={async e => { if (e.key === 'Enter' && name.trim()) { await act('member.add', { name: name.trim() }); setName('') } }} />
        <Btn disabled={!name.trim()} onClick={async () => { await act('member.add', { name: name.trim() }); setName('') }}><Plus size={14} /></Btn>
      </div>
      {snap.candidates.length > 0 && (
        <div className="mt-3">
          <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-muted)' }}>Agregar desde la banda</p>
          <div className="flex flex-wrap gap-1.5">
            {snap.candidates.map(c => <Chip key={c.user_id} onClick={() => act('member.add', { name: c.name, user_id: c.user_id })}>+ {c.name}</Chip>)}
          </div>
        </div>
      )}
    </Card>
  )
}
