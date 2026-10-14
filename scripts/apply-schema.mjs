// Aplica db/schema.sql a la base de datos indicada en DATABASE_URL (.env.local)
import { readFileSync } from 'node:fs'
import { Pool } from '@neondatabase/serverless'

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')] })
)
const url = process.env.DATABASE_URL || env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL no definido')
const pool = new Pool({ connectionString: url })
const ddl = readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')
await pool.query(ddl)
const { rows } = await pool.query("select table_name from information_schema.tables where table_schema='public' order by 1")
console.log('Tablas en Neon:', rows.map(r => r.table_name).join(', '))
await pool.end()
