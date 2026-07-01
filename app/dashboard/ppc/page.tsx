'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const PLATFORM_LABELS: Record<string, string> = {
  google_search: 'Google Search',
  google_display: 'Google Display',
  youtube: 'YouTube',
  meta: 'Meta',
  linkedin: 'LinkedIn',
  nextdoor: 'Nextdoor',
  bing: 'Microsoft/Bing',
  lsa: 'Google LSA',
}

const PLATFORM_COLORS: Record<string, string> = {
  google_search: '#4285F4',
  google_display: '#34A853',
  youtube: '#FF0000',
  meta: '#0866FF',
  linkedin: '#0A66C2',
  nextdoor: '#00B246',
  bing: '#008272',
  lsa: '#FBBC04',
}

type Campaign = {
  id: string
  client_id: string
  platform: string
  campaign_type: string
  objective: string
  campaign_name: string
  budget_daily: number
  budget_monthly: number
  status: string
  month: string
  created_at: string
  clients: { name: string }
}

type Goal = {
  id: string
  client_id: string
  platform: string
  metric: string
  target: number
  baseline: number | null
  period: string
  lower_is_better: boolean
  unit: string
  clients: { name: string }
}

const METRIC_LABELS: Record<string, string> = {
  cpl: 'Cost per Lead',
  cpc: 'Cost per Click',
  ctr: 'Click-Through Rate',
  roas: 'ROAS',
  impression_share: 'Impression Share',
  cpm: 'CPM',
  frequency: 'Frequency',
  quality_score: 'Avg Quality Score',
}

