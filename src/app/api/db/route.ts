import { NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'
import { buildSql, BadRequest, type Query, type Row } from '@/lib/db-sql'
import { getServerUser } from '@/lib/auth-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

let client: ReturnType<typeof neon> | null = null
function sql() {
  if (!client) {
    const url = process.env.DATABASE_URL
    if (!url) throw new Error('DATABASE_URL no configurado')
    client = neon(url)
  }
  return client
}

export async function POST(request: Request) {
  let qy: Query
  try { qy = await request.json() } catch { return NextResponse.json({ data: null, error: { message: 'JSON inválido' } }, { status: 400 }) }

  if (qy.op !== 'select') {
    const user = await getServerUser()
    if (!user) return NextResponse.json({ data: null, error: { message: 'No autorizado', code: '401' } }, { status: 401 })
  }

  try {
    const { text, params } = buildSql(qy)
    const rows = (await sql().query(text, params)) as Row[]
    const wantsRows = qy.op === 'select' || qy.returning
    let data: unknown = wantsRows ? rows : null
    if (wantsRows && qy.single) {
      if (rows.length === 0) {
        if (qy.single === 'single') return NextResponse.json({ data: null, error: { message: 'No se encontró el registro', code: 'PGRST116' } })
        data = null
      } else data = rows[0]
    }
    return NextResponse.json({ data, error: null })
  } catch (e) {
    const err = e as { message?: string; code?: string }
    const status = e instanceof BadRequest ? 400 : 500
    if (status === 500) console.error('[api/db]', err.message)
    return NextResponse.json({ data: null, error: { message: err.message || 'Error de base de datos', code: err.code } }, { status })
  }
}
