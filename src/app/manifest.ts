import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'BandUtils',
    short_name: 'BandUtils',
    description: 'Letras, acordes, BPM y metrónomo para tu banda',
    start_url: '/',
    display: 'standalone',
    background_color: '#07070f',
    theme_color: '#f59e0b',
    orientation: 'portrait-primary',
    categories: ['music', 'utilities'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
