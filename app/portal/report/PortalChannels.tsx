'use client'
import { useState, useEffect } from 'react'

function fmt(n: number | null | undefined, dec = 0) {
  if (n == null || isNaN(Number(n))) return '—'
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec })
}
function money(n: number | null | undefined) {
  if (n == null) return '—'
  return `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
function pct(n: number | null | undefined) {
  if (n == null) return '—'
  return `${Number(n).toFixed(2)}%`
}

function KpiRow({ items }: { items: { label: string; value: string }[] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10, marginTop: 14 }}>
      {items.map(k => (
        <div key={k.label} style={{ background: '#f9fafb', borderRadius: 8, padding: '10px 12px' }}>
          <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.7px', color: '#9ca3af', fontWeight: 600, marginBottom: 4 }}>{k.label}</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#0f1b34' }}>{k.value}</div>
        </div>
      ))}
    </div>
  )
}

function ChannelCard({ id, icon, label, note, clientId, month }: {
  id: string; icon: string; label: string; note: string; clientId: string; month: string
}) {
  const [open, setOpen] = useState(false)
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || data) return
    setLoading(true)
    const endpoints: Record<string, string> = {
      meta: `/api/reports/meta?clientId=${clientId}&month=${month}`,
      gads: `/api/reports/google-ads?clientId=${clientId}&month=${month}`,
      gmb:  `/api/reports/gmb?clientId=${clientId}&month=${month}`,
      email:`/api/reports/email?clientId=${clientId}&month=${month}`,
      ga4:  `/api/reports/ga4?clientId=${clientId}&month=${month}`,
    }
    const url = endpoints[id]
    if (!url) { setLoading(false); return }
    fetch(url).then(r => r.json()).then(d => { setData(d); setLoading(false) }).catch(() => setLoading(false))
  }, [open, id, clientId, month, data])

  const renderData = () => {
    if (loading) return <div style={{ fontSize: 13, color: '#9ca3af', paddingTop: 10 }}>Loading…</div>
    if (!data?.data) return <div style={{ fontSize: 13, color: '#9ca3af', paddingTop: 10 }}>No data available for this period.</div>
    const d = data.data

    if (id === 'meta') return <KpiRow items={[
      { label: 'Raw Spend', value: money(d.spend) },
      { label: 'Billed', value: money(d.billedSpend ?? d.spend) },
      { label: 'Impressions', value: fmt(d.impressions) },
      { label: 'Clicks', value: fmt(d.clicks) },
      { label: 'CTR', value: pct(d.ctr) },
      { label: 'CPC', value: money(d.cpc) },
      { label: 'Reach', value: fmt(d.reach) },
    ]} />

    if (id === 'gads') return <KpiRow items={[
      { label: 'Raw Spend', value: money(d.spend) },
      { label: 'Billed', value: money(d.billedSpend ?? d.spend) },
      { label: 'Clicks', value: fmt(d.clicks) },
      { label: 'Impressions', value: fmt(d.impressions) },
      { label: 'CTR', value: pct(d.ctr) },
      { label: 'CPC', value: money(d.cpc) },
      { label: 'Conversions', value: fmt(d.conversions) },
    ]} />

    if (id === 'gmb') return <KpiRow items={[
      { label: 'Search Views', value: fmt(d.searchViews) },
      { label: 'Maps Views', value: fmt(d.mapsViews) },
      { label: 'Total Views', value: fmt(d.totalImpressions) },
      { label: 'Calls', value: fmt(d.calls) },
      { label: 'Directions', value: fmt(d.directions) },
      { label: 'Website Clicks', value: fmt(d.websiteClicks) },
    ]} />

    if (id === 'email') return <KpiRow items={[
      { label: 'Campaigns', value: fmt(d.campaignCount) },
      { label: 'Sends', value: fmt(d.sends) },
      { label: 'Opens', value: fmt(d.opens) },
      { label: 'Open Rate', value: `${d.openRate}%` },
      { label: 'Clicks', value: fmt(d.clicks) },
      { label: 'Click Rate', value: `${d.clickRate}%` },
    ]} />

    if (id === 'ga4') return <KpiRow items={[
      { label: 'Sessions', value: fmt(d.sessions) },
      { label: 'Users', value: fmt(d.users) },
      { label: 'New Users', value: fmt(d.newUsers) },
      { label: 'Page Views', value: fmt(d.pageViews) },
      { label: 'Bounce Rate', value: pct(d.bounceRate) },
    ]} />

    return <div style={{ fontSize: 13, color: '#9ca3af', paddingTop: 10 }}>No data available.</div>
  }

  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, background: '#fff', overflow: 'hidden' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 16px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
        }}
      >
        <span style={{ fontWeight: 600, fontSize: 13, color: '#1a2744' }}>{icon} {label}</span>
        <span style={{ fontSize: 18, color: '#9ca3af', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>›</span>
      </button>
      {open && (
        <div style={{ padding: '0 16px 16px' }}>
          {note && <p style={{ fontSize: 13, color: '#4b5563', margin: '0 0 8px', lineHeight: 1.5 }}>{note}</p>}
          {renderData()}
        </div>
      )}
    </div>
  )
}

export default function PortalChannels({ channels, clientId, month }: {
  channels: { id: string; icon: string; label: string; note: string }[]
  clientId: string
  month: string
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {channels.map(ch => (
        <ChannelCard key={ch.id} {...ch} clientId={clientId} month={month} />
      ))}
    </div>
  )
}
