// Pruebas de los cálculos puros de Finanzas. Uso: npx tsx scripts/test-finance.mts
import assert from 'node:assert/strict'
import { splitExpense, installmentAmounts, memberSummary, treasurySummary, monthStatus, yearSummary, addMonths, monthsBetween, type FinanceSnapshot, type FeeCheck } from '../src/lib/finance'

// Reparto: 70.000 entre 4 (Alvaro paga) en 3 cuotas
const rows = splitExpense(70000, ['seb', 'nacho', 'tutu'], ['2026-10-24', '2026-11-24', '2026-12-24'])
assert.equal(rows.length, 9)
const perPerson = rows.filter(r => r.member_id === 'seb').reduce((a, r) => a + r.amount, 0)
assert.equal(perPerson, 17500, 'cada uno aporta 17.500')
assert.deepEqual(rows.filter(r => r.member_id === 'seb').map(r => r.amount), [5834, 5833, 5833])
assert.equal(rows.reduce((a, r) => a + r.amount, 0), 52500, 'Alvaro recibe 52.500')
// Redondeo: 10.000 entre 3 → 3.333 c/u, el pagador absorbe 1 peso
const r2 = splitExpense(10000, ['a', 'b'], ['2026-10-01'])
assert.deepEqual(r2.map(r => r.amount), [3333, 3333])
assert.deepEqual(installmentAmounts(10000, 3), [3334, 3333, 3333])
assert.equal(installmentAmounts(10000, 3).reduce((a, b) => a + b, 0), 10000)
// Fechas
assert.equal(addMonths('2026-01-31', 1), '2026-02-28')
assert.equal(addMonths('2026-12-24', 1), '2027-01-24')
assert.deepEqual(monthsBetween('2026-10-01', '2027-01-15'), ['2026-10', '2026-11', '2026-12', '2027-01'])

// Resumen por persona
const m = (id: string, name: string) => ({ id, project_id: 'p', name, user_id: null, active: true, sort_order: 0 })
const snap: FinanceSnapshot = {
  project: { id: 'p', name: 'Banda', access_code: 'ABC' },
  members: [m('alv', 'Alvaro'), m('seb', 'Sebastian'), m('nacho', 'Nacho'), m('tutu', 'Tutu')],
  candidates: [],
  expenses: [
    { id: 'e1', project_id: 'p', paid_by: 'alv', description: 'Radio', amount: 70000, expense_date: '2026-10-15', installments: 3, notes: null, created_by_name: null, created_at: '' },
    { id: 'e2', project_id: 'p', paid_by: 'seb', description: 'Pasajes', amount: 20000, expense_date: '2026-10-10', installments: 1, notes: null, created_by_name: null, created_at: '' },
  ],
  shares: [
    ...rows.map((r, i) => ({ id: 's' + i, expense_id: 'e1', ...r, paid_at: r.member_id === 'seb' && r.installment_no === 1 ? '2026-10-20T00:00:00Z' : null, paid_marked_by: null })),
    ...splitExpense(20000, ['alv', 'nacho', 'tutu'], ['2026-10-30']).map((r, i) => ({ id: 't' + i, expense_id: 'e2', ...r, paid_at: null, paid_marked_by: null })),
  ],
  treasury: { settings: { project_id: 'p', monthly_fee: 5000, start_month: '2026-10-01', opening_balance: 30158, opening_note: null }, checks: [
    { id: 'c1', member_id: 'alv', month: '2026-10-01', amount: 5000, historical: false, checked_by_name: 'Alvaro', checked_at: '' },
    { id: 'c2', member_id: 'seb', month: '2026-10-01', amount: 5000, historical: false, checked_by_name: 'Alvaro', checked_at: '' },
  ], expenses: [{ id: 'x1', expense_date: '2026-10-16', description: 'Ensayo', amount: 16000, paid_to: 'Sound Pro', created_by_name: null, created_at: '' }] },
  log: [],
}
const seb = memberSummary(snap, 'seb')
assert.equal(seb.iOwe, 17500 - 5834, 'Seb debe 2 cuotas de Radio')
assert.equal(seb.owedToMe, 15000, 'a Seb le deben 3 × 5.000 por Pasajes')
const conAlvaro = seb.byPerson.find(p => p.member.id === 'alv')!
assert.equal(conAlvaro.iOwe, 11666); assert.equal(conAlvaro.owesMe, 5000); assert.equal(conAlvaro.net, -6666)
assert.deepEqual(seb.byMonth.map(g => [g.key, g.total]), [['2026-11', 5833], ['2026-12', 5833]])
const alv = memberSummary(snap, 'alv')
assert.equal(alv.iOwe, 5000); assert.equal(alv.owedToMe, 52500 - 5834)

