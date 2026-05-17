import { createClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
  const supabase = createClient()

  // Test 1: Most basic query
  const start = Date.now()
  const { data: workOrders, error } = await supabase
    .from('work_orders')
    .select('id, title, stage')
    .limit(10)
  const elapsed = Date.now() - start

  return (
    <div style={{ padding: 40, fontFamily: 'monospace' }}>
      <h1>Dashboard Diagnostic</h1>
      <p>Query took: {elapsed}ms</p>
      <p>Error: {error ? JSON.stringify(error) : 'none'}</p>
      <p>Rows returned: {workOrders?.length || 0}</p>
      <pre>{JSON.stringify(workOrders, null, 2)}</pre>
    </div>
  )
}