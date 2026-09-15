'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Profile, DeveloperRole, Project } from '@/types'

interface Props {
  profile: Profile | null
  roles: DeveloperRole[]
  projects: Project[]
  userId: string
}

export default function ProfileClient({ profile, roles: initRoles, projects, userId }: Props) {
  const [fullName, setFullName] = useState(profile?.full_name ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [roles, setRoles] = useState(initRoles)
  const [newRole, setNewRole] = useState({ project_id: '', title: '' })
  const [addingRole, setAddingRole] = useState(false)
  const supabase = createClient()

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await supabase.from('profiles').update({ full_name: fullName }).eq('id', userId)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
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
    <div className="max-w-xl mx-auto space-y-6">
      <h1 className="text-xl font-bold text-slate-900">Profile</h1>

      {/* Basic info */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6">
        <h2 className="font-semibold text-slate-800 mb-4">Basic Info</h2>
        <form onSubmit={saveProfile} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Full name</label>
            <input
              type="text"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              required
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input type="email" value={profile?.email ?? ''} disabled
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-500" />
          </div>
          <button type="submit" disabled={saving}
            className="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-700 disabled:opacity-50 transition-colors">
            {saved ? '✓ Saved' : saving ? 'Saving...' : 'Save changes'}
          </button>
        </form>
      </div>

      {/* Project roles */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-800">Project Roles</h2>
          <button onClick={() => setAddingRole(true)}
            className="text-sm text-slate-600 hover:text-slate-900 font-medium">+ Add role</button>
        </div>

        <div className="space-y-2">
          {roles.map(role => (
            <div key={role.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2.5">
              <div>
                <p className="text-sm font-medium text-slate-800">{role.title}</p>
                <p className="text-xs text-slate-500">{role.project?.name}</p>
              </div>
              <button onClick={() => deleteRole(role.id)} className="text-slate-400 hover:text-red-500 text-sm transition-colors">✕</button>
            </div>
          ))}
          {roles.length === 0 && !addingRole && (
            <p className="text-sm text-slate-400 italic">No project roles set. Add one to appear on cards.</p>
          )}
        </div>

        {addingRole && (
          <form onSubmit={addRole} className="mt-3 space-y-2">
            <select
              value={newRole.project_id}
              onChange={e => setNewRole(r => ({ ...r, project_id: e.target.value }))}
              required
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
            >
              <option value="">Select project</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <input
              type="text"
              placeholder="e.g. Senior Backend Developer"
              value={newRole.title}
              onChange={e => setNewRole(r => ({ ...r, title: e.target.value }))}
              required
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
            />
            <div className="flex gap-2">
              <button type="submit"
                className="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-700 transition-colors">
                Save role
              </button>
              <button type="button" onClick={() => setAddingRole(false)}
                className="px-4 py-2 border border-slate-300 text-sm rounded-lg hover:bg-slate-50 transition-colors">
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
