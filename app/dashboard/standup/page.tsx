import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import StandupClient, { type WallPost, type TeamMember } from './StandupClient'

export const dynamic = 'force-dynamic'

export default async function StandupPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // All standup posts (top-level + replies); client splits them by parent_id.
  const { data: posts } = await supabase
    .from('wall_posts')
    .select('id, channel, parent_id, author_id, body, mentions, created_at, edited_at')
    .eq('channel', 'standup')
    .order('created_at', { ascending: true })
    .limit(500)

  // Team: name lookup + mention autocomplete source.
  const { data: team } = await supabase.from('team_members').select('id, name, auth_user_id')
  const authMap: Record<string, string> = {}
  ;(team || []).forEach((t: any) => { if (t.auth_user_id) authMap[t.auth_user_id] = t.name })

  return (
    <StandupClient
      initialPosts={(posts || []) as WallPost[]}
      team={(team || []) as TeamMember[]}
      authMap={authMap}
      currentUserId={user.id}
    />
  )
}
