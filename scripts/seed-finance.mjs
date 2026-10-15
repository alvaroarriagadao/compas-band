// Carga la configuración inicial de Finanzas para Los Killtros Blues (desde el Excel).
// Uso: node scripts/seed-finance.mjs
import { readFileSync } from 'node:fs'
import { Pool } from '@neondatabase/serverless'

const url = readFileSync(new URL('../.env.local', import.meta.url), 'utf8').match(/^DATABASE_URL=(.*)$/m)[1]
const pool = new Pool({ connectionString: url })
const PROJECT = '39ace012-63f2-4e84-ae5c-5fde5ed5b966' // Los Killtros Blues
const ADMIN = 'dd7c464d-6a69-43e0-825a-84564947e43d'   // alvaro.arriagada101

const { rows: existing } = await pool.query('select count(*)::int as n from finance_members where project_id = $1', [PROJECT])
if (existing[0].n > 0) { console.log('Ya hay integrantes cargados, no se repite el seed.'); await pool.end(); process.exit(0) }

const members = [['Alvaro', ADMIN], ['Sebastian', null], ['Nacho', null], ['Tutu', null]]
for (const [i, [name, userId]] of members.entries()) {
  await pool.query('insert into finance_members (project_id, name, user_id, sort_order) values ($1,$2,$3,$4)', [PROJECT, name, userId, i])
}
await pool.query(`insert into treasury_settings (project_id, monthly_fee, start_month, opening_balance, opening_note) values ($1, 5000, '2026-10-01', 30158, $2)
  on conflict (project_id) do update set monthly_fee = 5000, start_month = '2026-10-01', opening_balance = 30158, opening_note = $2`,
  [PROJECT, 'Saldo de cierre del Excel al 15 oct 2026 (cuotas 2024-2026 menos gastos)'])
await pool.query(`insert into finance_log (project_id, module, action, detail, user_id, user_name) values ($1, 'caja', 'settings', $2, $3, 'Alvaro')`,
  [PROJECT, 'Caja iniciada desde el Excel: saldo inicial $30.158, cuota $5.000 desde octubre 2026. Integrantes: Alvaro, Sebastian, Nacho, Tutu', ADMIN])
console.log('Seed listo: 4 integrantes, caja con saldo inicial $30.158 desde 2026-10')
await pool.end()
