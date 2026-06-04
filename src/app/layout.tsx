import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ServiceWorker } from '@/components/ServiceWorker'
import { AuthProvider } from '@/contexts/AuthContext'
import { BottomNav } from '@/components/BottomNav'
import { PWAInstall } from '@/components/PWAInstall'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Compás — El ritmo de tu banda',
  description: 'Setlists, letras con acordes, metrónomo y calendario para tu banda.',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Compás',
  },
  formatDetection: { telephone: false },
  other: {
    'mobile-web-app-capable': 'yes',
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: dark)',  color: '#f59e0b' },
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
        <link rel="apple-touch-icon" href="/apple-icon" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-icon" />
      </head>
      <body
        className="min-h-screen"
        style={{
          backgroundColor: 'var(--bg-base)',
          color: 'var(--text-primary)',
          paddingBottom: 'calc(64px + env(safe-area-inset-bottom))',
        }}
      >
        <AuthProvider>
          <ServiceWorker />
          <PWAInstall />
          {children}
          <BottomNav />
        </AuthProvider>
      </body>
    </html>
  )
}
