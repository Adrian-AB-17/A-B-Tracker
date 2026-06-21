'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

const DEFAULT_SLOTS = [
  { slot: 1,  type: 'Post',    pillar: 'Story',          concept: 'Person at the business: intro of a real team member' },
  { slot: 2,  type: 'Post',    pillar: 'Value',          concept: 'Useful, not salesy: 1 practical tip the audience needs' },
  { slot: 3,  type: 'Post',    pillar: 'Culture',        concept: 'Why we do this: company value, mission moment, or origin' },
  { slot: 4,  type: 'Post',    pillar: 'Fans',           concept: 'Social proof: review, testimonial screenshot, or UGC' },
  { slot: 5,  type: 'Post',    pillar: 'Current Events', concept: 'Tie to a moment: holiday, trend, or local event' },
  { slot: 6,  type: 'Post',    pillar: 'Support',        concept: 'FAQ answered: address a real objection or common question' },
  { slot: 7,  type: 'Video',   pillar: 'Story',          concept: 'BTS: behind-the-scenes moment, team or process' },
  { slot: 8,  type: 'Video',   pillar: 'Value',          concept: 'How-to or demo: show the product/service in action' },
  { slot: 9,  type: 'Video',   pillar: 'Fans',           concept: 'Testimonial: customer on camera or voice note' },
  { slot: 10, type: 'Video',   pillar: 'Current Events', concept: 'Trend or moment: react to something happening now' },
  { slot: 11, type: 'Re-Post', pillar: 'Goals',          concept: 'Vision/long-form: blog post, case study, or service page' },
  { slot: 12, type: 'Re-Post', pillar: 'Value',          concept: 'How-to article: educational content from website' },
]

type Slot = {
  id?: string
  slot: number
  type: string
  pillar: string
  concept: string
  topic?: string
  status: string
  scheduled_date?: string
  caption_id?: string
  caption_text?: string
  notes?: string
}

type Caption = {
  id: string
  topic: string
  caption_text: string
  pillar: string
}

const CLIENTS = [
  'Richards Building Supply', 'Culture Construction', 'KBC Exteriors', 'KBC Restoration',
  'MVP Chiropractic', 'Midwest Construction Experts', 'Apollo Supply', 'Midway Windows',
  'Affiliated Control Equipment', 'NICO Roofing', 'A&B Consulting Group', 'APEK Inc.',
  'RG General Roofing',
]

const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  Planned:    { bg: '#F5F5F4', text: '#78716C' },
  'In Progress': { bg: '#FAEEDA', text: '#854F0B' },
  Scheduled:  { bg: '#EDF4FB', text: '#185FA5' },
  Published:  { bg: '#EAF3DE', text: '#3B6D11' },
}

const TYPE_COLOR: Record<string, string> = {
  Post: '#185FA5', Video: '#5B21B6', 'Re-Post': '#854F0B',
}

const PILLAR_COLOR: Record<string, string> = {
  Story: '#185FA5', Value: '#3B6D11', Culture: '#5B21B6',
  Fans: '#854F0B', 'Current Events': '#D97706', Support: '#A32D2D',
  Goals: '#047857',
}

