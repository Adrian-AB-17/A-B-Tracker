import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'

function getAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const key = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n')
  if (!email || !key) throw new Error('Missing Google credentials')
  return new google.auth.GoogleAuth({
    credentials: { client_email: email, private_key: key },
    scopes: ['https://www.googleapis.com/auth/calendar.events'],
  })
}

function buildEventTitle(woTitle: string, scheduleTitle: string | null, type: string): string {
  return scheduleTitle
    ? `${woTitle} — ${scheduleTitle}`
    : `${woTitle} — ${type}`
}

export async function POST(req: NextRequest) {
  try {
    const { action, scheduleRow, woTitle, dueDate } = await req.json() as {
      action: 'create' | 'update' | 'delete'
      scheduleRow: {
        id: string
        work_order_id: string
        scheduled_date: string
        scheduled_time: string | null
        type: string
        title: string | null
        status: string
        google_event_id?: string | null
      }
      woTitle: string
      dueDate?: string | null
    }

    const calendarId = process.env.GOOGLE_CALENDAR_ID
    if (!calendarId) return NextResponse.json({ ok: false, error: 'No GOOGLE_CALENDAR_ID' }, { status: 500 })

    const auth = getAuth()
    const calendar = google.calendar({ version: 'v3', auth })

    const summary = buildEventTitle(woTitle, scheduleRow.title, scheduleRow.type)
    const dateStr = scheduleRow.scheduled_date

    // Build start/end
    let start: any, end: any
    if (scheduleRow.scheduled_time) {
      const startDT = `${dateStr}T${scheduleRow.scheduled_time}:00`
      const endDT = `${dateStr}T${scheduleRow.scheduled_time.replace(/(\d+)/, (m) => String(parseInt(m) + 1).padStart(2, '0'))}:00`
      start = { dateTime: startDT, timeZone: 'America/Chicago' }
      end = { dateTime: endDT, timeZone: 'America/Chicago' }
    } else {
      start = { date: dateStr }
      end = { date: dateStr }
    }

    if (action === 'delete') {
      if (!scheduleRow.google_event_id) return NextResponse.json({ ok: true, deleted: false })
      await calendar.events.delete({ calendarId, eventId: scheduleRow.google_event_id }).catch(() => {})
      return NextResponse.json({ ok: true, deleted: true })
    }

    if (action === 'create') {
      const res = await calendar.events.insert({
        calendarId,
        requestBody: { summary, start, end, transparency: 'transparent' },
      })
      return NextResponse.json({ ok: true, google_event_id: res.data.id })
    }

    if (action === 'update') {
      if (!scheduleRow.google_event_id) {
        // No existing event — create one
        const res = await calendar.events.insert({
          calendarId,
          requestBody: { summary, start, end, transparency: 'transparent' },
        })
        return NextResponse.json({ ok: true, google_event_id: res.data.id })
      }
      await calendar.events.patch({
        calendarId,
        eventId: scheduleRow.google_event_id,
        requestBody: { summary, start, end },
      })
      return NextResponse.json({ ok: true, google_event_id: scheduleRow.google_event_id })
    }

    return NextResponse.json({ ok: false, error: 'Unknown action' }, { status: 400 })
  } catch (e: any) {
    console.error('Calendar event error:', e)
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
