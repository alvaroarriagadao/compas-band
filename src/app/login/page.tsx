'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { signIn, signUp, resetPasswordForEmail } from '@/lib/auth'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const joinCode = searchParams.get('join')
  const { user, loading } = useAuth()
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [resetSent, setResetSent] = useState(false)

  useEffect(() => {
    if (!loading && user) {
      if (joinCode) handleJoinAfterAuth(user.id, joinCode)
      else router.replace('/')
    }
  }, [user, loading]) // eslint-disable-line

  async function handleJoinAfterAuth(userId: string, code: string) {
    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('access_code', code.toUpperCase())
      .single()

    if (project) {
      await supabase.from('project_members').upsert({
        project_id: project.id,
        user_id: userId,
        role: 'member',
      })
      router.replace(`/projects/${project.id}`)
    } else {
      router.replace('/')
    }
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setSubmitting(true)
    const { error } = await resetPasswordForEmail(email, window.location.origin + '/auth/update-password')
    if (error) setError(error.message)
    else setResetSent(true)
    setSubmitting(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setSubmitting(true)

    if (mode === 'login') {
      const { data, error } = await signIn(email, password)
      if (error) {
        setError(
          error.message.includes('Invalid login credentials')
            ? 'Email o contraseña incorrectos'
            : error.message.includes('Email not confirmed')
            ? 'Debes confirmar tu email primero. Revisa tu bandeja de entrada.'
            : error.message
        )
      } else if (data.session) {
        if (joinCode) await handleJoinAfterAuth(data.session.user.id, joinCode)
        else router.replace('/')
      }
    } else {
      const { data, error } = await signUp(email, password)
      if (error) {
        setError(error.message)
      } else if (data.session) {
        // Email confirmation disabled — logged in directly
        if (joinCode) await handleJoinAfterAuth(data.session.user.id, joinCode)
        else router.replace('/')
      } else {
        // Email confirmation enabled — show message
        setEmailSent(true)
      }
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

  // Password reset sent screen
  if (resetSent) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 py-16" style={{ background: 'var(--bg-base)' }}>
        <div className="w-full max-w-sm text-center fade-in">
          <div className="text-6xl mb-4">📩</div>
          <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Revisa tu email</h2>
          <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
            Enviamos un enlace para restablecer tu contraseña a{' '}
            <strong style={{ color: 'var(--text-secondary)' }}>{email}</strong>.
            Haz clic en el enlace y podrás definir una nueva contraseña.
          </p>
          <button
            onClick={() => { setResetSent(false); setMode('login') }}
            className="w-full py-3 rounded-xl text-sm font-bold"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
          >
            ← Volver al inicio de sesión
          </button>
        </div>
      </div>
    )
  }

  // Email sent confirmation screen
  if (emailSent) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 py-16" style={{ background: 'var(--bg-base)' }}>
        <div className="w-full max-w-sm text-center fade-in">
          <div className="text-6xl mb-4">📬</div>
          <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Revisa tu email</h2>
          <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
            Enviamos un enlace de confirmación a <strong style={{ color: 'var(--text-secondary)' }}>{email}</strong>.
            Haz clic en el enlace y volverás directamente a Compás.
          </p>
          <button
            onClick={() => { setEmailSent(false); setMode('login') }}
            className="w-full py-3 rounded-xl text-sm font-bold"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
          >
            Ya confirmé → Iniciar sesión
          </button>
          <p className="text-xs mt-6" style={{ color: 'var(--text-muted)' }}>
            © {new Date().getFullYear()} Álvaro Arriagada Ortega. Todos los derechos reservados.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-16" style={{ background: 'var(--bg-base)' }}>
      {/* Logo */}
      <div className="mb-10 text-center fade-in">
        <div className="inline-flex items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', boxShadow: '0 0 30px rgba(245,158,11,0.35)' }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="#000">
              <path d="M9 3v11.55A4 4 0 1 0 11 18V7h6V3H9z"/>
            </svg>
          </div>
          <span className="text-3xl font-black tracking-tight" style={{ color: 'var(--text-primary)' }}>Compás</span>
        </div>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>El ritmo de tu banda</p>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm rounded-3xl p-7 fade-in" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        {mode === 'forgot' ? (
          <>
            <button onClick={() => { setMode('login'); setError('') }} className="text-xs mb-4 flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>← Volver</button>
            <h2 className="text-base font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Recuperar contraseña</h2>
            <p className="text-xs mb-5" style={{ color: 'var(--text-muted)' }}>Te enviamos un enlace para definir una nueva contraseña.</p>
            <form onSubmit={handleForgot} className="space-y-3">
              <div>
                <label className="text-xs font-semibold block mb-1.5" style={{ color: 'var(--text-muted)' }}>Email</label>
                <input
                  type="email" required autoFocus
                  value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="tu@email.com"
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
                type="submit" disabled={submitting}
                className="w-full py-3 rounded-xl text-sm font-bold mt-1 transition-all"
                style={{ background: 'var(--accent)', color: '#000', opacity: submitting ? 0.7 : 1, boxShadow: '0 0 20px rgba(245,158,11,0.25)' }}
              >
                {submitting ? '...' : 'Enviar enlace'}
              </button>
            </form>
          </>
        ) : (
          <>
            {/* Mode tabs */}
            <div className="flex gap-1 p-1 rounded-2xl mb-6" style={{ background: 'var(--bg-elevated)' }}>
              {(['login', 'register'] as const).map(m => (
                <button key={m} onClick={() => { setMode(m); setError('') }}
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
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
                  style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                  onFocus={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'}
                  onBlur={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'}
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Contraseña</label>
                  {mode === 'login' && (
                    <button type="button" onClick={() => { setMode('forgot'); setError('') }} className="text-xs" style={{ color: 'var(--accent)' }}>
                      ¿Olvidaste tu contraseña?
                    </button>
                  )}
                </div>
                <input
                  type="password" required minLength={6}
                  value={password} onChange={e => setPassword(e.target.value)}
                  placeholder={mode === 'register' ? 'Mínimo 6 caracteres' : '••••••••'}
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
                type="submit" disabled={submitting}
                className="w-full py-3 rounded-xl text-sm font-bold mt-1 transition-all"
                style={{ background: 'var(--accent)', color: '#000', opacity: submitting ? 0.7 : 1, boxShadow: '0 0 20px rgba(245,158,11,0.25)' }}
              >
                {submitting ? '...' : mode === 'login' ? 'Entrar' : 'Crear cuenta'}
              </button>
            </form>
          </>
        )}

        {/* Join with code */}
        {mode !== 'forgot' && <div className="mt-5 pt-4 space-y-3" style={{ borderTop: '1px solid var(--border)' }}>
          <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
            ¿Tu banda te compartió un código?
          </p>
          <a href="/join"
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-bright)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'}
          >
            🎵 Unirse con código de proyecto
          </a>
        </div>}
      </div>

      {/* PWA hint */}
      <p className="mt-5 text-xs text-center max-w-xs" style={{ color: 'var(--text-muted)' }}>
        💡 Instala Compás como app en tu teléfono — no tendrás que volver a iniciar sesión.
      </p>

      <p className="mt-4 text-xs text-center" style={{ color: 'var(--text-muted)', opacity: 0.6 }}>
        © {new Date().getFullYear()} Álvaro Arriagada Ortega. Todos los derechos reservados.
      </p>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-base)' }}>
        <div className="w-7 h-7 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--border)', borderTopColor: 'var(--accent)' }} />
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
