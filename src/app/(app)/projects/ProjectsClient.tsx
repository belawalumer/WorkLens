'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { createClient } from '@/lib/supabase/client'
import { Role } from '@/types'
import { toast } from '@/lib/toast'

interface Project { id: string; name: string; created_at: string }

const inputCls = 'w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 bg-slate-50 transition-colors'

export default function ProjectsClient({
  initialProjects,
  userRole,
}: {
  initialProjects: Project[]
  userRole: Role
}) {
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const supabase = createClient()

  const canDelete = userRole === 'super_admin' || userRole === 'hr_admin'

  const { data: projects = initialProjects, mutate } = useSWR<Project[]>(
    'projects',
    async () => {
      const { data } = await supabase.from('projects').select('id, name, created_at').order('name')
      return data ?? []
    },
    { fallbackData: initialProjects },
  )

  function isDuplicate(name: string, excludeId?: string) {
    return projects.some(p => p.name.toLowerCase() === name.toLowerCase() && p.id !== excludeId)
  }

  async function addProject(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = newName.trim()
    if (!trimmed) return
    if (isDuplicate(trimmed)) { toast.error('A project with this name already exists'); return }
    setAdding(true)
    const { data, error } = await supabase
      .from('projects')
      .insert({ name: trimmed })
      .select('id, name, created_at')
      .single()
    setAdding(false)
    if (error) { toast.error('Failed to add project'); return }
    mutate(prev => [...(prev ?? []), data].sort((a, b) => a.name.localeCompare(b.name)), false)
    setNewName('')
    toast.success('Project added')
  }

  function startEdit(p: Project) {
    setEditingId(p.id)
    setEditingName(p.name)
  }

  async function saveEdit(id: string) {
    const trimmed = editingName.trim()
    if (!trimmed) { setEditingId(null); return }
    if (isDuplicate(trimmed, id)) { toast.error('A project with this name already exists'); return }
    mutate(prev => (prev ?? []).map(p => p.id === id ? { ...p, name: trimmed } : p), false)
    setEditingId(null)
    const { error } = await supabase.from('projects').update({ name: trimmed }).eq('id', id)
    if (error) { toast.error('Failed to update project'); mutate() }
    else { mutate(); toast.success('Project updated') }
  }

  async function deleteProject(id: string, name: string) {
    if (!confirm(`Delete project "${name}"? Tasks linked to it will have no project.`)) return
    mutate(prev => (prev ?? []).filter(p => p.id !== id), false)
    const { error } = await supabase.from('projects').delete().eq('id', id)
    if (error) { toast.error('Failed to delete project'); mutate() }
    else { mutate(); toast.success('Project deleted') }
  }

  return (
    <div className="max-w-2xl mx-auto page-enter">

      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Projects</h1>
          <p className="text-sm text-slate-500 mt-0.5">{projects.length} project{projects.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Add form */}
      <form onSubmit={addProject} className="flex gap-2 mb-6">
        <input
          type="text"
          placeholder="New project name…"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          className={inputCls}
        />
        <button type="submit" disabled={adding || !newName.trim()}
          className="px-4 py-2 bg-brand-600 text-white text-sm font-semibold rounded-xl hover:bg-brand-700 disabled:opacity-50 transition-colors shrink-0">
          {adding ? 'Adding…' : '+ Add'}
        </button>
      </form>

      {/* Project list */}
      {projects.length === 0 ? (
        <div className="text-center py-16 bg-white border border-dashed border-slate-200 rounded-2xl">
          <p className="text-slate-500 text-sm font-medium">No projects yet</p>
          <p className="text-slate-400 text-xs mt-1">Add your first project above</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100">
          {projects.map(p => (
            <div key={p.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 transition-colors">
              {/* Color dot */}
              <div className="w-2 h-2 rounded-full bg-brand-400 shrink-0" />

              {/* Name / edit input */}
              {editingId === p.id ? (
                <input
                  autoFocus
                  type="text"
                  value={editingName}
                  onChange={e => setEditingName(e.target.value)}
                  onBlur={() => saveEdit(p.id)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') { e.preventDefault(); saveEdit(p.id) }
                    if (e.key === 'Escape') setEditingId(null)
                  }}
                  className="flex-1 px-2 py-1 border border-brand-400 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white"
                />
              ) : (
                <span className="flex-1 text-sm font-medium text-slate-800">{p.name}</span>
              )}

              {/* Actions */}
              <div className="flex items-center gap-1 shrink-0">
                {editingId === p.id ? (
                  <>
                    <button onClick={() => saveEdit(p.id)}
                      className="text-xs px-2.5 py-1 bg-brand-600 text-white rounded-lg hover:bg-brand-700 font-semibold transition-colors">
                      Save
                    </button>
                    <button onClick={() => setEditingId(null)}
                      className="text-xs px-2.5 py-1 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 transition-colors">
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button onClick={() => startEdit(p)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                      title="Edit">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    {canDelete && (
                      <button onClick={() => deleteProject(p.id, p.name)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                        title="Delete">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M9 6V4h6v2"/>
                        </svg>
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
