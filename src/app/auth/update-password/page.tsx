'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { resetPasswordWithToken } from '@/lib/auth'

function UpdatePasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const linkError = searchParams.get('error')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!token) { setError('El enlace no es válido.'); return }
    if (password !== confirm) { setError('Las contraseñas no coinciden'); return }
    if (password.length < 8) { setError('Mínimo 8 caracteres'); return }
    setSaving(true)
    const { error } = await resetPasswordWithToken(token, password)
    if (error) {
      setError(error.code === 'INVALID_TOKEN' || error.message.toLowerCase().includes('token')
        ? 'El enlace expiró o ya fue usado. Pide uno nuevo desde "¿Olvidaste tu contraseña?".'
        : error.message)
    } else {
      setDone(true)
      setTimeout(() => router.replace('/login'), 2200)
    }
    setSaving(false)
  }

  if (done) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4" style={{ background: 'var(--bg-base)' }}>
        <div className="text-center fade-in">
          <div className="text-5xl mb-3">✅</div>
          <h2 className="text-lg font-bold mb-1" style={{ color: 'var(--text-primary)' }}>¡Contraseña actualizada!</h2>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Ya puedes iniciar sesión…</p>
        </div>
      </div>
    )
  }

  if (!token || linkError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4" style={{ background: 'var(--bg-base)' }}>
        <div className="text-center fade-in max-w-sm">
          <div className="text-5xl mb-3">⚠️</div>
          <h2 className="text-lg font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Enlace no válido</h2>
          <p className="text-sm mb-5" style={{ color: 'var(--text-muted)' }}>
            El enlace para restablecer la contraseña expiró o ya fue usado. Pide uno nuevo.
          </p>
          <Link href="/login" className="inline-block px-5 py-2.5 rounded-xl text-sm font-bold"
            style={{ background: 'var(--accent)', color: '#000' }}>
            Volver al inicio de sesión
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4" style={{ background: 'var(--bg-base)' }}>
      <div className="mb-8 text-center fade-in">
        <div className="inline-flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="#000"><path d="M9 3v11.55A4 4 0 1 0 11 18V7h6V3H9z"/></svg>
          </div>
          <span className="text-2xl font-black" style={{ color: 'var(--text-primary)' }}>Compás</span>
        </div>
      </div>

      <div className="w-full max-w-sm rounded-3xl p-7 fade-in" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <h2 className="text-lg font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Nueva contraseña</h2>
        <p className="text-sm mb-5" style={{ color: 'var(--text-muted)' }}>Elige una contraseña nueva para tu cuenta.</p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs font-semibold block mb-1.5" style={{ color: 'var(--text-muted)' }}>Nueva contraseña</label>
            <input
              type="password" required minLength={8} autoFocus
              value={password} onChange={e => setPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
              onFocus={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'}
              onBlur={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'}
            />
          </div>
          <div>
            <label className="text-xs font-semibold block mb-1.5" style={{ color: 'var(--text-muted)' }}>Confirmar contraseña</label>
            <input
              type="password" required
              value={confirm} onChange={e => setConfirm(e.target.value)}
              placeholder="Repite la contraseña"
              className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
              onFocus={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'}
              onBlur={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'}
            />
          </div>

          {error && (
            <div className="px-3 py-2.5 rounded-xl text-xs" style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--red)', border: '1px solid rgba(239,68,68,0.2)' }}>
              {error}
            </div>
          )}

          <button
            type="submit" disabled={saving}
            className="w-full py-3 rounded-xl text-sm font-bold mt-1 transition-all"
            style={{ background: 'var(--accent)', color: '#000', opacity: saving ? 0.7 : 1, boxShadow: '0 0 20px rgba(245,158,11,0.25)' }}
          >
            {saving ? 'Guardando…' : 'Guardar contraseña'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function UpdatePasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-base)' }}>
        <div className="w-7 h-7 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--border)', borderTopColor: 'var(--accent)' }} />
      </div>
    }>
      <UpdatePasswordForm />
    </Suspense>
  )
}
