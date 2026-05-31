'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function AccountClient({ email }: { email: string }) {
  const supabase = createClient()
  const [pw, setPw] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  async function save() {
    setMsg(null)
    if (pw.length < 8) {
      setMsg({ kind: 'err', text: 'Password must be at least 8 characters.' })
      return
    }
    if (pw !== confirm) {
      setMsg({ kind: 'err', text: 'Passwords do not match.' })
      return
    }
    setSaving(true)
    const { error } = await supabase.auth.updateUser({ password: pw })
    setSaving(false)
    if (error) {
      setMsg({ kind: 'err', text: error.message })
      return
    }
    setPw('')
    setConfirm('')
    setMsg({ kind: 'ok', text: 'Password updated.' })
  }

  return (
    <div className="p-4 md:p-6 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Account</h1>
      <p className="text-sm text-gray-500 mb-6">{email}</p>

      <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-900">Change password</h2>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">New password</label>
          <input
            type="password"
            value={pw}
            onChange={e => setPw(e.target.value)}
            autoComplete="new-password"
            className="w-full text-sm px-3 py-2 border border-gray-300 rounded focus:border-blue-500 focus:outline-none"
            placeholder="At least 8 characters"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Confirm new password</label>
          <input
            type="password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            autoComplete="new-password"
            className="w-full text-sm px-3 py-2 border border-gray-300 rounded focus:border-blue-500 focus:outline-none"
            placeholder="Re-enter password"
          />
        </div>

        {msg && (
          <div
            className={`text-xs px-3 py-2 rounded ${
              msg.kind === 'ok'
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-red-50 text-red-700'
            }`}
          >
            {msg.text}
          </div>
        )}

        <button
          onClick={save}
          disabled={saving || !pw || !confirm}
          className="px-4 py-1.5 rounded-lg text-sm font-semibold text-white disabled:opacity-40"
          style={{ background: '#1a2b4a' }}
        >
          {saving ? 'Saving\u2026' : 'Update password'}
        </button>
      </div>
    </div>
  )
}
