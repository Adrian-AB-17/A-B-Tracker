import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function getAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const key = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n')
  if (!email || !key) throw new Error('Missing Google credentials')
  const auth = new google.auth.GoogleAuth({ credentials: { client_email: email, private_key: key }, scopes: ["https://www.googleapis.com/auth/calendar.readonly"] })
  return auth
}

// Parse WO title from structured event names like:
// "-Apollo Supply-Video-Video Testimonial 1-Due:5/13/2026"
// "POUGHKEEPSIE-RBS-Design-POUGHKEEPSIE - IKO DD - FLYER ONLY 5/11/26-Due:5/12/2026"
function parseStructuredTitle(summary: string): string | null {
  // Structured format starts with "-" or has "-Due:" pattern
  if (!summary.includes('-Due:') && !summary.match(/^-\w/)) return null
  // Extract the WO title part (between 3rd dash and -Due:)
  const parts = summary.split('-')
  if (parts.length < 4) return null
  const duePart = summary.indexOf('-Due:')
  const titlePart = duePart > 0 ? summary.slice(0, duePart) : summary
  // Skip first 3 segments (lead dash, client, service)
  const segments = titlePart.split('-').filter(Boolean)
  if (segments.length < 3) return null
  return segments.slice(2).join(' ').trim()
}

export async function POST(req: NextRequest) {
  try {
    const { wo_id } = await req.json().catch(() => ({}))
    const calendarId = process.env.GOOGLE_CALENDAR_ID
    if (!calendarId) return NextResponse.json({ ok: false, error: 'No GOOGLE_CALENDAR_ID' }, { status: 500 })

    const auth = getAuth()
    const calendar = google.calendar({ version: 'v3', auth })

    // Fetch events from last 12 months
    const timeMin = new Date()
    timeMin.setFullYear(timeMin.getFullYear() - 1)

    const res = await calendar.events.list({
      calendarId,
      timeMin: timeMin.toISOString(),
      maxResults: 500,
      singleEvents: true,
      orderBy: 'startTime',
    })

    const events = res.data.items || []

    // Fetch all WOs for matching
    const { data: workOrders } = await supabaseAdmin
      .from('work_orders')
      .select('id, title, client_id')
      .not('stage', 'in', '(archived,paid)')

    if (!workOrders) return NextResponse.json({ ok: false, error: 'Could not fetch WOs' })

    // Build title→id map (lowercase)
    const woMap = new Map(workOrders.map(w => [w.title.toLowerCase().trim(), w.id]))

    let matched = 0
    let skipped = 0
    const inserts: any[] = []

    for (const event of events) {
      const summary = event.summary || ''
      const startDate = event.start?.date || event.start?.dateTime?.split('T')[0]
      if (!startDate || !summary) { skipped++; continue }

      // Skip test events
      if (/^test/i.test(summary) || summary.toLowerCase().includes('testing')) { skipped++; continue }

      // Try structured parse first
      let woId: string | undefined
      const parsedTitle = parseStructuredTitle(summary)
      if (parsedTitle) {
        woId = woMap.get(parsedTitle.toLowerCase())
      }

      // If specific wo_id requested, only process that one
      if (wo_id && woId !== wo_id) continue

      if (!woId) { skipped++; continue }

      // Check if already exists (by google_event_id)
      const { data: existing } = await supabaseAdmin
        .from('wo_schedule')
        .select('id')
        .eq('google_event_id', event.id!)
        .maybeSingle()

      if (existing) { skipped++; continue }

      inserts.push({
        work_order_id: woId,
        scheduled_date: startDate,
        scheduled_time: event.start?.dateTime ? event.start.dateTime.split('T')[1]?.slice(0, 5) : null,
        type: 'other',
        title: summary,
        status: 'scheduled',
        calendar_synced: true,
        google_event_id: event.id,
      })
      matched++
    }

    if (inserts.length > 0) {
      const { error } = await supabaseAdmin.from('wo_schedule').insert(inserts)
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, matched, skipped, inserted: inserts.length })
  } catch (e: any) {
    console.error('Calendar sync error:', e)
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}

export async function GET() {
  return POST(new NextRequest('http://localhost/api/calendar/sync', { method: 'POST', body: '{}' }))
}