export default function PPCHubPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPeriod] = useState('Q3 2026')
  const [selectedClient, setSelectedClient] = useState('all')
  const [clients, setClients] = useState<{ id: string; name: string }[]>([])

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const [{ data: camps }, { data: gs }, { data: cls }] = await Promise.all([
      supabase.from('ppc_campaigns').select('*, clients(name)').order('created_at', { ascending: false }).limit(50),
      supabase.from('ppc_goals').select('*, clients(name)').eq('period', selectedPeriod).order('client_id'),
      supabase.from('clients').select('id, name').eq('status', 'active').order('name'),
    ])
    setCampaigns((camps ?? []) as unknown as Campaign[])
    setGoals((gs ?? []) as unknown as Goal[])
    setClients(cls ?? [])
    setLoading(false)
  }

  const filteredCampaigns = selectedClient === 'all' ? campaigns : campaigns.filter(c => c.client_id === selectedClient)
  const filteredGoals = selectedClient === 'all' ? goals : goals.filter(g => g.client_id === selectedClient)

  const ink = '#1C1917'
  const muted = '#78716C'

  return (
    <div style={{ minHeight: '100vh', background: '#FAFAF9', color: ink, fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Header */}
      <header style={{ borderBottom: '1px solid #E7E5E4' }}>
        <div style={{ maxWidth: 1300, margin: '0 auto', padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: '#4285F4', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 14 }}>P</div>
            <div>
              <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, color: muted }}>A&B Consulting · Tracker</div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>PPC Hub <span style={{ color: muted, fontWeight: 400 }}>/ Paid Media</span></div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <select value={selectedClient} onChange={e => setSelectedClient(e.target.value)}
              style={{ fontSize: 13, padding: '6px 12px', borderRadius: 6, border: '1px solid #E7E5E4', background: 'white', color: ink }}>
              <option value="all">All Clients</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <Link href="/dashboard/ppc/new"
              style={{ padding: '8px 16px', borderRadius: 6, background: '#4285F4', color: 'white', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
              + New Campaign
            </Link>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 1300, margin: '0 auto', padding: '32px 24px' }}>

        {/* Platform Quick Links */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 32, flexWrap: 'wrap' }}>
          {Object.entries(PLATFORM_LABELS).map(([key, label]) => (
            <Link key={key} href={`/dashboard/ppc/new?platform=${key}`}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'white', border: '1px solid #E7E5E4', borderRadius: 8, textDecoration: 'none', fontSize: 13, fontWeight: 500, color: ink }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: PLATFORM_COLORS[key], flexShrink: 0 }} />
              {label}
            </Link>
          ))}
        </div>

        {/* Goals Section */}
        <section style={{ marginBottom: 48 }}>
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, color: muted, marginBottom: 4 }}>{selectedPeriod} Goals</p>
            <h3 style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.01em', margin: 0 }}>Montse's performance targets.</h3>
          </div>

          {loading ? (
            <div style={{ color: muted, fontSize: 14 }}>Loading…</div>
          ) : filteredGoals.length === 0 ? (
            <div style={{ color: muted, fontSize: 14 }}>No goals set for this selection.</div>
          ) : (
            // Group goals by client
            Object.entries(
              filteredGoals.reduce((acc, g) => {
                const key = g.client_id
                if (!acc[key]) acc[key] = { name: (g.clients as unknown as { name: string })?.name || g.client_id, goals: [] }
                acc[key].goals.push(g)
                return acc
              }, {} as Record<string, { name: string; goals: Goal[] }>)
            ).map(([clientId, { name, goals: clientGoals }]) => (
              <div key={clientId} style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: muted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{name}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
                  {clientGoals.map(g => {
                    // No live data yet — show target + baseline
                    const unit = g.unit
                    const fmt = (v: number) => unit === '$' ? `$${v}` : unit === '%' ? `${v}%` : `${v}x`
                    return (
                      <div key={g.id} style={{ background: 'white', border: '1px solid #E7E5E4', borderRadius: 8, padding: '14px 16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 600, color: ink }}>{METRIC_LABELS[g.metric] || g.metric}</div>
                            <div style={{ fontSize: 11, color: muted, marginTop: 2 }}>
                              <span style={{ width: 6, height: 6, borderRadius: '50%', background: PLATFORM_COLORS[g.platform] || '#999', display: 'inline-block', marginRight: 4 }} />
                              {PLATFORM_LABELS[g.platform] || g.platform}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'monospace', color: ink }}>
                              {g.lower_is_better ? '≤' : '≥'}{fmt(g.target)}
                            </div>
                            {g.baseline && (
                              <div style={{ fontSize: 11, color: muted }}>baseline {fmt(g.baseline)}</div>
                            )}
                          </div>
                        </div>
                        <div style={{ height: 4, background: '#F5F5F4', borderRadius: 9999 }}>
                          <div style={{ height: '100%', width: '0%', background: '#4285F4', borderRadius: 9999 }} />
                        </div>
                        <div style={{ fontSize: 10, color: muted, marginTop: 6 }}>No live data yet — connect after first campaign runs</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </section>

        {/* Campaign List */}
        <section>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <p style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, color: muted, marginBottom: 4 }}>Campaigns</p>
              <h3 style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.01em', margin: 0 }}>All built campaigns.</h3>
            </div>
            <Link href="/dashboard/ppc/new" style={{ fontSize: 13, color: '#4285F4', fontWeight: 500, textDecoration: 'none' }}>+ New →</Link>
          </div>

          {loading ? (
            <div style={{ color: muted, fontSize: 14 }}>Loading…</div>
          ) : filteredCampaigns.length === 0 ? (
            <div style={{ background: 'white', border: '1px solid #E7E5E4', borderRadius: 8, padding: 48, textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>📡</div>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>No campaigns yet</div>
              <div style={{ fontSize: 13, color: muted, marginBottom: 20 }}>Build your first campaign and Claude will generate keywords, ad copy, and audience targeting.</div>
              <Link href="/dashboard/ppc/new"
                style={{ padding: '10px 20px', background: '#4285F4', color: 'white', borderRadius: 6, textDecoration: 'none', fontSize: 14, fontWeight: 600 }}>
                Build First Campaign
              </Link>
            </div>
          ) : (
            <div style={{ border: '1px solid #E7E5E4', borderRadius: 8, overflow: 'hidden', background: 'white' }}>
              <table style={{ width: '100%', fontSize: 14, borderCollapse: 'collapse' }}>
                <thead style={{ background: '#FAFAF9', borderBottom: '1px solid #E7E5E4' }}>
                  <tr>
                    {['Client', 'Campaign', 'Platform', 'Objective', 'Budget', 'Month', 'Status', ''].map(h => (
                      <th key={h} style={{ padding: '10px 16px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, color: muted, textAlign: 'left' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredCampaigns.map((c, i) => (
                    <tr key={c.id} style={{ borderTop: i > 0 ? '1px solid #E7E5E4' : undefined }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#F5F5F4')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td style={{ padding: '12px 16px', fontWeight: 500 }}>{(c.clients as unknown as { name: string })?.name}</td>
                      <td style={{ padding: '12px 16px', color: muted, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.campaign_name}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, padding: '2px 8px', borderRadius: 99, background: '#F5F5F4', fontWeight: 500 }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: PLATFORM_COLORS[c.platform] || '#999' }} />
                          {PLATFORM_LABELS[c.platform] || c.platform}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', color: muted, fontSize: 13 }}>{c.objective}</td>
                      <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: 13 }}>
                        {c.budget_daily ? `$${c.budget_daily}/day` : c.budget_monthly ? `$${c.budget_monthly}/mo` : '—'}
                      </td>
                      <td style={{ padding: '12px 16px', color: muted, fontSize: 13 }}>{c.month || '—'}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          fontSize: 11, padding: '2px 8px', borderRadius: 99, fontWeight: 600,
                          background: c.status === 'active' ? '#EAF3DE' : c.status === 'draft' ? '#F5F5F4' : '#FEE2E2',
                          color: c.status === 'active' ? '#047857' : c.status === 'draft' ? muted : '#b91c1c',
                        }}>{c.status}</span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <Link href={`/dashboard/ppc/${c.id}`} style={{ fontSize: 13, color: '#4285F4', textDecoration: 'none', fontWeight: 500 }}>View →</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
