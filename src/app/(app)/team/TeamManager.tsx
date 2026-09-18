'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { Profile, Role, ROLE_LABELS, UserStatus, USER_STATUS_CONFIG, formatStatusSub } from '@/types'
import { createUser, updateUserRole, deleteUser, resetUserPassword, updateUserProfile } from '@/app/actions/users'
import { createClient } from '@/lib/supabase/client'
import { toast } from '@/lib/toast'

interface Props {
  members: Profile[]
  currentUserId: string
  currentUserRole: Role
}

const ROLE_COLORS: Record<Role, string> = {
  super_admin: 'bg-purple-100 text-purple-700 border-purple-200',
  hr_admin:    'bg-brand-100 text-brand-700 border-brand-200',
  developer:   'bg-slate-100 text-slate-600 border-slate-200',
}

const AVATAR_BG: Record<Role, string> = {
  super_admin: 'bg-purple-100 text-purple-700',
  hr_admin:    'bg-brand-100 text-brand-700',
  developer:   'bg-slate-100 text-slate-600',
}

function assignableRoles(viewerRole: Role): Role[] {
  if (viewerRole === 'super_admin') return ['developer', 'hr_admin', 'super_admin']
  return ['developer']
}

function canManage(viewerRole: Role, targetRole: Role, isSelf: boolean): boolean {
  if (isSelf) return false
  if (viewerRole === 'super_admin') return true
  if (viewerRole === 'hr_admin') return targetRole === 'developer'
  return false
}

const initials = (name: string) => {
  const p = name.trim().split(/\s+/)
  return p.length === 1 ? p[0][0].toUpperCase() : (p[0][0] + p[p.length - 1][0]).toUpperCase()
}

function generatePassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#'
  return Array.from(crypto.getRandomValues(new Uint8Array(14))).map(b => chars[b % chars.length]).join('')
}

type AddForm = { fullName: string; email: string; role: Role; whatsapp: string }
const EMPTY_FORM: AddForm = { fullName: '', email: '', role: 'developer', whatsapp: '' }

interface ResetState { userId: string; password: string; applied: boolean; applying: boolean }
interface EditProfileState { userId: string; fullName: string; email: string; whatsapp: string; saving: boolean }

