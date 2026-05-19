import { createClient } from '@/lib/supabase/server'
import { STAGES } from '@/lib/types'
import type { WorkOrder } from '@/lib/types'
import {
  ACTIVE_DELIVERY_STAGES,
  isStale,
  isCriticallyStale,
  isOverdue,
  daysInStage,
} from '@/lib/sla'
import PipelineClient from './PipelineClient'

export const dynamic = 'force-dynamic'

type AlertRow = {
  id: string
  title: string
  stage: string
  stageLabel: string
  days: number
  ownerName: string | null
  reason: 'critically-stale' | 'overdue' | 'flagged'
}

type StageDistRow = {
  id: string
  label: string
  color: string
  count: number
  value: number
  oldestDays: number
}

export default async function PipelinePage() {
  const supabase = createClient()

  // Fetch WOs with all fields needed for SLA + alerts computation
  const { data: wosRaw } = await supabase
    .from('work_orders')
    .select(`
      id, title, stage, priority, est_cost, add_cost, ad_spend, due_date,
      submitted_at, stage_entered_at, flagged, owner_id
    `)

  const wos = (wosRaw || []) as Array<Pick<WorkOrder,
    'id' | 'title' | 'stage' | 'priority' | 'est_cost' | 'add_cost' | 'ad_spend' |
    'due_date' | 'submitted_at' | 'stage_entered_at' | 'flagged' | 'owner_id'
  >>

  // Owner name lookup — fetch all team members once
  const { data: members } = await supabase.from('team_members').select('id, name')
  const memberNameById = new Map<string, string>()
  ;(members || []).forEach(m => memberNameById.set(m.id, m.name))

  // Current user's team_member row for role-based view gating
  const { data: { user } } = await supabase.auth.getUser()
  const { data: currentMember } = user
    ? await supabase.from('team_members').select('id, role').eq('auth_user_id', user.id).maybeSingle()
    : { data: null }

  // ----- Stage distribution -----
  const stageAgg: Record<string, { count: number; value: number; oldestDays: number }> = {}
  STAGES.forEach(s => stageAgg[s.id] = { count: 0, value: 0, oldestDays: 0 })

  wos.forEach(wo => {
    if (!stageAgg[wo.stage]) return
    stageAgg[wo.stage].count++
    stageAgg[wo.stage].value += (wo.est_cost || 0) + (wo.add_cost || 0) + (wo.ad_spend || 0)
    const d = daysInStage(wo)
    if (d > stageAgg[wo.stage].oldestDays) {
      stageAgg[wo.stage].oldestDays = d
    }
  })

  const stageDistribution: StageDistRow[] = STAGES.map(s => ({
    id: s.id,
    label: s.label,
    color: s.color,
    count: stageAgg[s.id].count,
    value: stageAgg[s.id].value,
    oldestDays: stageAgg[s.id].oldestDays,
  }))

  const maxCount = Math.max(...stageDistribution.map(s => s.count), 1)

  // ----- KPI counts (Session 6, May 19 2026 definitions) -----
  // Active = stages where the team is actively delivering work (tight definition)
  const activeDeliverySet = new Set<string>(ACTIVE_DELIVERY_STAGES)
  const activeCount = wos.filter(w => activeDeliverySet.has(w.stage)).length

  // Total counts for the Active subtitle context
  const archivedCount = wos.filter(w => w.stage === 'archived').length
  const notDoneCount = wos.filter(w => w.stage !== 'paid' && w.stage !== 'archived').length

  // For stale/overdue/flagged, only consider WOs that aren't done
  const liveWos = wos.filter(w => w.stage !== 'paid' && w.stage !== 'archived')

  // Stale = flat 10 days in any stage (excluding paid/archived)
  const staleWos = liveWos.filter(isStale)
  const staleCount = staleWos.length
  const criticallyStaleCount = liveWos.filter(isCriticallyStale).length

  // Overdue or Flagged = due_date past OR flagged=true (union)
  const overdueWos = liveWos.filter(isOverdue)
  const overdueCount = overdueWos.length
  const flaggedCount = liveWos.filter(w => w.flagged === true).length
  const overdueOrFlaggedIds = new Set<string>()
  overdueWos.forEach(w => overdueOrFlaggedIds.add(w.id))
  liveWos.filter(w => w.flagged === true).forEach(w => overdueOrFlaggedIds.add(w.id))
  const overdueOrFlaggedCount = overdueOrFlaggedIds.size

  // In Approval = stage = sent-for-approval (broad visibility, all)
  const inApprovalCount = liveWos.filter(w => w.stage === 'sent-for-approval').length

  // Admin-only KPIs
  const readyToInvoiceCount = liveWos.filter(
    w => w.stage === 'approved' || w.stage === 'deliverables-executed'
  ).length
  const invoicedCount = liveWos.filter(w => w.stage === 'invoiced').length

  // ----- Alerts panel: union of flagged + overdue + critically-stale, top 10 -----
  // Priority order: flagged > overdue > critically-stale (dedup by WO id; first match wins)
  const alertsMap = new Map<string, AlertRow>()
  const stageLabelById = new Map(STAGES.map(s => [s.id, s.label]))

  liveWos.forEach(w => {
    if (alertsMap.has(w.id)) return
    let reason: AlertRow['reason'] | null = null
    if (w.flagged === true) reason = 'flagged'
    else if (isOverdue(w)) reason = 'overdue'
    else if (isCriticallyStale(w)) reason = 'critically-stale'
    if (!reason) return
    alertsMap.set(w.id, {
      id: w.id,
      title: w.title,
      stage: w.stage,
      stageLabel: stageLabelById.get(w.stage) || w.stage,
      days: daysInStage(w),
      ownerName: w.owner_id ? (memberNameById.get(w.owner_id) || null) : null,
      reason,
    })
  })

  const reasonRank: Record<AlertRow['reason'], number> = {
    'flagged': 0,
    'overdue': 1,
    'critically-stale': 2,
  }
  const alerts: AlertRow[] = Array.from(alertsMap.values())
    .sort((a, b) => {
      if (reasonRank[a.reason] !== reasonRank[b.reason]) {
        return reasonRank[a.reason] - reasonRank[b.reason]
      }
      return b.days - a.days
    })
    .slice(0, 10)

  return (
    <PipelineClient
      currentMember={currentMember}
      stageDistribution={stageDistribution}
      maxCount={maxCount}
      activeCount={activeCount}
      notDoneCount={notDoneCount}
      archivedCount={archivedCount}
      staleCount={staleCount}
      criticallyStaleCount={criticallyStaleCount}
      overdueOrFlaggedCount={overdueOrFlaggedCount}
      overdueCount={overdueCount}
      flaggedCount={flaggedCount}
      inApprovalCount={inApprovalCount}
      readyToInvoiceCount={readyToInvoiceCount}
      invoicedCount={invoicedCount}
      alerts={alerts}
    />
  )
}
