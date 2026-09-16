'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { Role } from '@/types'
import { revalidatePath } from 'next/cache'

async function getMyRole(): Promise<Role | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  return (data?.role as Role) ?? null
}

async function getTargetRole(userId: string): Promise<Role | null> {
  const admin = createAdminClient()
  const { data } = await admin.from('profiles').select('role').eq('id', userId).single()
  return (data?.role as Role) ?? null
}

export async function createUser(payload: {
  fullName: string
  email: string
  password: string
  role: Role
  whatsapp?: string | null
}) {
  const myRole = await getMyRole()
  if (!myRole) throw new Error('Unauthorized')
  if (myRole === 'developer' && payload.role !== 'developer') throw new Error('Developers can only create developer accounts')
  if (myRole === 'hr_admin' && payload.role === 'super_admin') throw new Error('HR admins cannot create super admins')

  const admin = createAdminClient()
  const { data, error } = await admin.auth.admin.createUser({
    email: payload.email,
    password: payload.password,
    user_metadata: { full_name: payload.fullName },
    email_confirm: true,
  })
  if (error) throw error

  if (data.user) {
    const profileUpdate: { role?: Role; whatsapp?: string } = {}
    if (payload.role !== 'developer') profileUpdate.role = payload.role
    if (payload.whatsapp) profileUpdate.whatsapp = payload.whatsapp
    if (Object.keys(profileUpdate).length) {
      await admin.from('profiles').update(profileUpdate).eq('id', data.user.id)
    }
  }

  revalidatePath('/team')
}

export async function updateUserRole(userId: string, newRole: Role) {
  const myRole = await getMyRole()
  if (!myRole || myRole === 'developer') throw new Error('Unauthorized')
  if (myRole === 'hr_admin' && newRole === 'super_admin') throw new Error('HR admins cannot assign super_admin role')

  if (myRole === 'hr_admin') {
    const targetRole = await getTargetRole(userId)
    if (targetRole !== 'developer') throw new Error('HR admins can only manage developers')
  }

  const admin = createAdminClient()
  await admin.from('profiles').update({ role: newRole }).eq('id', userId)
  revalidatePath('/team')
}

export async function deleteUser(userId: string) {
  const myRole = await getMyRole()
  if (!myRole || myRole === 'developer') throw new Error('Unauthorized')

  if (myRole === 'hr_admin') {
    const targetRole = await getTargetRole(userId)
    if (targetRole !== 'developer') throw new Error('HR admins can only delete developers')
  }

  const admin = createAdminClient()
  await admin.auth.admin.deleteUser(userId)
  revalidatePath('/team')
}

export async function updateUserProfile(userId: string, payload: { fullName?: string; email?: string; whatsapp?: string | null }) {
  const myRole = await getMyRole()
  if (!myRole || myRole === 'developer') throw new Error('Unauthorized')

  if (myRole === 'hr_admin') {
    const targetRole = await getTargetRole(userId)
    if (targetRole !== 'developer') throw new Error('HR admins can only edit developers')
  }

  const admin = createAdminClient()
  const authUpdate: { email?: string; user_metadata?: { full_name: string } } = {}
  if (payload.email) authUpdate.email = payload.email
  if (payload.fullName) authUpdate.user_metadata = { full_name: payload.fullName }
  if (Object.keys(authUpdate).length) {
    const { error } = await admin.auth.admin.updateUserById(userId, authUpdate)
    if (error) throw error
  }

  const profileUpdate: { full_name?: string; email?: string; whatsapp?: string | null } = {}
  if (payload.fullName) profileUpdate.full_name = payload.fullName
  if (payload.email) profileUpdate.email = payload.email
  if (payload.whatsapp !== undefined) profileUpdate.whatsapp = payload.whatsapp || null
  if (Object.keys(profileUpdate).length) {
    await admin.from('profiles').update(profileUpdate).eq('id', userId)
  }

  revalidatePath('/team')
}

export async function resetUserPassword(userId: string, newPassword: string) {
  const myRole = await getMyRole()
  if (!myRole || myRole === 'developer') throw new Error('Unauthorized')

  if (myRole === 'hr_admin') {
    const targetRole = await getTargetRole(userId)
    if (targetRole !== 'developer') throw new Error('HR admins can only reset developer passwords')
  }

  const admin = createAdminClient()
  const { error } = await admin.auth.admin.updateUserById(userId, { password: newPassword })
  if (error) throw error
}
