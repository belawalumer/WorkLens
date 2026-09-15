'use client'

import { useState } from 'react'
import { Profile, Role, ROLE_LABELS } from '@/types'
import { createUser, updateUserRole, deleteUser, resetUserPassword } from '@/app/actions/users'

interface Props {
  members: Profile[]
  currentUserId: string
  currentUserRole: Role
}

const ROLE_COLORS: Record<Role, string> = {
  super_admin: 'bg-purple-100 text-purple-700',
  hr_admin: 'bg-blue-100 text-blue-700',
  developer: 'bg-slate-100 text-slate-600',
}

function assignableRoles(viewerRole: Role): Role[] {
  if (viewerRole === 'super_admin') return ['developer', 'hr_admin', 'super_admin']
  if (viewerRole === 'hr_admin') return ['developer']
  return ['developer']
}

function canManage(viewerRole: Role, targetRole: Role, isSelf: boolean): boolean {
  if (isSelf) return false
  if (viewerRole === 'super_admin') return true
  if (viewerRole === 'hr_admin') return targetRole === 'developer'
  return false
}

function generatePassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#'
  return Array.from(crypto.getRandomValues(new Uint8Array(14)))
    .map(b => chars[b % chars.length])
    .join('')
}

type AddForm = { fullName: string; email: string; role: Role }
const EMPTY_FORM: AddForm = { fullName: '', email: '', role: 'developer' }

interface ResetState {
  userId: string
  password: string
  applied: boolean
  applying: boolean
}

