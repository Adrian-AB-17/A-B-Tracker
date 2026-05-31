// Maps internal wo_stage values to client-facing labels + colors.
// Internal stages (exact): submitted, not-started, in-progress, deliverables-completed,
// sent-for-approval, revisions-received, approved, deliverables-executed,
// invoiced, paid, on-hold, archived.

export type StageView = { label: string; color: string; dot: string }

export const STAGE_VIEW: Record<string, StageView> = {
  'submitted':              { label: 'Received',               color: '#64748b', dot: '#64748b' },
  'not-started':            { label: 'Received',               color: '#64748b', dot: '#64748b' },
  'in-progress':            { label: 'In progress',            color: '#d99e2b', dot: '#d99e2b' },
  'deliverables-completed': { label: 'In progress',            color: '#d99e2b', dot: '#d99e2b' },
  'sent-for-approval':      { label: 'Awaiting your approval', color: '#ea580c', dot: '#ea580c' },
  'revisions-received':     { label: 'In revisions',           color: '#ec4899', dot: '#ec4899' },
  'approved':               { label: 'Approved',               color: '#15803d', dot: '#15803d' },
  'deliverables-executed':  { label: 'In production',          color: '#15803d', dot: '#15803d' },
  'invoiced':               { label: 'Invoiced',               color: '#2563eb', dot: '#2563eb' },
  'paid':                   { label: 'Completed',              color: '#15803d', dot: '#15803d' },
  'on-hold':                { label: 'On hold',                color: '#92400e', dot: '#92400e' },
  'archived':               { label: 'Archived',               color: '#a3a097', dot: '#a3a097' },
}

export function stageView(stage: string): StageView {
  return STAGE_VIEW[stage] || { label: stage, color: '#64748b', dot: '#64748b' }
}

// Stages a client should NOT see at all in their project list.
export const HIDDEN_STAGES = new Set(['archived'])

// "Active" = in motion (not finished, not hidden).
export const FINISHED_STAGES = new Set(['paid', 'archived'])
