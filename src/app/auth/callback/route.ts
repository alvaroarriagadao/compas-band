import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Handles the email confirmation redirect from Supabase
export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const next = url.searchParams.get('next') ?? '/'

  if (code) {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    await supabase.auth.exchangeCodeForSession(code)
  }

  // Redirect to app — the client will pick up the session
  return NextResponse.redirect(new URL(next, url.origin))
}
