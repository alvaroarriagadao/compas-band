// Prueba el SQL de fee.pay contra Neon dentro de una transacción que se revierte.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { Pool } from '@neondatabase/serverless'
const url = readFileSync(new URL('../.env.local', import.meta.url), 'utf8').match(/^DATABASE_URL=(.*)$/m)![1]
const pool = new Pool({ connectionString: url })
const c = await pool.connect()
const PROJECT = '39ace012-63f2-4e84-ae5c-5fde5ed5b966'
const PAY = `with paid as (select coalesce(sum(amount), 0)::int as total from treasury_fee_checks where member_id = $1 and month = $2)
  insert into treasury_fee_checks (project_id, member_id, month, amount, historical, checked_by, checked_by_name)
  select $3, $1, $2, least(coalesce($4::int, $5::int - paid.total), $5::int - paid.total), false, $6, $7 from paid
  where $5::int - paid.total > 0
  returning amount, (select total from paid) as before`
try {
  await c.query('begin')
  const { rows: [nacho] } = await c.query(`select id from finance_members where project_id = $1 and name = 'Nacho'`, [PROJECT])
  const pay = (month: string, amount: number | null) => c.query(PAY, [nacho.id, month, PROJECT, amount, 5000, 'test', 'Test']).then(r => r.rows[0])
  assert.deepEqual(await pay('2026-03-01', null), { amount: 5000, before: 0 }, 'marzo completo')
  assert.equal(await pay('2026-03-01', null), undefined, 'doble toque en marzo no cobra dos veces')
  assert.deepEqual(await pay('2026-04-01', null), { amount: 5000, before: 0 }, 'abril completo')
  assert.deepEqual(await pay('2026-02-01', 9000), { amount: 4000, before: 1000 }, 'febrero: solo cobra lo que falta (4.000)')
  assert.deepEqual(await pay('2026-05-01', 2000), { amount: 2000, before: 0 }, 'mayo parcial')
  const { rows: [sum] } = await c.query(`select sum(amount)::int as nuevas from treasury_fee_checks where project_id = $1 and not historical`, [PROJECT])
  assert.equal(sum.nuevas, 16000, 'marzo + abril + 4.000 feb + 2.000 may')
  console.log('fee.pay SQL OK: sin cobros dobles, parciales y completar funcionan')
} finally {
  await c.query('rollback'); c.release(); await pool.end()
}
