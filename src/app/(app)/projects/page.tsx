import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ProjectsClient from './ProjectsClient'
import { Role } from '@/types'

export const dynamic = 'force-dynamic'

export default async function ProjectsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, { data: projects }] = await Promise.all([
    supabase.from('profiles').select('role').eq('id', user.id).single(),
    supabase.from('projects').select('id, name, created_at').order('name'),
  ])

  return (
    <ProjectsClient
      initialProjects={projects ?? []}
      userRole={(profile?.role as Role) ?? 'developer'}
    />
  )
}
