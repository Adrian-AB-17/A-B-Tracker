import { createClient } from '@/lib/supabase/server'
import BoardClient from '@/components/work-orders/BoardClient'

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: workOrders } = await supabase
    .from('work_orders')
    .select(`*, clients(name), services(name, category), team_members(name)`)
    .not('stage', 'eq', 'archived')
    .order('created_at', { ascending: false })

  const { data: clients } = await supabase
    .from('clients').select('id, name').eq('status', 'active').order('name')

  const { data: services } = await supabase
    .from('services').select('id, name, category, base_price, occurrence').eq('active', true).order('sort_order')

  const { data: team } = await supabase
    .from('team_members').select('id, name, role').eq('active', true).order('name')

  return (
    <BoardClient
      initialWorkOrders={workOrders || []}
      clients={clients || []}
      services={services || []}
      team={team || []}
    />
  )
}
