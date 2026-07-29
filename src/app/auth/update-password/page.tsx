'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { updatePassword } from '@/lib/auth'

export default function UpdatePasswordPage() {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    // Supabase auto-detects the recovery code/token in the URL and fires PASSWORD_RECOVERY
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') setReady(true)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password !== confirm) { setError('Las contraseñas no coinciden'); return }
    if (password.length < 6) { setError('Mínimo 6 caracteres'); return }
    setSaving(true)
    const { error } = await updatePassword(password)
    if (error) {
      setError(error.message)
    } else {
      setDone(true)
      setTimeout(() => router.replace('/'), 2200)
    }
    setSaving(false)
  }

  if (done) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4" style={{ background: 'var(--bg-base)' }}>
        <div className="text-center fade-in">
          <div className="text-5xl mb-3">✅</div>
          <h2 className="text-lg font-bold mb-1" style={{ color: 'var(--text-primary)' }}>¡Contraseña actualizada!</h2>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Entrando a Compás…</p>
        </div>
      </div>
    )
  }

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-base)' }}>
        <div className="w-7 h-7 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--border)', borderTopColor: 'var(--accent)' }} />
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
              type="password" required minLength={6} autoFocus
              value={password} onChange={e => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
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
