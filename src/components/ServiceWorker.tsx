'use client'

import { useEffect } from 'react'

export function ServiceWorker() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .catch(() => {/* silently fail in dev */})
    }
  }, [])

  return null
}
