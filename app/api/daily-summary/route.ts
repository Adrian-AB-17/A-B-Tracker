import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

const supabaseAdmin = createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: member } = await supabase
    .from('team_members')
    .select('id, name, role, auth_user_id')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (!member) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const type = new URL(req.url).searchParams.get('type') || 'morning'
  const today = new Date().toISOString().slice(0, 10)
  const todayStart = today + 'T00:00:00.000Z'
  const todayEnd = today + 'T23:59:59.999Z'
  const isAdmin = member.role === 'admin' || member.role === 'owner'

  if (type === 'morning') {
    const { data: wos } = await supabaseAdmin
      .from('work_orders')
      .select('id, title, stage, due_date, priority, clients!work_orders_client_id_fkey(name), team_members!work_orders_owner_id_fkey(name, auth_user_id), wo_assignees(team_members(name, auth_user_id))')
      .not('stage', 'in', '(archived,paid,invoiced)')
      .order('due_date', { ascending: true })

    const filtered = isAdmin ? (wos || []) : (wos || []).filter((w: any) =>
      w.team_members?.auth_user_id === user.id ||
      (w.wo_assignees || []).some((a: any) => a.team_members?.auth_user_id === user.id)
    )

    const EXCLUDE_OVERDUE = ['approved', 'sent-for-approval', 'revisions-received', 'paid', 'invoiced', 'archived']
    const overdueApproved = filtered.filter((w: any) => w.due_date && w.due_date < today && !EXCLUDE_OVERDUE.includes(w.stage))
    const dueToday = filtered.filter((w: any) => w.due_date === today)

    const { data: tasks } = await supabaseAdmin
      .from('wo_tasks')
      .select('id, title, status, due_date, work_order_id, work_orders!wo_tasks_work_order_id_fkey(title, clients!work_orders_client_id_fkey(name))')
      .not('status', 'eq', 'done')
      .lte('due_date', today)
      .order('due_date', { ascending: true })
      .limit(50)

    return NextResponse.json({
      type: 'morning', date: today, member: member.name,
      overdueApproved: overdueApproved.map((w: any) => ({ id: w.id, title: w.title, client: w.clients?.name, due: w.due_date, owner: w.team_members?.name, stage: w.stage })),
      dueToday: dueToday.map((w: any) => ({ id: w.id, title: w.title, client: w.clients?.name, due: w.due_date, owner: w.team_members?.name, stage: w.stage })),
      tasksDue: (tasks || []).map((t: any) => ({ id: t.id, title: t.title, due: t.due_date, woTitle: (t.work_orders as any)?.title, client: (t.work_orders as any)?.clients?.name })),
    })
  }

  const { data: stageChanges } = await supabaseAdmin
    .from('wo_stage_history')
    .select('work_order_id, to_stage, changed_at, work_orders!wo_stage_history_work_order_id_fkey(title, clients!work_orders_client_id_fkey(name))')
    .in('to_stage', ['deliverables-completed', 'deliverables-executed', 'approved', 'sent-for-approval', 'invoiced', 'paid'])
    .gte('changed_at', todayStart).lte('changed_at', todayEnd)
    .order('changed_at', { ascending: false })

  const { data: doneTasks } = await supabaseAdmin
    .from('wo_tasks')
    .select('id, title, updated_at, work_orders!wo_tasks_work_order_id_fkey(title, clients!work_orders_client_id_fkey(name))')
    .eq('status', 'done')
    .gte('updated_at', todayStart).lte('updated_at', todayEnd)
    .order('updated_at', { ascending: false }).limit(30)

  return NextResponse.json({
    type: 'eod', date: today, member: member.name,
    stageChanges: (stageChanges || []).map((h: any) => ({ woTitle: (h.work_orders as any)?.title, client: (h.work_orders as any)?.clients?.name, toStage: h.to_stage, at: h.changed_at })),
    doneTasks: (doneTasks || []).map((t: any) => ({ title: t.title, woTitle: (t.work_orders as any)?.title, client: (t.work_orders as any)?.clients?.name })),
  })
}
