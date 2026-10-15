import { NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'
import { getServerUser } from '@/lib/auth-server'
import { splitExpense, type FinanceSnapshot, type TreasurySettings } from '@/lib/finance'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Row = Record<string, unknown>
let client: ReturnType<typeof neon> | null = null
function sql() {
  if (!client) {
    const url = process.env.DATABASE_URL
    if (!url) throw new Error('DATABASE_URL no configurado')
    client = neon(url)
  }
  return client
}
const q = (text: string, params: unknown[] = []) => sql().query(text, params) as Promise<Row[]>

class HttpError extends Error { constructor(public status: number, msg: string) { super(msg) } }
const bad = (msg: string) => new HttpError(400, msg)
const isUuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v)
const isDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)
const toInt = (v: unknown, name: string) => { const n = Math.round(Number(v)); if (!Number.isFinite(n)) throw bad(`${name} inválido`); return n }
const str = (v: unknown, name: string, max = 200) => { const s = String(v ?? '').trim(); if (!s) throw bad(`${name} es obligatorio`); return s.slice(0, max) }

// ---------- carga del estado completo ----------
async function loadSnapshot(projectId: string): Promise<FinanceSnapshot> {
  const [project] = await q('select id, name, access_code from projects where id = $1', [projectId])
  if (!project) throw new HttpError(404, 'Proyecto no encontrado')
  const [members, candidates, expenses, shares, settingsRows, checks, texp, log] = await Promise.all([
    q('select id, project_id, name, user_id, active, sort_order from finance_members where project_id = $1 order by sort_order, created_at', [projectId]),
    q(`select distinct u.user_id, coalesce(p.display_name, split_part(p.email, '@', 1), 'Integrante') as name
       from (select user_id from project_members where project_id = $1 union select owner_id from projects where id = $1 and owner_id is not null) u
       left join profiles p on p.id = u.user_id
       where u.user_id is not null and u.user_id not in (select user_id from finance_members where project_id = $1 and user_id is not null)`, [projectId]),
    q('select id, project_id, paid_by, description, amount, expense_date::text, installments, notes, created_by_name, created_at from shared_expenses where project_id = $1 order by expense_date desc, created_at desc', [projectId]),
    q('select s.id, s.expense_id, s.member_id, s.installment_no, s.due_date::text, s.amount, s.paid_at, s.paid_marked_by from shared_expense_shares s join shared_expenses e on e.id = s.expense_id where e.project_id = $1', [projectId]),
    q('select project_id, monthly_fee, start_month::text, opening_balance, opening_note from treasury_settings where project_id = $1', [projectId]),
    q('select id, member_id, month::text, amount, checked_by_name, checked_at from treasury_fee_checks where project_id = $1', [projectId]),
    q('select id, expense_date::text, description, amount, paid_to, created_by_name, created_at from treasury_expenses where project_id = $1 order by expense_date desc, created_at desc', [projectId]),
    q('select id, module, action, detail, user_name, created_at from finance_log where project_id = $1 order by created_at desc limit 200', [projectId]),
  ])
  const now = new Date()
  const settings = (settingsRows[0] as unknown as TreasurySettings) ?? {
    project_id: projectId, monthly_fee: 5000,
    start_month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`,
    opening_balance: 0, opening_note: null,
  }
  return {
    project: project as FinanceSnapshot['project'],
    members: members as unknown as FinanceSnapshot['members'],
    candidates: candidates as unknown as FinanceSnapshot['candidates'],
    expenses: expenses as unknown as FinanceSnapshot['expenses'],
    shares: shares as unknown as FinanceSnapshot['shares'],
    treasury: { settings, checks: checks as unknown as FinanceSnapshot['treasury']['checks'], expenses: texp as unknown as FinanceSnapshot['treasury']['expenses'] },
    log: log as unknown as FinanceSnapshot['log'],
  }
}

// ---------- permisos ----------
interface Actor { id: string; name: string }
async function requireMember(projectId: string): Promise<Actor> {
  const user = await getServerUser()
  if (!user) throw new HttpError(401, 'Debes iniciar sesión')
  const rows = await q(
    `select coalesce(p.display_name, split_part($2::text, '@', 1)) as name
     from projects pr left join profiles p on p.id = $3
     where pr.id = $1 and (pr.owner_id = $3 or exists (select 1 from project_members m where m.project_id = pr.id and m.user_id = $3))`,
    [projectId, user.email, user.id])
  if (!rows[0]) throw new HttpError(403, 'No perteneces a esta banda')
  return { id: user.id, name: user.name || (rows[0].name as string) || user.email.split('@')[0] }
}
const log = (projectId: string, module: 'gastos' | 'caja', action: string, detail: string, actor: Actor) =>
  q('insert into finance_log (project_id, module, action, detail, user_id, user_name) values ($1,$2,$3,$4,$5,$6)', [projectId, module, action, detail, actor.id, actor.name])

const fmt = (n: number) => '$' + n.toLocaleString('es-CL')

// ---------- GET ----------
export async function GET(request: Request) {
  const url = new URL(request.url)
  try {
    const code = url.searchParams.get('code')
    if (code) {
      const [p] = await q('select id from projects where access_code = $1', [code.toUpperCase().trim()])
      if (!p) throw new HttpError(404, 'Código inválido')
      const snap = await loadSnapshot(p.id as string)
      snap.log = snap.log.slice(0, 50)
      return NextResponse.json(snap)
    }
    const projectId = url.searchParams.get('project')
    if (!isUuid(projectId)) throw bad('Falta el proyecto')
    const actor = await requireMember(projectId)
    const snap = await loadSnapshot(projectId)
    snap.me = { user_id: actor.id, member_id: snap.members.find(m => m.user_id === actor.id)?.id ?? null }
    return NextResponse.json(snap)
  } catch (e) {
    return errorResponse(e)
  }
}

function errorResponse(e: unknown) {
  if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status })
  console.error('[api/finance]', e)
  return NextResponse.json({ error: (e as Error).message || 'Error' }, { status: 500 })
}

// ---------- POST (acciones) ----------
export async function POST(request: Request) {
  let body: Row
  try { body = await request.json() } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }
  try {
    const projectId = body.project_id
    if (!isUuid(projectId)) throw bad('Falta el proyecto')
    const actor = await requireMember(projectId)
    const action = String(body.action)
    const memberById = async (id: unknown) => {
      if (!isUuid(id)) throw bad('Integrante inválido')
      const [m] = await q('select id, name from finance_members where id = $1 and project_id = $2', [id, projectId])
      if (!m) throw bad('Integrante no encontrado')
      return m as { id: string; name: string }
    }

    switch (action) {
      // ----- integrantes -----
      case 'member.add': {
        const name = str(body.name, 'Nombre', 40)
        const userId = typeof body.user_id === 'string' ? body.user_id : null
        const [{ n }] = await q('select count(*)::int as n from finance_members where project_id = $1', [projectId])
        await q('insert into finance_members (project_id, name, user_id, sort_order) values ($1,$2,$3,$4)', [projectId, name, userId, n])
        await log(projectId, 'gastos', 'member.add', `Agregó a ${name} como integrante`, actor)
        break
      }
      case 'member.update': {
        const m = await memberById(body.id)
        const name = str(body.name ?? m.name, 'Nombre', 40)
        const active = body.active === undefined ? true : Boolean(body.active)
        await q('update finance_members set name = $1, active = $2 where id = $3', [name, active, m.id])
        await log(projectId, 'gastos', 'member.update', active ? `Editó integrante: ${m.name} → ${name}` : `Desactivó a ${m.name}`, actor)
        break
      }
      case 'member.claim': {
        const m = await memberById(body.id)
        await q('update finance_members set user_id = null where project_id = $1 and user_id = $2', [projectId, actor.id])
        await q('update finance_members set user_id = $1 where id = $2', [actor.id, m.id])
        break
      }

      // ----- gastos compartidos -----
      case 'expense.create': {
        const payer = await memberById(body.paid_by)
        const amount = toInt(body.amount, 'Monto')
        if (amount <= 0) throw bad('El monto debe ser mayor a 0')
        const description = str(body.description, 'Descripción', 120)
        const expenseDate = isDate(body.expense_date) ? body.expense_date : new Date().toISOString().slice(0, 10)
        const dueDates = Array.isArray(body.due_dates) ? body.due_dates.filter(isDate) : []
        if (dueDates.length < 1 || dueDates.length > 36) throw bad('Indica entre 1 y 36 cuotas con fecha')
        const debtorIds = Array.isArray(body.participant_ids) ? body.participant_ids.filter(isUuid).filter(id => id !== payer.id) : []
        if (!debtorIds.length) throw bad('Elige al menos una persona que comparta el gasto')
        const valid = await q('select id from finance_members where project_id = $1 and id = any($2)', [projectId, debtorIds])
        if (valid.length !== debtorIds.length) throw bad('Integrante inválido')
        const notes = body.notes ? String(body.notes).slice(0, 500) : null
        const expenseId = crypto.randomUUID()
        const shares = splitExpense(amount, debtorIds, dueDates)
        const s = sql()
        await s.transaction([
          s.query('insert into shared_expenses (id, project_id, paid_by, description, amount, expense_date, installments, notes, created_by, created_by_name) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
            [expenseId, projectId, payer.id, description, amount, expenseDate, dueDates.length, notes, actor.id, actor.name]),
          ...shares.map(sh => s.query('insert into shared_expense_shares (expense_id, member_id, installment_no, due_date, amount) values ($1,$2,$3,$4,$5)',
            [expenseId, sh.member_id, sh.installment_no, sh.due_date, sh.amount])),
        ])
        await log(projectId, 'gastos', 'expense.create', `Registró "${description}" por ${fmt(amount)}, pagado por ${payer.name}, en ${dueDates.length} cuota${dueDates.length > 1 ? 's' : ''} entre ${debtorIds.length + 1} personas`, actor)
        break
      }
      case 'expense.update': {
        if (!isUuid(body.id)) throw bad('Gasto inválido')
        const [e] = await q('select id, description from shared_expenses where id = $1 and project_id = $2', [body.id, projectId])
        if (!e) throw bad('Gasto no encontrado')
        const description = str(body.description ?? e.description, 'Descripción', 120)
        const notes = body.notes === undefined ? undefined : (body.notes ? String(body.notes).slice(0, 500) : null)
        const expenseDate = isDate(body.expense_date) ? body.expense_date : undefined
        await q('update shared_expenses set description = $1, notes = coalesce($2, notes), expense_date = coalesce($3, expense_date) where id = $4', [description, notes ?? null, expenseDate ?? null, e.id])
        if (Array.isArray(body.due_dates)) {
          const dates = body.due_dates.filter(isDate) as string[]
          await Promise.all(dates.map((d, i) => q('update shared_expense_shares set due_date = $1 where expense_id = $2 and installment_no = $3', [d, e.id, i + 1])))
        }
        await log(projectId, 'gastos', 'expense.update', `Editó el gasto "${description}"`, actor)
        break
      }
      case 'expense.delete': {
        if (!isUuid(body.id)) throw bad('Gasto inválido')
        const [e] = await q('delete from shared_expenses where id = $1 and project_id = $2 returning description, amount', [body.id, projectId])
        if (e) await log(projectId, 'gastos', 'expense.delete', `Eliminó el gasto "${e.description}" de ${fmt(e.amount as number)}`, actor)
        break
      }
      case 'share.toggle': {
        if (!isUuid(body.share_id)) throw bad('Cuota inválida')
        const paid = Boolean(body.paid)
        const [row] = await q(
          `update shared_expense_shares s set paid_at = case when $1 then now() else null end, paid_marked_by = case when $1 then $2 else null end
           from shared_expenses e join finance_members d on true join finance_members p on p.id = e.paid_by
           where s.id = $3 and e.id = s.expense_id and e.project_id = $4 and d.id = s.member_id
           returning s.installment_no, s.amount, e.installments, e.description, d.name as debtor, p.name as payer`,
          [paid, actor.name, body.share_id, projectId])
        if (!row) throw bad('Cuota no encontrada')
        await log(projectId, 'gastos', paid ? 'share.paid' : 'share.unpaid',
          `${paid ? 'Marcó pagada' : 'Desmarcó'} la cuota ${row.installment_no}/${row.installments} de "${row.description}": ${row.debtor} → ${row.payer} ${fmt(row.amount as number)}`, actor)
        break
      }

      // ----- caja -----
      case 'treasury.settings': {
        const fee = toInt(body.monthly_fee, 'Cuota mensual')
        if (fee < 0) throw bad('Cuota inválida')
        const start = isDate(body.start_month) ? body.start_month.slice(0, 7) + '-01' : null
        if (!start) throw bad('Mes de inicio inválido')
        const opening = toInt(body.opening_balance ?? 0, 'Saldo inicial')
        const note = body.opening_note ? String(body.opening_note).slice(0, 200) : null
        await q(`insert into treasury_settings (project_id, monthly_fee, start_month, opening_balance, opening_note) values ($1,$2,$3,$4,$5)
                 on conflict (project_id) do update set monthly_fee = excluded.monthly_fee, start_month = excluded.start_month, opening_balance = excluded.opening_balance, opening_note = excluded.opening_note, updated_at = now()`,
          [projectId, fee, start, opening, note])
        await log(projectId, 'caja', 'settings', `Configuró la caja: cuota ${fmt(fee)}, desde ${start.slice(0, 7)}, saldo inicial ${fmt(opening)}`, actor)
        break
      }
      case 'fee.toggle': {
        const m = await memberById(body.member_id)
        if (!isDate(body.month)) throw bad('Mes inválido')
        const month = body.month.slice(0, 7) + '-01'
        const checked = Boolean(body.checked)
        const [settings] = await q('select monthly_fee from treasury_settings where project_id = $1', [projectId])
        const fee = (settings?.monthly_fee as number | undefined) ?? 5000
        if (checked) {
          await q('insert into treasury_fee_checks (project_id, member_id, month, amount, checked_by, checked_by_name) values ($1,$2,$3,$4,$5,$6) on conflict (member_id, month) do nothing', [projectId, m.id, month, fee, actor.id, actor.name])
        } else {
          await q('delete from treasury_fee_checks where member_id = $1 and month = $2', [m.id, month])
        }
        await log(projectId, 'caja', checked ? 'fee.checked' : 'fee.unchecked', `${checked ? 'Marcó pagada' : 'Desmarcó'} la cuota de ${m.name} de ${month.slice(0, 7)} (${fmt(fee)})`, actor)
        break
      }
      case 'treasury.expense.add': {
        const amount = toInt(body.amount, 'Monto')
        if (amount <= 0) throw bad('El monto debe ser mayor a 0')
        const description = str(body.description, 'Descripción', 120)
        const date = isDate(body.expense_date) ? body.expense_date : new Date().toISOString().slice(0, 10)
        const paidTo = body.paid_to ? String(body.paid_to).trim().slice(0, 60) : null
        await q('insert into treasury_expenses (project_id, expense_date, description, amount, paid_to, created_by, created_by_name) values ($1,$2,$3,$4,$5,$6,$7)', [projectId, date, description, amount, paidTo, actor.id, actor.name])
        await log(projectId, 'caja', 'expense.add', `Registró gasto de caja "${description}" por ${fmt(amount)}${paidTo ? ` a ${paidTo}` : ''}`, actor)
        break
      }
      case 'treasury.expense.delete': {
        if (!isUuid(body.id)) throw bad('Gasto inválido')
        const [e] = await q('delete from treasury_expenses where id = $1 and project_id = $2 returning description, amount', [body.id, projectId])
        if (e) await log(projectId, 'caja', 'expense.delete', `Eliminó gasto de caja "${e.description}" de ${fmt(e.amount as number)}`, actor)
        break
      }
      default:
        throw bad('Acción desconocida')
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    return errorResponse(e)
  }
}
