import { createClient } from '@/lib/supabase/server'
import MentionsClient from '@/components/notifications/MentionsClient'

export const dynamic = 'force-dynamic'

export default async function MentionsPage() {
  const supabase = createClient()
  const { data: user } = await supabase.auth.getUser()

  if (!user?.user) {
    return <div className="p-6 text-sm text-gray-500">Please log in.</div>
  }

  const { data: notifications } = await supabase
    .from('wo_notifications')
    .select('id, source_type, source_id, work_order_id, body_preview, author_name, link_url, read_at, created_at')
    .eq('user_id', user.user.id)
    .order('created_at', { ascending: false })
    .limit(50)

  return <MentionsClient initial={notifications || []} />
}
