'use client'

import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Check, Plus, Trash2, Settings2, X } from 'lucide-react'
import { Card, Btn, Input, Stat, SectionTitle, Empty, Avatar } from './ui'
import { type FinanceSnapshot, type MonthState, fmtCLP, dateLabel, monthLabel, monthKey, todayStr, treasurySummary, monthStatus } from '@/lib/finance'
import type { Act } from './GastosModule'

interface Props { snap: FinanceSnapshot; canEdit: boolean; act: Act }

export function CajaModule({ snap, canEdit, act }: Props) {
  const s = snap.treasury.settings
  const summary = useMemo(() => treasurySummary(snap), [snap])
  const today = todayStr()
  const currentYear = Number(today.slice(0, 4))
  const minYear = Math.min(Number(s.start_month.slice(0, 4)), currentYear)
  const [year, setYear] = useState(currentYear)
  const [selected, setSelected] = useState<{ memberId: string; key: string } | null>(null)
  const [showExpense, setShowExpense] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const active = snap.members.filter(m => m.active)

  return (
    <div>
      <div className="mt-2 grid grid-cols-1 gap-2">
        <Stat label="Saldo en caja" value={fmtCLP(summary.balance)} color={summary.balance >= 0 ? 'var(--green)' : 'var(--red)'} big />
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Saldo inicial" value={fmtCLP(s.opening_balance)} />
          <Stat label="Cuotas nuevas" value={`+${fmtCLP(summary.feesCollected)}`} color="var(--green)" />
          <Stat label="Gastos" value={`-${fmtCLP(summary.expensesTotal)}`} color="var(--red)" />
          <Stat label="Por cobrar" value={fmtCLP(summary.receivable)} color={summary.receivable > 0 ? 'var(--accent)' : 'var(--green)'} />
        </div>
      </div>
      {s.opening_note && <p className="text-[10px] mt-1.5 px-1 leading-relaxed" style={{ color: 'var(--text-muted)' }}>{s.opening_note}</p>}

      {active.length === 0 ? (
        <Empty emoji="👥" text="Agrega integrantes para llevar las cuotas mensuales." />
      ) : (
        <>
          <SectionTitle right={
            <div className="flex items-center gap-1.5">
              <button onClick={() => setYear(y => y - 1)} disabled={year <= minYear} className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)', opacity: year <= minYear ? 0.3 : 1 }}><ChevronLeft size={14} /></button>
              <span className="text-sm font-black tabular-nums w-11 text-center" style={{ color: 'var(--text-primary)' }}>{year}</span>
              <button onClick={() => setYear(y => y + 1)} disabled={year >= currentYear + 1} className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)', opacity: year >= currentYear + 1 ? 0.3 : 1 }}><ChevronRight size={14} /></button>
            </div>
          }>
            Cuotas de {fmtCLP(s.monthly_fee)}
          </SectionTitle>

          <div className="flex flex-wrap gap-x-3 gap-y-1 mb-2 px-1">
            {(['paid', 'partial', 'pending', 'future'] as const).map(st => (
              <span key={st} className="inline-flex items-center gap-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                <span className="w-2.5 h-2.5 rounded-sm" style={{ background: STATE_STYLE[st].bg, border: `1px solid ${STATE_STYLE[st].border}` }} />
                {STATE_STYLE[st].label}
              </span>
            ))}
          </div>

          <div className="flex flex-col gap-2">
            {active.map(m => {
              const pm = summary.perMember.find(p => p.member.id === m.id)!
              return (
                <Card key={m.id} style={{ padding: 12 }}>
                  <div className="flex items-center gap-2.5 mb-2.5">
                    <Avatar name={m.name} size={26} />
                    <p className="text-sm font-bold flex-1" style={{ color: 'var(--text-primary)' }}>{m.name}</p>
                    <span className="text-[11px] font-bold px-2 py-1 rounded-lg" style={{
                      background: pm.pendingAmount ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.15)',
                      color: pm.pendingAmount ? 'var(--red)' : 'var(--green)',
                    }}>
                      {pm.pendingAmount ? `Debe ${fmtCLP(pm.pendingAmount)}` : '✓ Al día'}
                    </span>
                  </div>
                  <div className="grid grid-cols-6 gap-1.5">
                    {Array.from({ length: 12 }, (_, i) => {
                      const key = `${year}-${String(i + 1).padStart(2, '0')}`
                      const st = monthStatus(snap, m.id, key, today)
                      const style = STATE_STYLE[st.state]
                      return (
                        <button key={key} disabled={st.state === 'off'} onClick={() => setSelected({ memberId: m.id, key })}
                          className="aspect-square rounded-xl flex flex-col items-center justify-center transition-transform active:scale-95"
                          style={{ background: style.bg, border: `1px solid ${style.border}`, color: style.color, borderStyle: st.state === 'off' ? 'dashed' : 'solid' }}>
                          <span className="text-[10px] font-bold leading-none">{MES_CORTO[i]}</span>
                          <span className="text-[10px] font-black leading-none mt-1 tabular-nums">
                            {st.state === 'paid' ? '✓' : st.state === 'partial' ? `${Math.round(st.paid / 1000)}k` : st.state === 'pending' ? '!' : ''}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </Card>
              )
            })}
          </div>
          <p className="text-[10px] mt-2 px-1 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            Toca un mes para marcarlo pagado, registrar un pago parcial o ver quién lo marcó. Las cuotas se cobran desde {monthLabel(monthKey(s.start_month))}.
            Los pagos marcados &quot;Excel&quot; ya estaban en el saldo inicial y no se suman de nuevo.
          </p>
        </>
      )}

      {selected && (
        <FeeSheet snap={snap} memberId={selected.memberId} monthKeyStr={selected.key} canEdit={canEdit} act={act} onClose={() => setSelected(null)} />
      )}

      {/* Gastos de caja */}
      <SectionTitle right={canEdit && !showExpense && <Btn small onClick={() => setShowExpense(true)}><Plus size={12} /> Gasto</Btn>}>
        Gastos de la caja
      </SectionTitle>
      {showExpense && <TreasuryExpenseForm act={act} onClose={() => setShowExpense(false)} />}
      {snap.treasury.expenses.length === 0 ? (
        <Empty emoji="🧾" text="Sin gastos registrados en la caja." />
      ) : (
        <Card style={{ padding: 0 }}>
          {snap.treasury.expenses.map(e => (
            <div key={e.id} className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{e.description}</p>
                <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                  {dateLabel(e.expense_date)}{e.paid_to && ` · a ${e.paid_to}`}{e.created_by_name && ` · por ${e.created_by_name}`}
                </p>
              </div>
              <span className="text-sm font-black tabular-nums" style={{ color: 'var(--red)' }}>-{fmtCLP(e.amount)}</span>
              {canEdit && (
                <button onClick={() => { if (window.confirm(`¿Eliminar "${e.description}"?`)) act('treasury.expense.delete', { id: e.id }) }}
                  className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--red)' }}>
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          ))}
        </Card>
      )}

      {canEdit && (
        <>
          <SectionTitle right={<Btn small variant="ghost" onClick={() => setShowSettings(!showSettings)}><Settings2 size={12} /> {showSettings ? 'Cerrar' : 'Configurar'}</Btn>}>
            Configuración
          </SectionTitle>
          {showSettings && <SettingsForm snap={snap} act={act} onClose={() => setShowSettings(false)} />}
        </>
      )}
    </div>
  )
}

const MES_CORTO = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const STATE_STYLE: Record<MonthState, { bg: string; border: string; color: string; label: string }> = {
  paid:    { bg: 'rgba(16,185,129,0.18)', border: 'rgba(16,185,129,0.45)', color: 'var(--green)', label: 'Pagado' },
  partial: { bg: 'rgba(245,158,11,0.18)', border: 'rgba(245,158,11,0.45)', color: 'var(--accent)', label: 'Parcial' },
  pending: { bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.4)', color: 'var(--red)', label: 'Debe' },
  future:  { bg: 'var(--bg-elevated)', border: 'var(--border)', color: 'var(--text-muted)', label: 'Próximo' },
  off:     { bg: 'transparent', border: 'var(--border)', color: 'var(--text-muted)', label: 'Sin cuota' },
}

function FeeSheet({ snap, memberId, monthKeyStr, canEdit, act, onClose }: {
  snap: FinanceSnapshot; memberId: string; monthKeyStr: string; canEdit: boolean; act: Act; onClose: () => void
}) {
  const member = snap.members.find(m => m.id === memberId)!
  const st = monthStatus(snap, memberId, monthKeyStr)
  const [custom, setCustom] = useState('')
  const [busy, setBusy] = useState(false)
  const customAmount = Math.round(Number(custom.replace(/\D/g, '')) || 0)
  const run = async (action: string, payload: Record<string, unknown>) => {
    setBusy(true)
    const ok = await act(action, { member_id: memberId, month: monthKeyStr + '-01', ...payload })
    setBusy(false)
    if (ok) onClose()
  }
  const style = STATE_STYLE[st.state]

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 fade-in" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-bright)', paddingBottom: 'calc(20px + env(safe-area-inset-bottom))' }}>
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <Avatar name={member.name} size={32} />
            <div>
              <p className="text-base font-black" style={{ color: 'var(--text-primary)' }}>{member.name}</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{monthLabel(monthKeyStr)}</p>
            </div>
          </div>
          <button onClick={onClose} style={{ color: 'var(--text-muted)' }}><X size={18} /></button>
        </div>

        <div className="rounded-2xl px-4 py-3 mb-3" style={{ background: style.bg, border: `1px solid ${style.border}` }}>
          <p className="text-sm font-bold" style={{ color: style.color }}>
            {st.state === 'paid' ? '✓ Pagado' : st.state === 'partial' ? 'Pago parcial' : st.state === 'pending' ? 'Pendiente' : 'Aún no vence'}
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            Pagado {fmtCLP(st.paid)} de {fmtCLP(st.due)}{st.remaining > 0 && ` · falta ${fmtCLP(st.remaining)}`}
          </p>
        </div>

        {st.payments.length > 0 && (
          <div className="mb-3">
            {st.payments.map(p => (
              <p key={p.id} className="text-xs py-1" style={{ color: 'var(--text-muted)' }}>
                +{fmtCLP(p.amount)} · {p.historical ? 'registrado en el Excel' : `marcado por ${p.checked_by_name || 'alguien'} el ${dateLabel(p.checked_at.slice(0, 10))}`}
              </p>
            ))}
          </div>
        )}

        {canEdit ? (
          <div className="space-y-2">
            {st.remaining > 0 && (
              <>
                <Btn onClick={() => run('fee.pay', {})} disabled={busy} className="w-full">
                  <Check size={14} /> {st.paid > 0 ? `Completar pago (+${fmtCLP(st.remaining)})` : `Marcar pagado (${fmtCLP(st.remaining)})`}
                </Btn>
                <div className="flex gap-2">
                  <Input inputMode="numeric" placeholder="Otro monto (pago parcial)" value={customAmount ? customAmount.toLocaleString('es-CL') : ''} onChange={e => setCustom(e.target.value)} />
                  <Btn variant="ghost" disabled={busy || customAmount <= 0 || customAmount > st.remaining} onClick={() => run('fee.pay', { amount: customAmount })}>Registrar</Btn>
                </div>
              </>
            )}
            {st.paid > 0 && (
              <Btn variant="danger" disabled={busy} className="w-full"
                onClick={() => { if (window.confirm(`¿Quitar el pago de ${member.name} de ${monthLabel(monthKeyStr)}? Quedará en el historial.`)) run('fee.clear', {}) }}>
                <Trash2 size={13} /> Quitar pago de este mes
              </Btn>
            )}
          </div>
        ) : (
          <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>Inicia sesión en Compás para marcar pagos.</p>
        )}
      </div>
    </div>
  )
}

function TreasuryExpenseForm({ act, onClose }: { act: Act; onClose: () => void }) {
  const [date, setDate] = useState(todayStr())
  const [description, setDescription] = useState('')
  const [amountText, setAmountText] = useState('')
  const [paidTo, setPaidTo] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const amount = Math.round(Number(amountText.replace(/\D/g, '')) || 0)
  async function submit() {
    setError('')
    if (!description.trim()) return setError('Escribe de qué es el gasto')
    if (amount <= 0) return setError('Ingresa el monto')
    setSaving(true)
    const ok = await act('treasury.expense.add', { expense_date: date, description: description.trim(), amount, paid_to: paidTo.trim() || null })
    setSaving(false)
    if (ok) onClose()
  }
  return (
    <Card className="mb-3 fade-in" style={{ borderColor: 'var(--border-bright)' }}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Nuevo gasto de caja</p>
        <button onClick={onClose} style={{ color: 'var(--text-muted)' }}><X size={16} /></button>
      </div>
      <div className="space-y-3">
        <Input label="¿De qué es?" placeholder="Ej: Ensayo Sound Pro" value={description} onChange={e => setDescription(e.target.value)} autoFocus />
        <div className="grid grid-cols-2 gap-2">
          <Input label="Monto (CLP)" inputMode="numeric" placeholder="16000" value={amount ? amount.toLocaleString('es-CL') : ''} onChange={e => setAmountText(e.target.value)} />
          <Input label="Fecha" type="date" value={date} onChange={e => setDate(e.target.value)} />
        </div>
        <Input label="¿A quién se pagó? (opcional)" placeholder="Ej: Alvaro, Sound Pro" value={paidTo} onChange={e => setPaidTo(e.target.value)} />
        {error && <p className="text-xs" style={{ color: 'var(--red)' }}>{error}</p>}
        <div className="flex gap-2">
          <Btn onClick={submit} disabled={saving} className="flex-1">{saving ? 'Guardando…' : 'Guardar'}</Btn>
          <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
        </div>
      </div>
    </Card>
  )
}

function SettingsForm({ snap, act, onClose }: { snap: FinanceSnapshot; act: Act; onClose: () => void }) {
  const s = snap.treasury.settings
  const [fee, setFee] = useState(String(s.monthly_fee))
  const [start, setStart] = useState(s.start_month.slice(0, 7))
  const [opening, setOpening] = useState(String(s.opening_balance))
  const [note, setNote] = useState(s.opening_note || '')
  const [saving, setSaving] = useState(false)
  async function submit() {
    setSaving(true)
    const ok = await act('treasury.settings', {
      monthly_fee: Number(fee.replace(/\D/g, '')) || 0, start_month: start + '-01',
      opening_balance: Number(opening.replace(/[^\d-]/g, '')) || 0, opening_note: note.trim() || null,
    })
    setSaving(false)
    if (ok) onClose()
  }
  return (
    <Card className="fade-in" style={{ borderColor: 'var(--border-bright)' }}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <Input label="Cuota mensual (CLP)" inputMode="numeric" value={fee} onChange={e => setFee(e.target.value)} />
          <Input label="Cuotas se cobran desde" type="month" value={start} onChange={e => setStart(e.target.value)} />
        </div>
        <Input label="Saldo inicial (CLP)" inputMode="numeric" value={opening} onChange={e => setOpening(e.target.value)} />
        <Input label="Nota del saldo inicial" placeholder="Ej: saldo del Excel al 15 oct 2026" value={note} onChange={e => setNote(e.target.value)} />
        <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
          Saldo en caja = saldo inicial + cuotas nuevas − gastos de caja. Los pagos importados del Excel no se suman porque ya están en el saldo inicial. Cada cambio queda en el historial.
        </p>
        <div className="flex gap-2">
          <Btn onClick={submit} disabled={saving} className="flex-1">{saving ? 'Guardando…' : 'Guardar configuración'}</Btn>
          <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
        </div>
      </div>
    </Card>
  )
}
