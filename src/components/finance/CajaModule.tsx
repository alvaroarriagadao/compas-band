'use client'

import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Check, Plus, Trash2, Settings2, X } from 'lucide-react'
import { Card, Btn, Input, Stat, SectionTitle, Empty, Avatar } from './ui'
import { type FinanceSnapshot, fmtCLP, dateLabel, monthLabel, monthKey, todayStr, addMonths, relativeTime, treasurySummary } from '@/lib/finance'
import type { Act } from './GastosModule'

interface Props { snap: FinanceSnapshot; canEdit: boolean; act: Act }

export function CajaModule({ snap, canEdit, act }: Props) {
  const s = snap.treasury.settings
  const summary = useMemo(() => treasurySummary(snap), [snap])
  const today = todayStr()
  const currentKey = monthKey(today)
  const maxKey = monthKey(addMonths(today, 1))
  const [month, setMonth] = useState(currentKey)
  const [showExpense, setShowExpense] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const active = snap.members.filter(m => m.active)
  const checksThisMonth = snap.treasury.checks.filter(c => monthKey(c.month) === month)
  const minKey = monthKey(s.start_month)
  const paidCount = checksThisMonth.length

  return (
    <div>
      <div className="mt-2 grid grid-cols-1 gap-2">
        <Stat label="Saldo en caja" value={fmtCLP(summary.balance)} color={summary.balance >= 0 ? 'var(--green)' : 'var(--red)'} big />
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Inicial" value={fmtCLP(s.opening_balance)} />
          <Stat label="Cuotas" value={`+${fmtCLP(summary.feesCollected)}`} color="var(--green)" />
          <Stat label="Gastos" value={`-${fmtCLP(summary.expensesTotal)}`} color="var(--red)" />
        </div>
      </div>
      {s.opening_note && <p className="text-[10px] mt-1.5 px-1" style={{ color: 'var(--text-muted)' }}>{s.opening_note}</p>}

      {active.length === 0 ? (
        <Empty emoji="👥" text="Agrega integrantes para llevar las cuotas mensuales." />
      ) : (
        <>
          {/* Cuotas del mes */}
          <SectionTitle>Cuotas de {fmtCLP(s.monthly_fee)} por mes</SectionTitle>
          <Card style={{ padding: 0 }}>
            <div className="flex items-center justify-between px-3 py-2.5" style={{ borderBottom: '1px solid var(--border)' }}>
              <button onClick={() => setMonth(monthKey(addMonths(month + '-01', -1)))} disabled={month <= minKey}
                className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)', opacity: month <= minKey ? 0.3 : 1 }}>
                <ChevronLeft size={16} />
              </button>
              <div className="text-center">
                <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{monthLabel(month)}</p>
                <p className="text-[10px]" style={{ color: paidCount === active.length ? 'var(--green)' : 'var(--text-muted)' }}>
                  {paidCount}/{active.length} pagaron · {fmtCLP(checksThisMonth.reduce((a, c) => a + c.amount, 0))}
                </p>
              </div>
              <button onClick={() => setMonth(monthKey(addMonths(month + '-01', 1)))} disabled={month >= maxKey}
                className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)', opacity: month >= maxKey ? 0.3 : 1 }}>
                <ChevronRight size={16} />
              </button>
            </div>
            {active.map(m => {
              const check = checksThisMonth.find(c => c.member_id === m.id)
              return (
                <div key={m.id} className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
                  <Avatar name={m.name} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{m.name}</p>
                    <p className="text-[10px]" style={{ color: check ? 'var(--green)' : 'var(--text-muted)' }}>
                      {check ? `✓ ${fmtCLP(check.amount)} · ${check.checked_by_name || ''} ${relativeTime(check.checked_at)}` : 'Pendiente'}
                    </p>
                  </div>
                  <button disabled={!canEdit} onClick={() => act('fee.toggle', { member_id: m.id, month: month + '-01', checked: !check })}
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all"
                    style={{ background: check ? 'var(--green)' : 'var(--bg-elevated)', border: '1px solid var(--border)', color: check ? '#000' : 'var(--text-muted)', opacity: canEdit ? 1 : 0.7 }}>
                    <Check size={18} />
                  </button>
                </div>
              )
            })}
          </Card>

          {/* Estado por integrante */}
          <SectionTitle>Estado de cuotas</SectionTitle>
          <Card style={{ padding: 0 }}>
            {summary.perMember.map(pm => (
              <div key={pm.member.id} className="flex items-center gap-3 px-4 py-2.5" style={{ borderBottom: '1px solid var(--border)' }}>
                <p className="text-sm font-semibold flex-1" style={{ color: 'var(--text-primary)' }}>{pm.member.name}</p>
                <p className="text-[10px] tabular-nums" style={{ color: 'var(--text-muted)' }}>{pm.paidCount} pagadas · {fmtCLP(pm.paidAmount)}</p>
                <span className="text-xs font-bold px-2 py-1 rounded-lg" style={{
                  background: pm.pending.length ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.15)',
                  color: pm.pending.length ? 'var(--red)' : 'var(--green)',
                }}>
                  {pm.pending.length ? `Debe ${pm.pending.length} · ${fmtCLP(pm.pendingAmount)}` : 'Al día'}
                </span>
              </div>
            ))}
            <p className="text-[10px] px-4 py-2" style={{ color: 'var(--text-muted)' }}>
              Se cuentan los meses desde {monthLabel(minKey, true)} hasta hoy.
            </p>
          </Card>
        </>
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

      {/* Configuración */}
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
          <Input label="Mes de inicio" type="month" value={start} onChange={e => setStart(e.target.value)} />
        </div>
        <Input label="Saldo inicial (CLP)" inputMode="numeric" value={opening} onChange={e => setOpening(e.target.value)} />
        <Input label="Nota del saldo inicial" placeholder="Ej: saldo del Excel al 15 oct 2026" value={note} onChange={e => setNote(e.target.value)} />
        <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
          Saldo en caja = saldo inicial + cuotas marcadas − gastos de caja. Cada cambio queda en el historial.
        </p>
        <div className="flex gap-2">
          <Btn onClick={submit} disabled={saving} className="flex-1">{saving ? 'Guardando…' : 'Guardar configuración'}</Btn>
          <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
        </div>
      </div>
    </Card>
  )
}
