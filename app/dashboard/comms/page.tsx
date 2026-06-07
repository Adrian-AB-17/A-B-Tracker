import { createClient } from '@/lib/supabase/server'
import CommsClient from './CommsClient'

export const dynamic = 'force-dynamic'

export default async function CommsPage() {
  const supabase = createClient()
  const [{ data: comms }, { data: clients }, { data: wos }] = await Promise.all([
    supabase
      .from('client_comms')
      .select('*')
      .order('sent_at', { ascending: false })
      .limit(200),
    supabase.from('clients').select('id, name').order('name'),
    supabase
      .from('work_orders')
      .select('id, title, client_id')
      .not('stage', 'in', '(archived,paid)')
      .order('created_at', { ascending: false })
      .limit(300),
  ])

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Client Communications</h1>
          <p className="text-sm text-gray-500 mt-1">Log of all outbound and inbound client messages</p>
        </div>
      </div>
      <CommsClient
        initialComms={comms || []}
        clients={clients || []}
        workOrders={wos || []}
      />
    </div>
  )
}
