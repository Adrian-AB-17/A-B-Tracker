import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { data: member } = await supabase
    .from('team_members')
    .select('id, role, active')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (!member?.active || (member.role !== 'admin' && member.role !== 'owner')) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  const body = await req.json()
  const { title, client_id, notes, priority = 'medium' } = body

  if (!title || !client_id) {
    return NextResponse.json({ error: 'title and client_id required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('work_orders')
    .insert({
      title,
      client_id,
      owner_id: member.id,
      stage: 'not-started',
      priority,
      occurrence: 'One-time',
      notes: notes || '',
      submitted_at: new Date().toISOString(),
    })
    .select('id, title')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true, wo: data })
}
