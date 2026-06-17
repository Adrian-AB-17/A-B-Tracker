import { NextRequest, NextResponse } from 'next/server';
import { GoogleAuth } from 'google-auth-library';

// Search Console site URLs per client
const SC_SITES: Record<string, string> = {
  'a-b-consulting-group':   'https://abconsultingg.com/',
  'affiliated-control':     'sc-domain:affiliatedcontrol.com',
  'culture':                'sc-domain:cultureccc.com',
  'kbc':                    'sc-domain:kbcexteriors.com',
  'midway-windows-doors':   'sc-domain:midwaywindows.com',
  'mvp-chiro':              'https://mvpchiro.com/',
};

function getAuth() {
  return new GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
    clientOptions: { subject: process.env.GOOGLE_IMPERSONATION_EMAIL || 'adrian@abconsultingg.com' },
  });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get('clientId');
  const month = searchParams.get('month') || new Date().toISOString().slice(0, 7);

  if (!clientId) return NextResponse.json({ error: 'clientId required' }, { status: 400 });

  const siteUrl = SC_SITES[clientId];
  if (!siteUrl) return NextResponse.json({ configured: false, message: 'Search Console not configured for this client', data: null });

  try {
    const auth = getAuth();
    const client = await auth.getClient();
    const { token } = await client.getAccessToken();
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    const [year, mon] = month.split('-').map(Number);
    const pad = (n: number) => String(n).padStart(2, '0');
    const startDate = `${year}-${pad(mon)}-01`;
    const endDate = `${year}-${pad(mon)}-${new Date(year, mon, 0).getDate()}`;

    const encodedSite = encodeURIComponent(siteUrl);
    const base = `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodedSite}/searchAnalytics/query`;

    // Fetch totals + top queries + top pages in parallel
    const [totalsRes, queriesRes, pagesRes] = await Promise.all([
      fetch(base, {
        method: 'POST', headers,
        body: JSON.stringify({ startDate, endDate, rowLimit: 1 }),
      }),
      fetch(base, {
        method: 'POST', headers,
        body: JSON.stringify({ startDate, endDate, dimensions: ['query'], rowLimit: 10 }),
      }),
      fetch(base, {
        method: 'POST', headers,
        body: JSON.stringify({ startDate, endDate, dimensions: ['page'], rowLimit: 10 }),
      }),
    ]);

    const [totalsData, queriesData, pagesData] = await Promise.all([
      totalsRes.json(), queriesRes.json(), pagesRes.json(),
    ]);

    const totals = totalsData.rows?.[0] || { clicks: 0, impressions: 0, ctr: 0, position: 0 };

    const topQueries = (queriesData.rows || []).map((r: { keys: string[]; clicks: number; impressions: number; ctr: number; position: number }) => ({
      query: r.keys[0],
      clicks: r.clicks,
      impressions: r.impressions,
      ctr: parseFloat((r.ctr * 100).toFixed(1)),
      position: parseFloat(r.position.toFixed(1)),
    }));

    const topPages = (pagesData.rows || []).map((r: { keys: string[]; clicks: number; impressions: number; ctr: number; position: number }) => ({
      page: r.keys[0].replace(/^https?:\/\/[^/]+/, ''),
      clicks: r.clicks,
      impressions: r.impressions,
      ctr: parseFloat((r.ctr * 100).toFixed(1)),
      position: parseFloat(r.position.toFixed(1)),
    }));

    return NextResponse.json({
      configured: true, clientId, month,
      data: {
        clicks: totals.clicks,
        impressions: totals.impressions,
        ctr: parseFloat((totals.ctr * 100).toFixed(1)),
        position: parseFloat(totals.position.toFixed(1)),
        topQueries,
        topPages,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[Search Console]', msg);
    return NextResponse.json({ error: msg, configured: true, data: null }, { status: 500 });
  }
}
