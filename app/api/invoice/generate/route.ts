import { NextRequest, NextResponse } from 'next/server'
import { execSync } from 'child_process'
import { writeFileSync, readFileSync, unlinkSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import path from 'path'

export async function POST(req: NextRequest) {
  try {
    const data = await req.json()
    const ts = Date.now()
    const tmpOut = join(tmpdir(), `invoice-${ts}.pdf`)
    const scriptPath = path.join(process.cwd(), 'scripts', 'generate_invoice.py')

    execSync(`python3 ${scriptPath} ${tmpOut}`, {
      input: JSON.stringify(data),
      timeout: 30000,
    })

    const pdf = readFileSync(tmpOut)
    try { unlinkSync(tmpOut) } catch {}

    return new NextResponse(pdf, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="invoice-${data.invoice_number || 'draft'}.pdf"`,
      }
    })
  } catch (e: any) {
    console.error('Invoice generation error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
