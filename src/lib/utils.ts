import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function parseLyricsWithChords(text: string): { chord?: string; word: string }[][] {
  return text.split('\n').map((line) => {
    const parts: { chord?: string; word: string }[] = []
    const regex = /\[([^\]]+)\]([^\[]*)/g
    let lastIndex = 0
    let match

    const leadingText = line.replace(/\[([^\]]+)\][\s\S]*/, '')
    if (leadingText && !line.startsWith('[')) {
      const preMatch = line.match(/^([^\[]+)/)
      if (preMatch) {
        parts.push({ word: preMatch[1] })
        lastIndex = preMatch[1].length
      }
    }

    const lineFromStart = line.substring(lastIndex)
    const regex2 = /\[([^\]]+)\]([^\[]*)/g
    while ((match = regex2.exec(lineFromStart)) !== null) {
      parts.push({ chord: match[1], word: match[2] })
    }

    if (parts.length === 0) {
      parts.push({ word: line })
    }

    return parts
  })
}
