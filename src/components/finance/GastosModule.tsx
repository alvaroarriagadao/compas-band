'use client'

import { useMemo, useState } from 'react'
import { Plus, Check, ChevronDown, ChevronUp, Trash2, Minus, X } from 'lucide-react'
import { Card, Btn, Input, Chip, Stat, SectionTitle, Empty, Avatar } from './ui'
import {
  type FinanceSnapshot, type ShareItem, fmtCLP, dateLabel, monthLabel, todayStr, addMonths,
  memberSummary, expenseProgress, installmentAmounts, allShareItems,
} from '@/lib/finance'

export type Act = (action: string, payload: Record<string, unknown>) => Promise<boolean>

interface Props { snap: FinanceSnapshot; canEdit: boolean; viewerId: string | null; act: Act }

export function GastosModule({ snap, canEdit, viewerId, act }: Props) {
  const [showNew, setShowNew] = useState(false)
  const active = snap.members.filter(m => m.active)
  const summary = useMemo(() => (viewerId ? memberSummary(snap, viewerId) : null), [snap, viewerId])
  const viewer = snap.members.find(m => m.id === viewerId)

  if (active.length < 2) {
    return <Empty emoji="👥" text="Agrega al menos dos integrantes en la sección Integrantes para repartir gastos." />
  }

  return (
    <div>
      {/* Resumen personal */}
      {summary && viewer && (
        <>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <Stat label="Debes" value={fmtCLP(summary.iOwe)} color={summary.iOwe > 0 ? 'var(--red)' : 'var(--green)'} />
            <Stat label="Te deben" value={fmtCLP(summary.owedToMe)} color={summary.owedToMe > 0 ? 'var(--green)' : 'var(--text-secondary)'} />
          </div>

          {summary.byPerson.length > 0 && (
            <>
              <SectionTitle>Con cada persona</SectionTitle>
              <Card className="divide-y" style={{ padding: 0 }}>
                {summary.byPerson.map(p => (
                  <div key={p.member.id} className="flex items-center gap-3 px-4 py-3" style={{ borderColor: 'var(--border)' }}>
                    <Avatar name={p.member.name} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{p.member.name}</p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {p.iOwe > 0 && <>Le debes {fmtCLP(p.iOwe)}</>}
                        {p.iOwe > 0 && p.owesMe > 0 && ' · '}
                        {p.owesMe > 0 && <>Te debe {fmtCLP(p.owesMe)}</>}
                      </p>
                    </div>
                    <span className="text-sm font-black tabular-nums" style={{ color: p.net < 0 ? 'var(--red)' : 'var(--green)' }}>
                      {p.net < 0 ? `-${fmtCLP(-p.net)}` : `+${fmtCLP(p.net)}`}
                    </span>
                  </div>
                ))}
              </Card>
            </>
          )}

          <SectionTitle>Qué tienes que pagar</SectionTitle>
          {summary.byMonth.length === 0 ? (
            <Card><p className="text-sm text-center py-2" style={{ color: 'var(--green)' }}>✓ Estás al día, no debes nada</p></Card>
          ) : summary.byMonth.map(group => (
            <div key={group.key} className="mb-3">
              <div className="flex items-center justify-between px-1 mb-1.5">
                <span className="text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>{monthLabel(group.key)}</span>
                <span className="text-xs font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>{fmtCLP(group.total)}</span>
              </div>
              <Card style={{ padding: 0 }} className="divide-y">
                {group.items.map(i => <ShareRow key={i.share.id} item={i} mode="pay" canEdit={canEdit} act={act} />)}
              </Card>
            </div>
          ))}

          {summary.incoming.length > 0 && (
            <>
              <SectionTitle>Te deben</SectionTitle>
              <Card style={{ padding: 0 }} className="divide-y">
                {summary.incoming.map(i => <ShareRow key={i.share.id} item={i} mode="receive" canEdit={canEdit} act={act} />)}
              </Card>
            </>
          )}
        </>
      )}

      {/* Lista de gastos */}
      <SectionTitle right={canEdit && !showNew && <Btn small onClick={() => setShowNew(true)}><Plus size={12} /> Nuevo gasto</Btn>}>
        Todos los gastos
      </SectionTitle>
      {showNew && <NewExpenseForm snap={snap} viewerId={viewerId} act={act} onClose={() => setShowNew(false)} />}
      {snap.expenses.length === 0 ? (
        <Empty emoji="🧾" text="Aún no hay gastos compartidos. Registra el primero con “Nuevo gasto”." />
      ) : (
        <div className="flex flex-col gap-2">
          {snap.expenses.map(e => <ExpenseCard key={e.id} snap={snap} expenseId={e.id} canEdit={canEdit} act={act} />)}
        </div>
      )}
    </div>
  )
}

