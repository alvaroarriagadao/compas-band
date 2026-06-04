'use client'

import { useEffect, useState } from 'react'
import { Download, X, Share, Smartphone } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function usePWAStatus() {
  const [isInstalled, setIsInstalled] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [canInstall, setCanInstall] = useState(false)

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || (navigator as unknown as { standalone?: boolean }).standalone === true
    setIsInstalled(standalone)

    const ua = navigator.userAgent
    const ios = /iPad|iPhone|iPod/.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream
    setIsIOS(ios)
  }, [])

  return { isInstalled, isIOS, canInstall, setCanInstall }
}

// ─── Banner flotante al entrar (solo primera vez por sesión) ───────────────────
export function PWAInstallBanner() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isIOS, setIsIOS] = useState(false)
  const [showGuide, setShowGuide] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || (navigator as unknown as { standalone?: boolean }).standalone === true
    if (standalone) { setIsInstalled(true); return }
    if (sessionStorage.getItem('pwa-dismissed')) { setDismissed(true); return }

    const handler = (e: Event) => { e.preventDefault(); setPrompt(e as BeforeInstallPromptEvent) }
    window.addEventListener('beforeinstallprompt', handler)

    const ua = navigator.userAgent
    const ios = /iPad|iPhone|iPod/.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream
    if (ios) setIsIOS(true)

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  function dismiss() { sessionStorage.setItem('pwa-dismissed', '1'); setDismissed(true); setShowGuide(false) }

  async function install() {
    if (!prompt) return
    await prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === 'accepted') setIsInstalled(true)
    setPrompt(null)
  }

  if (isInstalled || dismissed || (!prompt && !isIOS)) return null

  return (
    <>
      {/* Simple full-width top banner */}
      <div
        className="fixed top-0 left-0 right-0 z-50 flex items-center gap-3 px-4 fade-in"
        style={{
          paddingTop: 'max(10px, env(safe-area-inset-top))',
          paddingBottom: 10,
          background: 'rgba(10,10,18,0.97)',
          borderBottom: '1px solid rgba(245,158,11,0.25)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: 'var(--accent)' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="#000"><path d="M9 3v11.55A4 4 0 1 0 11 18V7h6V3H9z"/></svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            <span className="font-bold" style={{ color: 'var(--accent)' }}>Compás </span>
            {isIOS ? '— agrégala a tu inicio' : '— instala para acceso rápido'}
          </p>
        </div>
        <button
          onClick={isIOS ? () => setShowGuide(true) : install}
          className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold flex-shrink-0"
          style={{ background: 'var(--accent)', color: '#000' }}
        >
          <Download size={11} />
          {isIOS ? 'Ver cómo' : 'Instalar'}
        </button>
        <button onClick={dismiss} className="p-1 flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
          <X size={15} />
        </button>
      </div>

      {/* iOS guide */}
      {showGuide && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center px-4 pb-6"
          style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowGuide(false) }}
        >
          <div className="w-full max-w-sm rounded-3xl p-6 fade-in"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-bright)' }}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-bold" style={{ color: 'var(--text-primary)' }}>Instalar en iPhone / iPad</h3>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>3 pasos en Safari</p>
              </div>
              <button onClick={() => setShowGuide(false)} style={{ color: 'var(--text-muted)' }}><X size={18} /></button>
            </div>

            <div className="space-y-4">
              {[
                {
                  n: 1, color: '#f59e0b',
                  icon: <Share size={20} color="#000" />,
                  title: 'Toca el botón compartir',
                  desc: 'El ícono ↑ en la barra inferior de Safari',
                },
                {
                  n: 2, color: '#f59e0b',
                  icon: <span style={{ fontSize: 20, lineHeight: 1 }}>➕</span>,
                  title: '"Agregar a pantalla de inicio"',
                  desc: 'Desplázate en el menú hasta encontrarlo',
                },
                {
                  n: 3, color: '#10b981',
                  icon: <span style={{ fontSize: 20, lineHeight: 1 }}>✅</span>,
                  title: 'Toca "Agregar"',
                  desc: 'Compás aparece como app en tu pantalla de inicio',
                },
              ].map(step => (
                <div key={step.n} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-2xl flex items-center justify-center flex-shrink-0 font-black"
                    style={{ background: step.color, color: '#000', fontSize: 14 }}>
                    {step.n}
                  </div>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{step.title}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 p-3 rounded-2xl" style={{ background: 'var(--bg-elevated)' }}>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                💡 <strong style={{ color: 'var(--text-secondary)' }}>Importante:</strong> debes estar en <strong style={{ color: 'var(--accent)' }}>Safari</strong> para poder instalarla. Chrome en iOS no permite instalar PWAs.
              </p>
            </div>

            <button onClick={dismiss} className="w-full mt-4 py-3 rounded-2xl font-bold text-sm"
              style={{ background: 'var(--accent)', color: '#000' }}>
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  )
}

// ─── Botón siempre accesible en el dashboard ───────────────────────────────────
export function PWAInstallButton() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isIOS, setIsIOS] = useState(false)
  const [showGuide, setShowGuide] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)
  const [justInstalled, setJustInstalled] = useState(false)

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || (navigator as unknown as { standalone?: boolean }).standalone === true
    setIsInstalled(standalone)

    const handler = (e: Event) => { e.preventDefault(); setPrompt(e as BeforeInstallPromptEvent) }
    window.addEventListener('beforeinstallprompt', handler)

    const ua = navigator.userAgent
    if (/iPad|iPhone|iPod/.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream) setIsIOS(true)

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  async function install() {
    if (!prompt) return
    await prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === 'accepted') { setIsInstalled(true); setJustInstalled(true) }
    setPrompt(null)
  }

  // Already installed or nothing to show → render nothing
  if (isInstalled || (!prompt && !isIOS)) return null

  return (
    <>
      <button
        onClick={isIOS ? () => setShowGuide(true) : install}
        className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all"
        style={{ background: 'rgba(245,158,11,0.1)', color: 'var(--accent)', border: '1px solid rgba(245,158,11,0.3)' }}
      >
        <Smartphone size={13} />
        {isIOS ? 'Instalar en iPhone' : 'Instalar app'}
      </button>

      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-end justify-center px-4 pb-6"
          style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowGuide(false) }}>
          <div className="w-full max-w-sm rounded-3xl p-6 fade-in"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-bright)' }}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold" style={{ color: 'var(--text-primary)' }}>Instalar en iPhone / iPad</h3>
              <button onClick={() => setShowGuide(false)} style={{ color: 'var(--text-muted)' }}><X size={18} /></button>
            </div>
            <div className="space-y-4 mb-5">
              {[
                { n: 1, icon: '↑', title: 'Toca compartir en Safari', desc: 'Barra inferior del navegador' },
                { n: 2, icon: '➕', title: '"Agregar a pantalla de inicio"', desc: 'Desplázate en el menú para encontrarlo' },
                { n: 3, icon: '✅', title: 'Toca "Agregar"', desc: 'Compás quedará como app en tu inicio' },
              ].map(s => (
                <div key={s.n} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-2xl flex items-center justify-center flex-shrink-0 font-black text-sm"
                    style={{ background: 'var(--accent)', color: '#000' }}>{s.n}</div>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{s.title}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-3 rounded-2xl mb-4" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
              <p className="text-xs" style={{ color: 'var(--accent)' }}>
                ⚠️ Debes estar en <strong>Safari</strong> — Chrome en iOS no permite instalar PWAs.
              </p>
            </div>
            <button onClick={() => setShowGuide(false)} className="w-full py-3 rounded-2xl font-bold text-sm"
              style={{ background: 'var(--accent)', color: '#000' }}>Entendido</button>
          </div>
        </div>
      )}
    </>
  )
}

// Exportar el viejo nombre para compatibilidad con layout.tsx
export const PWAInstall = PWAInstallBanner
