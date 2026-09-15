export type Role = 'super_admin' | 'hr_admin' | 'developer'
export type WorkloadStatus = 'overloaded' | 'full' | 'underloaded' | 'available'

export const ROLE_LABELS: Record<Role, string> = {
  super_admin: 'Super Admin',
  hr_admin: 'HR Admin',
  developer: 'Developer',
}

export interface Profile {
  id: string
  full_name: string
  email: string
  role: Role
}

export interface Project {
  id: string
  name: string
}

export interface DeveloperRole {
  id: string
  developer_id: string
  project_id: string
  title: string
  project?: Project
}

export interface Task {
  id: string
  developer_id: string
  project_id: string | null
  title: string
  estimated_hours: number
  completed: boolean
  task_date: string
  estimate_change_reason: string | null
  project?: Project
}

export interface DeveloperWithData extends Profile {
  roles: DeveloperRole[]
  tasks: Task[]
  todayHours: number
  completedHours: number
  remainingHours: number
  freeHours: number
  weeklyHours: number
  status: WorkloadStatus
}

export function getWorkloadStatus(hours: number): WorkloadStatus {
  if (hours > 8) return 'overloaded'
  if (hours >= 7) return 'full'
  if (hours >= 4) return 'underloaded'
  return 'available'
}

export const STATUS_CONFIG: Record<WorkloadStatus, { label: string; emoji: string; bg: string; text: string; border: string; solid: string }> = {
  overloaded:  { label: 'Overloaded',  emoji: '🔴', bg: 'bg-red-50',     text: 'text-red-700',    border: 'border-red-200',    solid: '#dc2626' },
  full:        { label: 'Full Load',   emoji: '🟢', bg: 'bg-green-50',   text: 'text-green-700',  border: 'border-green-200',  solid: '#16a34a' },
  underloaded: { label: 'Underloaded', emoji: '🟡', bg: 'bg-amber-50',   text: 'text-amber-700',  border: 'border-amber-200',  solid: '#d97706' },
  available:   { label: 'Available',   emoji: '🔵', bg: 'bg-brand-50',   text: 'text-brand-700',  border: 'border-brand-200',  solid: '#4f46e5' },
}
