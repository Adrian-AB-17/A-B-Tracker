#!/bin/bash
set -e
cd ~/ab-tracker

echo "→ Step 1/5: Adding @mentions autocomplete to comments in BoardClient..."

python3 << 'PYEOF'
path = 'components/work-orders/BoardClient.tsx'
with open(path) as f:
    c = f.read()

old_state = """  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState('')
  const [postingComment, setPostingComment] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)"""

new_state = """  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState('')
  const [postingComment, setPostingComment] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [mentionDropdown, setMentionDropdown] = useState<{ open: boolean; query: string; position: number }>({ open: false, query: '', position: 0 })
  const [mentionIndex, setMentionIndex] = useState(0)"""

c = c.replace(old_state, new_state)
print("✅ Mention state added")

old_post = "  async function postComment() {"
new_post = """  function handleCommentInput(value: string, cursorPos: number) {
    setNewComment(value)
    const before = value.substring(0, cursorPos)
    const m = before.match(/(?:^|\\s)@(\\w*)$/)
    if (m) {
      setMentionDropdown({ open: true, query: m[1].toLowerCase(), position: cursorPos - m[1].length - 1 })
      setMentionIndex(0)
    } else {
      setMentionDropdown({ open: false, query: '', position: 0 })
    }
  }

  const mentionCandidates = useMemo(() => {
    if (!selectedWo || (selectedWo as any).__new) return team
    const wo = selectedWo as WorkOrder
    const priorityIds = new Set<string>()
    if (wo.owner_id) priorityIds.add(wo.owner_id)
    const priority = team.filter((t: any) => priorityIds.has(t.id))
    const others = team.filter((t: any) => !priorityIds.has(t.id))
    return [...priority, ...others]
  }, [team, selectedWo])

  const mentionMatches = useMemo(() => {
    const q = mentionDropdown.query
    return mentionCandidates.filter((t: any) =>
      t.name.toLowerCase().includes(q)
    ).slice(0, 6)
  }, [mentionCandidates, mentionDropdown.query])

  function insertMention(memberName: string) {
    const cursorPos = mentionDropdown.position + 1 + mentionDropdown.query.length
    const before = newComment.substring(0, mentionDropdown.position)
    const after = newComment.substring(cursorPos)
    const updated = before + '@' + memberName + ' ' + after
    setNewComment(updated)
    setMentionDropdown({ open: false, query: '', position: 0 })
  }

  function extractMentionedIds(body: string): string[] {
    const ids: string[] = []
    const seen = new Set<string>()
    const matches = body.match(/@(\\w+)/g) || []
    matches.forEach(m => {
      const name = m.substring(1).toLowerCase()
      const member = team.find((t: any) => t.name.toLowerCase() === name || t.name.toLowerCase().startsWith(name))
      if (member && member.auth_user_id && !seen.has(member.auth_user_id)) {
        seen.add(member.auth_user_id)
        ids.push(member.auth_user_id)
      }
    })
    return ids
  }

  async function postComment() {"""

c = c.replace(old_post, new_post)
print("✅ Mention helpers added")

old_post_body = """    const { data, error } = await supabase.from('wo_comments')
      .insert({ work_order_id: wo.id, body, author_id: currentUserId })
      .select()
      .single()
    setPostingComment(false)
    if (error) { alert('Failed to post: ' + error.message); return }
    setComments(prev => [...prev, data as Comment])
    setNewComment('')
  }"""

new_post_body = """    const mentionIds = extractMentionedIds(body)
    const { data, error } = await supabase.from('wo_comments')
      .insert({ work_order_id: wo.id, body, author_id: currentUserId, mentions: mentionIds })
      .select()
      .single()
    setPostingComment(false)
    if (error) { alert('Failed to post: ' + error.message); return }
    setComments(prev => [...prev, data as Comment])
    setNewComment('')
    if (mentionIds.length > 0 && data) {
      const authorName = team.find((t: any) => t.auth_user_id === currentUserId)?.name || 'Someone'
      const preview = body.substring(0, 120)
      const notifPayload = mentionIds
        .filter(uid => uid !== currentUserId)
        .map(uid => ({
          user_id: uid,
          source_type: 'comment',
          source_id: (data as any).id,
          work_order_id: wo.id,
          body_preview: preview,
          author_name: authorName,
          link_url: '/dashboard?wo=' + wo.id,
        }))
      if (notifPayload.length > 0) {
        await supabase.from('wo_notifications').insert(notifPayload)
      }
    }
  }"""

