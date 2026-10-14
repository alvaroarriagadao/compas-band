'use client'

import { authClient } from './auth-client'

export interface AuthError { message: string; code?: string; status?: number }
export interface AuthUser { id: string; email: string; name?: string | null }

function toError(e: unknown): AuthError {
  if (e && typeof e === 'object' && 'message' in e) {
    const o = e as { message?: string; code?: string; status?: number }
    return { message: o.message || 'Error de autenticación', code: o.code, status: o.status }
  }
  return { message: 'Error de autenticación' }
}

export async function signIn(email: string, password: string): Promise<{ user: AuthUser | null; error: AuthError | null }> {
  const { data, error } = await authClient.signIn.email({ email, password })
  if (error) return { user: null, error: toError(error) }
  return { user: data?.user ? { id: data.user.id, email: data.user.email, name: data.user.name } : null, error: null }
}

/** Devuelve `user` cuando la sesión quedó iniciada y `pendingVerification` si falta confirmar el email. */
export async function signUp(email: string, password: string): Promise<{ user: AuthUser | null; pendingVerification: boolean; error: AuthError | null }> {
  const name = email.split('@')[0]
  const { data, error } = await authClient.signUp.email({ email, password, name })
  if (error) return { user: null, pendingVerification: false, error: toError(error) }
  const user = data?.user ? { id: data.user.id, email: data.user.email, name: data.user.name } : null
  return { user, pendingVerification: !data?.token, error: null }
}

export async function signOut() {
  const { error } = await authClient.signOut()
  return { error: error ? toError(error) : null }
}

/** Envía el email con enlace de recuperación. El enlace llega a `redirectTo?token=...`. */
export async function resetPasswordForEmail(email: string, redirectTo: string) {
  const { error } = await authClient.requestPasswordReset({ email, redirectTo })
  return { error: error ? toError(error) : null }
}

/** Define una contraseña nueva usando el token del enlace de recuperación. */
export async function resetPasswordWithToken(token: string, newPassword: string) {
  const { error } = await authClient.resetPassword({ token, newPassword })
  return { error: error ? toError(error) : null }
}

/** Cambia la contraseña de un usuario con sesión iniciada. */
export async function changePassword(currentPassword: string, newPassword: string) {
  const { error } = await authClient.changePassword({ currentPassword, newPassword, revokeOtherSessions: false })
  return { error: error ? toError(error) : null }
}

export async function getSession() {
  const { data } = await authClient.getSession()
  return data ?? null
}

export function generateAccessCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 48)
}
