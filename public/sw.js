// v2: excluye /api (auth y datos), otros orígenes y peticiones Range (audio).
// Navegación con red primero para que siempre llegue la última versión de la app.
const CACHE = 'compas-v2'
const APP_SHELL = ['/', '/manifest.webmanifest']

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(APP_SHELL)).catch(() => {}).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', e => {
  const req = e.request
  const url = new URL(req.url)

  if (req.method !== 'GET') return
  if (url.origin !== self.location.origin) return      // Vercel Blob, Neon Auth, fuentes externas
  if (url.pathname.startsWith('/api/')) return          // sesión y datos: siempre red
  if (req.headers.has('range')) return                  // reproducción de audio

  // Páginas: red primero, caché solo si no hay conexión
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then(res => {
          if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)) }
          return res
        })
        .catch(() => caches.match(req).then(r => r || caches.match('/')))
    )
    return
  }

  // Archivos estáticos (JS/CSS con hash, iconos): caché primero
  e.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(res => {
      if (res.ok && res.status === 200) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)) }
      return res
    }))
  )
})
