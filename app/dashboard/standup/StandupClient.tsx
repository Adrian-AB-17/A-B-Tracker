'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export type WallPost = {
  id: string
  channel: string
  parent_id: string | null
  author_id: string
  body: string
  mentions: string[] | null
  created_at: string
  edited_at?: string | null
}

export type TeamMember = { id: string; name: string; auth_user_id: string | null }

function ClientDate({ iso }: { iso: string }) {
  const d = new Date(iso)
  const txt = d.toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
  return <span suppressHydrationWarning>{txt}</span>
}

// Render @Name tokens as gold pills.
function renderBody(body: string) {
  const parts = body.split(/(@\w+)/g)
  return parts.map((p, i) =>
    p.startsWith('@') ? (
      <span key={i} style={{
        background: 'rgba(217,158,43,0.15)', color: 'var(--brand-accent, #b8860b)',
        borderRadius: 4, padding: '0 4px', fontWeight: 600,
      }}>{p}</span>
    ) : <span key={i}>{p}</span>
  )
}

export default function StandupClient({
  initialPosts,
  team,
  authMap,
  currentUserId,
}: {
  initialPosts: WallPost[]
  team: TeamMember[]
  authMap: Record<string, string>
  currentUserId: string | null
}) {
  const supabase = createClient()
  const [posts, setPosts] = useState<WallPost[]>(initialPosts)
  const [body, setBody] = useState('')
  const [posting, setPosting] = useState(false)

  // mention dropdown state, shared by main box + reply boxes (keyed by target)
  const [mention, setMention] = useState<{ target: string; query: string; pos: number } | null>(null)
  const [mentionIdx, setMentionIdx] = useState(0)

  // reply composer state
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const [replyBody, setReplyBody] = useState('')
  const [replyPosting, setReplyPosting] = useState(false)

  // edit state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editBody, setEditBody] = useState('')

  const currentUserName = useMemo(() => {
    const me = team.find(t => t.auth_user_id === currentUserId)
    return me?.name || 'Someone'
  }, [team, currentUserId])

  // Realtime on the standup channel.
  useEffect(() => {
    const ch = supabase
      .channel('wall-standup')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'wall_posts', filter: 'channel=eq.standup' },
        (payload: any) => {
          if (payload.eventType === 'INSERT') {
            const row = payload.new as WallPost
            setPosts(prev => prev.some(p => p.id === row.id) ? prev : [...prev, row])
          } else if (payload.eventType === 'UPDATE') {
            const row = payload.new as WallPost
            setPosts(prev => prev.map(p => p.id === row.id ? row : p))
          } else if (payload.eventType === 'DELETE') {
            const goneId = (payload.old as { id: string }).id
            setPosts(prev => prev.filter(p => p.id !== goneId))
          }
        })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── mention helpers ──
  function onInput(target: string, value: string, cursor: number, setter: (v: string) => void) {
    setter(value)
    const before = value.substring(0, cursor)
    const m = before.match(/(?:^|\s)@(\w*)$/)
    if (m) { setMention({ target, query: m[1].toLowerCase(), pos: cursor - m[1].length - 1 }); setMentionIdx(0) }
    else { setMention(null) }
  }

  const mentionMatches = useMemo(() => {
    if (!mention) return []
    return team.filter(t => t.name.toLowerCase().includes(mention.query)).slice(0, 6)
  }, [team, mention])

  function applyMention(name: string, value: string, setter: (v: string) => void) {
    if (!mention) return
    const cursor = mention.pos + 1 + mention.query.length
    const before = value.substring(0, mention.pos)
    const after = value.substring(cursor)
    setter(before + '@' + name + ' ' + after)
    setMention(null)
  }

  function extractMentionedIds(text: string): string[] {
    const ids: string[] = []
    const seen = new Set<string>()
    const matches = text.match(/@(\w+)/g) || []
    matches.forEach(m => {
      const name = m.substring(1).toLowerCase()
      const member = team.find(t => t.name.toLowerCase() === name || t.name.toLowerCase().startsWith(name))
      if (member && member.auth_user_id && !seen.has(member.auth_user_id)) {
        seen.add(member.auth_user_id); ids.push(member.auth_user_id)
      }
    })
    return ids
  }

  async function notify(mentionIds: string[], text: string, postId: string) {
    const recipients = mentionIds.filter(uid => uid !== currentUserId)
    if (recipients.length === 0) return
    const preview = text.length > 140 ? text.slice(0, 140) + '\u2026' : text
    const rows = recipients.map(uid => ({
      user_id: uid,
      source_type: 'standup',
      source_id: postId,
      work_order_id: null,
      body_preview: preview,
      author_name: currentUserName,
      link_url: '/dashboard/standup',
    }))
    const { error } = await supabase.from('wo_notifications').insert(rows)
    if (error) console.error('Failed to create standup notifications:', error.message)
  }

  // ── post / reply / edit / delete ──
  async function submitPost(text: string, parentId: string | null) {
    const clean = text.trim()
    if (!clean) return
    const mentionIds = extractMentionedIds(clean)
    const { data, error } = await supabase
      .from('wall_posts')
      .insert({ channel: 'standup', parent_id: parentId, author_id: currentUserId, body: clean, mentions: mentionIds })
      .select()
      .single()
    if (error) { alert('Error posting: ' + error.message); return null }
    setPosts(prev => prev.some(p => p.id === (data as WallPost).id) ? prev : [...prev, data as WallPost])
    await notify(mentionIds, clean, (data as WallPost).id)
    return data as WallPost
  }

  async function onPost() {
    if (!body.trim()) return
    setPosting(true)
    const res = await submitPost(body, null)
    setPosting(false)
    if (res) { setBody(''); setMention(null) }
  }

  async function onReply(parentId: string) {
    if (!replyBody.trim()) return
    setReplyPosting(true)
    const res = await submitPost(replyBody, parentId)
    setReplyPosting(false)
    if (res) { setReplyBody(''); setReplyTo(null); setMention(null) }
  }

  async function onDelete(id: string) {
    if (!confirm('Delete this post?')) return
    const prev = posts
    setPosts(curr => curr.filter(p => p.id !== id && p.parent_id !== id))
    const { error } = await supabase.from('wall_posts').delete().eq('id', id)
    if (error) { alert('Error deleting: ' + error.message); setPosts(prev) }
  }

  async function onSaveEdit() {
    if (!editingId) return
    const clean = editBody.trim()
    if (!clean) return
    const { error } = await supabase
      .from('wall_posts')
      .update({ body: clean, edited_at: new Date().toISOString() })
      .eq('id', editingId)
    if (error) { alert('Error saving: ' + error.message); return }
    setPosts(prev => prev.map(p => p.id === editingId ? { ...p, body: clean, edited_at: new Date().toISOString() } : p))
    setEditingId(null); setEditBody('')
  }

  // ── derived: top-level posts newest-first, replies grouped ──
  const topLevel = useMemo(
    () => posts.filter(p => !p.parent_id).sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [posts]
  )
  const repliesByParent = useMemo(() => {
    const map: Record<string, WallPost[]> = {}
    posts.filter(p => p.parent_id).forEach(p => {
      ;(map[p.parent_id as string] ||= []).push(p)
    })
    Object.values(map).forEach(list => list.sort((a, b) => a.created_at.localeCompare(b.created_at)))
    return map
  }, [posts])

  const initials = (uid: string) => (authMap[uid] || '?')[0]?.toUpperCase() || '?'
  const nameOf = (uid: string) => authMap[uid] || 'Someone'

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="mb-5">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>☀️ Standup</h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Post your morning update. Everyone on the team can see and reply. Use @name to ping someone.
        </p>
      </div>

      {/* Composer */}
      <div className="rounded-lg border p-3 mb-6 relative" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)' }}>
        <textarea
          value={body}
          onChange={e => onInput('main', e.target.value, e.target.selectionStart || 0, setBody)}
          placeholder="What are you working on today?"
          rows={3}
          className="w-full rounded border px-3 py-2 text-sm"
          style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)', resize: 'vertical' }}
        />
        {mention && mention.target === 'main' && mentionMatches.length > 0 && (
          <MentionMenu matches={mentionMatches} idx={mentionIdx}
            onPick={(name) => applyMention(name, body, setBody)} />
        )}
        <div className="flex justify-end mt-2">
          <button
            onClick={onPost}
            disabled={posting || !body.trim()}
            className="px-4 py-1.5 rounded text-sm font-medium"
            style={{ background: 'var(--brand-accent, #b8860b)', color: '#1a2744', opacity: posting || !body.trim() ? 0.5 : 1 }}
          >
            {posting ? 'Posting…' : 'Post'}
          </button>
        </div>
      </div>

      {/* Feed */}
      {topLevel.length === 0 ? (
        <div className="text-center text-sm py-10" style={{ color: 'var(--text-muted)' }}>
          No standups yet today. Be the first to post.
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {topLevel.map(post => {
            const replies = repliesByParent[post.id] || []
            return (
              <div key={post.id} className="rounded-lg border p-4" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)' }}>
                <PostHead
                  initials={initials(post.author_id)} name={nameOf(post.author_id)}
                  createdAt={post.created_at} editedAt={post.edited_at}
                  canManage={post.author_id === currentUserId}
                  onEdit={() => { setEditingId(post.id); setEditBody(post.body) }}
                  onDelete={() => onDelete(post.id)}
                />
                {editingId === post.id ? (
                  <EditBox value={editBody} onChange={setEditBody} onSave={onSaveEdit} onCancel={() => { setEditingId(null); setEditBody('') }} />
                ) : (
                  <div className="text-sm mt-1 whitespace-pre-wrap" style={{ color: 'var(--text)', lineHeight: 1.5 }}>
                    {renderBody(post.body)}
                  </div>
                )}

                {/* Replies */}
                {replies.length > 0 && (
                  <div className="mt-3 pl-3 flex flex-col gap-3" style={{ borderLeft: '2px solid var(--border)' }}>
                    {replies.map(r => (
                      <div key={r.id}>
                        <PostHead
                          small initials={initials(r.author_id)} name={nameOf(r.author_id)}
                          createdAt={r.created_at} editedAt={r.edited_at}
                          canManage={r.author_id === currentUserId}
                          onEdit={() => { setEditingId(r.id); setEditBody(r.body) }}
                          onDelete={() => onDelete(r.id)}
                        />
                        {editingId === r.id ? (
                          <EditBox value={editBody} onChange={setEditBody} onSave={onSaveEdit} onCancel={() => { setEditingId(null); setEditBody('') }} />
                        ) : (
                          <div className="text-sm whitespace-pre-wrap" style={{ color: 'var(--text)', lineHeight: 1.5 }}>
                            {renderBody(r.body)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Reply composer */}
                <div className="mt-3 relative">
                  {replyTo === post.id ? (
                    <>
                      <textarea
                        value={replyBody}
                        onChange={e => onInput('reply', e.target.value, e.target.selectionStart || 0, setReplyBody)}
                        placeholder={`Reply to ${nameOf(post.author_id)}…`}
                        rows={2}
                        className="w-full rounded border px-3 py-2 text-sm"
                        style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)', resize: 'vertical' }}
                      />
                      {mention && mention.target === 'reply' && mentionMatches.length > 0 && (
                        <MentionMenu matches={mentionMatches} idx={mentionIdx}
                          onPick={(name) => applyMention(name, replyBody, setReplyBody)} />
                      )}
                      <div className="flex justify-end gap-2 mt-1">
                        <button onClick={() => { setReplyTo(null); setReplyBody(''); setMention(null) }}
                          className="px-3 py-1 rounded text-xs" style={{ color: 'var(--text-muted)' }}>Cancel</button>
                        <button onClick={() => onReply(post.id)} disabled={replyPosting || !replyBody.trim()}
                          className="px-3 py-1 rounded text-xs font-medium"
                          style={{ background: 'var(--brand-accent, #b8860b)', color: '#1a2744', opacity: replyPosting || !replyBody.trim() ? 0.5 : 1 }}>
                          {replyPosting ? 'Replying…' : 'Reply'}
                        </button>
                      </div>
                    </>
                  ) : (
                    <button onClick={() => { setReplyTo(post.id); setReplyBody(''); setMention(null) }}
                      className="text-xs font-medium" style={{ color: 'var(--brand-accent, #b8860b)' }}>
                      Reply
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function PostHead({
  initials, name, createdAt, editedAt, canManage, onEdit, onDelete, small,
}: {
  initials: string; name: string; createdAt: string; editedAt?: string | null
  canManage: boolean; onEdit: () => void; onDelete: () => void; small?: boolean
}) {
  return (
    <div className="flex items-center gap-2 mb-1">
      <span className="rounded-full flex items-center justify-center font-bold flex-shrink-0"
        style={{ width: small ? 22 : 28, height: small ? 22 : 28, fontSize: small ? 10 : 12,
          background: 'var(--brand-navy, #1a2744)', color: 'white' }}>
        {initials}
      </span>
      <span className="font-semibold" style={{ color: 'var(--text)', fontSize: small ? 13 : 14 }}>{name}</span>
      <span style={{ color: 'var(--text-muted)', fontSize: 11 }}><ClientDate iso={createdAt} /></span>
      {editedAt && <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>(edited)</span>}
      {canManage && (
        <span className="ml-auto flex gap-2">
          <button onClick={onEdit} className="text-xs" style={{ color: 'var(--text-muted)' }}>Edit</button>
          <button onClick={onDelete} className="text-xs" style={{ color: '#dc2626' }}>Delete</button>
        </span>
      )}
    </div>
  )
}

function EditBox({ value, onChange, onSave, onCancel }: {
  value: string; onChange: (v: string) => void; onSave: () => void; onCancel: () => void
}) {
  return (
    <div className="mt-1">
      <textarea value={value} onChange={e => onChange(e.target.value)} rows={3}
        className="w-full rounded border px-3 py-2 text-sm"
        style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)', resize: 'vertical' }} />
      <div className="flex justify-end gap-2 mt-1">
        <button onClick={onCancel} className="px-3 py-1 rounded text-xs" style={{ color: 'var(--text-muted)' }}>Cancel</button>
        <button onClick={onSave} disabled={!value.trim()} className="px-3 py-1 rounded text-xs font-medium"
          style={{ background: 'var(--brand-accent, #b8860b)', color: '#1a2744', opacity: value.trim() ? 1 : 0.5 }}>Save</button>
      </div>
    </div>
  )
}

function MentionMenu({ matches, idx, onPick }: {
  matches: TeamMember[]; idx: number; onPick: (name: string) => void
}) {
  return (
    <div className="absolute z-10 mt-1 rounded border shadow-lg"
      style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)', minWidth: 180 }}>
      {matches.map((m, i) => (
        <button key={m.id} onClick={() => onPick(m.name)}
          className="block w-full text-left px-3 py-1.5 text-sm"
          style={{ background: i === idx ? 'rgba(217,158,43,0.15)' : 'transparent', color: 'var(--text)' }}>
          @{m.name}
        </button>
      ))}
    </div>
  )
}
