'use client'

import type { CSSProperties, ReactNode, InputHTMLAttributes } from 'react'

export const cardStyle: CSSProperties = { background: 'var(--bg-card)', border: '1px solid var(--border)' }
export const inputStyle: CSSProperties = { background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 16 }

export function Card({ children, className = '', style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return <div className={`rounded-2xl p-4 ${className}`} style={{ ...cardStyle, ...style }}>{children}</div>
}

export function Btn({ children, onClick, variant = 'primary', disabled, small, type = 'button', className = '' }: {
  children: ReactNode; onClick?: () => void; variant?: 'primary' | 'ghost' | 'danger' | 'success'; disabled?: boolean; small?: boolean; type?: 'button' | 'submit'; className?: string
}) {
  const styles: Record<string, CSSProperties> = {
    primary: { background: 'var(--accent)', color: '#000' },
    ghost: { background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border)' },
    danger: { background: 'rgba(239,68,68,0.12)', color: 'var(--red)', border: '1px solid rgba(239,68,68,0.25)' },
    success: { background: 'rgba(16,185,129,0.15)', color: 'var(--green)', border: '1px solid rgba(16,185,129,0.3)' },
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl font-bold transition-all ${small ? 'px-3 py-1.5 text-xs' : 'px-4 py-2.5 text-sm'} ${className}`}
      style={{ ...styles[variant], opacity: disabled ? 0.5 : 1 }}>
      {children}
    </button>
  )
}

export function Input(props: InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  const { label, className = '', style, ...rest } = props
  return (
    <label className="block">
      {label && <span className="text-xs font-semibold block mb-1" style={{ color: 'var(--text-muted)' }}>{label}</span>}
      <input {...rest} className={`w-full px-3.5 py-2.5 rounded-xl outline-none ${className}`} style={{ ...inputStyle, ...style }}
        onFocus={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
        onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')} />
    </label>
  )
}

export function Chip({ active, onClick, children, disabled, color }: { active?: boolean; onClick?: () => void; children: ReactNode; disabled?: boolean; color?: string }) {
  const c = color || 'var(--accent)'
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className="px-3 py-1.5 rounded-full text-xs font-bold transition-all"
      style={{
        background: active ? c : 'var(--bg-elevated)',
        color: active ? '#000' : 'var(--text-secondary)',
        border: `1px solid ${active ? c : 'var(--border)'}`,
        opacity: disabled ? 0.5 : 1,
      }}>
      {children}
    </button>
  )
}

export function Stat({ label, value, color, big }: { label: string; value: string; color?: string; big?: boolean }) {
  return (
    <div className="rounded-2xl px-4 py-3" style={cardStyle}>
      <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>{label}</p>
      <p className={`${big ? 'text-3xl' : 'text-xl'} font-black tabular-nums mt-0.5`} style={{ color: color || 'var(--text-primary)' }}>{value}</p>
    </div>
  )
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-2 mt-6">
      <h3 className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--accent)' }}>{children}</h3>
      {right}
    </div>
  )
}

export function Empty({ emoji, text }: { emoji: string; text: string }) {
  return (
    <div className="text-center py-8">
      <div className="text-3xl mb-2">{emoji}</div>
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{text}</p>
    </div>
  )
}

export function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  const hue = [...name].reduce((a, ch) => a + ch.charCodeAt(0), 0) % 360
  return (
    <div className="rounded-full flex items-center justify-center flex-shrink-0 font-black"
      style={{ width: size, height: size, fontSize: size * 0.42, background: `hsl(${hue} 60% 25%)`, color: `hsl(${hue} 80% 80%)` }}>
      {name.slice(0, 2).toUpperCase()}
    </div>
  )
}
