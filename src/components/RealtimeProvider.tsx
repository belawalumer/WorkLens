'use client'

import { useEffect } from 'react'
import { mutate } from 'swr'
import { createClient } from '@/lib/supabase/client'
import { Task, Profile } from '@/types'
import { toast } from '@/lib/toast'

function msUntilMidnightPlus1(): number {
  const now = new Date()
  const next = new Date(now)
  next.setDate(now.getDate() + 1)
  next.setHours(0, 1, 0, 0) // 12:01 AM
  return next.getTime() - now.getTime()
}

function scheduleMidnight(fn: () => void): () => void {
  let id: ReturnType<typeof setTimeout>
  function schedule() {
    id = setTimeout(() => { fn(); schedule() }, msUntilMidnightPlus1())
  }
  schedule()
  return () => clearTimeout(id)
}

export default function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const supabase = createClient()

  // Midnight reset — fires every night, mutates all date-sensitive SWR keys
  // so every open client snaps to the new day without a page reload
  useEffect(() => {
    return scheduleMidnight(() => {
      mutate('dashboard-tasks')
      mutate('today-leaves')
      mutate('profiles')
    })
  }, [])

  useEffect(() => {
    const channel = supabase
      .channel('app-global')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, payload => {
        if (payload.eventType === 'DELETE') {
          // Optimistic delete — no joins needed
          const t = payload.old as Task
          mutate('dashboard-tasks', (prev: Task[] = []) => prev.filter(p => p.id !== t.id), false)
        } else {
          // INSERT/UPDATE: refetch to include project join (raw payloads have no joins)
          mutate('dashboard-tasks')
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'profiles' }, payload => {
        const p = payload.new as Profile
        mutate('profiles', (prev: Profile[] = []) =>
          [...prev, p].sort((a, b) => a.full_name.localeCompare(b.full_name)), false)
        toast('👋 New team member joined')
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, payload => {
        const p = payload.new as Profile
        mutate('profiles', (prev: Profile[] = []) =>
          prev.map(q => q.id === p.id ? { ...q, ...p } : q), false)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'developer_roles' }, () => {
        mutate('developer-roles')
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return <>{children}</>
}
