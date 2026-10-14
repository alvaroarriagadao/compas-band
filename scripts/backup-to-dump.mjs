// Convierte un respaldo SQL de Supabase (pg_dumpall en texto plano) a migration/dump/<tabla>.json
// Uso: node scripts/backup-to-dump.mjs /ruta/al/backup.sql
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'

const file = process.argv[2]
if (!file) throw new Error('Indica la ruta del respaldo (.sql o .backup descomprimido)')
const text = readFileSync(file, 'utf8')
const out = new URL('../migration/dump/', import.meta.url)
mkdirSync(out, { recursive: true })

const TABLES = ['profiles','projects','project_members','songs','setlists','setlist_songs','rehearsals','recordings','gig_dates','gig_attendance']

function unescape(v) {
  if (v === '\\N') return null
  return v.replace(/\\(.)/g, (_, c) => ({ n: '\n', t: '\t', r: '\r', '\\': '\\' }[c] ?? c))
}

for (const t of TABLES) {
  const m = text.match(new RegExp(`^COPY public\\.${t} \\(([^)]*)\\) FROM stdin;\\n([\\s\\S]*?)^\\\\\\.$`, 'm'))
  if (!m) { writeFileSync(new URL(`${t}.json`, out), '[]'); console.log(`  ${t}: (no existe en el respaldo) 0 filas`); continue }
  const cols = m[1].split(',').map(s => s.trim().replace(/"/g, ''))
  const rows = m[2].split('\n').filter(Boolean).map(line => {
    const vals = line.split('\t').map(unescape)
    const row = {}
    cols.forEach((c, i) => {
      let v = vals[i]
      if (v === 't') v = true; else if (v === 'f') v = false
      row[c] = v
    })
    return row
  })
  writeFileSync(new URL(`${t}.json`, out), JSON.stringify(rows, null, 2))
  console.log(`  ${t}: ${rows.length} filas`)
}