function ShareRow({ item, mode, canEdit, act }: { item: ShareItem; mode: 'pay' | 'receive'; canEdit: boolean; act: Act }) {
  const { share, expense, payer, debtor } = item
  const [busy, setBusy] = useState(false)
  const overdue = !share.paid_at && share.due_date < todayStr()
  const toggle = async () => { setBusy(true); await act('share.toggle', { share_id: share.id, paid: !share.paid_at }); setBusy(false) }
  return (
    <div className="flex items-center gap-3 px-4 py-3" style={{ borderColor: 'var(--border)' }}>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{expense.description}</p>
        <p className="text-xs" style={{ color: overdue ? 'var(--red)' : 'var(--text-muted)' }}>
          {mode === 'pay' ? `a ${payer.name}` : `${debtor.name}`}
          {expense.installments > 1 && ` · cuota ${share.installment_no}/${expense.installments}`}
          {' · '}{overdue ? 'venció el ' : 'vence '}{dateLabel(share.due_date)}
        </p>
      </div>
      <span className="text-sm font-black tabular-nums" style={{ color: 'var(--text-primary)' }}>{fmtCLP(share.amount)}</span>
      {canEdit && (
        <button onClick={toggle} disabled={busy} title={mode === 'pay' ? 'Marcar como pagada' : 'Marcar como recibida'}
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all"
          style={{ background: share.paid_at ? 'var(--green)' : 'var(--bg-elevated)', border: '1px solid var(--border)', color: share.paid_at ? '#000' : 'var(--text-muted)', opacity: busy ? 0.5 : 1 }}>
          <Check size={16} />
        </button>
      )}
    </div>
  )
}

