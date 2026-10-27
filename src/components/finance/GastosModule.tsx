'use client'

import { useMemo, useState } from 'react'
import { Plus, Check, ChevronDown, ChevronUp, Trash2, Minus, X } from 'lucide-react'
import { Card, Btn, Input, Chip, SectionTitle, Empty, Avatar } from './ui'
import {
  type FinanceSnapshot, type ShareItem, type PersonBalance, fmtCLP, dateLabel, monthLabel, monthKey, todayStr, addMonths,
  memberSummary, expenseProgress, installmentAmounts, debtorParts, allShareItems,
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
          <Card className="mt-2" style={{ padding: 14 }}>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Debes</p>
                <p className="text-2xl font-black tabular-nums leading-tight" style={{ color: summary.iOwe > 0 ? 'var(--red)' : 'var(--green)' }}>{fmtCLP(summary.iOwe)}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Te deben</p>
                <p className="text-2xl font-black tabular-nums leading-tight" style={{ color: summary.owedToMe > 0 ? 'var(--green)' : 'var(--text-secondary)' }}>{fmtCLP(summary.owedToMe)}</p>
              </div>
            </div>
            <ThisMonthLine summary={summary} />
          </Card>

          <SectionTitle>Por persona</SectionTitle>
          {summary.byPerson.length === 0 ? (
            <Card><p className="text-sm text-center py-1" style={{ color: 'var(--green)' }}>✓ Estás al día con todos</p></Card>
          ) : (
            <div className="flex flex-col gap-2">
              {summary.byPerson.map(p => (
                <PersonCard key={p.member.id} snap={snap} me={viewer.id} person={p} canEdit={canEdit} act={act} />
              ))}
            </div>
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

function ThisMonthLine({ summary }: { summary: ReturnType<typeof memberSummary> }) {
  const key = monthKey(todayStr())
  const pay = summary.pending.filter(i => monthKey(i.share.due_date) <= key).reduce((a, i) => a + i.share.amount, 0)
  const get = summary.incoming.filter(i => monthKey(i.share.due_date) <= key).reduce((a, i) => a + i.share.amount, 0)
  if (!pay && !get) return null
  return (
    <p className="text-[11px] mt-2 pt-2" style={{ color: 'var(--text-muted)', borderTop: '1px solid var(--border)' }}>
      Vencido a {monthLabel(key).toLowerCase()}:{' '}
      {pay > 0 && <>pagas <b style={{ color: 'var(--red)' }}>{fmtCLP(pay)}</b></>}
      {pay > 0 && get > 0 && ' · '}
      {get > 0 && <>recibes <b style={{ color: 'var(--green)' }}>{fmtCLP(get)}</b></>}
    </p>
  )
}

/** Una tarjeta por persona: total neto y, al abrir, cada gasto en una línea con sus cuotas como botones. */
function PersonCard({ snap, me, person, canEdit, act }: { snap: FinanceSnapshot; me: string; person: PersonBalance; canEdit: boolean; act: Act }) {
  const [open, setOpen] = useState(false)
  const items = useMemo(() => allShareItems(snap), [snap])
  const owesMe = items.filter(i => i.debtor.id === person.member.id && i.payer.id === me)
  const iOwe = items.filter(i => i.debtor.id === me && i.payer.id === person.member.id)
  const net = person.net
  const nextDue = [...owesMe, ...iOwe].filter(i => !i.share.paid_at).sort((x, y) => x.share.due_date.localeCompare(y.share.due_date))[0]

  return (
    <Card style={{ padding: 0 }}>
      <button className="w-full flex items-center gap-3 px-3.5 py-3 text-left" onClick={() => setOpen(!open)}>
        <Avatar name={person.member.name} size={32} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{person.member.name}</p>
          <p className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>
            {person.owesMe > 0 && person.iOwe > 0
              ? <>te debe <b style={{ color: 'var(--green)' }}>{fmtCLP(person.owesMe)}</b> · le debes <b style={{ color: 'var(--red)' }}>{fmtCLP(person.iOwe)}</b></>
              : nextDue && <>Próxima: {dateLabel(nextDue.share.due_date).split(' ').slice(0, 2).join(' ')} · {fmtCLP(nextDue.share.amount)}</>}
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-base font-black tabular-nums" style={{ color: net < 0 ? 'var(--red)' : 'var(--green)' }}>{net < 0 ? '−' : '+'}{fmtCLP(Math.abs(net))}</p>
          <p className="text-[9px] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>{net < 0 ? 'pagas' : 'recibes'}</p>
        </div>
        <span style={{ color: 'var(--text-muted)' }}>{open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}</span>
      </button>
      {open && (
        <div className="px-3.5 pb-3.5" style={{ borderTop: '1px solid var(--border)' }}>
          {owesMe.some(i => !i.share.paid_at) && <DebtBlock title={`${person.member.name} te debe`} items={owesMe} canEdit={canEdit} act={act} color="var(--green)" />}
          {iOwe.some(i => !i.share.paid_at) && <DebtBlock title={`Le debes a ${person.member.name}`} items={iOwe} canEdit={canEdit} act={act} color="var(--red)" />}
        </div>
      )}
    </Card>
  )
}

function DebtBlock({ title, items, canEdit, act, color }: { title: string; items: ShareItem[]; canEdit: boolean; act: Act; color: string }) {
  const [busy, setBusy] = useState(false)
  const today = todayStr()
  const currentKey = monthKey(today)
  const byExpense = new Map<string, ShareItem[]>()
  for (const i of items) byExpense.set(i.expense.id, [...(byExpense.get(i.expense.id) || []), i])
  const groups = [...byExpense.values()]
    .filter(xs => xs.some(i => !i.share.paid_at))
    .sort((x, y) => x[0].expense.expense_date.localeCompare(y[0].expense.expense_date))
  const dueNow = items.filter(i => !i.share.paid_at && monthKey(i.share.due_date) <= currentKey)
  const dueNowTotal = dueNow.reduce((a, i) => a + i.share.amount, 0)
  const pendingTotal = items.filter(i => !i.share.paid_at).reduce((a, i) => a + i.share.amount, 0)

  async function payDueNow() {
    if (!window.confirm(`¿Marcar como pagadas ${dueNow.length} cuota${dueNow.length > 1 ? 's' : ''} por ${fmtCLP(dueNowTotal)}?`)) return
    setBusy(true)
    await act('shares.pay', { share_ids: dueNow.map(i => i.share.id) })
    setBusy(false)
  }

  return (
    <div className="pt-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color }}>{title}</p>
        <p className="text-xs font-black tabular-nums" style={{ color: 'var(--text-primary)' }}>{fmtCLP(pendingTotal)}</p>
      </div>
      <div className="flex flex-col gap-2">
        {groups.map(xs => {
          const e = xs[0].expense
          const left = xs.filter(i => !i.share.paid_at).reduce((a, i) => a + i.share.amount, 0)
          return (
            <div key={e.id} className="rounded-xl px-3 py-2" style={{ background: 'var(--bg-elevated)' }}>
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{e.description}</p>
                <p className="text-xs font-bold tabular-nums flex-shrink-0" style={{ color: 'var(--text-secondary)' }}>{fmtCLP(left)}</p>
              </div>
              <div className="flex flex-wrap gap-1 mt-1.5">
                {xs.sort((x, y) => x.share.installment_no - y.share.installment_no).map(i => {
                  const paid = !!i.share.paid_at
                  const overdue = !paid && i.share.due_date < today
                  return (
                    <button key={i.share.id} disabled={!canEdit}
                      onClick={() => act('share.toggle', { share_id: i.share.id, paid: !paid })}
                      title={paid ? 'Pagada · tocar para desmarcar' : 'Tocar para marcar pagada'}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold tabular-nums transition-transform active:scale-95"
                      style={{
                        background: paid ? 'rgba(16,185,129,0.15)' : overdue ? 'rgba(239,68,68,0.12)' : 'var(--bg-card)',
                        border: `1px solid ${paid ? 'rgba(16,185,129,0.35)' : overdue ? 'rgba(239,68,68,0.35)' : 'var(--border)'}`,
                        color: paid ? 'var(--green)' : overdue ? 'var(--red)' : 'var(--text-secondary)',
                        textDecoration: paid ? 'line-through' : 'none',
                      }}>
                      {paid ? <Check size={10} /> : <span className="w-2.5 h-2.5 rounded-[3px]" style={{ border: '1.5px solid currentColor' }} />}
                      {monthLabel(monthKey(i.share.due_date), true).split(' ')[0]} {fmtCLP(i.share.amount)}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
      {canEdit && dueNow.length > 1 && (
        <Btn small variant="success" className="w-full mt-2" disabled={busy} onClick={payDueNow}>
          <Check size={12} /> Marcar todo lo vencido ({fmtCLP(dueNowTotal)})
        </Btn>
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
              {expense.installments > 1 && ` · ${expense.installments} cuotas`} · {progress.people} persona{progress.people > 1 ? 's' : ''}
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {progress.payerShares ? `Cada uno aporta ${fmtCLP(progress.perPerson)}` : `Le devuelven el total a ${payer?.name}`}
            </p>
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
            {progress.payerShares ? `${payer?.name} pone su parte (${fmtCLP(expense.amount - progress.total)}) y recibe el resto.` : `${payer?.name} no comparte este gasto: recibe los ${fmtCLP(progress.total)} completos.`}
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
  const payerShares = participants.includes(paidBy)
  const parts = debtorParts(amount, debtors.length, payerShares)
  const perPerson = parts[0] ?? 0
  const toPayer = parts.reduce((a, x) => a + x, 0)
  const cuotas = installmentAmounts(perPerson, dueDates.length)
  const payerName = active.find(m => m.id === paidBy)?.name

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
    if (!debtors.length) return setError('Elige al menos una persona que le deba a quien pagó')
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
          <span className="text-xs font-semibold block mb-1.5" style={{ color: 'var(--text-muted)' }}>¿Entre quiénes se reparte? (partes iguales)</span>
          <div className="flex flex-wrap gap-1.5">
            {active.map(m => (
              <Chip key={m.id} active={participants.includes(m.id)} onClick={() => toggleParticipant(m.id)} color="var(--green)">
                {m.name}{m.id === paidBy ? ' (pagó)' : ''}
              </Chip>
            ))}
          </div>
          <p className="text-[10px] mt-1.5" style={{ color: 'var(--text-muted)' }}>
            {payerShares
              ? `${payerName} pone su parte. Desmárcalo si el gasto no es suyo y le deben devolver todo.`
              : `${payerName} no comparte el gasto: le devuelven el total.`}
          </p>
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
            {payerShares
              ? <><b style={{ color: 'var(--text-primary)' }}>{fmtCLP(amount)}</b> entre {debtors.length + 1} personas → cada uno aporta <b style={{ color: 'var(--text-primary)' }}>{fmtCLP(perPerson)}</b></>
              : <><b style={{ color: 'var(--text-primary)' }}>{fmtCLP(amount)}</b> {debtors.length > 1 ? `entre ${debtors.length} personas → cada una devuelve` : `→ ${active.find(m => m.id === debtors[0])?.name} devuelve`} <b style={{ color: 'var(--text-primary)' }}>{fmtCLP(perPerson)}</b></>}
            {dueDates.length > 1 && <> en cuotas de {cuotas.map(fmtCLP).join(', ')}</>}.
            <br />{payerName} recibirá <b style={{ color: 'var(--green)' }}>{fmtCLP(toPayer)}</b> en total.
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
