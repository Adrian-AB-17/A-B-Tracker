import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const email = String(formData.get('email') || '').toLowerCase().trim()
  const password = String(formData.get('password') || '')

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  )

  const { error, data } = await supabase.auth.signInWithPassword({ email, password })

  console.log('LOGIN ATTEMPT v2:', {
    email,
    success: !error,
    hasSession: !!data?.session,
    hasAccessToken: !!data?.session?.access_token,
    error: error?.message,
  })

  if (error || !data.session) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error?.message || 'No session')}`, request.url),
      { status: 303 }
    )
  }

  const response = NextResponse.redirect(new URL('/dashboard', request.url), {
    status: 303,
  })

  // Extract project ref from Supabase URL for cookie naming
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] || 'default'
  const cookieName = `sb-${projectRef}-auth-token`

  // Manually serialize the session as Supabase expects
  const sessionPayload = JSON.stringify({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_at: data.session.expires_at,
    expires_in: data.session.expires_in,
    token_type: data.session.token_type,
    user: data.session.user,
  })

  // Set the auth cookie manually
  response.cookies.set(cookieName, sessionPayload, {
    path: '/',
    httpOnly: false,
    secure: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  })

  console.log('COOKIE SET:', { cookieName, size: sessionPayload.length })

  return response
}