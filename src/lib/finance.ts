// Tipos y cálculos puros del módulo Finanzas. Se usan en la app y en la página pública.
// Todas las fechas son strings 'YYYY-MM-DD' y los montos enteros en CLP.

export interface FinMember { id: string; project_id: string; name: string; user_id: string | null; active: boolean; sort_order: number }
export interface SharedExpense {
  id: string; project_id: string; paid_by: string; description: string; amount: number; expense_date: string
  installments: number; notes: string | null; created_by_name: string | null; created_at: string
  /** true: quien pagó pone su parte. false: le devuelven el total. */
  payer_shares: boolean
}
export interface ExpenseShare {
  id: string; expense_id: string; member_id: string; installment_no: number; due_date: string; amount: number
  paid_at: string | null; paid_marked_by: string | null
}
export interface TreasurySettings { project_id: string; monthly_fee: number; start_month: string; opening_balance: number; opening_note: string | null }
export interface FeeCheck { id: string; member_id: string; month: string; amount: number; historical: boolean; checked_by_name: string | null; checked_at: string }
export interface TreasuryExpense { id: string; expense_date: string; description: string; amount: number; paid_to: string | null; created_by_name: string | null; created_at: string }
export interface LogEntry { id: string; module: 'gastos' | 'caja'; action: string; detail: string; user_name: string | null; created_at: string }
export interface Candidate { user_id: string; name: string }

export interface FinanceSnapshot {
  project: { id: string; name: string; access_code: string | null }
  members: FinMember[]
  candidates: Candidate[]
  expenses: SharedExpense[]
  shares: ExpenseShare[]
  treasury: { settings: TreasurySettings; checks: FeeCheck[]; expenses: TreasuryExpense[] }
  log: LogEntry[]
  me?: { user_id: string; member_id: string | null }
}

