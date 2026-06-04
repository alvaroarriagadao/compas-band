'use client'

interface Segment {
  chord?: string
  text: string
}

function parseSegments(line: string): Segment[] {
  if (!line.includes('[')) return [{ text: line }]
  const segments: Segment[] = []
  const parts = line.split(/(\[[^\]]+\])/)
  let pendingChord: string | undefined

  for (const part of parts) {
    const m = part.match(/^\[([^\]]+)\]$/)
    if (m) {
      if (pendingChord !== undefined) segments.push({ chord: pendingChord, text: '' })
      pendingChord = m[1]
    } else {
      segments.push({ chord: pendingChord, text: part })
      pendingChord = undefined
    }
  }
  if (pendingChord !== undefined) segments.push({ chord: pendingChord, text: '' })
  return segments.filter(s => s.chord !== undefined || s.text !== '')
}

/** True when the line has ONLY chord markers + spaces/nothing */
function isChordOnlyLine(line: string): boolean {
  return line.trim() !== '' && line.replace(/\[[^\]]+\]/g, '').trim() === ''
}

interface LyricsDisplayProps {
  lyrics: string
  chordColor?: string
  textColor?: string
  /** Base font size in rem (default 0.95) */
  fontSize?: number
  /** Chord font size relative to base (0.5 – 1.2, default 0.82) */
  chordScale?: number
}

export function LyricsDisplay({
  lyrics,
  chordColor = '#f59e0b',
  textColor,
  fontSize = 0.95,
  chordScale = 0.82,
}: LyricsDisplayProps) {
  if (!lyrics.trim()) {
    return (
      <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
        <p className="text-sm">No hay letra aún</p>
      </div>
    )
  }

  const chordFontSize = `${fontSize * chordScale}rem`
  const textFontSize = `${fontSize}rem`

  return (
    <div style={{ fontSize: textFontSize, fontFamily: 'monospace' }}>
      {lyrics.split('\n').map((line, lineIdx) => {
        // Empty line → small gap
        if (!line.trim()) {
          return <div key={lineIdx} style={{ height: `${fontSize * 0.9}rem` }} />
        }

        const hasChords = line.includes('[')

        // ── Pure chord line: [E]     [G]     [A]  ──────────────
        if (hasChords && isChordOnlyLine(line)) {
          const parts = line.split(/(\[[^\]]+\])/)
          return (
            <div
              key={lineIdx}
              style={{
                lineHeight: 1.5,
                whiteSpace: 'pre',
                marginBottom: 0,
                color: chordColor,
                fontWeight: 800,
                fontSize: chordFontSize,
              }}
            >
              {parts.map((p, i) => {
                const m = p.match(/^\[([^\]]+)\]$/)
                return m
                  ? <span key={i}>{m[1]}</span>
                  : <span key={i}>{p}</span>
              })}
            </div>
          )
        }

        // ── Mixed line: [Am]Hola [G]mundo  ──────────────────────
        if (hasChords) {
          const segments = parseSegments(line)
          return (
            <div
              key={lineIdx}
              style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: `${fontSize * 0.1}rem` }}
            >
              {segments.map((seg, i) => (
                <span
                  key={i}
                  style={{ display: 'inline-flex', flexDirection: 'column' }}
                >
                  <span
                    style={{
                      fontSize: chordFontSize,
                      fontWeight: 800,
                      lineHeight: 1.3,
                      color: seg.chord ? chordColor : 'transparent',
                      whiteSpace: 'pre',
                      letterSpacing: '0.01em',
                    }}
                  >
                    {seg.chord ?? '.'}
                  </span>
                  <span
                    style={{
                      fontSize: textFontSize,
                      lineHeight: 1.45,
                      whiteSpace: 'pre',
                      color: textColor || 'var(--text-primary)',
                    }}
                  >
                    {seg.text || (seg.chord !== undefined ? ' ' : '')}
                  </span>
                </span>
              ))}
            </div>
          )
        }

        // ── Plain lyric line ─────────────────────────────────────
        return (
          <div
            key={lineIdx}
            style={{
              lineHeight: 1.55,
              whiteSpace: 'pre-wrap',
              color: textColor || 'var(--text-primary)',
            }}
          >
            {line}
          </div>
        )
      })}
    </div>
  )
}
