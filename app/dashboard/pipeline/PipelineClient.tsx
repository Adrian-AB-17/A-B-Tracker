'use client'

import Link from 'next/link'
import { useViewMode } from '@/lib/useViewMode'
import { STALE_DAYS } from '@/lib/sla'

type StageDistRow = {
  id: string
  label: string
  color: string
  count: number
  value: number
  oldestDays: number
}

type AlertRow = {
  id: string
  title: string
  stage: string
  stageLabel: string
  days: number
  ownerName: string | null
  reason: 'critically-stale' | 'overdue' | 'flagged'
}

export default function PipelineClient({
  currentMember,
  stageDistribution,
  maxCount,
  activeCount,
  notDoneCount,
  archivedCount,
  staleCount,
  criticallyStaleCount,
  overdueOrFlaggedCount,
  overdueCount,
  flaggedCount,
  inApprovalCount,
  readyToInvoiceCount,
  invoicedCount,
  alerts,
}: {
  currentMember: { id: string; role: string } | null
  stageDistribution: StageDistRow[]
  maxCount: number
  activeCount: number
  notDoneCount: number
  archivedCount: number
  staleCount: number
  criticallyStaleCount: number
  overdueOrFlaggedCount: number
  overdueCount: number
  flaggedCount: number
  inApprovalCount: number
  readyToInvoiceCount: number
  invoicedCount: number
  alerts: AlertRow[]
}) {
  const isAdmin = currentMember?.role === 'admin'
  const [viewMode] = useViewMode(isAdmin)
  const showCosts = viewMode === 'admin'

  const reasonLabel = (r: AlertRow['reason']) => {
    switch (r) {
      case 'flagged': return 'Flagged with issue'
      case 'overdue': return 'Past due date'
      case 'critically-stale': return 'Critically overdue in stage'
    }
  }

  const reasonDot = (r: AlertRow['reason']) => {
    switch (r) {
      case 'flagged': return 'bg-red-500'
      case 'overdue': return 'bg-red-500'
      case 'critically-stale': return 'bg-amber-500'
    }
  }

  // Card wrapper as a Link — gives consistent hover + cursor + transition.
  function KpiCard({
    href,
    label,
    value,
    valueColor,
    subtitle,
    subtitleColor,
    borderColor,
  }: {
    href: string
    label: string
    value: number
    valueColor?: string
    subtitle: string
    subtitleColor?: string
    borderColor?: string
  }) {
    return (
      <Link
        href={href}
        className="bg-white rounded-lg border border-gray-200 p-5 transition-all hover:shadow-md hover:border-gray-300 cursor-pointer block"
        style={borderColor ? { borderColor } : undefined}
      >
        <div className="text-xs text-gray-500 uppercase tracking-wide font-semibold">{label}</div>
        <div className="text-3xl font-bold mt-1" style={valueColor ? { color: valueColor } : undefined}>
          {value}
        </div>
        <div className="text-xs mt-1" style={{ color: subtitleColor || '#9ca3af' }}>
          {subtitle}
        </div>
      </Link>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Pipeline Health</h1>
        <p className="text-sm text-gray-500 mt-1">SLA-driven view of what needs attention · Click any tile to filter the board</p>
      </div>

      {/* KPI cards: 4 for team, 6 for admin (2 extra: Ready to Invoice + Invoiced) */}
      <div className={`grid grid-cols-1 sm:grid-cols-2 ${showCosts ? 'lg:grid-cols-3 xl:grid-cols-6' : 'lg:grid-cols-4'} gap-4 mb-6`}>
        {/* Card 1: Active */}
        <KpiCard
          href="/dashboard?active=1"
          label="Active"
          value={activeCount}
          subtitle={`of ${notDoneCount} open · ${archivedCount} archived`}
        />

        {/* Card 2: Stale */}
        <KpiCard
          href="/dashboard?stale=1"
          label={`Stale (${STALE_DAYS}d+)`}
          value={staleCount}
          valueColor={staleCount > 0 ? '#b45309' : undefined}
          subtitle={
            criticallyStaleCount > 0
              ? `${criticallyStaleCount} critically overdue`
              : 'All within threshold'
          }
          subtitleColor={criticallyStaleCount > 0 ? '#dc2626' : undefined}
          borderColor={staleCount > 0 ? '#f59e0b40' : undefined}
        />

        {/* Card 3: Overdue or Flagged */}
        <KpiCard
          href="/dashboard?overdueOrFlagged=1"
          label="Overdue or Flagged"
          value={overdueOrFlaggedCount}
          valueColor={overdueOrFlaggedCount > 0 ? '#dc2626' : undefined}
          subtitle={`${overdueCount} past due · ${flaggedCount} flagged`}
          subtitleColor={overdueOrFlaggedCount > 0 ? '#dc2626' : undefined}
          borderColor={overdueOrFlaggedCount > 0 ? '#dc262640' : undefined}
        />

        {/* Card 4: In Approval */}
        <KpiCard
          href="/dashboard?stage=sent-for-approval"
          label="In Approval"
          value={inApprovalCount}
          valueColor={inApprovalCount > 0 ? '#7c3aed' : undefined}
          subtitle={inApprovalCount > 0 ? 'Waiting on client review' : 'Nothing in approval'}
          borderColor={inApprovalCount > 0 ? '#7c3aed40' : undefined}
        />

        {/* Admin-only Card 5: Ready to Invoice */}
        {showCosts && (
          <KpiCard
            href="/dashboard?stage=approved-or-executed"
            label="Ready to Invoice"
            value={readyToInvoiceCount}
            valueColor={readyToInvoiceCount > 0 ? '#059669' : undefined}
            subtitle={readyToInvoiceCount > 0 ? 'Approved + executed' : 'Nothing to invoice'}
            borderColor={readyToInvoiceCount > 0 ? '#10b98140' : undefined}
          />
        )}

        {/* Admin-only Card 6: Invoiced */}
        {showCosts && (
          <KpiCard
            href="/dashboard?stage=invoiced"
            label="Invoiced"
            value={invoicedCount}
            valueColor={invoicedCount > 0 ? '#d99e2b' : undefined}
            subtitle={invoicedCount > 0 ? 'Awaiting payment' : 'No outstanding invoices'}
            borderColor={invoicedCount > 0 ? '#d99e2b40' : undefined}
          />
        )}
      </div>

      {/* Two-column row: stage distribution (left, wider) + alerts panel (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-5">Distribution by Stage</h2>
          <div className="space-y-3">
            {stageDistribution.map(s => {
              if (s.count === 0) return null
              const pct = (s.count / maxCount) * 100
              return (
                <Link
                  key={s.id}
                  href={`/dashboard?stage=${s.id}`}
                  className="block group rounded-md hover:bg-gray-50 -mx-2 px-2 py-1.5 transition-colors"
                >
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: s.color }} />
                      <span className="font-medium text-gray-700 truncate group-hover:text-gray-900">{s.label}</span>
                    </div>
                    <div className="flex items-center gap-3 font-mono text-xs flex-shrink-0">
                      <span className="text-gray-500 w-16 text-right">{s.count} WOs</span>
                      <span
                        className="w-14 text-right"
                        style={{ color: s.oldestDays > 30 ? '#dc2626' : '#6b7280' }}
                        title={`Oldest WO has been in this stage for ${s.oldestDays} days`}
                      >
                        {s.oldestDays}d
                      </span>
                      {showCosts && (
                        <span className="font-semibold text-gray-900 w-28 text-right">
                          ${s.value.toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, background: s.color }}
                    />
                  </div>
                </Link>
              )
            })}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold text-gray-900">Alerts</h2>
            <span className="text-xs text-gray-500 font-mono">{alerts.length}</span>
          </div>
          {alerts.length === 0 ? (
            <div className="text-sm text-gray-500 py-6 text-center">
              🌿 All clear. No stale, overdue, or flagged work orders.
            </div>
          ) : (
            <div className="space-y-3">
              {alerts.map(a => (
                <Link
                  key={a.id}
                  href={`/dashboard?wo=${a.id}`}
                  className="block group rounded-md hover:bg-gray-50 -mx-2 px-2 py-2 transition-colors"
                >
                  <div className="flex items-start gap-2">
                    <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${reasonDot(a.reason)}`} />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-gray-900 truncate group-hover:text-amber-700">
                        {a.title}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {reasonLabel(a.reason)}
                        {a.reason !== 'flagged' && (
                          <> in <span className="font-medium">{a.stageLabel}</span></>
                        )}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5 font-mono">
                        {a.days}d in stage · {a.ownerName || 'Unassigned'}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
