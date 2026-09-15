'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Profile, ROLE_LABELS, Role } from '@/types'

interface Props {
  profile: Profile | null
  userId: string
}

const initials = (name: string) => {
  const p = name.trim().split(/\s+/)
  return p.length === 1 ? p[0][0].toUpperCase() : (p[0][0] + p[p.length - 1][0]).toUpperCase()
}

const inputCls = 'w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-400 transition-colors bg-white'
const disabledCls = 'w-full px-3 py-2.5 border border-slate-100 rounded-xl text-sm bg-slate-50 text-slate-400'

export default function ProfileClient({ profile, userId }: Props) {
  const [fullName, setFullName] = useState(profile?.full_name ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

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

  return (
    <div className="page-enter space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-brand-100 flex items-center justify-center shrink-0">
          <span className="text-brand-700 text-xl font-black">{initials(profile?.full_name ?? 'U')}</span>
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

      {/* 2-column row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
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
      </div>
    </div>
  )
}
