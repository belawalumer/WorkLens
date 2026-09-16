'use client'

import { useEffect } from 'react'
import { mutate } from 'swr'
import { createClient } from '@/lib/supabase/client'
import { Task, Profile } from '@/types'
import { toast } from '@/lib/toast'

const TODAY = new Date().toISOString().split('T')[0]

export default function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const supabase = createClient()

  useEffect(() => {
    const channel = supabase
      .channel('app-global')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, payload => {
        if (payload.eventType === 'INSERT') {
          // Refetch to include project join
          mutate('dashboard-tasks')
        } else if (payload.eventType === 'UPDATE') {
          const t = payload.new as Task
          mutate('dashboard-tasks', (prev: Task[] = []) =>
            prev.map(p => p.id === t.id ? { ...p, ...t } : p), false)
        } else if (payload.eventType === 'DELETE') {
          const t = payload.old as Task
          mutate('dashboard-tasks', (prev: Task[] = []) => prev.filter(p => p.id !== t.id), false)
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
