// Migra datos y archivos desde Supabase a Neon + Vercel Blob.
//
// Uso:  node scripts/migrate-from-supabase.mjs [--dump] [--files] [--users] [--import]
//       (sin flags ejecuta los cuatro pasos en orden; cada paso es reentrante)
//
// Requiere en .env.local: DATABASE_URL, BLOB_READ_WRITE_TOKEN, NEON_AUTH_BASE_URL
// y en .env.local.bak-supabase (o .env.local): NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { Pool } from '@neondatabase/serverless'
import { put } from '@vercel/blob'

const here = new URL('.', import.meta.url)
const OUT = new URL('../migration/', here)
mkdirSync(new URL('dump/', OUT), { recursive: true })

function readEnv(file) {
  const p = new URL(`../${file}`, here)
  if (!existsSync(p)) return {}
  return Object.fromEntries(readFileSync(p, 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')] }))
}
const env = { ...readEnv('.env.local.bak-supabase'), ...readEnv('.env.local'), ...process.env }
const SB_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SB_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const need = (k) => { if (!env[k]) throw new Error(`Falta ${k}`); return env[k] }

const TABLES = {
  profiles:        { pk: 'id',         cols: ['id','email','display_name','is_active','created_at','updated_at'] },
  projects:        { pk: 'id',         cols: ['id','name','description','slug','logo_url','access_code','owner_id','created_at','updated_at'] },
  project_members: { pk: 'project_id', cols: ['project_id','user_id','role','joined_at'] },
  songs:           { pk: 'id',         cols: ['id','project_id','title','bpm','song_order','lyrics','notes','metro_sound','metro_subdivision','metro_volume','metro_beats','metro_accent','created_at','updated_at'] },
  setlists:        { pk: 'id',         cols: ['id','project_id','name','event_date','venue','notes','setlist_order','created_at','updated_at'] },
  setlist_songs:   { pk: 'id',         cols: ['id','setlist_id','song_id','custom_title','song_order','notes'] },
  rehearsals:      { pk: 'id',         cols: ['id','project_id','title','rehearsal_date','notes','created_at','updated_at'] },
  recordings:      { pk: 'id',         cols: ['id','rehearsal_id','project_id','title','audio_url','duration_seconds','created_at'] },
  gig_dates:       { pk: 'id',         cols: ['id','project_id','title','date','end_date','start_time','end_time','status','venue','notes','setlist_id','created_at'] },
  gig_attendance:  { pk: 'id',         cols: ['id','gig_id','user_id','user_email','display_name','status','created_at'] },
}
const USER_ID_COLS = { profiles: ['id'], projects: ['owner_id'], project_members: ['user_id'], gig_attendance: ['user_id'] }
const URL_COLS = { projects: ['logo_url'], recordings: ['audio_url'] }

const dumpPath = (t) => new URL(`dump/${t}.json`, OUT)
const readJson = (u, fallback) => existsSync(u) ? JSON.parse(readFileSync(u, 'utf8')) : fallback
const writeJson = (u, v) => writeFileSync(u, JSON.stringify(v, null, 2))

// ---------- 1. dump desde Supabase (REST, políticas abiertas) ----------
async function dump() {
  need('NEXT_PUBLIC_SUPABASE_URL'); need('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  for (const [t, def] of Object.entries(TABLES)) {
    const rows = []
    for (let offset = 0; ; offset += 1000) {
      const res = await fetch(`${SB_URL}/rest/v1/${t}?select=*&order=${def.pk}&limit=1000&offset=${offset}`, {
        headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
      })
      if (!res.ok) { console.warn(`  ! ${t}: HTTP ${res.status} ${await res.text()}`); break }
      const page = await res.json()
      rows.push(...page)
      if (page.length < 1000) break
    }
    writeJson(dumpPath(t), rows)
    console.log(`  ${t}: ${rows.length} filas`)
  }
}

// ---------- 2. archivos: Supabase Storage -> Vercel Blob ----------
async function files() {
  const token = need('BLOB_READ_WRITE_TOKEN')
  const mapUrl = new URL('files.json', OUT)
  const map = readJson(mapUrl, {})
  for (const [t, cols] of Object.entries(URL_COLS)) {
    const rows = readJson(dumpPath(t), [])
    for (const row of rows) for (const c of cols) {
      const old = row[c]
      if (!old || !old.includes('supabase.co') || map[old]) continue
      const res = await fetch(old)
      if (!res.ok) { console.warn(`  ! no se pudo descargar ${old} (HTTP ${res.status})`); continue }
      const buf = Buffer.from(await res.arrayBuffer())
      const contentType = res.headers.get('content-type') || 'application/octet-stream'
      const rel = decodeURIComponent(old.split('/object/public/')[1] || `${t}/${row.id}`)
      const bucket = rel.split('/')[0]
      const rest = rel.split('/').slice(1).join('/')
      const path = (bucket === 'rehearsal-recordings' ? 'recordings/' : 'logos/') + rest
      const blob = await put(path, buf, { access: 'public', token, addRandomSuffix: false, allowOverwrite: true, contentType })
      map[old] = blob.url
      writeJson(mapUrl, map)
      console.log(`  ${(buf.length / 1024 / 1024).toFixed(2)} MB  ${path}`)
    }
  }
  console.log(`  ${Object.keys(map).length} archivos en Vercel Blob`)
}

// ---------- 3. usuarios: crear en Neon Auth y mapear ids antiguos ----------
async function users() {
  const base = need('NEON_AUTH_BASE_URL').replace(/\/$/, '')
  const mapUrl = new URL('users.json', OUT)
  const map = readJson(mapUrl, {}) // oldId -> { id, email }
  const emails = new Map()
  for (const p of readJson(dumpPath('profiles'), [])) if (p.email) emails.set(p.id, p.email.toLowerCase())
  for (const a of readJson(dumpPath('gig_attendance'), [])) if (a.user_email && !emails.has(a.user_id)) emails.set(a.user_id, a.user_email.toLowerCase())
  const names = Object.fromEntries(readJson(dumpPath('profiles'), []).map(p => [p.id, p.display_name]))

  for (const [oldId, email] of emails) {
    if (map[oldId]) continue
    const already = Object.values(map).find(u => u.email === email)
    if (already) { map[oldId] = already; writeJson(mapUrl, map); continue }
    const password = randomBytes(18).toString('base64url')
    const res = await fetch(`${base}/sign-up/email`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password, name: names[oldId] || email.split('@')[0] }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok || !json.user?.id) {
      console.warn(`  ! ${email}: ${res.status} ${json.code || ''} ${json.message || ''} (si ya existe, crea la entrada a mano en migration/users.json)`)
      continue
    }
    map[oldId] = { id: json.user.id, email }
    writeJson(mapUrl, map)
    console.log(`  ${email} -> ${json.user.id}`)
  }
  const missing = [...new Set([
    ...readJson(dumpPath('projects'), []).map(p => p.owner_id),
    ...readJson(dumpPath('project_members'), []).map(m => m.user_id),
  ])].filter(id => id && !map[id])
  if (missing.length) console.warn(`  ! ${missing.length} ids de usuario sin email conocido (quedarán sin mapear): ${missing.join(', ')}`)
}

// ---------- 4. importar a Neon ----------
async function importData() {
  const pool = new Pool({ connectionString: need('DATABASE_URL') })
  const userMap = readJson(new URL('users.json', OUT), {})
  const fileMap = readJson(new URL('files.json', OUT), {})
  const mapUser = (id) => (id && userMap[id]) ? userMap[id].id : id
  for (const [t, def] of Object.entries(TABLES)) {
    const rows = readJson(dumpPath(t), [])
    let n = 0
    for (const raw of rows) {
      const row = {}
      for (const c of def.cols) if (raw[c] !== undefined) row[c] = raw[c]
      for (const c of USER_ID_COLS[t] || []) row[c] = mapUser(row[c])
      for (const c of URL_COLS[t] || []) {
        if (!row[c]) continue
        if (fileMap[row[c]]) row[c] = fileMap[row[c]]
        else if (row[c].includes('supabase.co')) { console.warn(`  ! ${t}.${c} sin archivo migrado, se deja vacío: ${row[c]}`); row[c] = null }
      }
      const cols = Object.keys(row)
      const text = `insert into "${t}" (${cols.map(c => `"${c}"`).join(',')}) values (${cols.map((_, i) => `$${i + 1}`).join(',')}) on conflict do nothing`
      try { const r = await pool.query(text, cols.map(c => row[c])); n += r.rowCount } catch (e) { console.warn(`  ! ${t} ${raw[def.pk]}: ${e.message}`) }
    }
    console.log(`  ${t}: ${n} insertadas (${rows.length} en dump)`)
  }
  await pool.end()
}

const flags = process.argv.slice(2)
const all = flags.length === 0
const steps = [['--dump', dump], ['--files', files], ['--users', users], ['--import', importData]]
for (const [flag, fn] of steps) {
  if (all || flags.includes(flag)) { console.log(`\n== ${flag.slice(2)} ==`); await fn() }
}
console.log('\nListo.')
