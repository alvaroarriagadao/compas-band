'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

export default function JoinPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setLoading(true)

    const { data: project } = await supabase
      .from('projects')
      .select('id, name')
      .eq('access_code', code.toUpperCase().trim())
      .single()

    if (!project) {
      setError('Código inválido. Verifica con quien te lo compartió.')
      setLoading(false)
      return
    }

    if (user) {
      // Add as member
      await supabase.from('project_members').upsert({
        project_id: project.id,
        user_id: user.id,
        role: 'member',
      })
      router.push(`/projects/${project.id}`)
    } else {
      // Redirect to login with project code in params
      router.push(`/login?join=${code}`)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4" style={{ background: 'var(--bg-base)' }}>
      <div className="w-full max-w-sm">
        <Link href="/login" className="inline-flex items-center gap-1.5 text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
          <ArrowLeft size={14} /> Volver
        </Link>

        <div className="rounded-3xl p-7" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <div className="text-3xl mb-3">🎵</div>
          <h1 className="text-xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Unirse a un proyecto</h1>
          <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>Ingresa el código que te compartió tu banda</p>

          <form onSubmit={handleJoin} className="space-y-4">
            <input
              autoFocus required maxLength={6}
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              placeholder="FUNK88"
              className="w-full px-4 py-4 rounded-2xl text-center text-3xl font-black outline-none tracking-widest uppercase"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-bright)', color: 'var(--accent)', letterSpacing: '0.3em' }}
            />
            {error && (
              <p className="text-xs text-center" style={{ color: 'var(--red)' }}>{error}</p>
            )}
            <button type="submit" disabled={loading || code.length < 4}
              className="w-full py-3 rounded-xl font-bold transition-all"
              style={{ background: 'var(--accent)', color: '#000', opacity: (loading || code.length < 4) ? 0.5 : 1 }}>
              {loading ? 'Buscando...' : 'Unirse al proyecto'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
