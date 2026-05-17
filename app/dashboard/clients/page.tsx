import { createClient } from '@/lib/supabase/server'
import ClientsClient from '@/components/clients/ClientsClient'

export default async function ClientsPage() {
  const supabase = createClient()
  const { data: clients } = await supabase.from('clients').select('*').order('name')
  const { data: workOrders } = await supabase
    .from('work_orders')
    .select(`id, title, stage, client_id, est_cost, add_cost, due_date, priority,
             services!work_orders_service_id_fkey(name),
             team_members!work_orders_owner_id_fkey(name)`)
    .limit(2000)

  return <ClientsClient clients={clients || []} workOrders={workOrders || []} />
}
