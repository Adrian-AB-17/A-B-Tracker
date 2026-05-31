import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const response = NextResponse.redirect(new URL('/login', request.url), {
    status: 303,
  })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const projectRef =
    supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] || 'default'
  const cookieName = `sb-${projectRef}-auth-token`

  // Must match the attributes login set (path:'/', secure, sameSite:'lax')
  // or the browser keeps the old cookie. Cover chunked variants too.
  for (const name of [cookieName, `${cookieName}.0`, `${cookieName}.1`]) {
    response.cookies.set(name, '', {
      path: '/',
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
    })
  }

  return response
}
