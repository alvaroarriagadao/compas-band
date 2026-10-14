import { createNeonAuth } from '@neondatabase/auth/next/server'

let instance: ReturnType<typeof createNeonAuth> | null = null

/** Instancia de Neon Auth para el servidor (route handlers, server components). */
export function getAuth() {
  if (!instance) {
    const baseUrl = process.env.NEON_AUTH_BASE_URL
    const secret = process.env.NEON_AUTH_COOKIE_SECRET
    if (!baseUrl || !secret) {
      throw new Error('Faltan NEON_AUTH_BASE_URL o NEON_AUTH_COOKIE_SECRET en las variables de entorno')
    }
    instance = createNeonAuth({ baseUrl, cookies: { secret } })
  }
  return instance
}

export interface ServerUser { id: string; email: string; name?: string | null }

/** Usuario autenticado de la request actual, o null. */
export async function getServerUser(): Promise<ServerUser | null> {
  try {
    const { data } = await getAuth().getSession()
    const u = data?.user
    return u ? { id: u.id, email: u.email, name: u.name } : null
  } catch {
    return null
  }
}
