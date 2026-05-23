'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const SCHEDULE_TYPES = [
  { id: 'email',       label: 'Email blast',     icon: '📧' },
  { id: 'mailer',      label: 'Mailer drop',     icon: '📬' },
  { id: 'social-post', label: 'Social post',     icon: '📱' },
  { id: 'social-ad',   label: 'Social ad start', icon: '📣' },
  { id: 'google-ad',   label: 'Google ad start', icon: '🔍' },
  { id: 'meeting',     label: 'Meeting/call',    icon: '👥' },
  { id: 'launch',      label: 'Go-live/launch',  icon: '🚀' },
  { id: 'other',       label: 'Other',           icon: '◆' },
] as const

const STATUS_OPTIONS = [
  { id: 'scheduled', label: 'Scheduled' },
  { id: 'sent',      label: '✓ Sent' },
  { id: 'cancelled', label: 'Cancelled' },
] as const

export type ScheduleRow = {
  id: string
  work_order_id: string | null  // null for buffered (new WO) rows
  scheduled_date: string
  scheduled_time: string | null
  type: string
  title: string | null
  owner_id: string | null
  status: string
  sort_order: number
  calendar_synced: boolean
  google_event_id: string | null
}

type TeamMember = { id: string; name: string }

const todayISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const trimTime = (t: string | null): string => t ? t.slice(0, 5) : ''

function effectiveStatus(row: ScheduleRow): 'scheduled' | 'sent' | 'cancelled' | 'past_due' {
  if (row.status === 'sent') return 'sent'
  if (row.status === 'cancelled') return 'cancelled'
  if (row.scheduled_date < todayISO()) return 'past_due'
  return 'scheduled'
}

function statusPillStyle(status: ReturnType<typeof effectiveStatus>) {
  switch (status) {
    case 'sent':      return { bg: '#dcfce7', fg: '#166534', label: '✓ Sent' }
    case 'past_due':  return { bg: '#fee2e2', fg: '#991b1b', label: '⚠ Past due' }
    case 'cancelled': return { bg: '#f3f4f6', fg: '#6b7280', label: 'Cancelled' }
    default:          return { bg: '#fef3c7', fg: '#92400e', label: 'Scheduled' }
  }
}

// Local-only id generator for buffered (new WO) rows
function genLocalId() {
  return 'local-' + Math.random().toString(36).slice(2, 11)
}

type Props = {
  workOrderId: string | null    // null when in buffered (new WO) mode
  team: TeamMember[]
  // Buffered mode: parent owns rows
  bufferedRows?: ScheduleRow[]
  onBufferedChange?: (rows: ScheduleRow[]) => void
}

