import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '22%',
        }}
      >
        <svg width="108" height="108" viewBox="0 0 24 24" fill="#000000">
          <path d="M9 3v11.55A4 4 0 1 0 11 18V7h6V3H9z" />
        </svg>
      </div>
    ),
    { width: 192, height: 192 }
  )
}
