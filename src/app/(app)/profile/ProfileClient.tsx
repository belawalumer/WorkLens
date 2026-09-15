'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Profile, DeveloperRole, Project, ROLE_LABELS, Role } from '@/types'

interface Props {
  profile: Profile | null
  roles: DeveloperRole[]
  projects: Project[]
  userId: string
}

const inputCls = 'w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-400 transition-colors bg-white'
const disabledCls = 'w-full px-3 py-2.5 border border-slate-100 rounded-xl text-sm bg-slate-50 text-slate-400'

export default function ProfileClient({ profile, roles: initRoles, projects, userId }: Props) {
  const [fullName, setFullName] = useState(profile?.full_name ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [roles, setRoles] = useState(initRoles)
  const [newRole, setNewRole] = useState({ project_id: '', title: '' })
  const [addingRole, setAddingRole] = useState(false)

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwdError, setPwdError] = useState('')
  const [pwdSaving, setPwdSaving] = useState(false)
  const [pwdSaved, setPwdSaved] = useState(false)

  const supabase = createClient()

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await supabase.from('profiles').update({ full_name: fullName }).eq('id', userId)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault()
    setPwdError('')
    if (newPassword.length < 6) { setPwdError('Password must be at least 6 characters.'); return }
    if (newPassword !== confirmPassword) { setPwdError('Passwords do not match.'); return }
    setPwdSaving(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setPwdSaving(false)
    if (error) { setPwdError(error.message); return }
    setNewPassword('')
    setConfirmPassword('')
    setPwdSaved(true)
    setTimeout(() => setPwdSaved(false), 3000)
  }

  async function addRole(e: React.FormEvent) {
    e.preventDefault()
    if (!newRole.project_id || !newRole.title.trim()) return
    const { data } = await supabase
      .from('developer_roles')
      .upsert({ developer_id: userId, project_id: newRole.project_id, title: newRole.title.trim() }, { onConflict: 'developer_id,project_id' })
      .select('*, project:projects(id, name)')
      .single()
    if (data) setRoles(prev => [...prev.filter(r => r.project_id !== data.project_id), data])
    setNewRole({ project_id: '', title: '' })
    setAddingRole(false)
  }

  async function deleteRole(id: string) {
    await supabase.from('developer_roles').delete().eq('id', id)
    setRoles(prev => prev.filter(r => r.id !== id))
  }

  return (
    <div className="page-enter space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-brand-100 flex items-center justify-center shrink-0">
          <span className="text-brand-700 text-xl font-black">{(profile?.full_name ?? 'U').charAt(0).toUpperCase()}</span>
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">{profile?.full_name ?? 'Profile'}</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-sm text-slate-500">{profile?.email}</span>
            <span className="text-slate-300">·</span>
            <span className="text-xs font-semibold text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full border border-brand-100">
              {ROLE_LABELS[profile?.role as Role ?? 'developer']}
            </span>
          </div>
        </div>
      </div>

      {/* 3-column row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Basic Info */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-brand-600">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
              </svg>
            </div>
            <h2 className="font-semibold text-slate-800">Basic Info</h2>
          </div>

          <form onSubmit={saveProfile} className="flex flex-col gap-3 flex-1">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Full name</label>
              <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} required className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Email</label>
              <input type="email" value={profile?.email ?? ''} disabled className={disabledCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Role</label>
              <input type="text" value={ROLE_LABELS[profile?.role as Role ?? 'developer']} disabled className={disabledCls} />
            </div>
            <div className="mt-auto pt-2">
              <button type="submit" disabled={saving}
                className="w-full py-2.5 bg-brand-600 text-white text-sm font-semibold rounded-xl hover:bg-brand-700 disabled:opacity-50 transition-colors">
                {saved ? '✓ Saved' : saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </form>
        </div>

        {/* Change Password */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-600">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </div>
            <h2 className="font-semibold text-slate-800">Change Password</h2>
          </div>

          <form onSubmit={changePassword} className="flex flex-col gap-3 flex-1">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">New password</label>
              <input type="password" value={newPassword} onChange={e => { setNewPassword(e.target.value); setPwdError('') }}
                placeholder="Min. 6 characters" required className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Confirm password</label>
              <input type="password" value={confirmPassword} onChange={e => { setConfirmPassword(e.target.value); setPwdError('') }}
                placeholder="Repeat new password" required className={inputCls} />
            </div>

            {pwdError && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">{pwdError}</p>
            )}
            {pwdSaved && (
              <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-xl px-3 py-2.5">✓ Password updated successfully.</p>
            )}

            <div className="mt-auto pt-2">
              <button type="submit" disabled={pwdSaving}
                className="w-full py-2.5 bg-amber-500 text-white text-sm font-semibold rounded-xl hover:bg-amber-600 disabled:opacity-50 transition-colors">
                {pwdSaving ? 'Updating…' : 'Update password'}
              </button>
            </div>
          </form>
        </div>

        {/* Project Roles */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600">
                  <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-4 0v2"/><path d="M8 7V5a2 2 0 0 0-4 0v2"/>
                </svg>
              </div>
              <h2 className="font-semibold text-slate-800">Project Roles</h2>
            </div>
            {!addingRole && (
              <button onClick={() => setAddingRole(true)}
                className="text-xs font-semibold text-brand-600 hover:text-brand-800 bg-brand-50 hover:bg-brand-100 px-2.5 py-1 rounded-lg transition-colors">
                + Add
              </button>
            )}
          </div>

          <div className="flex flex-col gap-2 flex-1">
            {roles.map(role => (
              <div key={role.id} className="flex items-center justify-between bg-slate-50 rounded-xl px-3 py-2.5 group">
                <div>
                  <p className="text-sm font-medium text-slate-800">{role.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{role.project?.name}</p>
                </div>
                <button onClick={() => deleteRole(role.id)}
                  className="w-6 h-6 flex items-center justify-center rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            ))}

            {roles.length === 0 && !addingRole && (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-8 border-2 border-dashed border-slate-100 rounded-xl">
                <p className="text-sm text-slate-400">No project roles yet</p>
                <p className="text-xs text-slate-300 mt-1">Add one to appear on team cards</p>
              </div>
            )}

            {addingRole && (
              <form onSubmit={addRole} className="space-y-2 mt-1">
                <select value={newRole.project_id} onChange={e => setNewRole(r => ({ ...r, project_id: e.target.value }))} required className={inputCls}>
                  <option value="">Select project</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <input type="text" placeholder="e.g. Senior Backend Developer" value={newRole.title}
                  onChange={e => setNewRole(r => ({ ...r, title: e.target.value }))} required className={inputCls} />
                <div className="flex gap-2">
                  <button type="submit"
                    className="flex-1 py-2 bg-brand-600 text-white text-sm font-semibold rounded-xl hover:bg-brand-700 transition-colors">
                    Save
                  </button>
                  <button type="button" onClick={() => setAddingRole(false)}
                    className="flex-1 py-2 border border-slate-200 text-sm text-slate-600 rounded-xl hover:bg-slate-50 transition-colors">
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
