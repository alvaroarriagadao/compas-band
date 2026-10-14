import { getAuth } from '@/lib/auth-server'

type Ctx = { params: Promise<{ path: string[] }> }

// Proxy hacia Neon Auth. Se resuelve de forma perezosa para no fallar en build sin env vars.
export const GET = (req: Request, ctx: Ctx) => getAuth().handler().GET(req, ctx)
export const POST = (req: Request, ctx: Ctx) => getAuth().handler().POST(req, ctx)
export const PUT = (req: Request, ctx: Ctx) => getAuth().handler().PUT(req, ctx)
export const DELETE = (req: Request, ctx: Ctx) => getAuth().handler().DELETE(req, ctx)
export const PATCH = (req: Request, ctx: Ctx) => getAuth().handler().PATCH(req, ctx)
