'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function loginAction(formData: FormData) {
  const email = String(formData.get('email') || '').toLowerCase().trim()
  const password = String(formData.get('password') || '')

  const supabase = createClient()

  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    return { error: error.message }
  }

  redirect('/dashboard')
}