function ExpenseCard({ snap, expenseId, canEdit, act }: { snap: FinanceSnapshot; expenseId: string; canEdit: boolean; act: Act }) {
  const [open, setOpen] = useState(false)
  const expense = snap.expenses.find(e => e.id === expenseId)!
  const payer = snap.members.find(m => m.id === expense.paid_by)
  const progress = expenseProgress(expense, snap.shares)
  const items = useMemo(() => allShareItems(snap).filter(i => i.expense.id === expenseId), [snap, expenseId])
  const byMember = new Map<string, ShareItem[]>()
  for (const i of items) byMember.set(i.debtor.id, [...(byMember.get(i.debtor.id) || []), i])
  const pct = progress.total ? Math.round((progress.paid / progress.total) * 100) : 100

  return (
    <Card style={{ padding: 0 }}>
      <button className="w-full text-left px-4 py-3" onClick={() => setOpen(!open)}>
        <div className="flex items-start gap-3">
          <Avatar name={payer?.name || '?'} size={34} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{expense.description}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Pagó <b style={{ color: 'var(--text-secondary)' }}>{payer?.name}</b> · {dateLabel(expense.expense_date)}
              {expense.installments > 1 && ` · ${expense.installments} cuotas`} · {progress.debtors + 1} personas
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Cada uno aporta {fmtCLP(progress.perPerson)}</p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-base font-black tabular-nums" style={{ color: 'var(--text-primary)' }}>{fmtCLP(expense.amount)}</p>
            <p className="text-[10px] font-bold" style={{ color: progress.done ? 'var(--green)' : 'var(--accent)' }}>
              {progress.done ? '✓ Saldado' : `Falta ${fmtCLP(progress.pending)}`}
            </p>
          </div>
        </div>
        <div className="mt-2.5 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-elevated)' }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: progress.done ? 'var(--green)' : 'var(--accent)' }} />
        </div>
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Recibido {fmtCLP(progress.paid)} de {fmtCLP(progress.total)}</span>
          <span style={{ color: 'var(--text-muted)' }}>{open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</span>
        </div>
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1" style={{ borderTop: '1px solid var(--border)' }}>
          {expense.notes && <p className="text-xs mb-3 italic" style={{ color: 'var(--text-secondary)' }}>{expense.notes}</p>}
          {[...byMember.entries()].map(([memberId, xs]) => (
            <div key={memberId} className="mb-3">
              <p className="text-xs font-bold mb-1" style={{ color: 'var(--text-secondary)' }}>
                {xs[0].debtor.name} → {payer?.name} · {fmtCLP(xs.reduce((a, i) => a + i.share.amount, 0))}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {xs.map(i => (
                  <button key={i.share.id} disabled={!canEdit}
                    onClick={() => act('share.toggle', { share_id: i.share.id, paid: !i.share.paid_at })}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-semibold tabular-nums"
                    style={{
                      background: i.share.paid_at ? 'rgba(16,185,129,0.15)' : 'var(--bg-elevated)',
                      color: i.share.paid_at ? 'var(--green)' : (i.share.due_date < todayStr() ? 'var(--red)' : 'var(--text-secondary)'),
                      border: `1px solid ${i.share.paid_at ? 'rgba(16,185,129,0.3)' : 'var(--border)'}`,
                    }}>
                    {i.share.paid_at ? '✓ ' : ''}{expense.installments > 1 ? `${i.share.installment_no}ª · ` : ''}{dateLabel(i.share.due_date)} · {fmtCLP(i.share.amount)}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <p className="text-[10px] mb-3" style={{ color: 'var(--text-muted)' }}>
            {payer?.name} pone su parte ({fmtCLP(expense.amount - progress.total)}) y recibe el resto.
            {expense.created_by_name && ` Registrado por ${expense.created_by_name}.`}
          </p>
          {canEdit && (
            <Btn small variant="danger" onClick={() => { if (window.confirm(`¿Eliminar "${expense.description}"? Se borran también sus cuotas.`)) act('expense.delete', { id: expense.id }) }}>
              <Trash2 size={12} /> Eliminar gasto
            </Btn>
          )}
        </div>
      )}
    </Card>
  )
}

function NewExpenseForm({ snap, viewerId, act, onClose }: { snap: FinanceSnapshot; viewerId: string | null; act: Act; onClose: () => void }) {
  const active = snap.members.filter(m => m.active)
  const [paidBy, setPaidBy] = useState(viewerId && active.some(m => m.id === viewerId) ? viewerId : active[0].id)
  const [description, setDescription] = useState('')
  const [amountText, setAmountText] = useState('')
  const [date, setDate] = useState(todayStr())
  const [dueDates, setDueDates] = useState<string[]>([todayStr()])
  const [participants, setParticipants] = useState<string[]>(active.map(m => m.id))
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const amount = Math.round(Number(amountText.replace(/\D/g, '')) || 0)
  const debtors = participants.filter(id => id !== paidBy)
  const perPerson = debtors.length ? Math.floor(amount / (debtors.length + 1)) : 0
  const cuotas = installmentAmounts(perPerson, dueDates.length)

  function setInstallments(k: number) {
    k = Math.max(1, Math.min(12, k))
    setDueDates(prev => Array.from({ length: k }, (_, i) => prev[i] ?? addMonths(prev[0] ?? date, i)))
  }
  function regenerateFrom(first: string) {
    setDueDates(prev => prev.map((_, i) => addMonths(first, i)))
  }
  const toggleParticipant = (id: string) => setParticipants(p => (p.includes(id) ? p.filter(x => x !== id) : [...p, id]))

  async function submit() {
    setError('')
    if (!description.trim()) return setError('Escribe de qué es el gasto')
    if (amount <= 0) return setError('Ingresa el monto')
    if (!debtors.length) return setError('Elige al menos una persona más que comparta el gasto')
    setSaving(true)
    const ok = await act('expense.create', { paid_by: paidBy, description: description.trim(), amount, expense_date: date, due_dates: dueDates, participant_ids: participants, notes: notes.trim() || null })
    setSaving(false)
    if (ok) onClose()
  }

  return (
    <Card className="mb-4 fade-in" style={{ borderColor: 'var(--border-bright)' }}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Nuevo gasto compartido</p>
        <button onClick={onClose} style={{ color: 'var(--text-muted)' }}><X size={16} /></button>
      </div>
      <div className="space-y-3">
        <div>
          <span className="text-xs font-semibold block mb-1.5" style={{ color: 'var(--text-muted)' }}>¿Quién pagó?</span>
          <div className="flex flex-wrap gap-1.5">
            {active.map(m => <Chip key={m.id} active={paidBy === m.id} onClick={() => { setPaidBy(m.id); if (!participants.includes(m.id)) setParticipants(p => [...p, m.id]) }}>{m.name}</Chip>)}
          </div>
        </div>
        <Input label="¿De qué es?" placeholder="Ej: Difusión en radio" value={description} onChange={e => setDescription(e.target.value)} autoFocus />
        <div className="grid grid-cols-2 gap-2">
          <Input label="Monto total (CLP)" inputMode="numeric" placeholder="70000" value={amount ? amount.toLocaleString('es-CL') : ''} onChange={e => setAmountText(e.target.value)} />
          <Input label="Fecha del gasto" type="date" value={date} onChange={e => { setDate(e.target.value); if (e.target.value) regenerateFrom(e.target.value) }} />
        </div>
        <div>
          <span className="text-xs font-semibold block mb-1.5" style={{ color: 'var(--text-muted)' }}>¿Quiénes lo comparten? (en partes iguales)</span>
          <div className="flex flex-wrap gap-1.5">
            {active.map(m => (
              <Chip key={m.id} active={participants.includes(m.id)} disabled={m.id === paidBy} onClick={() => toggleParticipant(m.id)} color="var(--green)">
                {m.name}{m.id === paidBy ? ' (pagó)' : ''}
              </Chip>
            ))}
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Cuotas para devolverle</span>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setInstallments(dueDates.length - 1)} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}><Minus size={12} /></button>
              <span className="text-sm font-black w-5 text-center" style={{ color: 'var(--text-primary)' }}>{dueDates.length}</span>
              <button type="button" onClick={() => setInstallments(dueDates.length + 1)} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}><Plus size={12} /></button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {dueDates.map((d, i) => (
              <div key={i} className="flex items-center gap-2 rounded-xl px-2.5 py-1.5" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                <span className="text-[10px] font-bold w-6" style={{ color: 'var(--text-muted)' }}>{i + 1}ª</span>
                <input type="date" value={d} onChange={e => setDueDates(ds => ds.map((x, j) => (j === i ? e.target.value : x)))}
                  className="flex-1 bg-transparent outline-none text-xs" style={{ color: 'var(--text-primary)' }} />
                <span className="text-[10px] tabular-nums" style={{ color: 'var(--text-muted)' }}>{amount ? fmtCLP(cuotas[i]) : ''}</span>
              </div>
            ))}
          </div>
        </div>
        <Input label="Nota (opcional)" placeholder="Detalle, boleta, etc." value={notes} onChange={e => setNotes(e.target.value)} />

        {amount > 0 && debtors.length > 0 && (
          <div className="rounded-xl px-3.5 py-3 text-xs leading-relaxed" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', color: 'var(--text-secondary)' }}>
            <b style={{ color: 'var(--text-primary)' }}>{fmtCLP(amount)}</b> entre {debtors.length + 1} personas → cada uno aporta <b style={{ color: 'var(--text-primary)' }}>{fmtCLP(perPerson)}</b>
            {dueDates.length > 1 && <> en cuotas de {cuotas.map(fmtCLP).join(', ')}</>}.
            <br />{active.find(m => m.id === paidBy)?.name} recibirá <b style={{ color: 'var(--green)' }}>{fmtCLP(perPerson * debtors.length)}</b> en total.
          </div>
        )}
        {error && <p className="text-xs" style={{ color: 'var(--red)' }}>{error}</p>}
        <div className="flex gap-2">
          <Btn onClick={submit} disabled={saving} className="flex-1">{saving ? 'Guardando…' : 'Guardar gasto'}</Btn>
          <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
        </div>
      </div>
    </Card>
  )
}
