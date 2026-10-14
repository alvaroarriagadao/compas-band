// Traduce una consulta del cliente (src/lib/db.ts) a SQL parametrizado.
// Solo permite las tablas y columnas declaradas en db-schema.ts.
import { TABLES, type TableDef, type ColType } from './db-schema'

export type Row = Record<string, unknown>
type Filter = { op: 'eq' | 'neq' | 'in'; col: string; val: unknown }
type Order = { col: string; asc: boolean }
export interface Query {
  table: string
  op: 'select' | 'insert' | 'update' | 'delete' | 'upsert'
  columns?: string
  values?: Row | Row[]
  filters?: Filter[]
  order?: Order[]
  limit?: number
  single?: 'single' | 'maybe' | null
  returning?: boolean
}

export class BadRequest extends Error {}
const q = (id: string) => `"${String(id).replace(/"/g, '')}"`

function splitTopLevel(s: string): string[] {
  const out: string[] = []
  let depth = 0, cur = ''
  for (const ch of s) {
    if (ch === '(') depth++
    if (ch === ')') depth--
    if (ch === ',' && depth === 0) { out.push(cur); cur = '' } else cur += ch
  }
  out.push(cur)
  return out.map(x => x.trim()).filter(Boolean)
}

function colExpr(alias: string, c: string, ty: ColType) {
  const e = `${alias}.${q(c)}`
  return ty === 'date' || ty === 'time' ? `${e}::text as ${q(c)}` : e
}

function selectList(def: TableDef, spec: string | undefined, alias = 't'): string {
  const parts: string[] = []
  for (const item of splitTopLevel(spec || '*')) {
    if (item === '*') {
      for (const [c, ty] of Object.entries(def.columns)) parts.push(colExpr(alias, c, ty))
      continue
    }
    const embed = item.match(/^(\w+):(\w+)\((.*)\)$/)
    if (embed) {
      const [, al, fk, cols] = embed
      const ref = def.fks?.[fk]
      if (!ref) throw new BadRequest(`Relación no permitida: ${fk}`)
      const rdef = TABLES[ref]
      const rcols = cols.split(',').map(s => s.trim()).filter(Boolean)
      for (const c of rcols) if (!rdef.columns[c]) throw new BadRequest(`Columna no permitida: ${ref}.${c}`)
      const inner = rcols.map(c => colExpr('r', c, rdef.columns[c])).join(', ')
      parts.push(`(select row_to_json(e) from (select ${inner} from ${q(ref)} r where r.${q(rdef.pk[0])} = ${alias}.${q(fk)}) e) as ${q(al)}`)
      continue
    }
    if (!def.columns[item]) throw new BadRequest(`Columna no permitida: ${item}`)
    parts.push(colExpr(alias, item, def.columns[item]))
  }
  if (!parts.length) throw new BadRequest('Sin columnas')
  return parts.join(', ')
}

function whereClause(def: TableDef, filters: Filter[], params: unknown[]): string {
  const conds = filters.map(f => {
    if (!def.columns[f.col]) throw new BadRequest(`Columna no permitida: ${f.col}`)
    const col = `t.${q(f.col)}`
    if (f.op === 'in') {
      params.push(Array.isArray(f.val) ? f.val : [f.val])
      return `${col} = any($${params.length})`
    }
    if (f.val === null || f.val === undefined) return `${col} ${f.op === 'eq' ? 'is' : 'is not'} null`
    params.push(f.val)
    return `${col} ${f.op === 'eq' ? '=' : '<>'} $${params.length}`
  })
  return conds.length ? ` where ${conds.join(' and ')}` : ''
}

function orderClause(def: TableDef, order: Order[]): string {
  if (!order.length) return ''
  return ' order by ' + order.map(o => {
    if (!def.columns[o.col]) throw new BadRequest(`Columna no permitida: ${o.col}`)
    return `t.${q(o.col)} ${o.asc ? 'asc' : 'desc'}`
  }).join(', ')
}

function cleanRow(def: TableDef, row: Row): Row {
  const out: Row = {}
  for (const [k, v] of Object.entries(row)) {
    if (v === undefined) continue
    if (!def.columns[k]) throw new BadRequest(`Columna no permitida: ${k}`)
    out[k] = v
  }
  return out
}

export function buildSql(qy: Query): { text: string; params: unknown[] } {
  const def = TABLES[qy.table]
  if (!def) throw new BadRequest(`Tabla no permitida: ${qy.table}`)
  const params: unknown[] = []
  const filters = qy.filters ?? []
  const returning = qy.returning ? ` returning ${selectList(def, qy.columns)}` : ''

  switch (qy.op) {
    case 'select': {
      const limit = qy.single ? 2 : qy.limit
      return {
        text: `select ${selectList(def, qy.columns)} from ${q(qy.table)} t${whereClause(def, filters, params)}${orderClause(def, qy.order ?? [])}${limit ? ` limit ${Number(limit)}` : ''}`,
        params,
      }
    }
    case 'insert':
    case 'upsert': {
      const rows = (Array.isArray(qy.values) ? qy.values : [qy.values ?? {}]).map(r => cleanRow(def, r))
      const cols = Array.from(new Set(rows.flatMap(r => Object.keys(r))))
      if (!cols.length) throw new BadRequest('Sin columnas para insertar')
      const tuples = rows.map(r => '(' + cols.map(c => { params.push(r[c] ?? null); return `$${params.length}` }).join(', ') + ')').join(', ')
      let text = `insert into ${q(qy.table)} as t (${cols.map(q).join(', ')}) values ${tuples}`
      if (qy.op === 'upsert') {
        const keys = def.conflict ?? def.pk
        const upd = cols.filter(c => !keys.includes(c))
        text += ` on conflict (${keys.map(q).join(', ')}) ` + (upd.length ? `do update set ${upd.map(c => `${q(c)} = excluded.${q(c)}`).join(', ')}` : 'do nothing')
      }
      return { text: text + returning, params }
    }
    case 'update': {
      if (!filters.length) throw new BadRequest('update sin filtros')
      const row = cleanRow(def, (qy.values ?? {}) as Row)
      const sets = Object.entries(row).map(([k, v]) => { params.push(v); return `${q(k)} = $${params.length}` })
      if (!sets.length) throw new BadRequest('Sin columnas para actualizar')
      return { text: `update ${q(qy.table)} as t set ${sets.join(', ')}${whereClause(def, filters, params)}${returning}`, params }
    }
    case 'delete': {
      if (!filters.length) throw new BadRequest('delete sin filtros')
      return { text: `delete from ${q(qy.table)} as t${whereClause(def, filters, params)}${returning}`, params }
    }
    default:
      throw new BadRequest('Operación no permitida')
  }
}
