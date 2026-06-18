import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const WINDSOR_META_ACCOUNTS: Record<string, string> = {
  'a-b-consulting-group': '954365713245',
  'rbs':                  '1731592717357645',
  'culture':              '1571033470104669',
  'apollo-events':        '447099052878647',
  'nico-roofing':         '512986365868649',
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get('clientId');
  const month = searchParams.get('month') || new Date().toISOString().slice(0, 7);
  if (!clientId) return NextResponse.json({ error: 'clientId required' }, { status: 400 });

  const accountId = WINDSOR_META_ACCOUNTS[clientId];
  if (!accountId) return NextResponse.json({ configured: false, message: 'Meta Ads not configured for this client', data: null });

  const apiKey = process.env.WINDSOR_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'WINDSOR_API_KEY not set' }, { status: 500 });

  try {
    const [year, mon] = month.split('-').map(Number);
    const pad = (n: number) => String(n).padStart(2, '0');
    const dateFrom = `${year}-${pad(mon)}-01`;
    const dateTo = `${year}-${pad(mon)}-${new Date(year, mon, 0).getDate()}`;

    const params = new URLSearchParams({
      api_key: apiKey,
      date_from: dateFrom,
      date_to: dateTo,
      fields: 'date,datasource,account_name,account_id,campaign,device,impressions,clicks,spend,reach,conversions,conversion_value',
      select_accounts: `facebook__${accountId}`,
    });

    const res = await fetch(`https://connectors.windsor.ai/all?${params}`);
    if (!res.ok) throw new Error(`Windsor: ${res.status}`);

    const rows = ((await res.json()).data || []) as Record<string, unknown>[];
    if (!rows.length) return NextResponse.json({ configured: true, clientId, month, data: null, message: 'No data for this period' });

    const n = (v: unknown) => Number(v) || 0;

    const t = rows.reduce<{ impressions: number; clicks: number; spend: number; reach: number; conversions: number; conversion_value: number }>(
      (a, r) => ({
        impressions:      a.impressions      + n(r.impressions),
        clicks:           a.clicks           + n(r.clicks),
        spend:            a.spend            + n(r.spend),
        reach:            a.reach            + n(r.reach),
        conversions:      a.conversions      + n(r.conversions),
        conversion_value: a.conversion_value + n(r.conversion_value),
      }),
      { impressions: 0, clicks: 0, spend: 0, reach: 0, conversions: 0, conversion_value: 0 }
    );

    const campaignMap: Record<string, { spend: number; impressions: number; clicks: number; conversions: number }> = {};
    rows.forEach(r => {
      const name = String(r.campaign || 'Unknown');
      if (!campaignMap[name]) campaignMap[name] = { spend: 0, impressions: 0, clicks: 0, conversions: 0 };
      campaignMap[name].spend       += n(r.spend);
      campaignMap[name].impressions += n(r.impressions);
      campaignMap[name].clicks      += n(r.clicks);
      campaignMap[name].conversions += n(r.conversions);
    });
    const campaigns = Object.entries(campaignMap)
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 5);

    // Daily time series
    const dailyMap: Record<string, { date: string; impressions: number; clicks: number; spend: number }> = {};
    rows.forEach(r => {
      const date = String(r.date || '').slice(0, 10);
      if (!date) return;
      if (!dailyMap[date]) dailyMap[date] = { date, impressions: 0, clicks: 0, spend: 0 };
      dailyMap[date].impressions += n(r.impressions);
      dailyMap[date].clicks      += n(r.clicks);
      dailyMap[date].spend       += n(r.spend);
    });
    const daily = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));

    // Device breakdown
    const deviceMap: Record<string, number> = {};
    rows.forEach(r => {
      const device = String(r.device || r.impression_device || 'Unknown');
      deviceMap[device] = (deviceMap[device] || 0) + n(r.impressions);
    });
    const devices = Object.entries(deviceMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);


    // Look up saved markup % for this client/month
    const supabase = await createClient();
    const { data: approvalRow } = await supabase
      .from('client_report_approvals')
      .select('markup_pct')
      .eq('client_id', clientId)
      .eq('month', month)
      .eq('channel', 'meta')
      .maybeSingle();
    const markupPct = approvalRow?.markup_pct ?? 30;
    const billedSpend = parseFloat((t.spend * (1 + markupPct / 100)).toFixed(2));

    return NextResponse.json({
      configured: true, clientId, month,
      data: {
        spend:       t.spend,
        billedSpend,
        markupPct,
        impressions: t.impressions,
        clicks:      t.clicks,
        reach:       t.reach,
        conversions: t.conversions,
        ctr:  t.impressions > 0 ? parseFloat(((t.clicks / t.impressions) * 100).toFixed(2)) : 0,
        cpc:  t.clicks > 0      ? parseFloat((t.spend / t.clicks).toFixed(2)) : 0,
        cpm:  t.impressions > 0 ? parseFloat(((t.spend / t.impressions) * 1000).toFixed(2)) : 0,
        roas: t.spend > 0       ? parseFloat((t.conversion_value / t.spend).toFixed(2)) : 0,
        campaigns,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[Meta Ads]', msg);
    return NextResponse.json({ error: msg, configured: true, data: null }, { status: 500 });
  }
}
