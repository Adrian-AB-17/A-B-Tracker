import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
  const supabase = createClient()

  // Auth check inside the page (no middleware)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Diagnostic query
  const start = Date.now()
  const { data: workOrders, error } = await supabase
    .from('work_orders')
    .select('id, title, stage')
    .limit(10)
  const elapsed = Date.now() - start

  return (
    <div style={{ padding: 40, fontFamily: 'monospace' }}>
      <h1>Dashboard - Logged In ✓</h1>
      <p>Logged in as: {user.email}</p>
      <p>Query took: {elapsed}ms</p>
      <p>Error: {error ? JSON.stringify(error) : 'none'}</p>
      <p>Rows: {workOrders?.length || 0}</p>
      <pre style={{ background: '#f5f5f5', padding: 10, marginTop: 20 }}>
        {JSON.stringify(workOrders, null, 2)}
      </pre>
    </div>
  )
}