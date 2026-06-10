'use client'

import { useEffect, useState } from 'react'
import { Play, Square, Volume2 } from 'lucide-react'
import { useMetronomeStore, type ClickSound, type Subdivision } from '@/stores/metronomeStore'

interface MetronomeProps {
  songId?: string
  songTitle?: string
  initialBpm?: number
  onBpmChange?: (bpm: number) => void
  compact?: boolean
}

const SOUNDS: { id: ClickSound; label: string; emoji: string; desc: string }[] = [
  { id: 'classic', label: 'Click', emoji: '🎯', desc: 'Clásico' },
  { id: 'wood', label: 'Madera', emoji: '🪵', desc: 'Wood block' },
  { id: 'soft', label: 'Hi-hat', emoji: '🥁', desc: 'Suave' },
]

const SUBDIVISIONS: { value: Subdivision; symbol: string; mult: string }[] = [
  { value: 1, symbol: '♩', mult: '×1' },
  { value: 2, symbol: '♪', mult: '×2' },
  { value: 3, symbol: '♪', mult: '×3' },
  { value: 4, symbol: '♬', mult: '×4' },
]

export function Metronome({ songId, songTitle, initialBpm, onBpmChange, compact = false }: MetronomeProps) {
  const {
    isPlaying, bpm, setBpm, currentBeat, currentSubdivision, beatsPerMeasure, setBeatsPerMeasure,
    accentDownbeat, setAccentDownbeat, sound, setSound, volume, setVolume,
    subdivision, setSubdivision, playingSongId, start, stop, toggle,
  } = useMetronomeStore()

  // Local input state so typing isn't interrupted by store updates
  const [bpmInput, setBpmInput] = useState(String(initialBpm ?? bpm))

  const isThisSongPlaying = isPlaying && (!songId || playingSongId === songId)

  useEffect(() => {
    if (initialBpm !== undefined && !isPlaying) {
      setBpm(initialBpm)
      setBpmInput(String(initialBpm))
    }
  }, [initialBpm]) // eslint-disable-line

  function handleBpmChange(val: number) {
    const clamped = Math.min(240, Math.max(40, val))
    setBpm(clamped)
    setBpmInput(String(clamped))
    onBpmChange?.(clamped)
    if (isThisSongPlaying && songId) {
      start({ songId, songTitle, bpm: clamped })
    }
  }

  function handleBpmInput(raw: string) {
    setBpmInput(raw)
    const n = parseInt(raw)
    if (!isNaN(n) && n >= 40 && n <= 240) {
      setBpm(n)
      onBpmChange?.(n)
    }
  }

  function commitBpmInput() {
    const n = parseInt(bpmInput)
    const clamped = isNaN(n) ? bpm : Math.min(240, Math.max(40, n))
    setBpm(clamped)
    setBpmInput(String(clamped))
    onBpmChange?.(clamped)
  }

  function handleToggle() {
    toggle({ songId, songTitle, bpm })
  }

  if (compact) {
    return (
      <button
        onClick={handleToggle}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
        style={{
          background: isThisSongPlaying ? 'var(--green)' : 'var(--bg-elevated)',
          color: isThisSongPlaying ? '#000' : 'var(--text-secondary)',
          border: `1px solid ${isThisSongPlaying ? 'var(--green)' : 'var(--border)'}`,
        }}
      >
        {isThisSongPlaying ? <Square size={11} /> : <Play size={11} />}
        {bpm} BPM
      </button>
    )
  }

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
      {/* Header */}
      <div className="px-5 pt-5 pb-4" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Metrónomo</span>
          {isPlaying && playingSongId !== songId && (
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(16,185,129,0.15)', color: 'var(--green)' }}>
              ▶ Sonando
            </span>
          )}
        </div>

        {/* BPM + Play */}
        <div className="flex items-center gap-4">
          {/* Beat dots */}
          <div className="flex gap-1.5 flex-wrap" style={{ minWidth: 60 }}>
            {Array.from({ length: beatsPerMeasure }).map((_, i) => {
              const isActive = isThisSongPlaying && currentBeat === i
              const isSubActive = isThisSongPlaying && currentBeat === i && currentSubdivision > 0
              return (
                <div
                  key={i}
                  className="rounded-full transition-all duration-75"
                  style={{
                    width: i === 0 ? 14 : 10,
                    height: i === 0 ? 14 : 10,
                    background: isActive
                      ? (i === 0 ? 'var(--accent)' : isSubActive ? 'rgba(255,255,255,0.6)' : 'var(--text-primary)')
                      : 'var(--bg-elevated)',
                    boxShadow: isActive && i === 0 ? '0 0 10px var(--accent)' : 'none',
                    border: `2px solid ${i === 0 ? 'rgba(245,158,11,0.4)' : 'var(--border)'}`,
                    transform: isActive ? 'scale(1.15)' : 'scale(1)',
                  }}
                />
              )
            })}
          </div>

          {/* BPM Number */}
          <div className="flex-1 text-center">
            <div
              className="text-5xl font-black tabular-nums leading-none"
              style={{ color: isThisSongPlaying ? 'var(--accent)' : 'var(--text-primary)', textShadow: isThisSongPlaying ? '0 0 24px rgba(245,158,11,0.35)' : 'none' }}
            >
              {bpm}
            </div>
            <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>BPM</div>
          </div>

          {/* Play/Stop */}
          <button
            onClick={handleToggle}
            className="w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-200 flex-shrink-0"
            style={{
              background: isThisSongPlaying ? 'var(--red)' : 'var(--green)',
              boxShadow: isThisSongPlaying ? '0 0 20px rgba(239,68,68,0.4)' : '0 0 20px rgba(16,185,129,0.4)',
            }}
          >
            {isThisSongPlaying
              ? <Square size={20} color="#fff" />
              : <Play size={20} color="#fff" fill="white" />}
          </button>
        </div>
      </div>

      <div className="px-5 py-4 space-y-5">
        {/* BPM controls */}
        <div>
          <div className="flex justify-between text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
            <span>40</span><span>Tempo</span><span>240</span>
          </div>
          <input
            type="range" min={40} max={240} value={bpm}
            onChange={e => handleBpmChange(Number(e.target.value))}
            className="w-full"
          />
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={() => handleBpmChange(Math.max(40, bpm - 1))}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-lg font-bold transition-all"
              style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--border)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-elevated)'}
            >−</button>
            <input
              type="text" inputMode="numeric" value={bpmInput}
              onChange={e => handleBpmInput(e.target.value)}
              onBlur={commitBpmInput}
              onKeyDown={e => { if (e.key === 'Enter') commitBpmInput() }}
              className="flex-1 text-center font-bold text-lg rounded-xl outline-none py-1.5"
              style={{ background: 'var(--bg-elevated)', color: 'var(--accent)', border: '1px solid var(--border)' }}
            />
            <button
              onClick={() => handleBpmChange(Math.min(240, bpm + 1))}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-lg font-bold"
              style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--border)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-elevated)'}
            >+</button>
          </div>
          {/* BPM presets */}
          <div className="flex gap-1 mt-2 flex-wrap">
            {[60, 80, 100, 120, 140, 160, 180, 200].map(b => (
              <button
                key={b}
                onClick={() => handleBpmChange(b)}
                className="flex-1 py-1 rounded-lg text-xs transition-all"
                style={{
                  minWidth: 28,
                  background: bpm === b ? 'rgba(245,158,11,0.2)' : 'var(--bg-elevated)',
                  color: bpm === b ? 'var(--accent)' : 'var(--text-muted)',
                  border: `1px solid ${bpm === b ? 'rgba(245,158,11,0.4)' : 'transparent'}`,
                }}
              >{b}</button>
            ))}
          </div>
        </div>

        {/* Subdivisions */}
        <div>
          <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>Subdivisión</p>
          <div className="grid grid-cols-4 gap-1.5">
            {SUBDIVISIONS.map(s => (
              <button
                key={s.value}
                onClick={() => setSubdivision(s.value)}
                className="py-2 rounded-xl flex flex-col items-center gap-0.5 transition-all"
                style={{
                  background: subdivision === s.value ? 'rgba(245,158,11,0.12)' : 'var(--bg-elevated)',
                  border: `1px solid ${subdivision === s.value ? 'rgba(245,158,11,0.5)' : 'var(--border)'}`,
                  color: subdivision === s.value ? 'var(--accent)' : 'var(--text-muted)',
                }}
              >
                <span style={{ fontSize: 18, lineHeight: 1 }}>{s.symbol}</span>
                <span style={{ fontSize: 10, lineHeight: 1.4, fontWeight: 700 }}>{s.mult}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Sound selector */}
        <div>
          <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>Sonido del click</p>
          <div className="grid grid-cols-3 gap-2">
            {SOUNDS.map(s => (
              <button
                key={s.id}
                onClick={() => setSound(s.id)}
                className="py-3 rounded-xl flex flex-col items-center gap-1 transition-all"
                style={{
                  background: sound === s.id ? 'var(--bg-elevated)' : 'transparent',
                  border: `1px solid ${sound === s.id ? 'var(--border-bright)' : 'var(--border)'}`,
                  color: sound === s.id ? 'var(--text-primary)' : 'var(--text-muted)',
                }}
              >
                <span className="text-xl">{s.emoji}</span>
                <span className="text-xs font-medium">{s.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Row: Accent + Compás */}
        <div className="flex gap-3">
          <div className="flex-1 rounded-xl p-3" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between">
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Acento T.1</span>
              <button
                onClick={() => setAccentDownbeat(!accentDownbeat)}
                className="w-10 h-5 rounded-full transition-all duration-200 relative flex-shrink-0"
                style={{ background: accentDownbeat ? 'var(--accent)' : 'var(--border)' }}
              >
                <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all duration-200" style={{ left: accentDownbeat ? '22px' : '2px' }} />
              </button>
            </div>
          </div>
          <div className="flex-1 rounded-xl p-3" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
            <p className="text-xs mb-1.5" style={{ color: 'var(--text-secondary)' }}>Compás</p>
            <div className="flex gap-1">
              {[3, 4, 5, 6].map(n => (
                <button
                  key={n}
                  onClick={() => setBeatsPerMeasure(n)}
                  className="flex-1 py-1 rounded-lg text-xs font-bold transition-all"
                  style={{
                    background: beatsPerMeasure === n ? 'var(--accent)' : 'var(--border)',
                    color: beatsPerMeasure === n ? '#000' : 'var(--text-muted)',
                  }}
                >{n}/4</button>
              ))}
            </div>
          </div>
        </div>

        {/* Volume */}
        <div className="rounded-xl p-3" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Volume2 size={13} style={{ color: 'var(--green)' }} />
              <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Volumen</span>
            </div>
            <span className="text-xs font-bold" style={{ color: volume > 1 ? 'var(--green)' : 'var(--text-muted)' }}>
              {Math.round(volume * 100)}%{volume > 1 && ' 🔊'}
            </span>
          </div>
          <input
            type="range" min={0} max={4} step={0.05} value={volume}
            onChange={e => setVolume(Number(e.target.value))}
            className="w-full volume-slider"
          />
          <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
            Sube hasta 4× — para que el baterista escuche 🥁
          </p>
        </div>
      </div>
    </div>
  )
}

// Compact inline version for status bar / playlist
interface SongMetroConfig {
  songId: string
  songTitle: string
  bpm: number
  sound?: ClickSound
  volume?: number
  subdivision?: Subdivision
  beatsPerMeasure?: number
  accentDownbeat?: boolean
}

export function MetronomePlayButton(props: SongMetroConfig) {
  const { isPlaying, playingSongId, toggle } = useMetronomeStore()
  const isThisSongPlaying = isPlaying && playingSongId === props.songId

  function handleToggle() {
    toggle({
      songId:          props.songId,
      songTitle:       props.songTitle,
      bpm:             props.bpm,
      sound:           props.sound,
      volume:          props.volume,
      subdivision:     props.subdivision,
      beatsPerMeasure: props.beatsPerMeasure,
      accentDownbeat:  props.accentDownbeat,
    })
  }

  return (
    <button
      onClick={handleToggle}
      className="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-150 flex-shrink-0"
      style={{
        background: isThisSongPlaying ? 'var(--red)' : 'var(--green)',
        boxShadow: isThisSongPlaying ? '0 0 12px rgba(239,68,68,0.3)' : '0 0 12px rgba(16,185,129,0.3)',
      }}
    >
      {isThisSongPlaying
        ? <Square size={13} color="#fff" />
        : <Play size={13} color="#fff" fill="white" />}
    </button>
  )
}