export default function DrawerScheduleSection({
  workOrderId,
  team,
  bufferedRows,
  onBufferedChange,
}: Props) {
  const supabase = createClient()
  const isBuffered = workOrderId === null

  // Live mode state (existing WO)
  const [liveRows, setLiveRows] = useState<ScheduleRow[]>([])
  const [loading, setLoading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const loadedForId = useRef<string | null>(null)

  // Load schedule rows when workOrderId changes (live mode only)
  useEffect(() => {
    if (isBuffered || !workOrderId) {
      setLiveRows([])
      loadedForId.current = null
      return
    }
    if (loadedForId.current === workOrderId) return
    loadedForId.current = workOrderId
    setLoading(true)
    supabase
      .from('wo_schedule')
      .select('*')
      .eq('work_order_id', workOrderId)
      .then(({ data, error: loadErr }) => {
        setLoading(false)
        if (loadErr) {
          setError(loadErr.message)
          return
        }
        setLiveRows((data || []) as ScheduleRow[])
      })
  }, [workOrderId, isBuffered, supabase])

  const rows = isBuffered ? (bufferedRows || []) : liveRows

  const sortedRows = [...rows].sort((a, b) => {
    const dateCmp = a.scheduled_date.localeCompare(b.scheduled_date)
    if (dateCmp !== 0) return dateCmp
    return (a.scheduled_time || '').localeCompare(b.scheduled_time || '')
  })

  // ─────────────────────────
  // Add row
  // ─────────────────────────
  async function addRow() {
    setError(null)
    setAdding(true)
    const nextSort = rows.length > 0 ? Math.max(...rows.map(r => r.sort_order)) + 1 : 0

    if (isBuffered) {
      const newRow: ScheduleRow = {
        id: genLocalId(),
        work_order_id: null,
        scheduled_date: todayISO(),
        scheduled_time: null,
        type: 'other',
        title: null,
        owner_id: null,
        status: 'scheduled',
        sort_order: nextSort,
        calendar_synced: false,
        google_event_id: null,
      }
      onBufferedChange?.([...(bufferedRows || []), newRow])
      setAdding(false)
      return
    }

    const { data, error: insertErr } = await supabase
      .from('wo_schedule')
      .insert({
        work_order_id: workOrderId,
        scheduled_date: todayISO(),
        type: 'other',
        status: 'scheduled',
        sort_order: nextSort,
      })
      .select('*')
      .single()

    setAdding(false)

    if (insertErr || !data) {
      setError(insertErr?.message || 'Failed to add row')
      return
    }
    setLiveRows(prev => [...prev, data as ScheduleRow])
  }

  // ─────────────────────────
  // Update row
  // ─────────────────────────
  async function updateRow(id: string, patch: Partial<ScheduleRow>) {
    setError(null)

    if (isBuffered) {
      onBufferedChange?.((bufferedRows || []).map(r => r.id === id ? { ...r, ...patch } : r))
      return
    }

    setBusyId(id)
    setLiveRows(prev => prev.map(r => (r.id === id ? { ...r, ...patch } : r)))

    const { error: updateErr } = await supabase
      .from('wo_schedule')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)

    setBusyId(null)

    if (updateErr) {
      setError(updateErr.message)
      const { data } = await supabase.from('wo_schedule').select('*').eq('id', id).single()
      if (data) setLiveRows(prev => prev.map(r => (r.id === id ? (data as ScheduleRow) : r)))
    }
  }

  // ─────────────────────────
  // Delete row
  // ─────────────────────────
  async function deleteRow(id: string) {
    if (!confirm('Delete this scheduled date?')) return
    setError(null)

    if (isBuffered) {
      onBufferedChange?.((bufferedRows || []).filter(r => r.id !== id))
      return
    }

    setBusyId(id)
    const { error: deleteErr } = await supabase.from('wo_schedule').delete().eq('id', id)
    setBusyId(null)

    if (deleteErr) {
      setError(deleteErr.message)
      return
    }
    setLiveRows(prev => prev.filter(r => r.id !== id))
  }

  return (
    <div className="space-y-3">
      {/* Section header */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
            Execution Schedule
          </div>
          <div className="text-xs text-gray-500 mt-0.5">
            When each deliverable actually goes out
          </div>
        </div>
        <button
          type="button"
          onClick={addRow}
          disabled={adding || loading}
          className="text-xs px-3 py-1.5 rounded-md font-medium"
          style={{
            background: '#d99e2b',
            color: 'white',
            cursor: (adding || loading) ? 'wait' : 'pointer',
            border: 'none',
          }}
        >
          {adding ? 'Adding…' : '+ Add date'}
        </button>
      </div>

      {error && (
        <div className="text-xs px-2 py-1.5 rounded bg-red-50 border border-red-200 text-red-700">
          {error}
        </div>
      )}

      {loading && (
        <div className="text-xs text-gray-500 italic">Loading schedule…</div>
      )}

      {/* Empty state */}
      {!loading && rows.length === 0 && (
        <div className="px-3 py-4 text-center bg-gray-50 border border-dashed border-gray-300 rounded text-xs text-gray-500">
          <div>No scheduled dates yet.</div>
          <div className="text-[11px] mt-1">
            Add a date when you know <em>when</em> the deliverable goes out.
          </div>
        </div>
      )}

      {/* Rows */}
      {!loading && rows.length > 0 && (
        <div className="space-y-1.5">
          {sortedRows.map(row => {
            const isBusy = busyId === row.id
            const eff = effectiveStatus(row)
            const pill = statusPillStyle(eff)

            return (
              <div
                key={row.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  padding: 8,
                  background: 'white',
                  border: row.calendar_synced ? '1px solid rgba(217, 158, 43, 0.4)' : '1px solid #e5e7eb',
                  borderRadius: 6,
                  opacity: isBusy ? 0.6 : 1,
                }}
              >
                {/* Row 1: Date + Time side by side */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  <input
                    type="date"
                    value={row.scheduled_date}
                    onChange={e => updateRow(row.id, { scheduled_date: e.target.value })}
                    disabled={isBusy}
                    style={{
                      padding: '5px 8px',
                      border: '1px solid #d1d5db',
                      borderRadius: 4,
                      fontSize: 12,
                      fontFamily: 'inherit',
                      width: '100%',
                    }}
                  />
                  <input
                    type="time"
                    value={trimTime(row.scheduled_time)}
                    onChange={e => updateRow(row.id, { scheduled_time: e.target.value || null })}
                    disabled={isBusy}
                    title="Time (optional)"
                    style={{
                      padding: '5px 8px',
                      border: '1px solid #d1d5db',
                      borderRadius: 4,
                      fontSize: 11,
                      fontFamily: 'JetBrains Mono, monospace',
                      width: '100%',
                      color: '#6b7280',
                    }}
                  />
                </div>

                {/* Row 2: Type, Owner, Status, Delete */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 100px 28px',
                    gap: 6,
                    alignItems: 'center',
                  }}
                >
                  <select
                    value={row.type}
                    onChange={e => updateRow(row.id, { type: e.target.value })}
                    disabled={isBusy}
                    style={{
                      padding: '5px 6px',
                      border: '1px solid #d1d5db',
                      borderRadius: 4,
                      fontSize: 11,
                      background: 'white',
                      fontFamily: 'inherit',
                    }}
                  >
                    {SCHEDULE_TYPES.map(t => (
                      <option key={t.id} value={t.id}>{t.icon} {t.label}</option>
                    ))}
                  </select>

                  <select
                    value={row.owner_id || ''}
                    onChange={e => updateRow(row.id, { owner_id: e.target.value || null })}
                    disabled={isBusy}
                    style={{
                      padding: '5px 6px',
                      border: '1px solid #d1d5db',
                      borderRadius: 4,
                      fontSize: 11,
                      background: 'white',
                      fontFamily: 'inherit',
                    }}
                  >
                    <option value="">— Owner —</option>
                    {team.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>

                  <select
                    value={row.status}
                    onChange={e => updateRow(row.id, { status: e.target.value })}
                    disabled={isBusy}
                    style={{
                      padding: '5px 6px',
                      border: 'none',
                      borderRadius: 4,
                      fontSize: 10,
                      background: pill.bg,
                      color: pill.fg,
                      fontWeight: 600,
                      fontFamily: 'inherit',
                      textAlign: 'center',
                      cursor: 'pointer',
                    }}
                    title={eff === 'past_due' ? 'Past due — mark as sent or update date' : ''}
                  >
                    {STATUS_OPTIONS.map(s => (
                      <option key={s.id} value={s.id} style={{ background: 'white', color: '#1a1f2e' }}>
                        {s.label}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => deleteRow(row.id)}
                    disabled={isBusy}
                    title="Delete row"
                    style={{
                      background: 'transparent',
                      border: '1px solid #e5e7eb',
                      color: '#dc2626',
                      borderRadius: 4,
                      cursor: isBusy ? 'wait' : 'pointer',
                      fontSize: 11,
                      padding: '4px 2px',
                      width: 28,
                    }}
                  >
                    ✕
                  </button>
                </div>

                {/* Row 3: Title (full width) */}
                <input
                  type="text"
                  value={row.title || ''}
                  onChange={e => updateRow(row.id, { title: e.target.value || null })}
                  disabled={isBusy}
                  placeholder="What's going out?"
                  style={{
                    padding: '6px 8px',
                    border: '1px solid #d1d5db',
                    borderRadius: 4,
                    fontSize: 12,
                    fontFamily: 'inherit',
                    width: '100%',
                  }}
                />
              </div>
            )
          })}
        </div>
      )}

      {/* Footer note */}
      {!loading && rows.length > 0 && (
        <div className="text-[11px] text-gray-400">
          {rows.length} {rows.length === 1 ? 'date' : 'dates'} scheduled
          {isBuffered ? ' — will save when work order is created.' : '. Changes save automatically.'}
        </div>
      )}
    </div>
  )
}
