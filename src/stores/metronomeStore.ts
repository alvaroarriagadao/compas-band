'use client'

import { create } from 'zustand'

export type ClickSound = 'classic' | 'wood' | 'soft'
export type Subdivision = 1 | 2 | 3 | 4

// Module-level audio state (not serializable, lives outside React)
let audioCtx: AudioContext | null = null
let schedulerTimer: ReturnType<typeof setTimeout> | null = null
let nextBeatTime = 0
let rawBeatCounter = 0

function getAudioCtx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
  }
  if (audioCtx.state === 'suspended') audioCtx.resume()
  return audioCtx
}

function playClick(
  ctx: AudioContext,
  time: number,
  isAccent: boolean,
  isSubBeat: boolean,
  sound: ClickSound,
  volume: number
) {
  const vol = isSubBeat ? volume * 0.38 : volume
  const gainNode = ctx.createGain()
  gainNode.connect(ctx.destination)
  gainNode.gain.setValueAtTime(vol, time)

  if (sound === 'classic') {
    const osc = ctx.createOscillator()
    osc.connect(gainNode)
    const freq = isAccent ? 1800 : isSubBeat ? 900 : 1200
    osc.frequency.setValueAtTime(freq, time)
    osc.frequency.exponentialRampToValueAtTime(freq * 0.5, time + 0.025)
    gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.035)
    osc.start(time)
    osc.stop(time + 0.035)
  } else if (sound === 'wood') {
    const osc = ctx.createOscillator()
    const osc2 = ctx.createOscillator()
    const g1 = ctx.createGain()
    const g2 = ctx.createGain()
    osc.connect(g1); g1.connect(gainNode)
    osc2.connect(g2); g2.connect(gainNode)
    const freq = isAccent ? 900 : isSubBeat ? 400 : 600
    osc.frequency.setValueAtTime(freq, time)
    osc2.frequency.setValueAtTime(freq * 1.5, time)
    osc.type = 'square'; osc2.type = 'square'
    g1.gain.setValueAtTime(vol * 0.8, time)
    g1.gain.exponentialRampToValueAtTime(0.001, time + 0.055)
    g2.gain.setValueAtTime(vol * 0.5, time)
    g2.gain.exponentialRampToValueAtTime(0.001, time + 0.04)
    osc.start(time); osc.stop(time + 0.055)
    osc2.start(time); osc2.stop(time + 0.04)
  } else {
    const bufferSize = Math.floor(ctx.sampleRate * 0.04)
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1
    const source = ctx.createBufferSource()
    source.buffer = buffer
    const filter = ctx.createBiquadFilter()
    filter.type = 'highpass'
    filter.frequency.value = isAccent ? 5000 : isSubBeat ? 9000 : 7000
    source.connect(filter); filter.connect(gainNode)
    gainNode.gain.setValueAtTime(vol * (isAccent ? 1.1 : 0.85), time)
    gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.04)
    source.start(time); source.stop(time + 0.04)
  }
}

interface MetronomeState {
  isPlaying: boolean
  bpm: number
  sound: ClickSound
  volume: number
  subdivision: Subdivision
  currentBeat: number        // 0..beatsPerMeasure-1
  currentSubdivision: number // 0..subdivision-1
  beatsPerMeasure: number
  accentDownbeat: boolean
  playingSongId: string | null
  playingSongTitle: string | null

  setBpm: (bpm: number) => void
  setSound: (sound: ClickSound) => void
  setVolume: (volume: number) => void
  setSubdivision: (sub: Subdivision) => void
  setBeatsPerMeasure: (n: number) => void
  setAccentDownbeat: (v: boolean) => void
  start: (opts?: { songId?: string; songTitle?: string; bpm?: number }) => void
  stop: () => void
  toggle: (opts?: { songId?: string; songTitle?: string; bpm?: number }) => void
}

export const useMetronomeStore = create<MetronomeState>((set, get) => {
  function schedule() {
    const ctx = audioCtx
    if (!ctx || !get().isPlaying) return

    const { bpm, sound, volume, subdivision, beatsPerMeasure, accentDownbeat } = get()
    const lookAhead = 0.12
    const intervalPerSubdiv = 60 / bpm / subdivision

    while (nextBeatTime < ctx.currentTime + lookAhead) {
      const totalSubBeat = rawBeatCounter
      const mainBeat = Math.floor(totalSubBeat / subdivision) % beatsPerMeasure
      const subBeat = totalSubBeat % subdivision
      const isMainBeat = subBeat === 0
      const isAccent = isMainBeat && mainBeat === 0 && accentDownbeat

      playClick(ctx, nextBeatTime, isAccent, !isMainBeat, sound, volume)

      const delay = Math.max(0, (nextBeatTime - ctx.currentTime) * 1000)
      const capturedMain = mainBeat
      const capturedSub = subBeat
      setTimeout(() => {
        if (get().isPlaying) {
          set({ currentBeat: capturedMain, currentSubdivision: capturedSub })
        }
      }, delay)

      nextBeatTime += intervalPerSubdiv
      rawBeatCounter++
    }

    schedulerTimer = setTimeout(schedule, 40)
  }

  return {
    isPlaying: false,
    bpm: 120,
    sound: 'classic',
    volume: 1.0,
    subdivision: 1,
    currentBeat: 0,
    currentSubdivision: 0,
    beatsPerMeasure: 4,
    accentDownbeat: true,
    playingSongId: null,
    playingSongTitle: null,

    setBpm: (bpm) => set({ bpm }),
    setSound: (sound) => set({ sound }),
    setVolume: (volume) => set({ volume }),
    setSubdivision: (subdivision) => set({ subdivision }),
    setBeatsPerMeasure: (beatsPerMeasure) => set({ beatsPerMeasure }),
    setAccentDownbeat: (accentDownbeat) => set({ accentDownbeat }),

    start: (opts) => {
      const ctx = getAudioCtx()
      if (schedulerTimer) clearTimeout(schedulerTimer)

      const newBpm = opts?.bpm ?? get().bpm
      rawBeatCounter = 0
      nextBeatTime = ctx.currentTime + 0.05

      set({
        isPlaying: true,
        bpm: newBpm,
        currentBeat: 0,
        currentSubdivision: 0,
        playingSongId: opts?.songId ?? null,
        playingSongTitle: opts?.songTitle ?? null,
      })

      // Use rAF-friendly scheduler
      setTimeout(schedule, 0)
    },

    stop: () => {
      if (schedulerTimer) { clearTimeout(schedulerTimer); schedulerTimer = null }
      set({ isPlaying: false, currentBeat: 0, currentSubdivision: 0, playingSongId: null, playingSongTitle: null })
    },

    toggle: (opts) => {
      const { isPlaying, playingSongId, start, stop } = get()
      // If same song is playing → stop. Otherwise start with new song.
      if (isPlaying && (!opts?.songId || opts.songId === playingSongId)) {
        stop()
      } else {
        start(opts)
      }
    },
  }
})
