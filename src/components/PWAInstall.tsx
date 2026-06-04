'use client'

import { useEffect, useState } from 'react'
import { Download, X, Share } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function PWAInstall() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isIOS, setIsIOS] = useState(false)
  const [showIOSGuide, setShowIOSGuide] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    // Already installed as PWA
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setInstalled(true)
      return
    }

    // Check if previously dismissed (in this session)
    if (sessionStorage.getItem('pwa-dismissed')) {
      setDismissed(true)
      return
    }

    // Android / Chrome
    const handler = (e: Event) => {
      e.preventDefault()
      setPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)

    // iOS detection
    const ua = navigator.userAgent
    const iosDevice = /iPad|iPhone|iPod/.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream
    if (iosDevice) setIsIOS(true)

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  function dismiss() {
    sessionStorage.setItem('pwa-dismissed', '1')
    setDismissed(true)
    setShowIOSGuide(false)
  }

  async function handleInstall() {
    if (!prompt) return
    await prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === 'accepted') setInstalled(true)
    setPrompt(null)
  }

  if (installed || dismissed) return null
  if (!prompt && !isIOS) return null

  return (
    <>
      {/* Install banner */}
      <div
        className="fixed top-0 left-0 right-0 z-50 flex items-center gap-3 px-4 py-3 fade-in"
        style={{
          background: 'linear-gradient(135deg, #1a1200, #0f0f00)',
          borderBottom: '1px solid rgba(245,158,11,0.3)',
          paddingTop: 'max(12px, env(safe-area-inset-top))',
        }}
      >
        <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'var(--accent)' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="#000"><path d="M9 3v11.55A4 4 0 1 0 11 18V7h6V3H9z"/></svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold" style={{ color: 'var(--accent)' }}>Instala Compás</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {isIOS ? 'Accede rápido desde tu pantalla de inicio' : 'Sin abrir el browser cada vez'}
          </p>
        </div>
        <button
          onClick={isIOS ? () => setShowIOSGuide(true) : handleInstall}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold flex-shrink-0"
          style={{ background: 'var(--accent)', color: '#000' }}
        >
          <Download size={12} /> Instalar
        </button>
        <button onClick={dismiss} style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
          <X size={16} />
        </button>
      </div>

      {/* iOS guide modal */}
      {showIOSGuide && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center px-4 pb-8"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowIOSGuide(false) }}
        >
          <div className="w-full max-w-sm rounded-3xl p-6 fade-in" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-bright)' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold" style={{ color: 'var(--text-primary)' }}>Instalar en iPhone / iPad</h3>
              <button onClick={() => setShowIOSGuide(false)} style={{ color: 'var(--text-muted)' }}><X size={18} /></button>
            </div>
            <div className="space-y-3">
              {[
                { n: 1, icon: <Share size={18} />, text: 'Toca el botón compartir ↑ en Safari (abajo en pantalla)' },
                { n: 2, icon: <span style={{ fontSize: 18 }}>➕</span>, text: 'Desplázate y toca "Agregar a pantalla de inicio"' },
                { n: 3, icon: <span style={{ fontSize: 18 }}>✅</span>, text: 'Toca "Agregar" — ¡listo! Compás aparece como app' },
              ].map(step => (
                <div key={step.n} className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm" style={{ background: 'var(--accent)', color: '#000' }}>{step.n}</div>
                  <div className="flex items-center gap-2 pt-0.5">
                    <span style={{ color: 'var(--accent)' }}>{step.icon}</span>
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{step.text}</p>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={dismiss} className="w-full mt-5 py-2.5 rounded-xl text-sm font-bold"
              style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  )
}
