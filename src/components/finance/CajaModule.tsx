'use client'

import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Check, Plus, Trash2, Settings2, X } from 'lucide-react'
import { Card, Btn, Input, Stat, SectionTitle, Empty, Avatar } from './ui'
import { type FinanceSnapshot, type MonthState, type DebtLevel, fmtCLP, dateLabel, monthLabel, monthKey, todayStr, treasurySummary, monthStatus, yearSummary, DEBT_HIGH_MONTHS } from '@/lib/finance'
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
            Estado anual · cuota {fmtCLP(s.monthly_fee)}
          </SectionTitle>

          <AnnualGrid snap={snap} year={year} today={today} summary={summary} onPick={(memberId, key) => setSelected({ memberId, key })} />
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

const LEVEL_STYLE: Record<DebtLevel, { bg: string; color: string; border: string; label: (amt: number) => string }> = {
  ok:   { bg: 'rgba(16,185,129,0.15)', color: 'var(--green)',  border: 'rgba(16,185,129,0.4)', label: () => 'Al día' },
  low:  { bg: 'rgba(245,158,11,0.15)', color: 'var(--accent)', border: 'rgba(245,158,11,0.45)', label: amt => `Debe ${fmtCLP(amt)}` },
  high: { bg: 'rgba(239,68,68,0.15)',  color: 'var(--red)',    border: 'rgba(239,68,68,0.45)', label: amt => `Debe ${fmtCLP(amt)}` },
}
const MES_LETRA = ['E', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']

function AnnualGrid({ snap, year, today, summary, onPick }: {
  snap: FinanceSnapshot; year: number; today: string; summary: ReturnType<typeof treasurySummary>; onPick: (memberId: string, key: string) => void
}) {
  const active = snap.members.filter(m => m.active)
  const ys = yearSummary(snap, year, today)
  const fee = snap.treasury.settings.monthly_fee
  const currentKey = monthKey(today)
  const pct = ys.expected ? Math.min(100, Math.round((ys.collected / ys.expected) * 100)) : 0

  return (
    <Card style={{ padding: 12 }}>
      {/* Avance del año */}
      <div className="mb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Pagado {year}</p>
            <p className="text-lg font-black tabular-nums leading-tight" style={{ color: 'var(--text-primary)' }}>{fmtCLP(ys.collected)}</p>
            <p className="text-[10px] tabular-nums" style={{ color: 'var(--text-muted)' }}>de {fmtCLP(ys.expected)} esperado a la fecha</p>
          </div>
          {ys.owed > 0 && (
            <div className="text-right">
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Atraso</p>
              <p className="text-lg font-black tabular-nums leading-tight" style={{ color: 'var(--red)' }}>{fmtCLP(ys.owed)}</p>
            </div>
          )}
        </div>
        <div className="mt-1.5 h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-elevated)' }}>
          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: pct >= 100 ? 'var(--green)' : 'linear-gradient(90deg, var(--green), var(--accent))' }} />
        </div>
      </div>

      {/* Grilla tipo Excel: integrantes × meses */}
      <div className="grid gap-[3px] items-center grid-cols-[76px_repeat(12,minmax(0,1fr))] sm:grid-cols-[130px_repeat(12,minmax(0,1fr))]">
        <div />
        {MES_LETRA.map((l, i) => {
          const key = `${year}-${String(i + 1).padStart(2, '0')}`
          return (
            <div key={key} className="text-center text-[10px] font-bold pb-0.5" style={{ color: key === currentKey ? 'var(--accent)' : 'var(--text-muted)' }}>
              <span className="sm:hidden">{l}</span><span className="hidden sm:inline">{MESES_CORTOS[i]}</span>
            </div>
          )
        })}

        {active.map(m => {
          const pm = summary.perMember.find(p => p.member.id === m.id)!
          const lv = LEVEL_STYLE[pm.level]
          return (
            <Row key={m.id}>
              <div className="rounded-lg px-1.5 sm:px-2 py-1 mr-0.5 sm:mr-1 min-w-0" style={{ background: lv.bg, border: `1px solid ${lv.border}` }}>
                <p className="text-xs font-bold truncate" style={{ color: 'var(--text-primary)' }}>{m.name}</p>
                <p className="text-[9px] sm:text-[10px] font-bold truncate tabular-nums" style={{ color: lv.color }}>
                  <span className="sm:hidden">{pm.pendingAmount ? `−${fmtCLP(pm.pendingAmount)}` : 'Al día'}</span>
                  <span className="hidden sm:inline">{lv.label(pm.pendingAmount)}</span>
                </p>
              </div>
              {Array.from({ length: 12 }, (_, i) => {
                const key = `${year}-${String(i + 1).padStart(2, '0')}`
                const st = monthStatus(snap, m.id, key, today)
                const c = STATE_STYLE[st.state]
                const partialPct = st.state === 'partial' ? Math.round((st.paid / Math.max(1, st.due)) * 100) : 0
                return (
                  <button key={key} disabled={st.state === 'off'} onClick={() => onPick(m.id, key)} title={`${m.name} · ${monthLabel(key)}`}
                    className="relative h-9 sm:h-10 rounded-md overflow-hidden flex items-center justify-center transition-transform active:scale-90"
                    style={{ background: c.bg, border: `1px ${st.state === 'off' ? 'dashed' : 'solid'} ${c.border}`, outline: key === currentKey ? '1px solid var(--accent)' : 'none', outlineOffset: 1 }}>
                    {st.state === 'partial' && <span className="absolute bottom-0 left-0 right-0" style={{ height: `${partialPct}%`, background: 'rgba(245,158,11,0.45)' }} />}
                    <span className="relative text-[11px] font-black leading-none" style={{ color: c.color }}>
                      {st.state === 'paid' ? '✓' : st.state === 'partial' ? '½' : ''}
                    </span>
                  </button>
                )
              })}
            </Row>
          )
        })}

        {/* Totales por mes, como la fila de suma del Excel */}
        <div className="text-[9px] sm:text-[10px] font-bold pt-1.5 pr-1 leading-tight" style={{ color: 'var(--text-muted)' }}>Total mes<br className="sm:hidden" /><span className="sm:hidden"> (miles)</span></div>
        {ys.months.map(mo => (
          <div key={mo.key} className="text-center pt-1.5 text-[9px] sm:text-[10px] font-bold tabular-nums leading-tight"
            style={{ color: mo.due === 0 ? 'var(--text-muted)' : mo.paid >= mo.due ? 'var(--green)' : 'var(--text-secondary)' }}>
            {mo.paid ? <>{Math.round(mo.paid / 1000)}<span className="hidden sm:inline">k</span></> : '–'}
          </div>
        ))}
      </div>

      {/* Leyenda */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-3">
        {(['paid', 'partial', 'pending', 'future'] as const).map(st => (
          <span key={st} className="inline-flex items-center gap-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>
            <span className="w-3 h-3 rounded-sm" style={{ background: STATE_STYLE[st].bg, border: `1px solid ${STATE_STYLE[st].border}` }} />
            {STATE_STYLE[st].label}
          </span>
        ))}
      </div>
      <p className="text-[10px] mt-1.5" style={{ color: 'var(--text-muted)' }}>
        <span style={{ color: 'var(--accent)' }}>■</span> Amarillo: debe hasta {DEBT_HIGH_MONTHS} cuotas ({fmtCLP(DEBT_HIGH_MONTHS * fee)}).{' '}
        <span style={{ color: 'var(--red)' }}>■</span> Rojo: debe más.
      </p>
    </Card>
  )
}

function Row({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

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
