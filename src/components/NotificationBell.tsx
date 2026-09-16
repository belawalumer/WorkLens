'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Role, Task } from '@/types'

interface Notif {
  id: string
  message: string
  type: 'task_added' | 'task_completed' | 'task_updated' | 'member_joined'
  at: Date
  read: boolean
}

interface ToastNotif {
  id: string
  message: string
  type: Notif['type']
}

const TYPE_ICON: Record<Notif['type'], string> = {
  task_added:    '📋',
  task_completed:'✅',
  task_updated:  '✏️',
  member_joined: '👋',
}

function isToday(d: Date) {
  const t = new Date(); return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate()
}
function isYesterday(d: Date) {
  const y = new Date(); y.setDate(y.getDate() - 1)
  return d.getFullYear() === y.getFullYear() && d.getMonth() === y.getMonth() && d.getDate() === y.getDate()
}

function timeAgo(d: Date) {
  const s = Math.floor((Date.now() - d.getTime()) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  return `${Math.floor(s / 3600)}h ago`
}

export default function NotificationBell({ userRole, userId }: { userRole: Role; userId: string }) {
  const [notifs, setNotifs] = useState<Notif[]>([])
  const [toasts, setToasts] = useState<ToastNotif[]>([])
  const [open, setOpen] = useState(false)
  const profileMap = useRef<Record<string, string>>({})
  const panelRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  const unread = notifs.filter(n => !n.read).length

  function playSound() {
    try {
      const ctx = new AudioContext()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.setValueAtTime(880, ctx.currentTime)
      osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.1)
      gain.gain.setValueAtTime(0.08, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.4)
    } catch { /* SSR or unavailable */ }
  }

  function push(n: Omit<Notif, 'id' | 'at' | 'read'>) {
    const id = crypto.randomUUID()
    const at = new Date()
    setNotifs(prev => [{ ...n, id, at, read: false }, ...prev].slice(0, 50))
    setToasts(prev => [...prev, { id, message: n.message, type: n.type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500)
    playSound()
    supabase.from('notifications').insert({ user_id: userId, message: n.message, type: n.type, read: false }).then(() => {})
  }

  useEffect(() => {
    if (userRole === 'hr_admin') return

    supabase.from('notifications').select('*').eq('user_id', userId)
      .order('created_at', { ascending: false }).limit(50)
      .then(({ data }) => {
        if (data?.length) {
          setNotifs(data.map(n => ({
            id: n.id,
            message: n.message,
            type: n.type as Notif['type'],
            at: new Date(n.created_at),
            read: n.read,
          })))
        }
      })

    supabase.from('profiles').select('id, full_name').then(({ data }) => {
      if (data) profileMap.current = Object.fromEntries(
        data.map((p: { id: string; full_name: string }) => [p.id, p.full_name])
      )
    })

    const ch = supabase.channel('notif-feed')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tasks' }, ({ new: row }) => {
        const t = row as Task
        if (t.developer_id === userId) return
        const name = profileMap.current[t.developer_id] ?? 'Someone'
        push({ type: 'task_added', message: `${name} added "${t.title}" (${t.estimated_hours}h)` })
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tasks' }, ({ new: n, old: o }) => {
        const newT = n as Task, oldT = o as Partial<Task>
        if (newT.developer_id === userId) return
        const name = profileMap.current[newT.developer_id] ?? 'Someone'
        if (!oldT.completed && newT.completed) {
          push({ type: 'task_completed', message: `${name} completed "${newT.title}"` })
        } else if (oldT.estimated_hours !== undefined && oldT.estimated_hours !== newT.estimated_hours) {
          push({ type: 'task_updated', message: `${name} changed estimate for "${newT.title}": ${oldT.estimated_hours}h → ${newT.estimated_hours}h` })
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'profiles' }, ({ new: row }) => {
        const p = row as { id: string; full_name: string }
        if (p.id === userId) return
        profileMap.current[p.id] = p.full_name
        push({ type: 'member_joined', message: `${p.full_name} joined the team` })
      })
      .subscribe()

    return () => { supabase.removeChannel(ch) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  async function markAllRead() {
    setNotifs(p => p.map(n => ({ ...n, read: true })))
    await supabase.from('notifications').update({ read: true }).eq('user_id', userId).eq('read', false)
  }

  function openPanel() {
    setOpen(true)
    if (unread > 0) markAllRead()
  }

  // Group notifications for the panel (show today + yesterday only, max 8)
  const todayNotifs = notifs.filter(n => isToday(n.at)).slice(0, 5)
  const yesterdayNotifs = notifs.filter(n => isYesterday(n.at)).slice(0, 3)
  const panelNotifs: { label: string; items: Notif[] }[] = []
  if (todayNotifs.length) panelNotifs.push({ label: 'Today', items: todayNotifs })
  if (yesterdayNotifs.length) panelNotifs.push({ label: 'Yesterday', items: yesterdayNotifs })

  return (
    <>
      {/* ── Toasts ────────────────────────────────────────────────────── */}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id}
            className="page-enter flex items-start gap-3 bg-white border border-slate-200 rounded-xl shadow-lg px-4 py-3 w-72 pointer-events-auto">
            <span className="text-base shrink-0 mt-0.5">{TYPE_ICON[t.type]}</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-800 leading-snug">{t.message}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">just now</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Bell button + dropdown ─────────────────────────────────────── */}
      <div className="relative" ref={panelRef}>
        <button
          onClick={openPanel}
          className="relative w-9 h-9 flex items-center justify-center rounded-xl hover:bg-brand-50 transition-colors"
          aria-label="Notifications"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-brand-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 leading-none ring-2 ring-white">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>

        {open && (
          <div className="fixed sm:absolute inset-x-3 sm:inset-x-auto right-3 sm:right-0 top-16 sm:top-12 sm:w-80 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <span className="text-sm font-bold text-slate-800">Notifications</span>
              {notifs.some(n => !n.read) && (
                <button onClick={markAllRead} className="text-xs text-brand-600 hover:text-brand-800 font-semibold">
                  Mark all read
                </button>
              )}
            </div>

            <div className="max-h-80 overflow-y-auto">
              {panelNotifs.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <p className="text-slate-600 text-sm font-medium">No notifications yet</p>
                  <p className="text-slate-400 text-xs mt-1">Updates will appear here in real time</p>
                </div>
              ) : (
                panelNotifs.map(group => (
                  <div key={group.label}>
                    <p className="px-4 pt-3 pb-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest">{group.label}</p>
                    {group.items.map(n => (
                      <div key={n.id} className={`flex items-start gap-3 px-4 py-3 transition-colors ${n.read ? 'bg-white' : 'bg-brand-50/50'}`}>
                        <span className="text-base mt-0.5 shrink-0">{TYPE_ICON[n.type]}</span>
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs leading-relaxed ${n.read ? 'text-slate-600' : 'text-slate-800 font-semibold'}`}>
                            {n.message}
                          </p>
                          <p className="text-[11px] text-slate-400 mt-0.5">{timeAgo(n.at)}</p>
                        </div>
                        {!n.read && <span className="w-2 h-2 rounded-full bg-brand-500 shrink-0 mt-1.5" />}
                      </div>
                    ))}
                  </div>
                ))
              )}
            </div>

            <div className="border-t border-slate-100 px-4 py-3">
              <Link
                href="/notifications"
                onClick={() => setOpen(false)}
                className="text-xs font-semibold text-brand-600 hover:text-brand-800 transition-colors"
              >
                View all notifications →
              </Link>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
