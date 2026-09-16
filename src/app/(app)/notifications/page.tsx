import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import NotificationsClient from './NotificationsClient'

export const dynamic = 'force-dynamic'

export default async function NotificationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: notifications } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(200)

  // Mark all read on page open
  await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false)

  return <NotificationsClient notifications={notifications ?? []} />
}