export default function PlanningBoardPage() {
  const now = new Date()
  const currentMonth = (now.getMonth() + 1) % 12
  const currentYear = now.getFullYear()

  const [selectedClient, setSelectedClient] = useState(CLIENTS[0])
  const [selectedMonth, setSelectedMonth] = useState(currentMonth)
  const [selectedYear, setSelectedYear] = useState(currentYear)
  const [slots, setSlots] = useState<Slot[]>(DEFAULT_SLOTS.map(s => ({ ...s, status: 'Planned' })))
  const [captions, setCaptions] = useState<Caption[]>([])
  const [loading, setLoading] = useState(false)
  const [editingSlot, setEditingSlot] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  const months3 = [-2, -1, 0].map(offset => {
    const m = (currentMonth + offset + 12) % 12
    return { label: MONTH_LABELS[m], value: m }
  })

  useEffect(() => { loadPlan() }, [selectedClient, selectedMonth, selectedYear])
  useEffect(() => { loadCaptions() }, [selectedClient])

  async function loadPlan() {
    setLoading(true)
    const monthStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`

    const { data } = await supabase
      .from('social_monthly_mix')
      .select('*')
      .eq('client_name', selectedClient)
      .eq('month', monthStr)
      .order('slot', { ascending: true })

    if (data && data.length > 0) {
      // Merge DB data with defaults
      const merged = DEFAULT_SLOTS.map(def => {
        const saved = data.find((d: any) => d.slot === def.slot) as any
        return saved ? {
          ...def,
          id: saved.id,
          topic: saved.topic ?? def.concept,
          status: saved.status ?? 'Planned',
          scheduled_date: saved.scheduled_date,
          caption_id: saved.caption_id,
          notes: saved.notes,
        } : { ...def, status: 'Planned' }
      })
      setSlots(merged)
    } else {
      setSlots(DEFAULT_SLOTS.map(s => ({ ...s, status: 'Planned' })))
    }
    setLoading(false)
  }

  async function loadCaptions() {
    const { data } = await supabase
      .from('social_captions')
      .select('id, topic, caption_text, pillar')
      .eq('client_name', selectedClient)
      .order('post_date', { ascending: false })
      .limit(50)
    setCaptions(data ?? [])
  }

  async function saveSlot(slot: Slot) {
    setSaving(true)
    const monthStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`
    const row = {
      client_name: selectedClient,
      month: monthStr,
      slot: slot.slot,
      pillar: slot.pillar,
      post_type: slot.type,
      content_type: slot.type,
      topic: slot.topic,
      status: slot.status,
      scheduled_date: slot.scheduled_date || null,
      caption_id: slot.caption_id || null,
      notes: slot.notes || null,
    }

    if (slot.id) {
      await supabase.from('social_monthly_mix').update(row).eq('id', slot.id)
    } else {
      const { data } = await supabase.from('social_monthly_mix').insert(row).select().single()
      if (data) {
        setSlots(prev => prev.map(s => s.slot === slot.slot ? { ...s, id: data.id } : s))
      }
    }
    setSaving(false)
    setEditingSlot(null)
  }

  function updateSlot(slotNum: number, updates: Partial<Slot>) {
    setSlots(prev => prev.map(s => s.slot === slotNum ? { ...s, ...updates } : s))
  }

  const posts = slots.filter(s => s.type === 'Post')
  const videos = slots.filter(s => s.type === 'Video')
  const reposts = slots.filter(s => s.type === 'Re-Post')
  const publishedCount = slots.filter(s => s.status === 'Published').length
  const scheduledCount = slots.filter(s => s.status === 'Scheduled').length

  const ink = '#1C1917', muted = '#78716C', rule = '#E7E5E4'

  function SlotCard({ slot }: { slot: Slot }) {
    const st = STATUS_STYLE[slot.status] ?? STATUS_STYLE['Planned']
    const isEditing = editingSlot === slot.slot
    const linkedCaption = captions.find(c => c.id === slot.caption_id)

    return (
      <div style={{ background: 'white', border: `1px solid ${rule}`, borderRadius: 8, padding: '14px 16px', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <div style={{ fontFamily: 'monospace', fontSize: 12, color: muted, minWidth: 20, paddingTop: 2 }}>
            {String(slot.slot).padStart(2, '0')}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 99, background: TYPE_COLOR[slot.type] + '20', color: TYPE_COLOR[slot.type] }}>{slot.type}</span>
              <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 99, background: (PILLAR_COLOR[slot.pillar] ?? muted) + '15', color: PILLAR_COLOR[slot.pillar] ?? muted }}>{slot.pillar}</span>
            </div>

            {isEditing ? (
              <div>
                <input
                  value={slot.topic ?? slot.concept}
                  onChange={e => updateSlot(slot.slot, { topic: e.target.value })}
                  placeholder="Topic / angle…"
                  style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: `1px solid ${rule}`, fontSize: 13, marginBottom: 8, boxSizing: 'border-box' }}
                />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                  <div>
                    <label style={{ fontSize: 11, color: muted, fontWeight: 600 }}>Status</label>
                    <select value={slot.status} onChange={e => updateSlot(slot.slot, { status: e.target.value })}
                      style={{ width: '100%', marginTop: 3, padding: '6px 8px', borderRadius: 5, border: `1px solid ${rule}`, fontSize: 12 }}>
                      {Object.keys(STATUS_STYLE).map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: muted, fontWeight: 600 }}>Scheduled date</label>
                    <input type="date" value={slot.scheduled_date ?? ''} onChange={e => updateSlot(slot.slot, { scheduled_date: e.target.value })}
                      style={{ width: '100%', marginTop: 3, padding: '6px 8px', borderRadius: 5, border: `1px solid ${rule}`, fontSize: 12 }} />
                  </div>
                </div>
                <div style={{ marginBottom: 8 }}>
                  <label style={{ fontSize: 11, color: muted, fontWeight: 600 }}>Link caption</label>
                  <select value={slot.caption_id ?? ''} onChange={e => updateSlot(slot.slot, { caption_id: e.target.value || undefined })}
                    style={{ width: '100%', marginTop: 3, padding: '6px 8px', borderRadius: 5, border: `1px solid ${rule}`, fontSize: 12 }}>
                    <option value="">— No caption linked —</option>
                    {captions.filter(c => !slot.pillar || c.pillar === slot.pillar || !c.pillar).map(c => (
                      <option key={c.id} value={c.id}>{c.topic || c.caption_text?.slice(0, 60) + '…'}</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => saveSlot(slot)} disabled={saving}
                    style={{ padding: '6px 12px', borderRadius: 5, border: 'none', background: ink, color: 'white', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                  <button onClick={() => setEditingSlot(null)}
                    style={{ padding: '6px 12px', borderRadius: 5, border: `1px solid ${rule}`, background: 'white', fontSize: 12, cursor: 'pointer' }}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div onClick={() => setEditingSlot(slot.slot)} style={{ cursor: 'pointer' }}>
                <div style={{ fontSize: 13, color: slot.topic ? ink : muted, lineHeight: 1.4, marginBottom: 4 }}>
                  {slot.topic || slot.concept}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 99, background: st.bg, color: st.text, fontWeight: 500 }}>
                    {slot.status}
                  </span>
                  {slot.scheduled_date && <span style={{ fontSize: 11, color: muted }}>{new Date(slot.scheduled_date).toLocaleDateString()}</span>}
                  {linkedCaption && <span style={{ fontSize: 11, color: '#185FA5' }}>📎 {linkedCaption.topic || 'Caption linked'}</span>}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#FAFAF9', color: ink, fontFamily: "'Inter', system-ui, sans-serif" }}>
      <header style={{ borderBottom: `1px solid ${rule}` }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Link href="/dashboard/social" style={{ color: muted, textDecoration: 'none', fontSize: 13 }}>← Social Hub</Link>
            <span style={{ color: rule }}>/</span>
            <div>
              <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, color: muted }}>Content</div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>Planning Board</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <select value={selectedClient} onChange={e => setSelectedClient(e.target.value)}
              style={{ padding: '7px 10px', borderRadius: 6, border: `1px solid ${rule}`, fontSize: 13, background: 'white', fontWeight: 500 }}>
              {CLIENTS.map(c => <option key={c}>{c}</option>)}
            </select>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: 4, borderRadius: 8, background: '#F5F5F4' }}>
              {months3.map(m => (
                <button key={m.value} onClick={() => setSelectedMonth(m.value)} style={{
                  padding: '6px 12px', fontSize: 13, fontWeight: 500, borderRadius: 6, border: 'none', cursor: 'pointer',
                  background: m.value === selectedMonth ? '#1C1917' : 'transparent',
                  color: m.value === selectedMonth ? '#FAFAF9' : ink,
                }}>{m.label}</button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 24px' }}>

        {/* KPI row */}
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: '#D6D3D1', border: `1px solid ${rule}`, borderRadius: 8, overflow: 'hidden', marginBottom: 28 }}>
          {[
            { label: 'Total slots', value: '12' },
            { label: 'Published', value: publishedCount.toString(), color: '#047857' },
            { label: 'Scheduled', value: scheduledCount.toString(), color: '#185FA5' },
            { label: 'Remaining', value: String(12 - publishedCount - scheduledCount), color: 12 - publishedCount - scheduledCount > 6 ? '#b91c1c' : '#B45309' },
          ].map((k, i) => (
            <div key={i} style={{ background: 'white', padding: '16px 20px' }}>
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, color: muted }}>{k.label}</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 26, fontWeight: 600, marginTop: 8, color: k.color ?? ink }}>{k.value}</div>
            </div>
          ))}
        </section>

        {loading ? (
          <div style={{ padding: 32, textAlign: 'center', color: muted }}>Loading…</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>
            <div>
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, color: muted, marginBottom: 12 }}>
                📸 6 Posts
              </div>
              {posts.map(s => <SlotCard key={s.slot} slot={s} />)}
            </div>
            <div>
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, color: muted, marginBottom: 12 }}>
                🎥 4 Videos
              </div>
              {videos.map(s => <SlotCard key={s.slot} slot={s} />)}
            </div>
            <div>
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, color: muted, marginBottom: 12 }}>
                🔗 2 Re-Posts
              </div>
              {reposts.map(s => <SlotCard key={s.slot} slot={s} />)}
            </div>
          </div>
        )}

        <p style={{ marginTop: 16, fontSize: 12, color: muted }}>Click any slot to edit topic, status, scheduled date, or link a caption.</p>
      </main>
    </div>
  )
}