c = c.replace(old_post_body, new_post_body)
print("✅ postComment writes mentions + notifications")

old_textarea = """                    <textarea value={newComment}
                      onChange={e => setNewComment(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                          e.preventDefault()
                          postComment()
                        }
                      }}
                      placeholder="Add a comment... (Cmd+Enter to post)"
                      rows={2}
                      className="flex-1 text-sm px-3 py-2 border border-gray-200 rounded-lg resize-none focus:outline-none focus:border-blue-500" />"""

new_textarea = """                    <div className="flex-1 relative">
                      <textarea value={newComment}
                        onChange={e => handleCommentInput(e.target.value, e.target.selectionStart)}
                        onKeyDown={e => {
                          if (mentionDropdown.open && mentionMatches.length > 0) {
                            if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIndex(i => (i + 1) % mentionMatches.length); return }
                            if (e.key === 'ArrowUp') { e.preventDefault(); setMentionIndex(i => (i - 1 + mentionMatches.length) % mentionMatches.length); return }
                            if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); insertMention((mentionMatches[mentionIndex] as any).name); return }
                            if (e.key === 'Escape') { setMentionDropdown({ open: false, query: '', position: 0 }); return }
                          }
                          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                            e.preventDefault()
                            postComment()
                          }
                        }}
                        placeholder="Add a comment... use @ to mention. (Cmd+Enter to post)"
                        rows={2}
                        className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg resize-none focus:outline-none focus:border-blue-500" />
                      {mentionDropdown.open && mentionMatches.length > 0 && (
                        <div className="absolute bottom-full left-0 mb-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 min-w-[200px] max-h-56 overflow-y-auto">
                          {mentionMatches.map((m: any, idx: number) => (
                            <button key={m.id} onClick={() => insertMention(m.name)}
                              onMouseEnter={() => setMentionIndex(idx)}
                              className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 ${idx === mentionIndex ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                              <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: '#2d4a7c' }}>{m.name[0]}</div>
                              <span className="font-medium">{m.name}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>"""

c = c.replace(old_textarea, new_textarea)
print("✅ Textarea replaced with autocomplete-enabled version")

old_comment_body = """                            <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap break-words">
                              {comment.body}
                            </div>"""

new_comment_body = """                            <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap break-words">
                              {comment.body.split(/(@\\w+)/g).map((part: string, idx: number) => {
                                if (part.startsWith('@')) {
                                  const memberExists = team.some((t: any) => t.name.toLowerCase() === part.substring(1).toLowerCase())
                                  if (memberExists) {
                                    return <span key={idx} className="bg-blue-100 text-blue-800 rounded px-1 py-0.5 font-medium">{part}</span>
                                  }
                                }
                                return <span key={idx}>{part}</span>
                              })}
                            </div>"""

c = c.replace(old_comment_body, new_comment_body)
print("✅ Mentions visually highlighted in displayed comments")

with open(path, 'w') as f:
    f.write(c)
PYEOF

echo "→ Step 2/5: Creating My Mentions page..."

mkdir -p app/dashboard/mentions

cat > app/dashboard/mentions/page.tsx << 'EOF'
import { createClient } from '@/lib/supabase/server'
import MentionsClient from '@/components/notifications/MentionsClient'

export const dynamic = 'force-dynamic'

export default async function MentionsPage() {
  const supabase = createClient()
  const { data: user } = await supabase.auth.getUser()

  if (!user?.user) {
    return <div className="p-6 text-sm text-gray-500">Please log in.</div>
  }

  const { data: notifications } = await supabase
    .from('wo_notifications')
    .select('*')
    .eq('user_id', user.user.id)
    .order('created_at', { ascending: false })
    .limit(200)

  return <MentionsClient initial={notifications || []} />
}
EOF

