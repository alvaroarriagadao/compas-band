'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, ZoomIn, ZoomOut, Sun, Moon, ChevronLeft, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Song } from '@/lib/database.types'
import { LyricsDisplay } from '@/components/LyricsDisplay'

type Theme = 'dark' | 'light'

const FONT_SIZES = [0.85, 1, 1.2, 1.45, 1.75, 2.1]

export default function ReaderPage() {
  const { id, songId } = useParams<{ id: string; songId: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()
  const backTo = searchParams.get('from') // e.g. setlist id to go back
  const [song, setSong] = useState<Song | null>(null)
  const [siblings, setSiblings] = useState<Song[]>([]) // songs in same context
  const [loading, setLoading] = useState(true)
  const [theme, setTheme] = useState<Theme>('dark')
  const [fontIdx, setFontIdx] = useState(2)

  useEffect(() => {
    loadSong()
  }, [songId]) // eslint-disable-line

  async function loadSong() {
    const songRes = await supabase.from('songs').select('*').eq('id', songId).single()
    setSong(songRes.data)

    if (backTo) {
      // Reading from a setlist: order siblings by the setlist's own song order
      const [setlistSongsRes, songsRes] = await Promise.all([
        supabase.from('setlist_songs').select('*').eq('setlist_id', backTo).order('song_order'),
        supabase.from('songs').select('*').eq('project_id', id),
      ])
      const songMap = new Map((songsRes.data || []).map(s => [s.id, s]))
      const ordered = (setlistSongsRes.data || [])
        .map(ss => (ss.song_id ? songMap.get(ss.song_id) : null))
        .filter((s): s is Song => !!s)
      setSiblings(ordered)
    } else {
      const siblingsRes = await supabase.from('songs').select('*').eq('project_id', id).order('song_order')
      setSiblings(siblingsRes.data || [])
    }
    setLoading(false)
  }

  const currentIdx = siblings.findIndex(s => s.id === songId)
  const prevSong = currentIdx > 0 ? siblings[currentIdx - 1] : null
  const nextSong = currentIdx < siblings.length - 1 ? siblings[currentIdx + 1] : null

  function goBack() {
    if (backTo) {
      router.push(`/projects/${id}/setlists/${backTo}`)
    } else {
      router.push(`/projects/${id}/songs/${songId}`)
    }
  }

  const isDark = theme === 'dark'
  const bg = isDark ? '#07070f' : '#fafaf8'
  const textColor = isDark ? '#e8e8ff' : '#1a1a1a'
  const chordColor = '#f59e0b'
  const borderColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)'
  const controlBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
  const controlColor = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)'

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: bg }}>
        <div className="w-7 h-7 rounded-full border-2 animate-spin" style={{ borderColor: borderColor, borderTopColor: chordColor }} />
      </div>
    )
  }

  if (!song) return null

  return (
    <div className="min-h-screen flex flex-col" style={{ background: bg, color: textColor, transition: 'background 0.2s, color 0.2s' }}>
      {/* Controls bar */}
      <div
        className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 gap-2"
        style={{ background: isDark ? 'rgba(7,7,15,0.94)' : 'rgba(250,250,248,0.94)', borderBottom: `1px solid ${borderColor}`, backdropFilter: 'blur(12px)' }}
      >
        {/* Back */}
        <button
          onClick={goBack}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all"
          style={{ background: controlBg, color: textColor }}
        >
          <ArrowLeft size={16} /> Volver
        </button>

        {/* Song title */}
        <div className="flex-1 text-center min-w-0 px-2">
          <p className="font-bold text-sm truncate" style={{ color: textColor }}>{song.title}</p>
          <p className="text-xs" style={{ color: controlColor }}>{song.bpm} BPM</p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setFontIdx(Math.max(0, fontIdx - 1))}
            disabled={fontIdx === 0}
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-all"
            style={{ background: controlBg, color: fontIdx === 0 ? 'transparent' : textColor }}
          >
            <ZoomOut size={16} />
          </button>
          <button
            onClick={() => setFontIdx(Math.min(FONT_SIZES.length - 1, fontIdx + 1))}
            disabled={fontIdx === FONT_SIZES.length - 1}
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-all"
            style={{ background: controlBg, color: fontIdx === FONT_SIZES.length - 1 ? 'transparent' : textColor }}
          >
            <ZoomIn size={16} />
          </button>
          <button
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-all"
            style={{ background: controlBg, color: textColor }}
          >
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
      </div>

      {/* Lyrics */}
      <div className="flex-1 px-5 py-6 max-w-2xl mx-auto w-full">
        <LyricsDisplay
          lyrics={song.lyrics || ''}
          chordColor={chordColor}
          textColor={textColor}
          fontSize={FONT_SIZES[fontIdx]}
        />

        {!song.lyrics?.trim() && (
          <div className="text-center py-16" style={{ color: controlColor }}>
            <p className="text-2xl mb-2">🎼</p>
            <p>Esta canción no tiene letra aún</p>
          </div>
        )}
      </div>

      {/* Prev / Next navigation */}
      {(prevSong || nextSong) && (
        <div
          className="sticky bottom-0 flex items-center justify-between px-4 py-3 gap-2"
          style={{ background: isDark ? 'rgba(7,7,15,0.94)' : 'rgba(250,250,248,0.94)', borderTop: `1px solid ${borderColor}`, backdropFilter: 'blur(12px)' }}
        >
          <button
            onClick={() => prevSong && router.push(`/projects/${id}/songs/${prevSong.id}/read${backTo ? `?from=${backTo}` : ''}`)}
            disabled={!prevSong}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all flex-1 justify-start"
            style={{ background: prevSong ? controlBg : 'transparent', color: prevSong ? textColor : 'transparent' }}
          >
            <ChevronLeft size={16} />
            <span className="truncate">{prevSong?.title}</span>
          </button>

          <span className="text-xs flex-shrink-0 tabular-nums" style={{ color: controlColor }}>
            {currentIdx + 1} / {siblings.length}
          </span>

          <button
            onClick={() => nextSong && router.push(`/projects/${id}/songs/${nextSong.id}/read${backTo ? `?from=${backTo}` : ''}`)}
            disabled={!nextSong}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all flex-1 justify-end"
            style={{ background: nextSong ? controlBg : 'transparent', color: nextSong ? textColor : 'transparent' }}
          >
            <span className="truncate">{nextSong?.title}</span>
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  )
}
