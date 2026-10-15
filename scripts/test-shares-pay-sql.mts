// Prueba el SQL de shares.pay contra Neon dentro de una transacción que se revierte.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { Pool } from '@neondatabase/serverless'
const url = readFileSync(new URL('../.env.local', import.meta.url), 'utf8').match(/^DATABASE_URL=(.*)$/m)![1]
const pool = new Pool({ connectionString: url })
const c = await pool.connect()
const PROJECT = '39ace012-63f2-4e84-ae5c-5fde5ed5b966'
try {
  await c.query('begin')
  const { rows: ids } = await c.query(`select s.id from shared_expense_shares s join shared_expenses e on e.id = s.expense_id
    join finance_members d on d.id = s.member_id where e.project_id = $1 and d.name = 'Nacho' and s.paid_at is null order by s.installment_no limit 2`, [PROJECT])
  assert.equal(ids.length, 2)
  const SQL = `update shared_expense_shares s set paid_at = now(), paid_marked_by = $1
     from shared_expenses e, finance_members d, finance_members p
     where s.id = any($2) and s.paid_at is null and e.id = s.expense_id and e.project_id = $3 and d.id = s.member_id and p.id = e.paid_by
     returning s.amount, d.name as debtor, p.name as payer, e.description`
  const r1 = await c.query(SQL, ['Test', ids.map(r => r.id), PROJECT])
  assert.equal(r1.rows.length, 2); assert.equal(r1.rows[0].debtor, 'Nacho'); assert.equal(r1.rows[0].payer, 'Alvaro')
  const r2 = await c.query(SQL, ['Test', ids.map(r => r.id), PROJECT])
  assert.equal(r2.rows.length, 0, 'no vuelve a marcar las ya pagadas')
  console.log('shares.pay SQL OK:', r1.rows.map(r => `${r.debtor}→${r.payer} $${r.amount}`).join(', '))
} finally { await c.query('rollback'); c.release(); await pool.end() }