mkdir -p components/notifications

cat > components/notifications/MentionsClient.tsx << 'EOF'
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
EOF

echo "→ Step 3/5: Adding sidebar badge component..."

cat > components/layout/MentionBadge.tsx << 'EOF'
'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function MentionBadge() {
  const [count, setCount] = useState(0)
  const supabase = createClient()

  useEffect(() => {
    async function loadCount() {
      const { data: user } = await supabase.auth.getUser()
      if (!user.user) return
      const { count: c } = await supabase
        .from('wo_notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.user.id)
        .is('read_at', null)
      setCount(c || 0)
    }
    loadCount()
    const interval = setInterval(loadCount, 30000)
    return () => clearInterval(interval)
  }, [supabase])

  useEffect(() => {
    let channel: any
    async function subscribe() {
      const { data: user } = await supabase.auth.getUser()
      if (!user.user) return
      const userId = user.user.id
      channel = supabase
        .channel('mention-notifications-' + userId)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'wo_notifications',
          filter: `user_id=eq.${userId}`,
        }, (payload: any) => {
          setCount(c => c + 1)
          if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
            const n = payload.new
            const notif = new Notification(`${n.author_name || 'Someone'} mentioned you`, {
              body: n.body_preview || 'You were mentioned in a comment',
              icon: '/favicon.ico',
              tag: 'mention-' + n.id,
            })
            notif.onclick = () => {
              window.focus()
              if (n.link_url) window.location.href = n.link_url
            }
          }
        })
        .subscribe()
    }
    subscribe()
    return () => { if (channel) supabase.removeChannel(channel) }
  }, [supabase])

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return
    if (Notification.permission === 'default') {
      const timer = setTimeout(() => {
        Notification.requestPermission()
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [])

  if (count === 0) return null
  return (
    <span className="ml-auto bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
      {count > 99 ? '99+' : count}
    </span>
  )
}
EOF

echo "→ Step 4/5: Adding Mentions to sidebar nav + wiring badge..."

python3 << 'PYEOF'
path = 'components/layout/Sidebar.tsx'
with open(path) as f:
    c = f.read()

if "MentionBadge" not in c:
    c = c.replace(
        "import { usePathname } from 'next/navigation'",
        "import { usePathname } from 'next/navigation'\nimport MentionBadge from './MentionBadge'"
    )
    print("✅ MentionBadge import added")

if "'/dashboard/mentions'" not in c:
    c = c.replace(
        "{ href: '/dashboard/tasks',     label: 'My Tasks',        icon: '✓' },",
        "{ href: '/dashboard/tasks',     label: 'My Tasks',        icon: '✓' },\n  { href: '/dashboard/mentions',  label: 'My Mentions',     icon: '@' },"
    )
    print("✅ Mentions added to NAV array")

if "<MentionBadge" not in c:
    c = c.replace(
        '<span className="text-base">{item.icon}</span>\n                {item.label}',
        '<span className="text-base">{item.icon}</span>\n                {item.label}\n                {item.href === \'/dashboard/mentions\' && <MentionBadge />}'
    )
    print("✅ MentionBadge wired into nav render")

with open(path, 'w') as f:
    f.write(c)
PYEOF

echo "→ Step 5/5: Enabling realtime on wo_notifications (Supabase requires opt-in)..."
echo ""
echo "⚠️  IMPORTANT: One manual step required in Supabase Dashboard:"
echo "   1. Go to Database → Replication → Tables"
echo "   2. Find 'wo_notifications' and toggle 'Realtime' ON"
echo "   This enables the live notification badge updates."
echo ""
echo "✅ Build complete!"
echo ""
echo "Run: cd ~/ab-tracker && npm run build && git add -A && git commit -m 'Feature: @mentions + My Mentions + browser notifications' && git push"
