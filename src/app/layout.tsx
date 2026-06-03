import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ServiceWorker } from '@/components/ServiceWorker'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'BandUtils — Herramientas para tu banda',
  description: 'Gestiona proyectos, canciones, letras con acordes y metrónomo para tu banda.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'BandUtils',
  },
  formatDetection: { telephone: false },
}

export const viewport: Viewport = {
  themeColor: '#f59e0b',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={inter.className}>
      <body
        className="min-h-screen"
        style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)' }}
      >
        <ServiceWorker />
        {children}
      </body>
    </html>
  )
}
