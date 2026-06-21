import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/reports/culture-answer-rate?month=2026-05
// Returns answer rate metrics cross-referencing LSA phone leads with Cira calls

function prevMonth(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`
}

function lastYearMonth(month: string): string {
  const [y, m] = month.split('-')
  return `${Number(y) - 1}-${m}`
}

async function fetchAnswerRateForMonth(
  supabase: Awaited<ReturnType<typeof createClient>>,
  month: string
) {
  // 1. Get all LSA PHONE leads for this month (charged only — these are the ones Google billed)
  const { data: lsaLeads } = await supabase
    .from('lsa_leads')
    .select('lead_id, customer, lead_received, charge_status, job_type, location, answered')
    .eq('client_id', 'culture')
    .eq('lead_type', 'Phone')
    .like('lead_month', `${month}%`)

  if (!lsaLeads || lsaLeads.length === 0) return null

  const chargedLeads = lsaLeads.filter(l => l.charge_status === 'Charged')
  const totalPhoneLeads = lsaLeads.length
  const chargedPhoneLeads = chargedLeads.length

  // 2. Get Cira calls for this month
  const { data: ciraAll } = await supabase
    .from('cira_calls')
    .select('id, caller_phone, call_date, duration_sec, is_qualified, is_spam, is_new_lead, is_existing_customer, topic, lsa_lead_id, lsa_matched')
    .eq('client_id', 'culture')
    .like('call_month', `${month}%`)

  const ciraCalls = ciraAll || []

  // 3. Total call stats for the month
  const totalCalls        = ciraCalls.length
  const qualifiedCalls    = ciraCalls.filter(c => c.is_qualified).length
  const spamCalls         = ciraCalls.filter(c => c.is_spam).length
  const newLeadCalls      = ciraCalls.filter(c => c.is_new_lead).length
  const existingCustCalls = ciraCalls.filter(c => c.is_existing_customer).length
  const lsaMatchedCalls   = ciraCalls.filter(c => c.lsa_matched).length

  // Average duration (non-spam only)
  const realCalls      = ciraCalls.filter(c => !c.is_spam && c.duration_sec > 0)
  const avgDurationSec = realCalls.length
    ? Math.round(realCalls.reduce((s, c) => s + c.duration_sec, 0) / realCalls.length)
    : 0

  // 4. Answer rate = LSA phone charged leads that have a Cira match / total charged phone leads
  const answeredLeads = chargedLeads.filter(l => {
    // Check via lsa_lead_id FK
    if (ciraCalls.some(c => c.lsa_lead_id === l.lead_id)) return true
    // Fallback: check LSA answered field notes
    const ans = (l.answered || '').toLowerCase()
    return ans && !['no', 'no answer', 'no*', ''].some(v => ans === v)
  })

  const answerRate = chargedPhoneLeads > 0
    ? parseFloat(((answeredLeads.length / chargedPhoneLeads) * 100).toFixed(1))
    : null

  // 5. Missed leads (charged phone leads with NO Cira match and no answered note)
  const missedLeads = chargedLeads.filter(l => {
    const hasCiraMatch  = ciraCalls.some(c => c.lsa_lead_id === l.lead_id)
    const hasAnswerNote = (l.answered || '').toLowerCase().trim()
    return !hasCiraMatch && (!hasAnswerNote || ['no', 'no answer', 'no*'].includes(hasAnswerNote))
  })

  // 6. Booked from LSA (answered field contains booking notes)
  const bookedLeads = lsaLeads.filter(l => {
    const ans = (l.answered || '').toLowerCase()
    return ans.includes('book') || ans.includes('appt') || ans.includes('appointment') || ans.includes('set ')
  })

  // 7. Topic breakdown from Cira
  const topicCounts: Record<string, number> = {}
  ciraCalls.forEach(c => {
    if (!c.is_spam && c.topic) {
      topicCounts[c.topic] = (topicCounts[c.topic] || 0) + 1
    }
  })
  const topTopics = Object.entries(topicCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([topic, count]) => ({ topic, count }))

  return {
    month,
    // LSA phone lead stats
    totalPhoneLeads,
    chargedPhoneLeads,
    answeredLeads:   answeredLeads.length,
    missedLeads:     missedLeads.length,
    bookedLeads:     bookedLeads.length,
    answerRate,
    bookRate: chargedPhoneLeads > 0
      ? parseFloat(((bookedLeads.length / chargedPhoneLeads) * 100).toFixed(1))
      : null,
    // Cira call stats
    totalCalls,
    qualifiedCalls,
    newLeadCalls,
    existingCustCalls,
    spamCalls,
    lsaMatchedCalls,
    avgDurationSec,
    avgDurationMin: `${Math.floor(avgDurationSec / 60)}m ${avgDurationSec % 60}s`,
    // Breakdown
    topTopics,
    missedLeadSample: missedLeads.slice(0, 5).map(l => ({
      leadId:       l.lead_id,
      jobType:      l.job_type,
      location:     l.location,
      leadReceived: l.lead_received,
    })),
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const clientId = searchParams.get('clientId')
  const month    = searchParams.get('month') || new Date().toISOString().slice(0, 7)

  if (clientId !== 'culture') {
    return NextResponse.json({ configured: false, message: 'Culture Construction only' })
  }

  try {
    const supabase = await createClient()
    const pm = prevMonth(month)
    const ly = lastYearMonth(month)

    const [current, prev, lastYear] = await Promise.all([
      fetchAnswerRateForMonth(supabase, month),
      fetchAnswerRateForMonth(supabase, pm),
      fetchAnswerRateForMonth(supabase, ly),
    ])

    return NextResponse.json({
      configured: true,
      clientId,
      month,
      data:         current,
      prevData:     prev,
      lastYearData: lastYear,
    })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[Answer Rate]', msg)
    return NextResponse.json({ error: msg, configured: true, data: null }, { status: 500 })
  }
}
