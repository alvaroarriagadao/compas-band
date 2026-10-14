/* eslint-disable @typescript-eslint/no-explicit-any */
// Cliente de datos para componentes cliente. Imita el query builder de Supabase
// pero envía la consulta a /api/db, que la ejecuta contra Neon Postgres.

export interface DbError { message: string; code?: string }
export interface DbResponse<T = any> { data: T; error: DbError | null }

type Filter = { op: 'eq' | 'neq' | 'in'; col: string; val: unknown }
type Order = { col: string; asc: boolean }

interface QueryState {
  table: string
  op: 'select' | 'insert' | 'update' | 'delete' | 'upsert'
  columns?: string
  values?: unknown
  filters: Filter[]
  order: Order[]
  limit?: number
  single?: 'single' | 'maybe' | null
  returning?: boolean
}

export class QueryBuilder<T = any> implements PromiseLike<DbResponse<T>> {
  private s: QueryState

  constructor(table: string) {
    this.s = { table, op: 'select', filters: [], order: [] }
  }

  /** En un select define las columnas; tras insert/update/upsert/delete pide RETURNING. */
  select(columns?: string) {
    this.s.columns = columns ?? '*'
    if (this.s.op !== 'select') this.s.returning = true
    return this
  }
  insert(values: Record<string, unknown> | Record<string, unknown>[]) { this.s.op = 'insert'; this.s.values = values; return this }
  upsert(values: Record<string, unknown> | Record<string, unknown>[]) { this.s.op = 'upsert'; this.s.values = values; return this }
  update(values: Record<string, unknown>) { this.s.op = 'update'; this.s.values = values; return this }
  delete() { this.s.op = 'delete'; return this }

  eq(col: string, val: unknown) { this.s.filters.push({ op: 'eq', col, val }); return this }
  neq(col: string, val: unknown) { this.s.filters.push({ op: 'neq', col, val }); return this }
  in(col: string, vals: unknown[]) { this.s.filters.push({ op: 'in', col, val: vals }); return this }
  order(col: string, opts?: { ascending?: boolean }) { this.s.order.push({ col, asc: opts?.ascending ?? true }); return this }
  limit(n: number) { this.s.limit = n; return this }
  single() { this.s.single = 'single'; return this }
  maybeSingle() { this.s.single = 'maybe'; return this }

  then<R1 = DbResponse<T>, R2 = never>(
    onfulfilled?: ((value: DbResponse<T>) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    return this.run().then(onfulfilled, onrejected)
  }

  private async run(): Promise<DbResponse<any>> {
    try {
      const res = await fetch('/api/db', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(this.s),
      })
      const json = await res.json().catch(() => null)
      if (!json || typeof json !== 'object') return { data: null, error: { message: `Error HTTP ${res.status}` } }
      return json as DbResponse<any>
    } catch (e) {
      return { data: null, error: { message: e instanceof Error ? e.message : 'Error de red' } }
    }
  }
}

export const db = {
  from<T = any>(table: string) { return new QueryBuilder<T>(table) },
}
