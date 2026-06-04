'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { signIn, signUp } from '@/lib/auth'
import { useAuth } from '@/contexts/AuthContext'

export default function LoginPage() {
  const router = useRouter()
  const { user, loading } = useAuth()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState('')

  useEffect(() => {
    if (!loading && user) router.replace('/')
  }, [user, loading, router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setSuccess(''); setSubmitting(true)

    if (mode === 'login') {
      const { error } = await signIn(email, password)
      if (error) setError(error.message === 'Invalid login credentials' ? 'Email o contraseña incorrectos' : error.message)
      else router.replace('/')
    } else {
      const { error } = await signUp(email, password)
      if (error) setError(error.message)
      else setSuccess('Revisa tu email para confirmar tu cuenta.')
    }
    setSubmitting(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-7 h-7 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--border)', borderTopColor: 'var(--accent)' }} />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-16" style={{ background: 'var(--bg-base)' }}>
      {/* Logo */}
      <div className="mb-10 text-center fade-in">
        <div className="inline-flex items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', boxShadow: '0 0 30px rgba(245,158,11,0.35)' }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="#000" strokeWidth="0">
              <path d="M9 3v11.55A4 4 0 1 0 11 18V7h6V3H9z"/>
            </svg>
          </div>
          <span className="text-3xl font-black tracking-tight" style={{ color: 'var(--text-primary)' }}>Compás</span>
        </div>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>El ritmo de tu banda</p>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm rounded-3xl p-7 fade-in" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        {/* Mode tabs */}
        <div className="flex gap-1 p-1 rounded-2xl mb-6" style={{ background: 'var(--bg-elevated)' }}>
          {(['login', 'register'] as const).map(m => (
            <button key={m} onClick={() => { setMode(m); setError(''); setSuccess('') }}
              className="flex-1 py-2 rounded-xl text-sm font-bold transition-all"
              style={{
                background: mode === m ? 'var(--bg-card)' : 'transparent',
                color: mode === m ? 'var(--text-primary)' : 'var(--text-muted)',
                boxShadow: mode === m ? '0 1px 4px rgba(0,0,0,0.3)' : 'none',
              }}
            >{m === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}</button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs font-semibold block mb-1.5" style={{ color: 'var(--text-muted)' }}>Email</label>
            <input
              type="email" required autoFocus
              value={email} onChange={e => setEmail(e.target.value)}
              placeholder="tu@email.com"
              className="w-full px-4 py-3 rounded-xl text-sm outline-none"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
              onFocus={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'}
              onBlur={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'}
            />
          </div>
          <div>
            <label className="text-xs font-semibold block mb-1.5" style={{ color: 'var(--text-muted)' }}>Contraseña</label>
            <input
              type="password" required minLength={6}
              value={password} onChange={e => setPassword(e.target.value)}
              placeholder={mode === 'register' ? 'Mínimo 6 caracteres' : '••••••••'}
              className="w-full px-4 py-3 rounded-xl text-sm outline-none"
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
          {success && (
            <div className="px-3 py-2.5 rounded-xl text-xs" style={{ background: 'rgba(16,185,129,0.1)', color: 'var(--green)', border: '1px solid rgba(16,185,129,0.2)' }}>
              {success}
            </div>
          )}

          <button
            type="submit" disabled={submitting}
            className="w-full py-3 rounded-xl text-sm font-bold mt-2 transition-all"
            style={{ background: 'var(--accent)', color: '#000', opacity: submitting ? 0.7 : 1, boxShadow: '0 0 20px rgba(245,158,11,0.3)' }}
          >
            {submitting ? '...' : mode === 'login' ? 'Entrar' : 'Crear cuenta'}
          </button>
        </form>

        <div className="mt-5 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
          <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
            ¿Tienes un código de proyecto?{' '}
            <a href="/join" className="font-semibold" style={{ color: 'var(--accent)' }}>Únete aquí</a>
          </p>
        </div>
      </div>
    </div>
  )
}
