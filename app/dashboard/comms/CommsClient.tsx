'use client'
import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'

type Comm = {
  id: string
  client_id: string
  wo_id: string | null
  sent_by: string | null
  sent_at: string
  channel: string
  subject: string | null
  body: string
  direction: string
  created_at: string
}

type Client = { id: string; name: string }
type WO = { id: string; title: string; client_id: string }

const CHANNELS = ['email', 'phone', 'text', 'portal', 'in-person', 'slack']
const CHANNEL_ICONS: Record<string, string> = {
  email: '📧', phone: '📞', text: '💬', portal: '🌐', 'in-person': '🤝', slack: '💼'
}

function timeAgo(d: string) {
  const ms = Date.now() - new Date(d).getTime()
  const mins = Math.floor(ms / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function CommsClient({
  initialComms, clients, workOrders,
}: {
  initialComms: Comm[]
  clients: Client[]
  workOrders: WO[]
}) {
  const supabase = createClient()
  const [comms, setComms] = useState<Comm[]>(initialComms)
  const [filterClient, setFilterClient] = useState('')
  const [filterChannel, setFilterChannel] = useState('')
  const [filterDirection, setFilterDirection] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)

  // New comm form state
  const [newClientId, setNewClientId] = useState('')
  const [newWoId, setNewWoId] = useState('')
  const [newChannel, setNewChannel] = useState('email')
  const [newDirection, setNewDirection] = useState('outbound')
  const [newSubject, setNewSubject] = useState('')
  const [newBody, setNewBody] = useState('')
  const [newSentBy, setNewSentBy] = useState('')

  const clientWos = useMemo(() =>
    workOrders.filter(w => w.client_id === newClientId),
    [workOrders, newClientId]
  )

  const filtered = useMemo(() => {
    return comms.filter(c => {
      if (filterClient && c.client_id !== filterClient) return false
      if (filterChannel && c.channel !== filterChannel) return false
      if (filterDirection && c.direction !== filterDirection) return false
      return true
    })
  }, [comms, filterClient, filterChannel, filterDirection])

  const clientName = (id: string) => clients.find(c => c.id === id)?.name || id

  async function saveComm() {
    if (!newClientId || !newBody.trim()) { alert('Client and message are required.'); return }
    setSaving(true)
    const { data, error } = await supabase.from('client_comms').insert({
      client_id: newClientId,
      wo_id: newWoId || null,
      sent_by: newSentBy.trim() || null,
      channel: newChannel,
      direction: newDirection,
      subject: newSubject.trim() || null,
      body: newBody.trim(),
      sent_at: new Date().toISOString(),
    }).select().single()
    setSaving(false)
    if (error) { alert('Error: ' + error.message); return }
    setComms(prev => [data as Comm, ...prev])
    setShowForm(false)
    setNewClientId(''); setNewWoId(''); setNewChannel('email')
    setNewDirection('outbound'); setNewSubject(''); setNewBody(''); setNewSentBy('')
  }

  async function deleteComm(id: string) {
    if (!confirm('Delete this communication log entry?')) return
    await supabase.from('client_comms').delete().eq('id', id)
    setComms(prev => prev.filter(c => c.id !== id))
  }

  return (
    <div>
      {/* Filters + Add button */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <select value={filterClient} onChange={e => setFilterClient(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
          <option value="">All clients</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={filterChannel} onChange={e => setFilterChannel(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
          <option value="">All channels</option>
          {CHANNELS.map(ch => <option key={ch} value={ch}>{CHANNEL_ICONS[ch]} {ch}</option>)}
        </select>
        <select value={filterDirection} onChange={e => setFilterDirection(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
          <option value="">All directions</option>
          <option value="outbound">Outbound</option>
          <option value="inbound">Inbound</option>
        </select>
        <span className="text-sm text-gray-400">{filtered.length} entries</span>
        <div className="ml-auto">
          <button onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
            style={{ background: '#1a2744' }}>
            + Log Communication
          </button>
        </div>
      </div>

      {/* New comm form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5 shadow-sm">
          <div className="text-sm font-bold text-gray-900 mb-4">Log a Communication</div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Client *</label>
              <select value={newClientId} onChange={e => { setNewClientId(e.target.value); setNewWoId('') }}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                <option value="">Select client…</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Work Order</label>
              <select value={newWoId} onChange={e => setNewWoId(e.target.value)}
                disabled={!newClientId}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm disabled:opacity-40">
                <option value="">No WO</option>
                {clientWos.map(w => <option key={w.id} value={w.id}>{w.title}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Sent By</label>
              <input type="text" value={newSentBy} onChange={e => setNewSentBy(e.target.value)}
                placeholder="e.g. Tanya, Adrian"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Channel</label>
              <select value={newChannel} onChange={e => setNewChannel(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                {CHANNELS.map(ch => <option key={ch} value={ch}>{CHANNEL_ICONS[ch]} {ch}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Direction</label>
              <select value={newDirection} onChange={e => setNewDirection(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                <option value="outbound">Outbound</option>
                <option value="inbound">Inbound</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Subject</label>
              <input type="text" value={newSubject} onChange={e => setNewSubject(e.target.value)}
                placeholder="Email subject or call topic"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </div>
          </div>
          <div className="mb-3">
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Message / Notes *</label>
            <textarea value={newBody} onChange={e => setNewBody(e.target.value)}
              rows={4} placeholder="What was communicated…"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none" />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
            <button onClick={saveComm} disabled={saving}
              className="px-4 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-50"
              style={{ background: '#1a2744' }}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {/* Comms list */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
          No communications logged yet.
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(c => {
            const isExpanded = expanded === c.id
            const wo = workOrders.find(w => w.id === c.wo_id)
            return (
              <div key={c.id}
                className="bg-white rounded-xl border border-gray-200 px-5 py-4 hover:border-gray-300 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="text-xl flex-shrink-0 mt-0.5">{CHANNEL_ICONS[c.channel] || '📎'}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-gray-900">{clientName(c.client_id)}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        c.direction === 'outbound' ? 'bg-blue-50 text-blue-700' : 'bg-green-50 text-green-700'
                      }`}>
                        {c.direction === 'outbound' ? '→ Out' : '← In'}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 capitalize">{c.channel}</span>
                      {wo && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 truncate max-w-40">
                          {wo.title}
                        </span>
                      )}
                    </div>
                    {c.subject && (
                      <div className="text-sm font-medium text-gray-700 mt-0.5">{c.subject}</div>
                    )}
                    <div className={`text-sm text-gray-500 mt-1 ${isExpanded ? '' : 'line-clamp-2'}`}>
                      {c.body}
                    </div>
                    {c.body.length > 120 && (
                      <button onClick={() => setExpanded(isExpanded ? null : c.id)}
                        className="text-xs text-blue-600 hover:underline mt-1">
                        {isExpanded ? 'Show less' : 'Show more'}
                      </button>
                    )}
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-xs text-gray-400">{timeAgo(c.sent_at)}</span>
                      {c.sent_by && <span className="text-xs text-gray-400">by {c.sent_by}</span>}
                    </div>
                  </div>
                  <button onClick={() => deleteComm(c.id)}
                    className="text-xs text-gray-300 hover:text-red-500 flex-shrink-0 transition-colors">
                    ×
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