const t = treasurySummary(snap, '2026-11-15')
assert.deepEqual(t.months, ['2026-10', '2026-11'])
assert.equal(t.balance, 30158 + 10000 - 16000)
assert.deepEqual(t.perMember.map(p => [p.member.name, p.pending.length, p.pendingAmount]), [['Alvaro', 1, 5000], ['Sebastian', 1, 5000], ['Nacho', 2, 10000], ['Tutu', 2, 10000]])

// ---------- Caja real de Los Killtros Blues: Excel 2026 importado como histórico ----------
const excel: Record<string, number[]> = { alv: Array(9).fill(5000), seb: Array(8).fill(5000), nacho: [5000, 1000], tutu: Array(9).fill(5000) }
const hist: FeeCheck[] = Object.entries(excel).flatMap(([mid, xs]) => xs.map((amount, i) => ({
  id: `${mid}-${i}`, member_id: mid, month: `2026-${String(i + 1).padStart(2, '0')}-01`, amount, historical: true, checked_by_name: 'Excel', checked_at: '',
})))
const kb: FinanceSnapshot = { ...snap, treasury: { settings: { ...snap.treasury.settings, start_month: '2026-01-01' }, checks: hist, expenses: [] } }
let k = treasurySummary(kb, '2026-10-15')
assert.equal(k.historicalFees, 136000, 'cuadra con Total Cuotas 2026 del Excel')
assert.equal(k.balance, 30158, 'el Excel no se suma dos veces')
assert.deepEqual(k.perMember.map(p => [p.member.name, p.pendingAmount]),
  [['Alvaro', 5000], ['Sebastian', 10000], ['Nacho', 4000 + 8 * 5000], ['Tutu', 5000]], 'deudas al 15 oct: nadie queda perdonado')
assert.deepEqual(k.perMember.map(p => [p.member.name, p.level]), [['Alvaro', 'low'], ['Sebastian', 'low'], ['Nacho', 'high'], ['Tutu', 'low']], 'semáforo')
const y = yearSummary(kb, 2026, '2026-10-15')
assert.equal(y.collected, 136000); assert.equal(y.expected, 10 * 4 * 5000); assert.equal(y.owed, 64000)
assert.deepEqual(y.months.slice(0, 3).map(m => m.paid), [20000, 16000, 15000])
assert.equal(monthStatus(kb, 'nacho', '2026-02', '2026-10-15').state, 'partial')
assert.equal(monthStatus(kb, 'nacho', '2026-02', '2026-10-15').remaining, 4000)
assert.equal(monthStatus(kb, 'nacho', '2026-11', '2026-10-15').state, 'future')
assert.equal(monthStatus(kb, 'nacho', '2025-12', '2026-10-15').state, 'off')

// Nacho paga mañana solo marzo y abril → +10.000 a la caja, sigue debiendo el resto
const pay = (id: string, mid: string, month: string, amount: number): FeeCheck => ({ id, member_id: mid, month, amount, historical: false, checked_by_name: 'Alvaro', checked_at: '' })
const kb2: FinanceSnapshot = { ...kb, treasury: { ...kb.treasury, checks: [...hist, pay('n3', 'nacho', '2026-03-01', 5000), pay('n4', 'nacho', '2026-04-01', 5000)] } }
k = treasurySummary(kb2, '2026-10-16')
assert.equal(k.balance, 30158 + 10000)
assert.equal(k.perMember.find(p => p.member.id === 'nacho')!.pendingAmount, 44000 - 10000)
assert.equal(monthStatus(kb2, 'nacho', '2026-03', '2026-10-16').state, 'paid')
// Completa febrero con 4.000 → suma 4.000, febrero queda pagado
const kb3: FinanceSnapshot = { ...kb2, treasury: { ...kb2.treasury, checks: [...kb2.treasury.checks, pay('n2b', 'nacho', '2026-02-01', 4000)] } }
assert.equal(treasurySummary(kb3, '2026-10-16').balance, 30158 + 14000)
assert.equal(monthStatus(kb3, 'nacho', '2026-02', '2026-10-16').state, 'paid')
console.log('finance.ts: todas las pruebas OK')
