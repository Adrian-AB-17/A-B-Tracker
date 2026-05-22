import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import WoDetail from './WoDetail'

export default async function WoDetailPage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: { tab?: string }
}) {
  const supabase = createClient()

  const { data: wo } = await supabase
    .from('work_orders')
    .select(`*,
      clients!work_orders_client_id_fkey(id, name),
      services!work_orders_service_id_fkey(id, name),
      team_members!work_orders_owner_id_fkey(id, name)`)
    .eq('id', params.id)
    .single()

  if (!wo) notFound()

  return <WoDetail wo={wo as any} initialTab={searchParams.tab} />
}
