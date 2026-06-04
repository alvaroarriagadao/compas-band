import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ServiceWorker } from '@/components/ServiceWorker'
import { AuthProvider } from '@/contexts/AuthContext'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Compás — El ritmo de tu banda',
  description: 'Setlists, letras con acordes y metrónomo para tu banda.',
  // DO NOT set manifest manually — Next.js auto-links /manifest.webmanifest from app/manifest.ts
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Compás',
    startupImage: '/icon',
  },
  formatDetection: { telephone: false },
  other: {
    // Ensure PWA is recognised on Android Chrome
    'mobile-web-app-capable': 'yes',
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#f59e0b' },
    { media: '(prefers-color-scheme: light)', color: '#f59e0b' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={inter.className}>
      <head>
        {/* Explicit apple-touch-icon for iOS Safari */}
        <link rel="apple-touch-icon" href="/apple-icon" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-icon" />
      </head>
      <body className="min-h-screen" style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)' }}>
        <AuthProvider>
          <ServiceWorker />
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}
