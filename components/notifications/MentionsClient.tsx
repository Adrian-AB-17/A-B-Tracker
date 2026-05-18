'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Notification = {
  id: string
  source_type: string
  source_id?: string
  work_order_id?: string
  body_preview?: string
  author_name?: string
  link_url?: string
  read_at?: string
  created_at: string
}

export default function MentionsClient({ initial }: { initial: Notification[] }) {
  const [notifications, setNotifications] = useState<Notification[]>(initial)
  const [filter, setFilter] = useState<'all' | 'unread'>('unread')
  const supabase = createClient()

  function relativeTime(iso: string) {
    const diff = Date.now() - new Date(iso).getTime()
    const m = Math.floor(diff / 60000)
    const h = Math.floor(diff / 3600000)
    const d = Math.floor(diff / 86400000)
    if (m < 1) return 'just now'
    if (m < 60) return `${m}m ago`
    if (h < 24) return `${h}h ago`
    if (d < 7) return `${d}d ago`
    return new Date(iso).toLocaleDateString()
  }

  async function markAsRead(id: string) {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
    await supabase.from('wo_notifications').update({ read_at: new Date().toISOString() }).eq('id', id)
  }

  async function markAllAsRead() {
    const unread = notifications.filter(n => !n.read_at)
    if (unread.length === 0) return
    setNotifications(prev => prev.map(n => ({ ...n, read_at: n.read_at || new Date().toISOString() })))
    await supabase.from('wo_notifications').update({ read_at: new Date().toISOString() }).is('read_at', null)
  }

  const filtered = filter === 'unread' ? notifications.filter(n => !n.read_at) : notifications
  const unreadCount = notifications.filter(n => !n.read_at).length

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">My Mentions</h1>
        <p className="text-sm text-gray-500 mt-1">Comments and posts where you were @mentioned</p>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => setFilter('unread')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
            filter === 'unread' ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}>
          Unread {unreadCount > 0 && <span className="ml-1 bg-red-500 text-white text-[10px] rounded-full px-1.5">{unreadCount}</span>}
        </button>
        <button onClick={() => setFilter('all')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
            filter === 'all' ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}>
          All
        </button>
        {unreadCount > 0 && (
          <button onClick={markAllAsRead} className="ml-auto text-xs text-gray-500 hover:text-gray-900 underline">
            Mark all as read
          </button>
        )}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-50">
        {filtered.length === 0 ? (
          <div className="text-center text-gray-400 py-12 text-sm">
            {filter === 'unread' ? 'No unread mentions' : 'No mentions yet'}
          </div>
        ) : filtered.map(n => (
          <a key={n.id} href={n.link_url || '/dashboard'}
            onClick={() => !n.read_at && markAsRead(n.id)}
            className={`block p-4 hover:bg-blue-50 transition-colors relative ${!n.read_at ? 'bg-blue-50/30' : ''}`}>
            {!n.read_at && <div className="absolute left-1 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-blue-500" />}
            <div className="flex items-start gap-3 ml-3">
              <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold text-white" style={{ background: '#2d4a7c' }}>
                {(n.author_name || '?')[0]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm">
                  <span className="font-semibold text-gray-900">{n.author_name || 'Someone'}</span>
                  <span className="text-gray-500"> mentioned you in a comment</span>
                </div>
                {n.body_preview && (
                  <div className="text-sm text-gray-700 mt-1 line-clamp-2 italic">"{n.body_preview}"</div>
                )}
                <div className="text-xs text-gray-400 mt-1">{relativeTime(n.created_at)}</div>
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  )
}
