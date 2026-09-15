'use client'

import { useState } from 'react'
import { Profile, Role, ROLE_LABELS } from '@/types'
import { createUser, updateUserRole, deleteUser } from '@/app/actions/users'

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

// Roles a given viewer can assign
function assignableRoles(viewerRole: Role): Role[] {
  if (viewerRole === 'super_admin') return ['developer', 'hr_admin', 'super_admin']
  if (viewerRole === 'hr_admin') return ['developer']
  return ['developer']
}

// Can the viewer manage (edit/delete) a target member?
function canManage(viewerRole: Role, targetRole: Role, isSelf: boolean): boolean {
  if (isSelf) return false
  if (viewerRole === 'super_admin') return true
  if (viewerRole === 'hr_admin') return targetRole === 'developer'
  return false
}

// Can the viewer create users?
function canCreate(viewerRole: Role): boolean {
  return true // all roles can create developer accounts
}

type AddForm = { fullName: string; email: string; password: string; role: Role }
const EMPTY_FORM: AddForm = { fullName: '', email: '', password: '', role: 'developer' }

export default function TeamManager({ members: init, currentUserId, currentUserRole }: Props) {
  const [members, setMembers] = useState(init)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState<AddForm>(EMPTY_FORM)
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null)
  const [pendingRole, setPendingRole] = useState<Role>('developer')

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setFormError('')
    setSubmitting(true)
    try {
      await createUser(form)
      // Optimistic add; server revalidates too
      setMembers(prev => [...prev, {
        id: crypto.randomUUID(),
        full_name: form.fullName,
        email: form.email,
        role: form.role,
      }].sort((a, b) => a.full_name.localeCompare(b.full_name)))
      setForm(EMPTY_FORM)
      setAdding(false)
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

  const roles = assignableRoles(currentUserRole)

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Team</h1>
          <p className="text-sm text-slate-500 mt-0.5">{members.length} members</p>
        </div>
        {canCreate(currentUserRole) && (
          <button
            onClick={() => setAdding(true)}
            className="px-3 py-1.5 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-700 transition-colors"
          >
            + Add member
          </button>
        )}
      </div>

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
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Password</label>
              <input type="password" required placeholder="Temporary password"
                value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Role</label>
              <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as Role }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400">
                {roles.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
            </div>
          </div>
          {formError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{formError}</p>
          )}
          <div className="flex gap-2">
            <button type="submit" disabled={submitting}
              className="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-700 disabled:opacity-50 transition-colors">
              {submitting ? 'Creating...' : 'Create member'}
            </button>
            <button type="button" onClick={() => { setAdding(false); setForm(EMPTY_FORM); setFormError('') }}
              className="px-4 py-2 border border-slate-300 text-sm rounded-lg hover:bg-slate-50 transition-colors">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Members table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {members.map((member, i) => {
          const isSelf = member.id === currentUserId
          const manageable = canManage(currentUserRole, member.role, isSelf)
          const isEditingRole = editingRoleId === member.id

          return (
            <div
              key={member.id}
              className={`flex items-center gap-4 px-5 py-4 ${i < members.length - 1 ? 'border-b border-slate-100' : ''} ${isSelf ? 'bg-slate-50' : ''}`}
            >
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

              {/* Role */}
              <div className="shrink-0">
                {isEditingRole ? (
                  <div className="flex items-center gap-1">
                    <select
                      value={pendingRole}
                      onChange={e => setPendingRole(e.target.value as Role)}
                      className="text-xs border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-slate-400"
                    >
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
                  <button
                    onClick={() => { setEditingRoleId(member.id); setPendingRole(member.role) }}
                    className="text-xs text-slate-500 hover:text-slate-900 transition-colors"
                  >
                    Edit role
                  </button>
                  <button
                    onClick={() => handleDelete(member.id, member.full_name)}
                    className="text-xs text-slate-400 hover:text-red-500 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
