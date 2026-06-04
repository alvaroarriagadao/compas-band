'use client'

import { useRef, useState } from 'react'
import { Camera, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface Props {
  projectId: string
  currentUrl: string | null
  onUploaded: (url: string) => void
}

export function ProjectLogoUpload({ projectId, currentUrl, onUploaded }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)

    const ext = file.name.split('.').pop()
    const path = `${projectId}/logo.${ext}`

    const { error } = await supabase.storage
      .from('project-logos')
      .upload(path, file, { upsert: true, contentType: file.type })

    if (!error) {
      const { data: { publicUrl } } = supabase.storage
        .from('project-logos')
        .getPublicUrl(path)

      await supabase.from('projects').update({ logo_url: publicUrl }).eq('id', projectId)
      onUploaded(publicUrl)
    }
    setUploading(false)
  }

  return (
    <button
      onClick={() => inputRef.current?.click()}
      disabled={uploading}
      className="relative w-14 h-14 rounded-2xl overflow-hidden flex items-center justify-center group transition-all"
      style={{ background: 'var(--bg-elevated)', border: '2px solid var(--border)' }}
      title="Cambiar logo"
    >
      {currentUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={currentUrl} alt="Logo" className="w-full h-full object-cover" />
      ) : (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--text-muted)' }}>
          <path d="M9 3v11.55A4 4 0 1 0 11 18V7h6V3H9z"/>
        </svg>
      )}
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ background: 'rgba(0,0,0,0.6)' }}>
        {uploading ? <Loader2 size={16} className="animate-spin text-white" /> : <Camera size={16} className="text-white" />}
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </button>
  )
}
