'use client'

import { upload } from '@vercel/blob/client'

/** Sube un archivo a Vercel Blob directamente desde el navegador (sin límite de 4.5 MB). */
export async function uploadFile(path: string, file: Blob, contentType?: string): Promise<{ url: string | null; error: { message: string } | null }> {
  try {
    const blob = await upload(path, file, {
      access: 'public',
      handleUploadUrl: '/api/upload',
      contentType,
      multipart: file.size > 5 * 1024 * 1024,
    })
    return { url: blob.url, error: null }
  } catch (e) {
    return { url: null, error: { message: e instanceof Error ? e.message : 'Error al subir el archivo' } }
  }
}
