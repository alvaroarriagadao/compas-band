'use client'

interface LyricsDisplayProps {
  lyrics: string
}

export function LyricsDisplay({ lyrics }: LyricsDisplayProps) {
  if (!lyrics.trim()) {
    return (
      <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
        <p className="text-sm">No hay letra aún</p>
      </div>
    )
  }

  const lines = lyrics.split('\n')

  return (
    <div className="space-y-0.5 font-mono text-sm leading-relaxed select-text">
      {lines.map((line, lineIdx) => {
        if (!line.trim()) {
          return <div key={lineIdx} className="h-4" />
        }

        // Parse [Chord]word format
        const parts: { chord?: string; text: string }[] = []
        const regex = /\[([^\]]+)\]([^\[]*)/g
        let lastIndex = 0
        let match

        // Check for text before first chord
        const firstBracket = line.indexOf('[')
        if (firstBracket > 0) {
          parts.push({ text: line.substring(0, firstBracket) })
          lastIndex = firstBracket
        } else if (firstBracket === -1) {
          // No chords on this line
          return (
            <div key={lineIdx} className="leading-6" style={{ color: 'var(--text-primary)' }}>
              {line}
            </div>
          )
        }

        const lineFrom = line.substring(lastIndex)
        while ((match = regex.exec(lineFrom)) !== null) {
          parts.push({ chord: match[1], text: match[2] })
        }

        if (parts.length === 0) {
          return (
            <div key={lineIdx} style={{ color: 'var(--text-primary)' }}>{line}</div>
          )
        }

        return (
          <div key={lineIdx} className="flex flex-wrap items-end leading-none mb-2">
            {parts.map((part, i) => (
              <span key={i} className="inline-flex flex-col" style={{ marginRight: part.text.endsWith(' ') || part.text === '' ? 0 : undefined }}>
                {part.chord ? (
                  <span
                    className="text-xs font-bold px-1 py-0.5 rounded mb-0.5 leading-none"
                    style={{
                      color: 'var(--chord-color)',
                      background: 'var(--chord-bg)',
                      minWidth: '1.5rem',
                      display: 'inline-block',
                    }}
                  >
                    {part.chord}
                  </span>
                ) : (
                  <span className="text-xs mb-0.5 leading-none" style={{ minWidth: '0.5rem', display: 'inline-block' }}>&nbsp;</span>
                )}
                <span style={{ color: 'var(--text-primary)' }}>{part.text || ' '}</span>
              </span>
            ))}
          </div>
        )
      })}
    </div>
  )
}
