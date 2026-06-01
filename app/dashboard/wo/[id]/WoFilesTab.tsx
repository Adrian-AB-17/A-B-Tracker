'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { DeliverablePreview } from '@/lib/deliverablePreview'

export type WoLink = {
  id: string
  work_order_id: string
  label: string | null
  url: string
  sort_order: number
  created_at: string
}

export default function WoFilesTab({
  woId, initialLinks, primaryLink, isAdmin,
}: {
  woId: string
  initialLinks: WoLink[]
  primaryLink: string | null
  isAdmin: boolean
}) {
  const supabase = createClient()
  const [links, setLinks] = useState<WoLink[]>(initialLinks)
  const [label, setLabel] = useState('')
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)

  async function addLink() {
    const u = url.trim()
    if (!u) return
    setBusy(true)
    const nextSort = links.length ? Math.max(...links.map(l => l.sort_order)) + 1 : 0
    const { data, error } = await supabase
      .from('wo_links')
      .insert({ work_order_id: woId, label: label.trim() || null, url: u, sort_order: nextSort })
      .select()
      .single()
    setBusy(false)
    if (error) { alert('Could not add link: ' + error.message); return }
    setLinks(prev => [...prev, data as WoLink])
    setLabel(''); setUrl('')
  }

  async function removeLink(id: string) {
    if (!confirm('Remove this deliverable link?')) return
    const prev = links
    setLinks(curr => curr.filter(l => l.id !== id))
    const { error } = await supabase.from('wo_links').delete().eq('id', id)
    if (error) { alert('Could not remove: ' + error.message); setLinks(prev) }
  }

  const hasAny = !!primaryLink || links.length > 0

  return (
    <div className="grid gap-4 max-w-3xl">
      {/* Add-link form (admin) */}
      {isAdmin && (
        <div className="rounded-lg border p-4" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)' }}>
          <div className="text-sm font-semibold mb-3" style={{ color: 'var(--text)' }}>Add a deliverable link</div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input type="text" value={label} onChange={e => setLabel(e.target.value)}
              placeholder="Label (e.g. Final flyer)"
              className="rounded border px-3 py-2 text-sm sm:w-48"
              style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
            <input type="url" value={url} onChange={e => setUrl(e.target.value)}
              placeholder="https://… (Drive, Slides, Dropbox, PDF, image)"
              onKeyDown={e => { if (e.key === 'Enter') addLink() }}
              className="flex-1 rounded border px-3 py-2 text-sm"
              style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
            <button onClick={addLink} disabled={busy || !url.trim()}
              className="rounded px-4 py-2 text-sm font-medium"
              style={{ background: 'var(--brand-accent, #b8860b)', color: '#1a2744', opacity: busy || !url.trim() ? 0.5 : 1 }}>
              {busy ? 'Adding…' : 'Add'}
            </button>
          </div>
        </div>
      )}

      {!hasAny && (
        <div className="rounded-lg border p-8 text-center" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
          No deliverables yet.{isAdmin ? ' Add a link above.' : ''}
        </div>
      )}

      {/* Primary deliverable (from work_orders.deliverables_link) */}
      {primaryLink && (
        <div className="rounded-lg border p-4" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)' }}>
          <div className="text-sm font-semibold mb-3" style={{ color: 'var(--text)' }}>Primary deliverable</div>
          <DeliverablePreview link={primaryLink} label="Primary deliverable" />
        </div>
      )}

      {/* Additional links */}
      {links.map(l => (
        <div key={l.id} className="rounded-lg border p-4" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{l.label || 'Deliverable'}</div>
            {isAdmin && (
              <button onClick={() => removeLink(l.id)} className="text-xs" style={{ color: '#dc2626' }}>Remove</button>
            )}
          </div>
          <DeliverablePreview link={l.url} label={l.label || 'Deliverable'} />
        </div>
      ))}
    </div>
  )
}
