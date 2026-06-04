'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

interface Props {
  userId: string
  email: string
  onSaved: (name: string) => void
}

export function FirstTimeNameModal({ userId, email, onSaved }: Props) {
  const defaultName = email.split('@')[0]
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  async function save(displayName: string) {
    setSaving(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('profiles').upsert({
      id: userId,
      email,
      display_name: displayName.trim() || defaultName,
      updated_at: new Date().toISOString(),
    })
    onSaved(displayName.trim() || defaultName)
    setSaving(false)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-6"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}
    >
      <div
        className="w-full max-w-xs rounded-3xl p-6 fade-in text-center"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-bright)' }}
      >
        <div className="text-4xl mb-3">👋</div>
        <h2 className="font-bold text-lg mb-1" style={{ color: 'var(--text-primary)' }}>
          ¡Bienvenido a Compás!
        </h2>
        <p className="text-sm mb-5" style={{ color: 'var(--text-muted)' }}>
          ¿Cómo te llaman en la banda?
        </p>

        <input
          autoFocus
          type="text"
          placeholder={`Ej: ${defaultName}`}
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && name.trim()) save(name) }}
          maxLength={40}
          className="w-full px-4 py-3 rounded-2xl text-sm text-center outline-none mb-3"
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-bright)',
            color: 'var(--text-primary)',
            fontSize: 16,
          }}
          onFocus={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'}
          onBlur={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-bright)'}
        />

        <button
          onClick={() => save(name)}
          disabled={saving}
          className="w-full py-3 rounded-2xl font-bold text-sm mb-2 transition-all"
          style={{
            background: name.trim() ? 'var(--accent)' : 'var(--bg-elevated)',
            color: name.trim() ? '#000' : 'var(--text-muted)',
            border: name.trim() ? 'none' : '1px solid var(--border)',
          }}
        >
          {saving ? 'Guardando...' : name.trim() ? `Hola, ${name.trim()} 👋` : 'Continuar'}
        </button>

        <button
          onClick={() => save(defaultName)}
          className="text-xs"
          style={{ color: 'var(--text-muted)' }}
        >
          Saltar por ahora
        </button>
      </div>
    </div>
  )
}
