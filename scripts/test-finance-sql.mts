// Prueba las sentencias SQL más complejas del API de Finanzas contra Neon (crea y borra datos de prueba).
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { neon } from '@neondatabase/serverless'
import { splitExpense } from '../src/lib/finance'

const url = readFileSync(new URL('../.env.local', import.meta.url), 'utf8').match(/^DATABASE_URL=(.*)$/m)![1]
const s = neon(url)
const PROJECT = '39ace012-63f2-4e84-ae5c-5fde5ed5b966'
const members = await s.query('select id, name from finance_members where project_id = $1 order by sort_order', [PROJECT]) as { id: string; name: string }[]
assert.equal(members.length, 4)
const [alv, ...rest] = members
const expenseId = crypto.randomUUID()
const dueDates = ['2026-10-24', '2026-11-24', '2026-12-24']
const shares = splitExpense(70000, rest.map(m => m.id), dueDates)
await s.transaction([
  s.query('insert into shared_expenses (id, project_id, paid_by, description, amount, expense_date, installments, notes, created_by, created_by_name) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
    [expenseId, PROJECT, alv.id, '__prueba radio__', 70000, '2026-10-15', 3, null, 'test', 'Test']),
  ...shares.map(sh => s.query('insert into shared_expense_shares (expense_id, member_id, installment_no, due_date, amount) values ($1,$2,$3,$4,$5)', [expenseId, sh.member_id, sh.installment_no, sh.due_date, sh.amount])),
])
const inserted = await s.query('select count(*)::int as n, sum(amount)::int as total from shared_expense_shares where expense_id = $1', [expenseId]) as { n: number; total: number }[]
assert.equal(inserted[0].n, 9); assert.equal(inserted[0].total, 52500)
const [share] = await s.query('select id from shared_expense_shares where expense_id = $1 and installment_no = 1 limit 1', [expenseId]) as { id: string }[]
const [row] = await s.query(
  `update shared_expense_shares s set paid_at = case when $1 then now() else null end, paid_marked_by = case when $1 then $2 else null end
   from shared_expenses e join finance_members d on true join finance_members p on p.id = e.paid_by
   where s.id = $3 and e.id = s.expense_id and e.project_id = $4 and d.id = s.member_id
   returning s.installment_no, s.amount, e.installments, e.description, d.name as debtor, p.name as payer`,
  [true, 'Test', share.id, PROJECT]) as Record<string, unknown>[]
assert.equal(row.payer, 'Alvaro'); assert.equal(row.installments, 3); assert.equal(row.amount, 5834)
console.log('share.toggle →', row)
const [chk] = await s.query('insert into treasury_fee_checks (project_id, member_id, month, amount, checked_by, checked_by_name) values ($1,$2,$3,$4,$5,$6) on conflict (member_id, month) do nothing returning id', [PROJECT, alv.id, '2026-10-01', 5000, 'test', 'Test']) as { id: string }[]
assert.ok(chk?.id)
await s.query('delete from treasury_fee_checks where id = $1', [chk.id])
await s.query('delete from shared_expenses where id = $1', [expenseId])
const left = await s.query('select count(*)::int as n from shared_expense_shares where expense_id = $1', [expenseId]) as { n: number }[]
assert.equal(left[0].n, 0, 'cascade borró las cuotas')
console.log('SQL de Finanzas OK (datos de prueba eliminados)')
