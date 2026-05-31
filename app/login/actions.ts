'use server'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export async function loginAction(formData: FormData) {
  const email = String(formData.get('email') || '').toLowerCase().trim()
  const password = String(formData.get('password') || '')

  const cookieStore = cookies()
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        },
      },
    }
  )

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  
  if (error) {
    return { error: error.message }
  }

  // Portal users land on /portal; team on /dashboard.
  let dest = '/dashboard'
  if (data?.user) {
    const { data: pu } = await supabase
      .from('portal_users').select('active').eq('auth_user_id', data.user.id).maybeSingle()
    if (pu && pu.active !== false) dest = '/portal'
  }
  redirect(dest)
}