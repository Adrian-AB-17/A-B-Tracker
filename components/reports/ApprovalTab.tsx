'use client'
import { useState, useEffect } from 'react'

const APPROVAL_CHANNELS = [
  { id: 'google_ads',     label: 'Google Ads',       icon: '🔍' },
  { id: 'meta_ads',       label: 'Meta Ads',         icon: '📘' },
  { id: 'social_organic', label: 'Social',           icon: '📣' },
  { id: 'lsa',            label: 'LSA Leads',        icon: '📋' },
  { id: 'website',        label: 'Website & SEO',    icon: '🌐' },
  { id: 'email',          label: 'Email',            icon: '✉️' },
  { id: 'gmb',            label: 'GMB / Reputation', icon: '⭐' },
  { id: 'acquisition',    label: 'Acquisition Cost', icon: '💰' },
  { id: 'calls',          label: 'Calls',            icon: '📞' },
]

type ApprovalRecord = {
  approved: boolean
  notes: string
  approved_by: string | null
  approved_at: string | null
  markup_pct: number | null
}

export default function ApprovalTab({
  clientId,
  month,
  defaultMarkup = 0,
}: {
  clientId: string
  month: string
  defaultMarkup?: number
}) {
  const [approvals, setApprovals] = useState<Record<string, ApprovalRecord>>({})
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [editingNotes, setEditingNotes] = useState<Record<string, string>>({})
  const [editingMarkup, setEditingMarkup] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/reports/approve?clientId=${clientId}&month=${month}`)
      .then(r => r.json())
      .then(d => {
        setApprovals(d.approvals || {})
        const notes: Record<string, string> = {}
        const markup: Record<string, string> = {}
        Object.entries(d.approvals || {}).forEach(([ch, a]) => {
          notes[ch] = (a as ApprovalRecord).notes || ''
          markup[ch] = (a as ApprovalRecord).markup_pct != null
            ? String((a as ApprovalRecord).markup_pct)
            : String(defaultMarkup)
        })
        setEditingNotes(notes)
        setEditingMarkup(markup)
      })
      .finally(() => setLoading(false))
  }, [clientId, month, defaultMarkup])

  const toggle = async (channel: string) => {
    const current = approvals[channel]
    const newApproved = !current?.approved
    setSaving(prev => ({ ...prev, [channel]: true }))
    await fetch('/api/reports/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId, month, channel,
        approved: newApproved,
        notes: editingNotes[channel] || '',
        markup_pct: parseFloat(editingMarkup[channel] || String(defaultMarkup)),
      }),
    })
    setApprovals(prev => ({
      ...prev,
      [channel]: { ...prev[channel], approved: newApproved, approved_at: newApproved ? new Date().toISOString() : null },
    }))
    setSaving(prev => ({ ...prev, [channel]: false }))
  }

  const saveNotes = async (channel: string) => {
    setSaving(prev => ({ ...prev, [`notes_${channel}`]: true }))
    await fetch('/api/reports/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId, month, channel,
        approved: approvals[channel]?.approved || false,
        notes: editingNotes[channel] || '',
        markup_pct: parseFloat(editingMarkup[channel] || String(defaultMarkup)),
      }),
    })
    setSaving(prev => ({ ...prev, [`notes_${channel}`]: false }))
  }

  const approvedCount = APPROVAL_CHANNELS.filter(c => approvals[c.id]?.approved).length

  if (loading) return (
    <div style={{ padding: '32px 0', color: '#6b7280', fontSize: 14 }}>Loading approvals…</div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Status bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 4, padding: '12px 16px',
        background: approvedCount === APPROVAL_CHANNELS.length ? '#f0fdf4' : '#f9fafb',
        border: '1px solid ' + (approvedCount === APPROVAL_CHANNELS.length ? '#86efac' : '#e5e7eb'),
        borderRadius: 10,
      }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#0f1b34' }}>
          {approvedCount}/{APPROVAL_CHANNELS.length} channels approved
        </div>
        {approvedCount > 0 && (
          <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 600 }}>
            ✓ {approvedCount} published to client portal
          </span>
        )}
      </div>

      {/* Channel rows */}
      {APPROVAL_CHANNELS.map(ch => {
        const appr = approvals[ch.id]
        const isApproved = appr?.approved || false
        const isSav = saving[ch.id]
        const markup = parseFloat(editingMarkup[ch.id] || String(defaultMarkup))
        return (
          <div key={ch.id} style={{
            border: '1px solid ' + (isApproved ? '#86efac' : '#e5e7eb'),
            borderRadius: 10, padding: '14px 16px',
            background: isApproved ? '#f0fdf4' : '#ffffff',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 16 }}>{ch.icon}</span>
              <span style={{ fontWeight: 600, fontSize: 14, color: '#0f1b34', flex: 1 }}>{ch.label}</span>
              {isApproved && appr?.approved_at && (
                <span style={{ fontSize: 11, color: '#16a34a' }}>
                  Approved {new Date(appr.approved_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  {appr.approved_by ? ' by ' + appr.approved_by.split('@')[0] : ''}
                </span>
              )}
              <button onClick={() => toggle(ch.id)} disabled={isSav} style={{
                fontSize: 12, fontWeight: 600, padding: '6px 14px', borderRadius: 7,
                border: '1px solid ' + (isApproved ? '#16a34a' : '#d1d5db'),
                background: isApproved ? '#16a34a' : 'transparent',
                color: isApproved ? '#fff' : '#6b7280',
                cursor: isSav ? 'not-allowed' : 'pointer', opacity: isSav ? 0.6 : 1,
              }}>
                {isSav ? '…' : isApproved ? '✓ Approved' : 'Approve'}
              </button>
            </div>

            {/* Notes + Markup */}
            <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <textarea
                value={editingNotes[ch.id] || ''}
                onChange={e => setEditingNotes(prev => ({ ...prev, [ch.id]: e.target.value }))}
                placeholder={'Notes for ' + ch.label + ' — visible to client after approval'}
                rows={2}
                style={{ flex: 1, fontSize: 12, padding: '6px 10px', borderRadius: 6, border: '1px solid #e5e7eb', resize: 'vertical' }}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11, color: '#6b7280' }}>Markup %</span>
                  <input
                    type="number"
                    value={editingMarkup[ch.id] ?? String(defaultMarkup)}
                    onChange={e => setEditingMarkup(prev => ({ ...prev, [ch.id]: e.target.value }))}
                    style={{ width: 56, fontSize: 12, padding: '4px 6px', borderRadius: 6, border: '1px solid #e5e7eb', textAlign: 'center' }}
                  />
                </div>
                <div style={{ fontSize: 10, color: '#9ca3af', textAlign: 'right' }}>
                  Billed: {(markup / 100 + 1).toFixed(2)}x raw
                </div>
                <button onClick={() => saveNotes(ch.id)} disabled={saving[`notes_${ch.id}`]} style={{
                  fontSize: 11, padding: '5px 10px', borderRadius: 6, border: '1px solid #e5e7eb',
                  background: '#f9fafb', color: '#6b7280', cursor: 'pointer',
                }}>
                  {saving[`notes_${ch.id}`] ? '…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        )
      })}

      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
        💡 Approved channels appear in the client portal. Notes are visible to the client. Markup is internal only.
      </div>
    </div>
  )
}
