import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get('clientId');
  const month = searchParams.get('month');
  if (!clientId || !month) return NextResponse.json({ error: 'clientId and month required' }, { status: 400 });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('client_report_approvals')
    .select('channel, approved, approved_by, approved_at, notes, markup_pct')
    .eq('client_id', clientId)
    .eq('month', month);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const map: Record<string, { approved: boolean; notes: string; approved_by: string | null; approved_at: string | null; markup_pct: number | null }> = {};
  (data || []).forEach(row => {
    map[row.channel] = {
      approved: row.approved,
      notes: row.notes || '',
      approved_by: row.approved_by,
      approved_at: row.approved_at,
      markup_pct: row.markup_pct ?? 30,
    };
  });

  return NextResponse.json({ clientId, month, approvals: map });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { clientId, month, channel, approved, notes, markup_pct } = body;
  if (!clientId || !month || !channel) return NextResponse.json({ error: 'clientId, month, channel required' }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { error } = await supabase
    .from('client_report_approvals')
    .upsert({
      client_id: clientId, month, channel,
      approved: approved ?? false,
      notes: notes ?? '',
      markup_pct: markup_pct ?? 30,
      approved_by: user?.email || null,
      approved_at: approved ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'client_id,month,channel' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, clientId, month, channel, approved });
}
