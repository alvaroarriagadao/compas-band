// Prueba la generación de SQL contra Neon dentro de una transacción que se revierte.
// Uso: npx tsx scripts/test-db-sql.mts
import { readFileSync } from 'node:fs'
import { Pool } from '@neondatabase/serverless'
import { buildSql, type Query } from '../src/lib/db-sql'

const env = Object.fromEntries(readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')
  .filter(l => l.includes('=') && !l.startsWith('#'))
  .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')] }))
const pool = new Pool({ connectionString: env.DATABASE_URL })
const c = await pool.connect()
const run = async (label: string, q: Query) => {
  const { text, params } = buildSql(q)
  const { rows } = await c.query(text, params as unknown[])
  console.log(`\n# ${label}\n  ${text}\n  →`, JSON.stringify(rows).slice(0, 300))
  return rows
}
try {
  await c.query('begin')
  await run('upsert profile', { table: 'profiles', op: 'upsert', values: { id: 'u_test', email: 't@t.cl', display_name: 'Test', updated_at: new Date().toISOString() } })
  await run('upsert profile again (update)', { table: 'profiles', op: 'upsert', values: { id: 'u_test', email: 't@t.cl', display_name: 'Test 2' }, columns: '*', returning: true, single: 'single' })
  const [p] = await run('insert project returning', { table: 'projects', op: 'insert', values: { name: 'Banda', owner_id: 'u_test', slug: 'banda', access_code: 'ABC123' }, columns: '*', returning: true })
  await run('upsert member (pk compuesta)', { table: 'project_members', op: 'upsert', values: { project_id: p.id, user_id: 'u_test', role: 'member' } })
  await run('select projects by owner', { table: 'projects', op: 'select', columns: '*', filters: [{ op: 'eq', col: 'owner_id', val: 'u_test' }], order: [{ col: 'created_at', asc: false }] })
  await run('select in + neq', { table: 'projects', op: 'select', columns: 'id, name', filters: [{ op: 'in', col: 'id', val: [p.id] }, { op: 'neq', col: 'owner_id', val: 'otro' }] })
  const [s] = await run('insert song', { table: 'songs', op: 'insert', values: { project_id: p.id, title: 'Tema', bpm: 128, song_order: 0 }, columns: '*', returning: true })
  await run('update song returning', { table: 'songs', op: 'update', values: { bpm: 90, metro_volume: 0.5, metro_accent: false }, filters: [{ op: 'eq', col: 'id', val: s.id }], columns: '*', returning: true, single: 'single' })
  const [g] = await run('insert gig con date/time', { table: 'gig_dates', op: 'insert', values: { project_id: p.id, title: 'Toque', date: '2026-11-05', start_time: '21:30', end_time: null, status: 'confirmed' }, columns: '*, project:project_id(name, access_code)', returning: true })
  const [sel] = await run('select gig con embed', { table: 'gig_dates', op: 'select', columns: '*, project:project_id(name, access_code)', order: [{ col: 'date', asc: true }] })
  if (sel.date !== '2026-11-05' || sel.start_time !== '21:30:00' || sel.project?.name !== 'Banda') throw new Error('Formato de date/time/embed incorrecto: ' + JSON.stringify(sel))
  await run('insert attendance', { table: 'gig_attendance', op: 'insert', values: { gig_id: g.id, user_id: 'u_test', user_email: 't@t.cl', display_name: 't', status: 'yes' }, columns: '*', returning: true, single: 'single' })
  await run('maybeSingle sin resultados', { table: 'rehearsals', op: 'select', columns: '*', filters: [{ op: 'eq', col: 'project_id', val: p.id }, { op: 'eq', col: 'title', val: 'Ideas generales' }], single: 'maybe' })
  await run('delete song', { table: 'songs', op: 'delete', filters: [{ op: 'eq', col: 'id', val: s.id }] })
  for (const bad of [
    { table: 'pg_tables', op: 'select' }, { table: 'songs', op: 'select', columns: 'id; drop table songs' },
    { table: 'songs', op: 'delete' }, { table: 'songs', op: 'update', values: { bpm: 1 } },
    { table: 'profiles', op: 'select', columns: 'hack:id(x)' },
  ] as Query[]) {
    try { buildSql(bad); console.log('  !! debería haber fallado', JSON.stringify(bad)) } catch (e) { console.log('  rechazado OK:', (e as Error).message) }
  }
  console.log('\nTODO OK — revirtiendo transacción')
} finally {
  await c.query('rollback'); c.release(); await pool.end()
}
