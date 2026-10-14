import { NextResponse } from 'next/server'
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { getServerUser } from '@/lib/auth-server'

export const runtime = 'nodejs'

// Emite tokens para subidas directas a Vercel Blob (grabaciones y logos).
export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody
  try {
    const json = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        const user = await getServerUser()
        if (!user) throw new Error('Debes iniciar sesión para subir archivos')
        if (!/^(recordings|logos)\/[\w-]+\//.test(pathname)) throw new Error('Ruta no permitida')
        return {
          allowOverwrite: true,
          addRandomSuffix: false,
          maximumSizeInBytes: 300 * 1024 * 1024,
          tokenPayload: JSON.stringify({ userId: user.id }),
        }
      },
      onUploadCompleted: async () => { /* la fila en la base se crea desde el cliente */ },
    })
    return NextResponse.json(json)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error al subir' }, { status: 400 })
  }
}
