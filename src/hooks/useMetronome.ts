'use client'

import { useRef, useState, useCallback, useEffect } from 'react'

export type ClickSound = 'classic' | 'wood' | 'soft'

function createAudioContext() {
  if (typeof window === 'undefined') return null
  return new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
}

function playClick(ctx: AudioContext, time: number, isAccent: boolean, sound: ClickSound, volume: number) {
  const gainNode = ctx.createGain()
  gainNode.connect(ctx.destination)
  gainNode.gain.setValueAtTime(volume, time)

  if (sound === 'classic') {
    // Sharp sine click
    const osc = ctx.createOscillator()
    osc.connect(gainNode)
    const freq = isAccent ? 1800 : 1200
    osc.frequency.setValueAtTime(freq, time)
    osc.frequency.exponentialRampToValueAtTime(freq * 0.5, time + 0.03)
    gainNode.gain.setValueAtTime(volume, time)
    gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.04)
    osc.start(time)
    osc.stop(time + 0.04)
  } else if (sound === 'wood') {
    // Wood block style
    const osc = ctx.createOscillator()
    const osc2 = ctx.createOscillator()
    const g1 = ctx.createGain()
    const g2 = ctx.createGain()
    osc.connect(g1); g1.connect(gainNode)
    osc2.connect(g2); g2.connect(gainNode)
    const freq = isAccent ? 900 : 600
    osc.frequency.setValueAtTime(freq, time)
    osc2.frequency.setValueAtTime(freq * 1.5, time)
    g1.gain.setValueAtTime(volume * 0.8, time)
    g1.gain.exponentialRampToValueAtTime(0.001, time + 0.06)
    g2.gain.setValueAtTime(volume * 0.5, time)
    g2.gain.exponentialRampToValueAtTime(0.001, time + 0.04)
    osc.type = 'square'; osc2.type = 'square'
    osc.start(time); osc.stop(time + 0.06)
    osc2.start(time); osc2.stop(time + 0.04)
  } else {
    // Soft hi-hat noise burst
    const bufferSize = ctx.sampleRate * 0.04
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1
    const source = ctx.createBufferSource()
    source.buffer = buffer
    const filter = ctx.createBiquadFilter()
    filter.type = 'highpass'
    filter.frequency.value = isAccent ? 6000 : 8000
    source.connect(filter)
    filter.connect(gainNode)
    gainNode.gain.setValueAtTime(volume * (isAccent ? 1.2 : 0.8), time)
    gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.04)
    source.start(time)
    source.stop(time + 0.04)
  }
}

export function useMetronome() {
  const [isPlaying, setIsPlaying] = useState(false)
  const [bpm, setBpm] = useState(120)
  const [currentBeat, setCurrentBeat] = useState(0)
  const [beatsPerMeasure, setBeatsPerMeasure] = useState(4)
  const [accentDownbeat, setAccentDownbeat] = useState(true)
  const [sound, setSound] = useState<ClickSound>('classic')
  const [volume, setVolume] = useState(0.85)

  const audioCtxRef = useRef<AudioContext | null>(null)
  const schedulerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const nextBeatTimeRef = useRef(0)
  const currentBeatRef = useRef(0)
  const bpmRef = useRef(bpm)
  const volumeRef = useRef(volume)
  const soundRef = useRef(sound)
  const beatsPerMeasureRef = useRef(beatsPerMeasure)
  const accentRef = useRef(accentDownbeat)
  const isPlayingRef = useRef(false)

  useEffect(() => { bpmRef.current = bpm }, [bpm])
  useEffect(() => { volumeRef.current = volume }, [volume])
  useEffect(() => { soundRef.current = sound }, [sound])
  useEffect(() => { beatsPerMeasureRef.current = beatsPerMeasure }, [beatsPerMeasure])
  useEffect(() => { accentRef.current = accentDownbeat }, [accentDownbeat])

  const scheduleBeats = useCallback(() => {
    if (!audioCtxRef.current || !isPlayingRef.current) return

    const lookAhead = 0.1
    const scheduleAhead = 0.05

    while (nextBeatTimeRef.current < audioCtxRef.current.currentTime + lookAhead) {
      const beat = currentBeatRef.current % beatsPerMeasureRef.current
      const isAccent = accentRef.current && beat === 0
      playClick(audioCtxRef.current, nextBeatTimeRef.current, isAccent, soundRef.current, volumeRef.current)

      const delay = (nextBeatTimeRef.current - audioCtxRef.current.currentTime) * 1000
      setTimeout(() => {
        if (isPlayingRef.current) setCurrentBeat(beat)
      }, Math.max(0, delay))

      nextBeatTimeRef.current += 60 / bpmRef.current
      currentBeatRef.current++
    }

    schedulerRef.current = setTimeout(scheduleBeats, scheduleAhead * 1000)
  }, [])

  const start = useCallback((startBpm?: number) => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = createAudioContext()
    }
    if (!audioCtxRef.current) return

    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume()
    }

    if (startBpm !== undefined) {
      setBpm(startBpm)
      bpmRef.current = startBpm
    }

    isPlayingRef.current = true
    currentBeatRef.current = 0
    nextBeatTimeRef.current = audioCtxRef.current.currentTime + 0.05
    setIsPlaying(true)
    setCurrentBeat(0)
    scheduleBeats()
  }, [scheduleBeats])

  const stop = useCallback(() => {
    isPlayingRef.current = false
    setIsPlaying(false)
    setCurrentBeat(0)
    if (schedulerRef.current) clearTimeout(schedulerRef.current)
  }, [])

  const toggle = useCallback((startBpm?: number) => {
    if (isPlayingRef.current) stop()
    else start(startBpm)
  }, [start, stop])

  return {
    isPlaying, bpm, setBpm, currentBeat, beatsPerMeasure, setBeatsPerMeasure,
    accentDownbeat, setAccentDownbeat, sound, setSound, volume, setVolume,
    start, stop, toggle
  }
}
