import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import MapClient from './MapClient'

export const dynamic = 'force-dynamic'

export default async function MapPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, role, user_status, lat, lng, location_updated_at')
    .order('full_name')

  return <MapClient profiles={profiles ?? []} currentUserId={user.id} />
}
