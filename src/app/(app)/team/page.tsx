import { createClient } from '@/lib/supabase/server'
import TeamManager from './TeamManager'
import { redirect } from 'next/navigation'
import { Role } from '@/types'

export const dynamic = 'force-dynamic'

export default async function TeamPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: myProfile }, { data: members }] = await Promise.all([
    supabase.from('profiles').select('role').eq('id', user.id).single(),
    supabase.from('profiles').select('id, full_name, email, role, created_at, user_status, status_from, status_until').order('full_name'),
  ])

  return (
    <TeamManager
      members={members ?? []}
      currentUserId={user.id}
      currentUserRole={(myProfile?.role as Role) ?? 'developer'}
    />
  )
}
