import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Compás',
    short_name: 'Compás',
    description: 'El ritmo de tu banda — setlists, letras, acordes y metrónomo',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#07070f',
    theme_color: '#f59e0b',
    orientation: 'portrait-primary',
    categories: ['music', 'utilities'],
    lang: 'es',
    icons: [
      {
        src: '/icon-192',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      {
        name: 'Mis proyectos',
        url: '/',
        description: 'Ver todos los proyectos',
      },
    ],
  }
}