export default function TeamManager({ members: init, currentUserId, currentUserRole }: Props) {
  const [members, setMembers] = useState(init)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState<AddForm>(EMPTY_FORM)
  const [generatedPassword, setGeneratedPassword] = useState('')
  const [createdPassword, setCreatedPassword] = useState('')  // shown after creation
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null)
  const [pendingRole, setPendingRole] = useState<Role>('developer')
  const [resetState, setResetState] = useState<ResetState | null>(null)
  const [copied, setCopied] = useState(false)

  function openAddForm() {
    const pwd = generatePassword()
    setGeneratedPassword(pwd)
    setForm(EMPTY_FORM)
    setFormError('')
    setCreatedPassword('')
    setAdding(true)
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setFormError('')
    setSubmitting(true)
    try {
      await createUser({ ...form, password: generatedPassword })
      setMembers(prev => [...prev, {
        id: crypto.randomUUID(),
        full_name: form.fullName,
        email: form.email,
        role: form.role,
      }].sort((a, b) => a.full_name.localeCompare(b.full_name)))
      setCreatedPassword(generatedPassword)
      setAdding(false)
      setForm(EMPTY_FORM)
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to create user')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRoleChange(userId: string) {
    try {
      await updateUserRole(userId, pendingRole)
      setMembers(prev => prev.map(m => m.id === userId ? { ...m, role: pendingRole } : m))
      setEditingRoleId(null)
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to update role')
    }
  }

  async function handleDelete(userId: string, name: string) {
    if (!confirm(`Delete ${name}? This cannot be undone.`)) return
    try {
      await deleteUser(userId)
      setMembers(prev => prev.filter(m => m.id !== userId))
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete user')
    }
  }

  function openResetPanel(userId: string) {
    setResetState({ userId, password: generatePassword(), applied: false, applying: false })
  }

  async function applyReset() {
    if (!resetState) return
    setResetState(s => s ? { ...s, applying: true } : null)
    try {
      await resetUserPassword(resetState.userId, resetState.password)
      setResetState(s => s ? { ...s, applied: true, applying: false } : null)
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to reset password')
      setResetState(s => s ? { ...s, applying: false } : null)
    }
  }

  const roles = assignableRoles(currentUserRole)

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Team</h1>
          <p className="text-sm text-slate-500 mt-0.5">{members.length} members</p>
        </div>
        <button
          onClick={openAddForm}
          className="px-3 py-1.5 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-700 transition-colors"
        >
          + Add member
        </button>
      </div>

      {/* Created — share password banner */}
      {createdPassword && (
        <div className="mb-5 bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-green-800 mb-1">✓ Member created successfully</p>
          <p className="text-xs text-green-700 mb-2">Share this temporary password with them — it won&apos;t be shown again.</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-sm bg-white border border-green-200 rounded-lg px-3 py-2 font-mono text-slate-800 select-all">
              {createdPassword}
            </code>
            <button
              onClick={() => copyToClipboard(createdPassword)}
              className="shrink-0 text-xs px-3 py-2 bg-green-700 text-white rounded-lg hover:bg-green-800 transition-colors"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
            <button onClick={() => setCreatedPassword('')} className="text-green-600 hover:text-green-800 text-sm">✕</button>
          </div>
        </div>
      )}

      {/* Add member form */}
      {adding && (
        <form onSubmit={handleCreate} className="bg-white border border-slate-200 rounded-xl p-5 mb-5 space-y-3">
          <h2 className="font-semibold text-slate-800 text-sm">New team member</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Full name</label>
              <input type="text" required placeholder="Jane Smith"
                value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
              <input type="email" required placeholder="jane@company.com"
                value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Role</label>
              <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as Role }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400">
                {roles.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
            </div>
          </div>

          {/* Generated password — read-only, copyable */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1">
            <p className="text-xs font-medium text-slate-600">Auto-generated temporary password</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-sm font-mono text-slate-800 select-all">{generatedPassword}</code>
              <button type="button" onClick={() => copyToClipboard(generatedPassword)}
                className="text-xs px-2.5 py-1 border border-slate-300 rounded-lg hover:bg-white transition-colors shrink-0">
                {copied ? 'Copied!' : 'Copy'}
              </button>
              <button type="button" onClick={() => setGeneratedPassword(generatePassword())}
                className="text-xs px-2.5 py-1 border border-slate-300 rounded-lg hover:bg-white transition-colors shrink-0" title="Regenerate">
                ↻
              </button>
            </div>
            <p className="text-xs text-slate-400">The member can change it from their Profile settings.</p>
          </div>

          {formError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{formError}</p>
          )}
          <div className="flex gap-2">
            <button type="submit" disabled={submitting}
              className="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-700 disabled:opacity-50 transition-colors">
              {submitting ? 'Creating...' : 'Create member'}
            </button>
            <button type="button" onClick={() => { setAdding(false); setFormError('') }}
              className="px-4 py-2 border border-slate-300 text-sm rounded-lg hover:bg-slate-50 transition-colors">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Members list */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {members.map((member, i) => {
          const isSelf = member.id === currentUserId
          const manageable = canManage(currentUserRole, member.role, isSelf)
          const isEditingRole = editingRoleId === member.id
          const isResetting = resetState?.userId === member.id

          return (
            <div key={member.id} className={i < members.length - 1 ? 'border-b border-slate-100' : ''}>
              <div className={`flex items-center gap-4 px-5 py-4 ${isSelf ? 'bg-slate-50' : ''}`}>
                {/* Avatar */}
                <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center text-sm font-bold text-slate-600 shrink-0">
                  {member.full_name.charAt(0).toUpperCase()}
                </div>

                {/* Name + email */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-slate-800 truncate">{member.full_name}</p>
                    {isSelf && <span className="text-xs text-slate-400">(you)</span>}
                  </div>
                  <p className="text-xs text-slate-500 truncate">{member.email}</p>
                </div>

                {/* Role — static or editing */}
                <div className="shrink-0">
                  {isEditingRole ? (
                    <div className="flex items-center gap-1">
                      <select value={pendingRole} onChange={e => setPendingRole(e.target.value as Role)}
                        className="text-xs border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-slate-400">
                        {roles.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                      </select>
                      <button onClick={() => handleRoleChange(member.id)}
                        className="text-xs px-2 py-1 bg-slate-900 text-white rounded hover:bg-slate-700 transition-colors">✓</button>
                      <button onClick={() => setEditingRoleId(null)}
                        className="text-xs px-2 py-1 border border-slate-300 rounded hover:bg-slate-50 transition-colors">✕</button>
                    </div>
                  ) : (
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${ROLE_COLORS[member.role]}`}>
                      {ROLE_LABELS[member.role]}
                    </span>
                  )}
                </div>

                {/* Actions */}
                {manageable && !isEditingRole && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => { setEditingRoleId(member.id); setPendingRole(member.role) }}
                      className="text-xs text-slate-500 hover:text-slate-900 transition-colors">
                      Edit role
                    </button>
                    <button
                      onClick={() => isResetting ? setResetState(null) : openResetPanel(member.id)}
                      className={`text-xs transition-colors ${isResetting ? 'text-amber-700 font-medium' : 'text-slate-500 hover:text-amber-600'}`}
                    >
                      {isResetting ? 'Cancel reset' : 'Reset pwd'}
                    </button>
                    <button onClick={() => handleDelete(member.id, member.full_name)}
                      className="text-xs text-slate-400 hover:text-red-500 transition-colors">
                      Delete
                    </button>
                  </div>
                )}
              </div>

              {/* Inline password reset panel */}
              {isResetting && (
                <div className="border-t border-slate-100 bg-amber-50 px-5 py-3 space-y-2">
                  <p className="text-xs font-medium text-amber-800">Reset password for {member.full_name}</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-sm font-mono text-slate-800 bg-white border border-amber-200 rounded-lg px-3 py-2 select-all">
                      {resetState!.password}
                    </code>
                    <button onClick={() => copyToClipboard(resetState!.password)}
                      className="text-xs px-2.5 py-2 border border-amber-300 bg-white rounded-lg hover:bg-amber-50 shrink-0 transition-colors">
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                    <button onClick={() => setResetState(s => s ? { ...s, password: generatePassword() } : null)}
                      title="Regenerate" className="text-xs px-2.5 py-2 border border-amber-300 bg-white rounded-lg hover:bg-amber-50 shrink-0 transition-colors">
                      ↻
                    </button>
                  </div>
                  {resetState!.applied ? (
                    <p className="text-xs text-green-700 font-medium">✓ Password reset. Share the new password with the member.</p>
                  ) : (
                    <div className="flex gap-2">
                      <button onClick={applyReset} disabled={resetState!.applying}
                        className="text-xs px-3 py-1.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 transition-colors">
                        {resetState!.applying ? 'Applying...' : 'Apply reset'}
                      </button>
                      <button onClick={() => setResetState(null)}
                        className="text-xs px-3 py-1.5 border border-slate-300 rounded-lg hover:bg-white transition-colors">
                        Cancel
                      </button>
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
