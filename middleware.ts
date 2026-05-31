import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options))
        }
      }
    }
  )

  // Refresh session and get the user.
  const { data: { user } } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname
  const onDashboard = path === '/dashboard' || path.startsWith('/dashboard/')
  const onPortal = path === '/portal' || path.startsWith('/portal/')

  if (user && (onDashboard || onPortal)) {
    // Cookie flag set at login keeps this a zero-DB check on the hot path.
    let flag = request.cookies.get('ab-portal')?.value
    if (flag !== '1' && flag !== '0') {
      // Unknown — resolve once and cache on the response.
      const { data: pu } = await supabase
        .from('portal_users').select('active').eq('auth_user_id', user.id).maybeSingle()
      flag = pu && pu.active !== false ? '1' : '0'
      response.cookies.set('ab-portal', flag, { path: '/', sameSite: 'lax' })
    }
    const isPortalUser = flag === '1'
    if (isPortalUser && onDashboard) {
      return NextResponse.redirect(new URL('/portal', request.url))
    }
    if (!isPortalUser && onPortal) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)']
}
