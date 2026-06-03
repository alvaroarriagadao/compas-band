'use client'

import { useState, useEffect } from 'react'
import { Play, Square, Volume2 } from 'lucide-react'
import { useMetronome, type ClickSound } from '@/hooks/useMetronome'

interface MetronomeProps {
  initialBpm?: number
  onBpmChange?: (bpm: number) => void
  compact?: boolean
}

export function Metronome({ initialBpm = 120, onBpmChange, compact = false }: MetronomeProps) {
  const metro = useMetronome()

  useEffect(() => {
    metro.setBpm(initialBpm)
  }, [initialBpm]) // eslint-disable-line

  const handleBpmChange = (val: number) => {
    metro.setBpm(val)
    onBpmChange?.(val)
  }

  const sounds: { id: ClickSound; label: string; emoji: string }[] = [
    { id: 'classic', label: 'Click', emoji: '🎯' },
    { id: 'wood', label: 'Madera', emoji: '🪵' },
    { id: 'soft', label: 'Hi-hat', emoji: '🥁' },
  ]

  if (compact) {
    return (
      <button
        onClick={() => metro.toggle(metro.bpm)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
        style={{
          background: metro.isPlaying ? 'var(--green)' : 'var(--bg-elevated)',
          color: metro.isPlaying ? '#000' : 'var(--text-secondary)',
          border: `1px solid ${metro.isPlaying ? 'var(--green)' : 'var(--border)'}`,
        }}
      >
        {metro.isPlaying ? <Square size={11} /> : <Play size={11} />}
        {metro.bpm} BPM
      </button>
    )
  }

  return (
    <div className="rounded-2xl p-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-bold" style={{ color: 'var(--text-primary)' }}>Metrónomo</h3>
        <span className="text-xs px-2 py-1 rounded-lg" style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>
          Web Audio
        </span>
      </div>

      {/* BPM Display + Play */}
      <div className="flex items-center justify-between mb-6">
        <div className="text-center">
          <div
            className="text-6xl font-black tabular-nums transition-all duration-100"
            style={{
              color: metro.isPlaying ? 'var(--accent)' : 'var(--text-primary)',
              textShadow: metro.isPlaying ? '0 0 30px rgba(245,158,11,0.4)' : 'none',
            }}
          >
            {metro.bpm}
          </div>
          <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>BPM</div>
        </div>

        {/* Beat indicators */}
        <div className="flex gap-2">
          {Array.from({ length: metro.beatsPerMeasure }).map((_, i) => (
            <div
              key={i}
              className="rounded-full transition-all duration-75"
              style={{
                width: i === 0 ? 16 : 12,
                height: i === 0 ? 16 : 12,
                background: metro.isPlaying && metro.currentBeat === i
                  ? (i === 0 ? 'var(--accent)' : 'var(--text-primary)')
                  : 'var(--bg-elevated)',
                boxShadow: metro.isPlaying && metro.currentBeat === i && i === 0
                  ? '0 0 12px var(--accent)' : 'none',
                border: `2px solid ${i === 0 ? 'var(--accent-dim)' : 'var(--border)'}`,
              }}
            />
          ))}
        </div>

        {/* Play button */}
        <button
          onClick={() => metro.toggle()}
          className="w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-200 font-bold"
          style={{
            background: metro.isPlaying ? 'var(--red)' : 'var(--green)',
            boxShadow: metro.isPlaying
              ? '0 0 24px rgba(239,68,68,0.4)'
              : '0 0 24px rgba(16,185,129,0.4)',
            color: '#fff',
          }}
        >
          {metro.isPlaying ? <Square size={22} /> : <Play size={22} fill="white" />}
        </button>
      </div>

      {/* BPM Slider */}
      <div className="mb-5">
        <div className="flex justify-between text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
          <span>40</span>
          <span style={{ color: 'var(--text-secondary)' }}>Tempo</span>
          <span>240</span>
        </div>
        <input
          type="range"
          min={40}
          max={240}
          value={metro.bpm}
          onChange={e => handleBpmChange(Number(e.target.value))}
          className="w-full"
        />
        <div className="flex justify-between mt-2 gap-1.5">
          {[60, 80, 100, 120, 140, 160, 180].map(b => (
            <button
              key={b}
              onClick={() => handleBpmChange(b)}
              className="flex-1 py-1 rounded-lg text-xs transition-all"
              style={{
                background: metro.bpm === b ? 'var(--accent-dim)' : 'var(--bg-elevated)',
                color: metro.bpm === b ? 'var(--accent)' : 'var(--text-muted)',
                border: `1px solid ${metro.bpm === b ? 'var(--accent-dim)' : 'transparent'}`,
              }}
            >
              {b}
            </button>
          ))}
        </div>
      </div>

      {/* BPM manual input */}
      <div className="flex gap-2 mb-5">
        <button
          onClick={() => handleBpmChange(Math.max(40, metro.bpm - 1))}
          className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold transition-colors"
          style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}
        >−</button>
        <input
          type="number"
          min={40}
          max={240}
          value={metro.bpm}
          onChange={e => handleBpmChange(Math.min(240, Math.max(40, Number(e.target.value))))}
          className="flex-1 text-center font-bold text-lg rounded-xl outline-none"
          style={{ background: 'var(--bg-elevated)', color: 'var(--accent)', border: '1px solid var(--border)' }}
        />
        <button
          onClick={() => handleBpmChange(Math.min(240, metro.bpm + 1))}
          className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold"
          style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}
        >+</button>
      </div>

      {/* Sound selector */}
      <div className="mb-5">
        <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>Sonido del click</p>
        <div className="grid grid-cols-3 gap-2">
          {sounds.map(s => (
            <button
              key={s.id}
              onClick={() => metro.setSound(s.id)}
              className="py-2.5 rounded-xl text-sm transition-all"
              style={{
                background: metro.sound === s.id ? 'var(--bg-elevated)' : 'transparent',
                border: `1px solid ${metro.sound === s.id ? 'var(--border-bright)' : 'var(--border)'}`,
                color: metro.sound === s.id ? 'var(--text-primary)' : 'var(--text-muted)',
              }}
            >
              <span className="block text-lg mb-0.5">{s.emoji}</span>
              <span className="text-xs">{s.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Accent toggle */}
      <div className="flex items-center justify-between mb-5 px-1">
        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Acentuar tiempo 1</span>
        <button
          onClick={() => metro.setAccentDownbeat(!metro.accentDownbeat)}
          className="w-12 h-6 rounded-full transition-all duration-200 relative"
          style={{ background: metro.accentDownbeat ? 'var(--accent)' : 'var(--bg-elevated)' }}
        >
          <div
            className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all duration-200"
            style={{ left: metro.accentDownbeat ? '26px' : '2px' }}
          />
        </button>
      </div>

      {/* Beats per measure */}
      <div className="flex items-center justify-between mb-5 px-1">
        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Compás</span>
        <div className="flex gap-1.5">
          {[2, 3, 4, 5, 6].map(n => (
            <button
              key={n}
              onClick={() => metro.setBeatsPerMeasure(n)}
              className="w-8 h-8 rounded-lg text-sm font-bold transition-all"
              style={{
                background: metro.beatsPerMeasure === n ? 'var(--accent)' : 'var(--bg-elevated)',
                color: metro.beatsPerMeasure === n ? '#000' : 'var(--text-muted)',
              }}
            >{n}/4</button>
          ))}
        </div>
      </div>

      {/* Volume */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Volume2 size={14} style={{ color: 'var(--text-muted)' }} />
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Volumen — {Math.round(metro.volume * 100)}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={3}
          step={0.05}
          value={metro.volume}
          onChange={e => metro.setVolume(Number(e.target.value))}
          className="w-full volume-slider"
        />
        <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
          💡 Sube hasta 3× para el baterista
        </p>
      </div>
    </div>
  )
}