// ---------- formato ----------
export const fmtCLP = (n: number) => (n < 0 ? '-' : '') + '$' + Math.abs(Math.round(n)).toLocaleString('es-CL')

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const MESES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/** 'YYYY-MM' de una fecha */
export const monthKey = (dateStr: string) => dateStr.slice(0, 7)
export function monthLabel(key: string, short = false) {
  const [y, m] = key.split('-').map(Number)
  const name = (short ? MESES_CORTO : MESES)[m - 1]
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${y}`
}
export function dateLabel(dateStr: string) {
  const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number)
  return `${d} ${MESES_CORTO[m - 1]} ${y}`
}
export function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
/** Suma meses manteniendo el día (si el mes es más corto, usa el último día). */
export function addMonths(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number)
  const total = y * 12 + (m - 1) + n
  const ny = Math.floor(total / 12), nm = (total % 12) + 1
  const last = new Date(ny, nm, 0).getDate()
  return `${ny}-${String(nm).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`
}
/** Claves 'YYYY-MM' entre dos meses, inclusive. */
export function monthsBetween(start: string, end: string): string[] {
  const out: string[] = []
  let cur = start.slice(0, 7) + '-01'
  const endKey = end.slice(0, 7)
  while (monthKey(cur) <= endKey && out.length < 600) { out.push(monthKey(cur)); cur = addMonths(cur, 1) }
  return out
}
export function relativeTime(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return 'hace un momento'
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`
  if (diff < 86400 * 7) return `hace ${Math.floor(diff / 86400)} d`
  return dateLabel(iso.slice(0, 10))
}

// ---------- gastos compartidos ----------
/** Parte de cada deudor. Si el pagador comparte, absorbe el redondeo; si no, los pesos sobrantes van a los primeros deudores. */
export function debtorParts(total: number, debtorCount: number, payerShares = true): number[] {
  if (debtorCount <= 0) return []
  if (payerShares) {
    const per = Math.floor(total / (debtorCount + 1))
    return Array(debtorCount).fill(per)
  }
  const base = Math.floor(total / debtorCount), rem = total - base * debtorCount
  return Array.from({ length: debtorCount }, (_, i) => base + (i < rem ? 1 : 0))
}

/**
 * Reparte un gasto en partes iguales. Cada deudor divide su parte en cuotas (los pesos sobrantes van a las primeras).
 * Si el pagador no comparte el gasto, los deudores le devuelven el total exacto.
 */
export function splitExpense(total: number, debtorIds: string[], dueDates: string[], payerShares = true) {
  const parts = debtorParts(total, debtorIds.length, payerShares)
  const k = Math.max(1, dueDates.length)
  const rows: { member_id: string; installment_no: number; due_date: string; amount: number }[] = []
  debtorIds.forEach((member_id, d) => {
    const cuotas = installmentAmounts(parts[d], k)
    for (let i = 0; i < k; i++) rows.push({ member_id, installment_no: i + 1, due_date: dueDates[i], amount: cuotas[i] })
  })
  return rows
}
/** Montos de las cuotas de una persona (para previsualizar). */
export function installmentAmounts(perPerson: number, k: number) {
  const base = Math.floor(perPerson / k), rest = perPerson - base * k
  return Array.from({ length: k }, (_, i) => base + (i < rest ? 1 : 0))
}

export interface ShareItem { share: ExpenseShare; expense: SharedExpense; payer: FinMember; debtor: FinMember }
export interface PersonBalance { member: FinMember; iOwe: number; owesMe: number; net: number }
export interface MemberSummary {
  iOwe: number; owedToMe: number
  byPerson: PersonBalance[]
  pending: ShareItem[]
  byMonth: { key: string; items: ShareItem[]; total: number }[]
  incoming: ShareItem[]
}

export function allShareItems(snap: FinanceSnapshot): ShareItem[] {
  const members = new Map(snap.members.map(m => [m.id, m]))
  const expenses = new Map(snap.expenses.map(e => [e.id, e]))
  const items: ShareItem[] = []
  for (const share of snap.shares) {
    const expense = expenses.get(share.expense_id)
    if (!expense) continue
    const payer = members.get(expense.paid_by), debtor = members.get(share.member_id)
    if (!payer || !debtor) continue
    items.push({ share, expense, payer, debtor })
  }
  return items.sort((a, b) => a.share.due_date.localeCompare(b.share.due_date) || a.share.installment_no - b.share.installment_no)
}

export function memberSummary(snap: FinanceSnapshot, memberId: string): MemberSummary {
  const items = allShareItems(snap)
  const pending = items.filter(i => i.share.member_id === memberId && !i.share.paid_at)
  const incoming = items.filter(i => i.expense.paid_by === memberId && !i.share.paid_at)
  const sum = (xs: ShareItem[]) => xs.reduce((a, i) => a + i.share.amount, 0)
  const byPersonMap = new Map<string, PersonBalance>()
  const get = (m: FinMember) => {
    let p = byPersonMap.get(m.id)
    if (!p) { p = { member: m, iOwe: 0, owesMe: 0, net: 0 }; byPersonMap.set(m.id, p) }
    return p
  }
  for (const i of pending) get(i.payer).iOwe += i.share.amount
  for (const i of incoming) get(i.debtor).owesMe += i.share.amount
  const byPerson = [...byPersonMap.values()].map(p => ({ ...p, net: p.owesMe - p.iOwe })).sort((a, b) => a.net - b.net)
  const byMonthMap = new Map<string, ShareItem[]>()
  for (const i of pending) { const k = monthKey(i.share.due_date); byMonthMap.set(k, [...(byMonthMap.get(k) || []), i]) }
  const byMonth = [...byMonthMap.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, xs]) => ({ key, items: xs, total: sum(xs) }))
  return { iOwe: sum(pending), owedToMe: sum(incoming), byPerson, pending, byMonth, incoming }
}

export function expenseProgress(expense: SharedExpense, shares: ExpenseShare[]) {
  const mine = shares.filter(s => s.expense_id === expense.id)
  const total = mine.reduce((a, s) => a + s.amount, 0)
  const paid = mine.filter(s => s.paid_at).reduce((a, s) => a + s.amount, 0)
  const debtors = new Set(mine.map(s => s.member_id)).size
  const payerShares = expense.payer_shares !== false
  const people = debtors + (payerShares ? 1 : 0)
  const perPerson = Math.floor(expense.amount / Math.max(1, people))
  return { total, paid, pending: total - paid, debtors, people, payerShares, perPerson, done: total > 0 && paid >= total }
}

// ---------- caja ----------
export type MonthState = 'paid' | 'partial' | 'pending' | 'future' | 'off'
export interface MonthStatus { key: string; due: number; paid: number; remaining: number; state: MonthState; payments: FeeCheck[] }

