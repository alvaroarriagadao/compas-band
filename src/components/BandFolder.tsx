'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Caveat } from 'next/font/google'
import { Music2, Eye, EyeOff, ListMusic, Mic } from 'lucide-react'
import type { Project } from '@/lib/database.types'

const hand = Caveat({ subsets: ['latin'], weight: ['600', '700'] })

export interface FolderStats { songs: number; setlists: number; rehearsals: number; titles: string[] }

// Tonos de carpeta de cuero, bien separados entre sí: coñac, vino, mezclilla, petróleo, violeta, mostaza
const FOLDER_HUES = [22, 350, 212, 168, 268, 42]
function hueOf(text: string) {
  return FOLDER_HUES[[...text].reduce((a, ch) => a + ch.charCodeAt(0), 0) % FOLDER_HUES.length]
}

/** La carpeta de una banda: pestaña con el código, hojas con canciones asomando y la tapa con el nombre. */
export function BandFolder({ project, stats, collaborator, index }: { project: Project; stats?: FolderStats; collaborator: boolean; index: number }) {
  const router = useRouter()
  const [opening, setOpening] = useState(false)
  const [showCode, setShowCode] = useState(false)
  const hue = hueOf(project.name)
  const href = `/projects/${project.id}`
  const titles = stats?.titles.length ? stats.titles : ['Primera canción', 'Ideas', 'Setlist']

  function open(e: React.MouseEvent | React.KeyboardEvent) {
    e.preventDefault()
    if (opening) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) { router.push(href); return }
    router.prefetch(href)
    setOpening(true)
    setTimeout(() => router.push(href), 380)
  }

  return (
    <a href={href} onClick={open} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') open(e) }}
      className={`band-folder relative block pt-[26px] fade-in ${opening ? 'is-opening' : ''}`}
      style={{ animationDelay: `${index * 60}ms` }} aria-label={`Abrir la carpeta de ${project.name}`}>

      {/* Pestaña */}
      <div className="absolute top-0 left-0 h-[34px] flex items-start gap-1.5 pl-3.5 pr-2 pt-[6px] rounded-t-[14px]"
        style={{ background: `hsl(${hue} 30% 15%)`, border: `1px solid hsl(${hue} 30% 24%)`, borderBottom: 'none', minWidth: 148 }}>
        {project.access_code ? (
          <>
            <span className="text-[11px] font-bold tabular-nums" style={{ color: showCode ? 'var(--accent)' : `hsl(${hue} 25% 62%)`, letterSpacing: showCode ? '0.1em' : '0.18em' }}>
              {showCode ? project.access_code : '••••••'}
            </span>
            <button onClick={e => { e.preventDefault(); e.stopPropagation(); setShowCode(s => !s) }}
              className="p-0.5 -mt-0.5 rounded" style={{ color: `hsl(${hue} 25% 62%)` }} title={showCode ? 'Ocultar código' : 'Ver código de la banda'}>
              {showCode ? <EyeOff size={12} /> : <Eye size={12} />}
            </button>
          </>
        ) : <span className="text-[11px] font-bold" style={{ color: `hsl(${hue} 25% 62%)` }}>Banda</span>}
      </div>

      {/* Cuerpo trasero + hojas */}
      <div className="relative rounded-[18px] rounded-tl-none" style={{ background: `hsl(${hue} 30% 15%)`, border: `1px solid hsl(${hue} 30% 24%)` }}>
        <div className="folder-papers absolute left-4 right-4 top-2.5 h-14 pointer-events-none" aria-hidden>
          {titles.slice(0, 3).map((title, i) => (
            <div key={i} className={`absolute top-0 h-14 rounded-md px-3 pt-1 ${hand.className}`}
              style={{
                left: `${i * 22}%`, width: '52%',
                background: i === 1 ? '#f1ecdf' : '#e6e0d1',
                transform: `rotate(${[-2, 1, 3.5][i]}deg)`,
                color: '#2b2a3a', fontSize: 17, lineHeight: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.35)',
                backgroundImage: 'repeating-linear-gradient(transparent 0 19px, rgba(40,60,140,0.13) 19px 20px)',
              }}>
              <span className="block truncate">{title}</span>
            </div>
          ))}
        </div>

        {/* Tapa */}
        <div className="folder-front relative mt-11 rounded-[16px] px-4 pt-3.5 pb-3.5 flex items-center gap-3.5"
          style={{
            background: `linear-gradient(165deg, hsl(${hue} 34% 22%), hsl(${hue} 32% 14%))`,
            border: `1px solid hsl(${hue} 32% 30%)`,
            boxShadow: '0 -6px 14px rgba(0,0,0,0.35)',
          }}>
          {project.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={project.logo_url} alt="" className="w-14 h-14 rounded-full object-cover flex-shrink-0" style={{ boxShadow: `0 0 0 2px hsl(${hue} 32% 30%)` }} />
          ) : (
            <div className="w-14 h-14 rounded-full flex-shrink-0 flex items-center justify-center" style={{ background: `hsl(${hue} 30% 12%)`, color: `hsl(${hue} 30% 60%)` }}>
              <Music2 size={22} />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-[17px] font-black truncate leading-tight" style={{ color: 'var(--text-primary)' }}>{project.name}</p>
              {collaborator && <span className="text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ background: 'rgba(0,0,0,0.25)', color: `hsl(${hue} 25% 70%)` }}>colaborador</span>}
            </div>
            {project.description && <p className="text-xs truncate mt-0.5" style={{ color: `hsl(${hue} 18% 68%)` }}>{project.description}</p>}
            {stats && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-2 text-[11px] font-semibold tabular-nums" style={{ color: `hsl(${hue} 20% 72%)` }}>
                <span className="inline-flex items-center gap-1"><Music2 size={11} /> {stats.songs} {stats.songs === 1 ? 'canción' : 'canciones'}</span>
                <span className="inline-flex items-center gap-1"><ListMusic size={11} /> {stats.setlists} {stats.setlists === 1 ? 'setlist' : 'setlists'}</span>
                <span className="inline-flex items-center gap-1"><Mic size={11} /> {stats.rehearsals} {stats.rehearsals === 1 ? 'ensayo' : 'ensayos'}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </a>
  )
}
