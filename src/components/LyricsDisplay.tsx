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
    const chordMatch = part.match(/^\[([^\]]+)\]$/)
    if (chordMatch) {
      // If we have a pending chord with no text yet, flush it
      if (pendingChord !== undefined) {
        segments.push({ chord: pendingChord, text: '' })
      }
      pendingChord = chordMatch[1]
    } else {
      segments.push({ chord: pendingChord, text: part })
      pendingChord = undefined
    }
  }

  // Trailing chord with no text
  if (pendingChord !== undefined) {
    segments.push({ chord: pendingChord, text: '' })
  }

  // Filter out empty segments with no chord
  return segments.filter(s => s.chord !== undefined || s.text.length > 0)
}

interface LyricsDisplayProps {
  lyrics: string
  chordColor?: string
  textColor?: string
  fontSize?: number // rem
}

export function LyricsDisplay({
  lyrics,
  chordColor = '#f59e0b',
  textColor,
  fontSize = 0.95,
}: LyricsDisplayProps) {
  if (!lyrics.trim()) {
    return (
      <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
        <p className="text-sm">No hay letra aún</p>
      </div>
    )
  }

  const lines = lyrics.split('\n')

  return (
    <div style={{ fontSize: `${fontSize}rem` }}>
      {lines.map((line, lineIdx) => {
        if (!line.trim()) {
          return <div key={lineIdx} style={{ height: `${fontSize * 1.4}rem` }} />
        }

        const segments = parseSegments(line)
        const hasChords = segments.some(s => s.chord)

        if (!hasChords) {
          return (
            <div key={lineIdx} style={{ lineHeight: 1.6, color: textColor || 'var(--text-primary)', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
              {line}
            </div>
          )
        }

        return (
          <div key={lineIdx} style={{ lineHeight: 1, marginBottom: `${fontSize * 0.55}rem`, display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            {segments.map((seg, i) => (
              <span
                key={i}
                style={{
                  display: 'inline-flex',
                  flexDirection: 'column',
                  verticalAlign: 'bottom',
                }}
              >
                {/* Chord row — always takes space for alignment */}
                <span
                  style={{
                    fontSize: `${fontSize * 0.72}rem`,
                    fontWeight: 800,
                    lineHeight: 1.3,
                    letterSpacing: '0.02em',
                    color: seg.chord ? chordColor : 'transparent',
                    fontFamily: 'monospace',
                    paddingRight: seg.chord ? '6px' : 0,
                    userSelect: 'none',
                    minWidth: seg.chord ? '1rem' : 0,
                  }}
                >
                  {seg.chord || '.'}
                </span>
                {/* Lyric text */}
                <span
                  style={{
                    fontFamily: 'monospace',
                    color: textColor || 'var(--text-primary)',
                    whiteSpace: 'pre',
                    lineHeight: 1.5,
                  }}
                >
                  {seg.text || (seg.chord ? ' ' : '')}
                </span>
              </span>
            ))}
          </div>
        )
      })}
    </div>
  )
}