export default function TeamManager({ members: init, currentUserId, currentUserRole }: Props) {
  const supabase = createClient()

  const { data: members = init, mutate: mutateMembers } = useSWR<Profile[]>(
    'profiles',
    async () => {
      const { data } = await supabase.from('profiles')
        .select('id, full_name, email, role, created_at, user_status, status_from, status_until, whatsapp')
        .order('full_name')
      return (data ?? []) as Profile[]
    },
    { fallbackData: init, revalidateOnFocus: true },
  )
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState<AddForm>(EMPTY_FORM)
  const [generatedPassword, setGeneratedPassword] = useState('')
  const [createdPassword, setCreatedPassword] = useState('')
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null)
  const [pendingRole, setPendingRole] = useState<Role>('developer')
  const [resetState, setResetState] = useState<ResetState | null>(null)
  const [editProfile, setEditProfile] = useState<EditProfileState | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const roles = assignableRoles(currentUserRole)

  const counts: Record<Role, number> = { super_admin: 0, hr_admin: 0, developer: 0 }
  members.forEach(m => counts[m.role]++)

  function openAddForm() {
    setGeneratedPassword(generatePassword())
    setForm(EMPTY_FORM)
    setFormError('')
    setCreatedPassword('')
    setAdding(true)
  }

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setFormError('')
    setSubmitting(true)
    try {
      await createUser({ ...form, password: generatedPassword, whatsapp: form.whatsapp || null })
      setCreatedPassword(generatedPassword)
      setAdding(false)
      setForm(EMPTY_FORM)
      mutateMembers()
      toast.success('Member created')
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to create user')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRoleChange(userId: string) {
    try {
      await updateUserRole(userId, pendingRole)
      mutateMembers(prev => (prev ?? []).map(m => m.id === userId ? { ...m, role: pendingRole } : m), false)
      setEditingRoleId(null)
      mutateMembers()
      toast.success('Role updated')
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Failed to update role') }
  }

  async function handleDelete(userId: string, name: string) {
    if (!confirm(`Remove ${name} from the team? This cannot be undone.`)) return
    try {
      await deleteUser(userId)
      mutateMembers(prev => (prev ?? []).filter(m => m.id !== userId), false)
      mutateMembers()
      toast.success('Member removed')
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Failed to remove member') }
  }

  async function applyReset() {
    if (!resetState) return
    setResetState(s => s ? { ...s, applying: true } : null)
    try {
      await resetUserPassword(resetState.userId, resetState.password)
      setResetState(s => s ? { ...s, applied: true, applying: false } : null)
      toast.success('Password reset')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to reset password')
      setResetState(s => s ? { ...s, applying: false } : null)
    }
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault()
    if (!editProfile) return
    setEditProfile(s => s ? { ...s, saving: true } : null)
    try {
      await updateUserProfile(editProfile.userId, { fullName: editProfile.fullName, email: editProfile.email, whatsapp: editProfile.whatsapp || null })
      mutateMembers(prev => (prev ?? []).map(m => m.id === editProfile.userId
        ? { ...m, full_name: editProfile.fullName, email: editProfile.email, whatsapp: editProfile.whatsapp || null } : m), false)
      setEditProfile(null)
      mutateMembers()
      toast.success('Profile updated')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update profile')
      setEditProfile(s => s ? { ...s, saving: false } : null)
    }
  }

  const filtered = search.trim()
    ? members.filter(m => m.full_name.toLowerCase().includes(search.toLowerCase()) || m.email.toLowerCase().includes(search.toLowerCase()))
    : members

  const inputCls = 'w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-400 bg-slate-50 transition-colors'
  const gridCls = currentUserRole === 'developer'
    ? 'sm:grid-cols-[1fr_140px]'
    : 'sm:grid-cols-[1fr_140px_160px]'

  // Summary cards based on role visibility
  const summaryCards = (
    currentUserRole === 'super_admin'
      ? [['developer', '💻', 'Developers'], ['hr_admin', '👔', 'HR Admins'], ['super_admin', '⭐', 'Super Admins']]
      : currentUserRole === 'hr_admin'
        ? [['developer', '💻', 'Developers'], ['hr_admin', '👔', 'HR Admins']]
        : [['developer', '💻', 'Developers']]
  ) as [Role, string, string][]

  return (
    <div className="max-w-3xl mx-auto page-enter">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Team</h1>
          <p className="text-sm text-slate-500 mt-0.5">{members.length} members</p>
        </div>
        {currentUserRole !== 'developer' && (
          <button onClick={openAddForm}
            className="px-4 py-2 bg-brand-600 text-white text-sm font-semibold rounded-xl hover:bg-brand-700 transition-colors shadow-sm shadow-brand-200">
            + Add member
          </button>
        )}
      </div>

      {/* ── Role summary cards ─────────────────────────────────── */}
      <div className={`grid grid-cols-${summaryCards.length} gap-3 mb-5`}>
        {summaryCards.map(([role, icon, label]) => (
          <div key={role} className="bg-white border border-slate-200 rounded-2xl px-4 py-3 text-center">
            <p className="text-lg">{icon}</p>
            <p className="text-2xl font-bold text-slate-900 mt-0.5">{counts[role]}</p>
            <p className="text-xs text-slate-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* ── Created password banner ────────────────────────────── */}
      {createdPassword && (
        <div className="mb-5 bg-green-50 border border-green-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-green-600 font-bold text-sm">✓ Member created!</span>
          </div>
          <p className="text-xs text-green-700 mb-2">Share this temporary password — it won&apos;t be shown again.</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-sm bg-white border border-green-200 rounded-xl px-3 py-2 font-mono text-slate-800 select-all">
              {createdPassword}
            </code>
            <button onClick={() => copy(createdPassword, 'created')}
              className="shrink-0 text-xs px-3 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors font-medium">
              {copied === 'created' ? '✓ Copied' : 'Copy'}
            </button>
            <button onClick={() => setCreatedPassword('')} className="text-green-500 hover:text-green-700 px-1">✕</button>
          </div>
        </div>
      )}

      {/* ── Add form ────────────────────────────────────────────── */}
      {adding && (
        <form onSubmit={handleCreate} className="bg-white border border-brand-200 rounded-2xl p-5 mb-5 space-y-4">
          <h2 className="font-bold text-slate-800">New team member</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Full name</label>
              <input type="text" required placeholder="Jane Smith" value={form.fullName}
                onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Email</label>
              <input type="email" required placeholder="jane@kodesinc.com" value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Role</label>
              <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as Role }))} className={inputCls}>
                {roles.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">WhatsApp number</label>
              <input type="tel" placeholder="+923001234567" value={form.whatsapp}
                onChange={e => setForm(f => ({ ...f, whatsapp: e.target.value }))} className={inputCls} />
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
            <p className="text-xs font-semibold text-slate-600 mb-2">🔑 Auto-generated password</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-sm font-mono text-slate-800 select-all">{generatedPassword}</code>
              <button type="button" onClick={() => copy(generatedPassword, 'gen')}
                className="text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg hover:bg-white text-slate-600 transition-colors font-medium">
                {copied === 'gen' ? '✓' : 'Copy'}
              </button>
              <button type="button" onClick={() => setGeneratedPassword(generatePassword())}
                className="text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg hover:bg-white text-slate-500 transition-colors" title="Regenerate">
                ↻
              </button>
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5">Member can change it from Profile settings.</p>
          </div>

          {formError && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">{formError}</p>}

          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={submitting}
              className="px-4 py-2 bg-brand-600 text-white text-sm font-semibold rounded-xl hover:bg-brand-700 disabled:opacity-50 transition-colors">
              {submitting ? 'Creating…' : 'Create member'}
            </button>
            <button type="button" onClick={() => { setAdding(false); setFormError('') }}
              className="px-4 py-2 border border-slate-200 text-sm rounded-xl hover:bg-slate-50 text-slate-600 transition-colors">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* ── Search ──────────────────────────────────────────────── */}
      <div className="relative mb-4">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <input type="text" placeholder="Search members…" value={search} onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-400 transition-colors" />
      </div>

      {/* ── Members table ───────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className={`hidden sm:grid ${gridCls} gap-4 px-5 py-3 bg-slate-50 border-b border-slate-200`}>
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Member</span>
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Role</span>
          {currentUserRole !== 'developer' && (
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">Actions</span>
          )}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-10 text-slate-500 text-sm">No members match your search.</div>
        )}

        {filtered.map((member, i) => {
          const isSelf = member.id === currentUserId
          const manageable = canManage(currentUserRole, member.role, isSelf)
          const isEditingRole = editingRoleId === member.id
          const isResetting = resetState?.userId === member.id
          const isEditingProfile = editProfile?.userId === member.id

          return (
            <div key={member.id} className={i < filtered.length - 1 ? 'border-b border-slate-100' : ''}>
              <div className={`sm:grid ${gridCls} gap-x-4 items-center px-5 py-4 ${isSelf ? 'bg-brand-50/30' : 'hover:bg-slate-50'} transition-colors`}>
                {/* Avatar + name */}
                <div className="flex items-start gap-3 min-w-0">
                  <div className="relative shrink-0 group/status">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold ${AVATAR_BG[member.role]}`}>
                      {initials(member.full_name)}
                    </div>
                    <span className="absolute -bottom-1 -right-1 flex items-center justify-center w-4 h-4 bg-white rounded-full text-[9px] leading-none shadow-sm ring-1 ring-slate-100">
                      {USER_STATUS_CONFIG[(member.user_status ?? 'active') as UserStatus].emoji}
                    </span>
                    <div className="pointer-events-none absolute bottom-full left-0 mb-2 px-2 py-1 text-[11px] font-medium bg-slate-800 text-white rounded-lg whitespace-nowrap opacity-0 group-hover/status:opacity-100 transition-opacity z-20">
                      {USER_STATUS_CONFIG[(member.user_status ?? 'active') as UserStatus].label}
                      {(() => {
                        const sub = formatStatusSub((member.user_status ?? 'active') as UserStatus, member.status_from, member.status_until)
                        return sub ? ` · ${sub}` : ''
                      })()}
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="text-sm font-semibold text-slate-800">{member.full_name}</p>
                      {isSelf && <span className="text-[11px] text-brand-500 font-medium shrink-0">(you)</span>}
                    </div>
                    <p className="text-xs text-slate-500 break-all">{member.email}</p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                      {member.whatsapp && (
                        <a
                          href={`https://wa.me/${member.whatsapp.replace(/\D/g, '')}`}
                          target="_blank" rel="noopener noreferrer"
                          title={`WhatsApp: ${member.whatsapp}`}
                          className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#25D366] hover:bg-[#20ba58] text-white text-[10px] font-semibold transition-colors"
                          onClick={e => e.stopPropagation()}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                          WhatsApp
                        </a>
                      )}
                      {/* Role badge — mobile only; desktop uses the grid column */}
                      <span className={`sm:hidden inline-flex text-xs px-2.5 py-1 rounded-full font-semibold border ${ROLE_COLORS[member.role]}`}>
                        {ROLE_LABELS[member.role]}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Role — desktop only; mobile shows it in the badges row */}
                <div className="hidden sm:block">
                  {isEditingRole ? (
                    <div className="flex items-center gap-1">
                      <select value={pendingRole} onChange={e => setPendingRole(e.target.value as Role)}
                        className="text-xs border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-brand-400 bg-white">
                        {roles.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                      </select>
                      <button onClick={() => handleRoleChange(member.id)}
                        className="text-xs px-2 py-1 bg-brand-600 text-white rounded-lg hover:bg-brand-700">✓</button>
                      <button onClick={() => setEditingRoleId(null)}
                        className="text-xs px-2 py-1 border border-slate-200 rounded-lg hover:bg-slate-50">✕</button>
                    </div>
                  ) : (
                    <span className={`inline-flex text-xs px-2.5 py-1 rounded-full font-semibold border ${ROLE_COLORS[member.role]}`}>
                      {ROLE_LABELS[member.role]}
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div className={`${currentUserRole === 'developer' ? 'hidden' : 'flex sm:justify-end'} items-center gap-1 flex-wrap mt-3 sm:mt-0`}>
                  {manageable && !isEditingRole && (
                    <>
                      {/* Edit profile */}
                      <div className="relative group/tip">
                        <button
                          onClick={() => isEditingProfile
                            ? setEditProfile(null)
                            : setEditProfile({ userId: member.id, fullName: member.full_name, email: member.email, whatsapp: member.whatsapp ?? '', saving: false })
                          }
                          className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${isEditingProfile ? 'text-brand-600 bg-brand-50' : 'text-slate-400 hover:text-brand-600 hover:bg-brand-50'}`}>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                        </button>
                        <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-[11px] font-medium bg-slate-800 text-white rounded-lg whitespace-nowrap opacity-0 group-hover/tip:opacity-100 transition-opacity">
                          Edit profile
                        </span>
                      </div>

                      {/* Edit role — super_admin only */}
                      {currentUserRole === 'super_admin' && (
                        <div className="relative group/tip">
                          <button onClick={() => { setEditingRoleId(member.id); setPendingRole(member.role) }}
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                          </button>
                          <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-[11px] font-medium bg-slate-800 text-white rounded-lg whitespace-nowrap opacity-0 group-hover/tip:opacity-100 transition-opacity">
                            Edit role
                          </span>
                        </div>
                      )}

                      <div className="relative group/tip">
                        <button onClick={() => isResetting ? setResetState(null) : setResetState({ userId: member.id, password: generatePassword(), applied: false, applying: false })}
                          className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${isResetting ? 'text-amber-600 bg-amber-50' : 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'}`}>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                        </button>
                        <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-[11px] font-medium bg-slate-800 text-white rounded-lg whitespace-nowrap opacity-0 group-hover/tip:opacity-100 transition-opacity">
                          Reset password
                        </span>
                      </div>

                      <div className="relative group/tip">
                        <button onClick={() => handleDelete(member.id, member.full_name)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                        </button>
                        <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-[11px] font-medium bg-slate-800 text-white rounded-lg whitespace-nowrap opacity-0 group-hover/tip:opacity-100 transition-opacity">
                          Delete
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Edit profile panel */}
              {isEditingProfile && (
                <form onSubmit={saveProfile} className="border-t border-slate-100 bg-brand-50/30 px-5 py-4 space-y-3">
                  <p className="text-xs font-semibold text-slate-700">Edit profile — {member.full_name}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Full name</label>
                      <input type="text" required value={editProfile!.fullName}
                        onChange={e => setEditProfile(s => s ? { ...s, fullName: e.target.value } : null)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white" />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Email</label>
                      <input type="email" required value={editProfile!.email}
                        onChange={e => setEditProfile(s => s ? { ...s, email: e.target.value } : null)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white" />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs text-slate-500 mb-1">WhatsApp number</label>
                      <input type="tel" placeholder="+923001234567" value={editProfile!.whatsapp}
                        onChange={e => setEditProfile(s => s ? { ...s, whatsapp: e.target.value } : null)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button type="submit" disabled={editProfile!.saving}
                      className="text-xs px-3 py-1.5 bg-brand-600 text-white rounded-xl hover:bg-brand-700 disabled:opacity-50 font-semibold transition-colors">
                      {editProfile!.saving ? 'Saving…' : 'Save'}
                    </button>
                    <button type="button" onClick={() => setEditProfile(null)}
                      className="text-xs px-3 py-1.5 border border-slate-200 rounded-xl hover:bg-white text-slate-600 transition-colors">Cancel</button>
                  </div>
                </form>
              )}

              {/* Reset password panel */}
              {isResetting && (
                <div className="border-t border-slate-100 bg-amber-50 px-5 py-3 space-y-2.5">
                  <p className="text-xs font-semibold text-amber-800">Reset password for {member.full_name}</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-sm font-mono text-slate-800 bg-white border border-amber-200 rounded-xl px-3 py-2 select-all">
                      {resetState!.password}
                    </code>
                    <button onClick={() => copy(resetState!.password, 'reset')}
                      className="text-xs px-2.5 py-2 border border-amber-300 bg-white rounded-xl hover:bg-amber-50 shrink-0 transition-colors font-medium">
                      {copied === 'reset' ? '✓' : 'Copy'}
                    </button>
                    <button onClick={() => setResetState(s => s ? { ...s, password: generatePassword() } : null)}
                      className="text-xs px-2.5 py-2 border border-amber-300 bg-white rounded-xl hover:bg-amber-50 shrink-0 transition-colors">↻</button>
                  </div>
                  {resetState!.applied
                    ? <p className="text-xs text-green-700 font-semibold">✓ Password reset. Share it with {member.full_name}.</p>
                    : (
                      <div className="flex gap-2">
                        <button onClick={applyReset} disabled={resetState!.applying}
                          className="text-xs px-3 py-1.5 bg-amber-600 text-white rounded-xl hover:bg-amber-700 disabled:opacity-50 transition-colors font-semibold">
                          {resetState!.applying ? 'Applying…' : 'Apply reset'}
                        </button>
                        <button onClick={() => setResetState(null)}
                          className="text-xs px-3 py-1.5 border border-slate-200 rounded-xl hover:bg-white text-slate-600 transition-colors">Cancel</button>
                      </div>
                    )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
