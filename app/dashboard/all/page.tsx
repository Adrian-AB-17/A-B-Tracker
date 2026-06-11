import { createClient } from '@/lib/supabase/server'
import AllWorkOrdersClient from '@/components/work-orders/AllWorkOrdersClient'

export default async function AllWorkOrdersPage() {
  const supabase = createClient()
  const { data: workOrders } = await supabase
    .from('work_orders')
    .select(`*,
      clients!work_orders_client_id_fkey(name),
      services!work_orders_service_id_fkey(name),
      team_members!work_orders_owner_id_fkey(name)`)
    .order('created_at', { ascending: false })
    .limit(2000)

  const { data: clients } = await supabase.from('clients').select('id, name').eq('status', 'active').order('name')
  const { data: services } = await supabase.from('services').select('id, name').order('name')
  const { data: team } = await supabase.from('team_members').select('id, name').order('name')

  return (
    <AllWorkOrdersClient
      workOrders={(workOrders as any) || []}
      clients={clients || []}
      services={services || []}
      team={team || []}
    />
  )
}
