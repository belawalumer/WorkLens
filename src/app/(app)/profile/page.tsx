import { createClient } from '@/lib/supabase/server'
import ProfileClient from './ProfileClient'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, { data: roles }, { data: projects }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('developer_roles').select('*, project:projects(id, name)').eq('developer_id', user.id),
    supabase.from('projects').select('id, name').order('name'),
  ])

  return (
    <ProfileClient
      profile={profile}
      roles={roles ?? []}
      projects={projects ?? []}
      userId={user.id}
    />
  )
}
