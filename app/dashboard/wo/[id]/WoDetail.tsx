'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'

type Tab =
  | 'overview'
  | 'campaign'
  | 'tasks'
  | 'messages'
  | 'files'
  | 'schedule'
  | 'vendor-invoices'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'overview',        label: 'Overview',        icon: '📋' },
  { id: 'campaign',        label: 'Campaign Items',  icon: '📣' },
  { id: 'tasks',           label: 'Tasks',           icon: '✓'  },
  { id: 'messages',        label: 'Messages',        icon: '💬' },
  { id: 'files',           label: 'Files',           icon: '📎' },
  { id: 'schedule',        label: 'Schedule',        icon: '📅' },
  { id: 'vendor-invoices', label: 'Vendor Invoices', icon: '🧾' },
]

const STAGE_COLORS: Record<string, string> = {
  submitted:        '#94a3b8',
  scoping:          '#0ea5e9',
  in_progress:      '#6366f1',
  client_review:    '#f59e0b',
  revisions:        '#ec4899',
  approved:         '#10b981',
  in_production:    '#8b5cf6',
  delivered:        '#14b8a6',
  invoiced:         '#22c55e',
  paid:             '#65a30d',
  on_hold:          '#737373',
  archived:         '#a3a3a3',
}

export default function WoDetail({
  wo,
  initialTab,
}: {
  wo: any
  initialTab?: string
}) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const validTab = (t: string | undefined): Tab =>
    TABS.find(x => x.id === t) ? (t as Tab) : 'overview'

  const [tab, setTab] = useState<Tab>(validTab(initialTab))

  // Keep tab state in sync with URL (?tab=campaign etc.)
  useEffect(() => {
    const urlTab = validTab(searchParams.get('tab') || undefined)
    if (urlTab !== tab) setTab(urlTab)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const switchTab = (next: Tab) => {
    setTab(next)
    const params = new URLSearchParams(window.location.search)
    if (next === 'overview') {
      params.delete('tab')
    } else {
      params.set('tab', next)
    }
    const query = params.toString()
    router.replace(`/dashboard/wo/${wo.id}${query ? '?' + query : ''}`, { scroll: false })
  }

  const clientName = wo.clients?.name || 'Unknown client'
  const serviceName = wo.services?.name || 'Unknown service'
  const ownerName = wo.team_members?.name || 'Unassigned'
  const stageColor = STAGE_COLORS[wo.stage] || '#94a3b8'

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      {/* Hero header */}
      <div
        className="border-b px-6 py-4"
        style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)' }}
      >
        <div className="max-w-[1400px] mx-auto">
          {/* Breadcrumb */}
          <div className="text-sm mb-2" style={{ color: 'var(--text-muted)' }}>
            <Link href="/dashboard" className="hover:underline">
              ← Back to Board
            </Link>
          </div>

          {/* Title + meta */}
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0 flex-1">
              <h1
                className="text-2xl font-bold mb-1"
                style={{ color: 'var(--text)' }}
              >
                {wo.title || 'Untitled work order'}
              </h1>
              <div
                className="text-sm flex items-center gap-3 flex-wrap"
                style={{ color: 'var(--text-muted)' }}
              >
                <span>
                  <strong style={{ color: 'var(--text)' }}>{clientName}</strong>
                </span>
                <span>·</span>
                <span>{serviceName}</span>
                <span>·</span>
                <span>Owner: {ownerName}</span>
                <span>·</span>
                <span style={{ fontFamily: 'monospace', fontSize: '12px' }}>
                  {wo.id}
                </span>
              </div>
            </div>

            {/* Stage badge (read-only for now; editing comes in Step 2) */}
            <div
              className="px-3 py-1.5 rounded-full text-sm font-medium"
              style={{
                background: stageColor + '22',
                color: stageColor,
                border: `1px solid ${stageColor}44`,
              }}
            >
              {wo.stage?.replace(/_/g, ' ').toUpperCase()}
            </div>
          </div>
        </div>
      </div>

      {/* Tab nav */}
      <div
        className="border-b sticky top-0 z-10 px-6"
        style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)' }}
      >
        <div className="max-w-[1400px] mx-auto flex gap-1 overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => switchTab(t.id)}
              className="px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors"
              style={{
                color: tab === t.id ? 'var(--text)' : 'var(--text-muted)',
                borderBottom: tab === t.id
                  ? '2px solid var(--accent, #6366f1)'
                  : '2px solid transparent',
                marginBottom: '-1px',
              }}
            >
              <span className="mr-1.5">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="max-w-[1400px] mx-auto px-6 py-6">
        {tab === 'overview' && (
          <Placeholder
            title="Overview"
            note="Title, client, service, costs, people, recent activity will live here. Coming in Step 2."
          />
        )}
        {tab === 'campaign' && (
          <Placeholder
            title="Campaign Items"
            note="The campaign builder will move here with a full 5-column grid. Coming in Step 3."
          />
        )}
        {tab === 'tasks' && (
          <Placeholder
            title="Tasks"
            note="Lifting the tasks UI out of the drawer into this tab. Coming in Step 5."
          />
        )}
        {tab === 'messages' && (
          <Placeholder
            title="Messages"
            note="Comments + @mentions get a proper home here. Coming in Step 5."
          />
        )}
        {tab === 'files' && (
          <Placeholder
            title="Files"
            note="URL list for v1. Per-WO folder + uploads come with the portal in Phase 2."
          />
        )}
        {tab === 'schedule' && (
          <Placeholder
            title="Schedule"
            note="Execution dates + Google Calendar sync. Session 11."
          />
        )}
        {tab === 'vendor-invoices' && (
          <Placeholder
            title="Vendor Invoices"
            note="Accurate Printing PDFs (internal-only, no cost math). Apps Script → Supabase wiring in Session 11."
          />
        )}
      </div>
    </div>
  )
}

function Placeholder({ title, note }: { title: string; note: string }) {
  return (
    <div
      className="rounded-lg border p-8 text-center"
      style={{
        background: 'var(--bg-elevated)',
        borderColor: 'var(--border)',
        color: 'var(--text-muted)',
      }}
    >
      <div className="text-lg font-medium mb-2" style={{ color: 'var(--text)' }}>
        {title}
      </div>
      <div className="text-sm">{note}</div>
    </div>
  )
}