export interface TreasurySummary {
  months: string[]            // meses exigibles: desde el inicio hasta el mes actual
  feesCollected: number       // cuotas que entraron a la caja desde el saldo inicial
  historicalFees: number      // cuotas ya incluidas en el saldo inicial (Excel)
  expensesTotal: number
  balance: number
  receivable: number          // total adeudado en cuotas
  perMember: { member: FinMember; paidAmount: number; pending: string[]; pendingAmount: number; level: DebtLevel }[]
}

/** Semáforo de deuda: al día, poco (hasta 2 cuotas) o mucho (más de 2 cuotas). */
export type DebtLevel = 'ok' | 'low' | 'high'
export const DEBT_HIGH_MONTHS = 2
export function debtLevel(pendingAmount: number, fee: number): DebtLevel {
  if (pendingAmount <= 0) return 'ok'
  return pendingAmount > DEBT_HIGH_MONTHS * Math.max(1, fee) ? 'high' : 'low'
}

/** Resumen de un año: lo esperado a la fecha, lo pagado y el total por mes. */
export function yearSummary(snap: FinanceSnapshot, year: number, today = todayStr()) {
  const s = snap.treasury.settings
  const active = snap.members.filter(m => m.active)
  const months = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`)
  const perMonth = months.map(key => {
    const statuses = active.map(m => monthStatus(snap, m.id, key, today))
    return {
      key,
      paid: statuses.reduce((a, st) => a + st.paid, 0),
      paidCount: statuses.filter(st => st.state === 'paid').length,
      due: statuses.some(st => st.state !== 'off' && st.state !== 'future') ? active.length * s.monthly_fee : 0,
    }
  })
  const collected = perMonth.reduce((a, m) => a + m.paid, 0)
  const expected = perMonth.reduce((a, m) => a + m.due, 0)
  return { months: perMonth, collected, expected, owed: Math.max(0, expected - collected), yearTotal: active.length * s.monthly_fee * 12 }
}

/** Estado de un mes para un integrante. Un mes se paga con uno o más pagos (parciales) hasta llegar a la cuota. */
export function monthStatus(snap: FinanceSnapshot, memberId: string, key: string, today = todayStr()): MonthStatus {
  const s = snap.treasury.settings
  const payments = snap.treasury.checks.filter(c => c.member_id === memberId && monthKey(c.month) === key)
  const paid = payments.reduce((a, c) => a + c.amount, 0)
  const due = s.monthly_fee
  const remaining = Math.max(0, due - paid)
  let state: MonthState
  if (paid >= due && due > 0) state = 'paid'
  else if (paid > 0) state = 'partial'
  else if (key < monthKey(s.start_month)) state = 'off'
  else if (key > monthKey(today)) state = 'future'
  else state = 'pending'
  return { key, due, paid, remaining, state, payments }
}

export function treasurySummary(snap: FinanceSnapshot, today = todayStr()): TreasurySummary {
  const s = snap.treasury.settings
  const months = monthsBetween(s.start_month, today)
  const checks = snap.treasury.checks
  const feesCollected = checks.filter(c => !c.historical).reduce((a, c) => a + c.amount, 0)
  const historicalFees = checks.filter(c => c.historical).reduce((a, c) => a + c.amount, 0)
  const expensesTotal = snap.treasury.expenses.reduce((a, e) => a + e.amount, 0)
  const balance = s.opening_balance + feesCollected - expensesTotal
  const perMember = snap.members.filter(m => m.active).map(member => {
    const statuses = months.map(k => monthStatus(snap, member.id, k, today))
    const pendingStatuses = statuses.filter(st => st.remaining > 0)
    return {
      member,
      paidAmount: checks.filter(c => c.member_id === member.id).reduce((a, c) => a + c.amount, 0),
      pending: pendingStatuses.map(st => st.key),
      pendingAmount: pendingStatuses.reduce((a, st) => a + st.remaining, 0),
      level: debtLevel(pendingStatuses.reduce((a, st) => a + st.remaining, 0), s.monthly_fee),
    }
  })
  const receivable = perMember.reduce((a, p) => a + p.pendingAmount, 0)
  return { months, feesCollected, historicalFees, expensesTotal, balance, receivable, perMember }
}
