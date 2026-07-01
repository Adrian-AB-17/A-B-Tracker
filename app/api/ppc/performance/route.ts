import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const clientId = searchParams.get('clientId') || 'all'

  // Client names
  const { data: clients } = await supabase.from('clients').select('id, name').eq('status', 'active')
  const nameMap: Record<string, string> = {}
  for (const c of clients ?? []) nameMap[c.id] = c.name

  // Meta data from report_data — service role bypasses RLS
  let q = supabase
    .from('report_data')
    .select('client_id, month, metric, value')
    .eq('section', 'meta')
    .order('month')

  if (clientId !== 'all') q = q.eq('client_id', clientId)

  const { data: rows, error } = await q
  if (error) return NextResponse.json({ error: error.message, rows: [] }, { status: 500 })

  // Aggregate into one row per client+month
  const map: Record<string, {
    client_id: string; client_name: string; month: string; platform: string
    spend: number; impressions: number; clicks: number; video_views: number
  }> = {}

  for (const r of rows ?? []) {
    const k = `${r.client_id}__${r.month}`
    if (!map[k]) map[k] = { client_id: r.client_id, client_name: nameMap[r.client_id] || r.client_id, month: r.month, platform: 'meta', spend: 0, impressions: 0, clicks: 0, video_views: 0 }
    const v = parseFloat(r.value) || 0
    if (r.metric === 'meta_spend')       map[k].spend       += v
    if (r.metric === 'meta_impressions') map[k].impressions += v
    if (r.metric === 'meta_clicks')      map[k].clicks      += v
    if (r.metric === 'meta_video_views') map[k].video_views += v
  }

  return NextResponse.json({ rows: Object.values(map), debug: { rowCount: rows?.length ?? 0, clientId } })
}
