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
