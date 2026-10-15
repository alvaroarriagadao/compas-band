// Importa las cuotas 2026 del Excel (ene–sep) como pagos históricos de Los Killtros Blues.
// Son históricos porque ya están incluidos en el saldo inicial de $30.158: se ven en el calendario
// y cuentan para saber quién debe, pero no se vuelven a sumar a la caja.
import { readFileSync } from 'node:fs'
import { Pool } from '@neondatabase/serverless'

const url = readFileSync(new URL('../.env.local', import.meta.url), 'utf8').match(/^DATABASE_URL=(.*)$/m)[1]
const pool = new Pool({ connectionString: url })
const PROJECT = '39ace012-63f2-4e84-ae5c-5fde5ed5b966'
const PAGOS = {
  Alvaro:    [5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000],
  Sebastian: [5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000],
  Nacho:     [5000, 1000],
  Tutu:      [5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000],
}
const { rows: members } = await pool.query('select id, name from finance_members where project_id = $1', [PROJECT])
const { rows: prev } = await pool.query('select count(*)::int as n from treasury_fee_checks where project_id = $1 and historical', [PROJECT])
if (prev[0].n > 0) { console.log('Ya están importadas las cuotas del Excel.'); await pool.end(); process.exit(0) }
let total = 0
for (const [name, amounts] of Object.entries(PAGOS)) {
  const m = members.find(x => x.name === name)
  if (!m) throw new Error(`Falta el integrante ${name}`)
  for (const [i, amount] of amounts.entries()) {
    const month = `2026-${String(i + 1).padStart(2, '0')}-01`
    await pool.query(`insert into treasury_fee_checks (project_id, member_id, month, amount, historical, checked_by, checked_by_name, checked_at)
                      values ($1,$2,$3,$4,true,null,'Excel', '2026-10-15T12:00:00Z')`, [PROJECT, m.id, month, amount])
    total += amount
  }
}
await pool.query(`update treasury_settings set start_month = '2026-01-01',
  opening_note = 'Saldo de cierre del Excel al 15 oct 2026. Ya incluye las cuotas pagadas en 2026 (marcadas como Excel en el calendario).'
  where project_id = $1`, [PROJECT])
await pool.query(`insert into finance_log (project_id, module, action, detail, user_id, user_name) values ($1, 'caja', 'import', $2, null, 'Excel')`,
  [PROJECT, `Importó las cuotas 2026 del Excel (ene–sep): ${Object.entries(PAGOS).map(([n, a]) => `${n} $${a.reduce((x, y) => x + y, 0).toLocaleString('es-CL')}`).join(', ')}. Total $${total.toLocaleString('es-CL')}. Las cuotas se cobran desde enero 2026.`])
console.log(`Importadas cuotas 2026 del Excel: total $${total.toLocaleString('es-CL')}`)
await pool.end()
