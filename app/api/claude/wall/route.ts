import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

const supabaseAdmin = createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const PANCHO_AUTHOR_ID = 'a0000000-0000-0000-0000-000000000001'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { message, channel, parent_id, thread_posts } = await req.json()

  const { data: member } = await supabaseAdmin
    .from('team_members')
    .select('id, name, role')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })

  const level = member.role === 'owner' ? 'owner' : member.role === 'admin' ? 'admin' : 'team'

  const { data: wos } = await supabaseAdmin
    .from('work_orders')
    .select(`id, title, stage, client_id, due_date, priority,
             clients!work_orders_client_id_fkey(name),
             services!work_orders_service_id_fkey(name),
             team_members!work_orders_owner_id_fkey(name, auth_user_id),
             wo_assignees(team_members(name, auth_user_id))`)
    .not('stage', 'in', '(archived,paid)')
    .order('created_at', { ascending: false })
    .limit(300)

  const filteredWos = level === 'team'
    ? (wos || []).filter((w: any) =>
        w.team_members?.auth_user_id === user.id ||
        (w.wo_assignees || []).some((a: any) => a.team_members?.auth_user_id === user.id)
      )
    : (wos || [])

  const woList = filteredWos.slice(0, 150).map((w: any) => {
    const assignees = (w.wo_assignees || []).map((a: any) => a.team_members?.name).filter(Boolean).join(', ')
    return `- [${w.stage}] ${w.title} | Client: ${w.clients?.name || '?'} | Due: ${w.due_date || 'none'} | Owner: ${w.team_members?.name || 'unassigned'}${assignees ? ' | Assignees: ' + assignees : ''}`
  }).join('\n')

  const threadContext = (thread_posts || []).length > 0
    ? '\n\nTHREAD CONTEXT:\n' + (thread_posts as any[]).map((p: any) => `${p.author}: ${p.body}`).join('\n')
    : ''

  const now = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  const systemPrompt = `You are Pancho, the A&B Consulting Group internal AI assistant living in the team's HQ wall — like Claude in Slack. You are helpful, concise, and friendly. You know the team and their work well.

Today is ${now}. You are talking with ${member.name} (${level} level).

ACTIVE WORK ORDERS:
${woList}

RULES:
- Keep replies short and conversational — this is a team chat, not a report
- Never share financial/cost data with team-level users  
- Answer questions about WOs, clients, status, and team operations
- Be direct and actionable
- Channel context: ${channel}${threadContext}`

  const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 600,
      system: systemPrompt,
      messages: [{ role: 'user', content: message }],
    }),
  })

  if (!anthropicRes.ok) {
    console.error('Pancho wall API error:', await anthropicRes.text())
    return NextResponse.json({ error: 'AI error' }, { status: 500 })
  }

  const aiData = await anthropicRes.json()
  const reply = aiData.content?.[0]?.text?.trim()
  if (!reply) return NextResponse.json({ error: 'No reply' }, { status: 500 })

  // Insert as Pancho using service role (bypasses RLS)
  // author_id uses Pancho's fixed UUID — stored in wall_posts, rendered specially client-side
  const { data: post, error: postErr } = await supabaseAdmin
    .from('wall_posts')
    .insert({
      channel,
      parent_id: parent_id || null,
      author_id: PANCHO_AUTHOR_ID,
      body: reply,
      mentions: [],
      work_order_id: null,
    })
    .select()
    .single()

  if (postErr) {
    console.error('Pancho post error:', postErr)
    return NextResponse.json({ error: postErr.message }, { status: 500 })
  }

  return NextResponse.json({ post })
}
