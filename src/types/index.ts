export type Role = 'super_admin' | 'hr_admin' | 'developer' | 'sqa' | 'ui_ux'

export function isDevRole(role: Role): boolean {
  return role === 'developer' || role === 'sqa' || role === 'ui_ux'
}
export type WorkloadStatus = 'overloaded' | 'full' | 'underloaded' | 'available'
export type UserStatus = 'active' | 'away' | 'dnd' | 'in_meeting' | 'on_leave' | 'vacation'

export const USER_STATUS_CONFIG: Record<UserStatus, { label: string; emoji: string; dotBg: string }> = {
  active:     { label: 'Active',         emoji: '🟢', dotBg: 'bg-emerald-500' },
  away:       { label: 'Away',           emoji: '🌙', dotBg: 'bg-amber-400'   },
  dnd:        { label: 'Do Not Disturb', emoji: '⛔', dotBg: 'bg-red-500'     },
  in_meeting: { label: 'In a Meeting',   emoji: '📅', dotBg: 'bg-blue-500'    },
  on_leave:   { label: 'On Leave',       emoji: '🏠', dotBg: 'bg-slate-400'   },
  vacation:   { label: 'Vacation',       emoji: '✈️', dotBg: 'bg-purple-500'  },
}

export const UNAVAILABLE_STATUSES: UserStatus[] = ['on_leave', 'vacation']

/** Returns 'active' if a leave/vacation status has passed its end date — no DB write needed. */
export function effectiveStatus(
  status: UserStatus,
  statusUntil?: string | null,
  today = new Date().toISOString().split('T')[0],
): UserStatus {
  if ((status === 'on_leave' || status === 'vacation') && statusUntil && statusUntil < today) return 'active'
  return status
}

export const ROLE_LABELS: Record<Role, string> = {
  super_admin: 'Super Admin',
  hr_admin: 'HR Admin',
  developer: 'Developer',
  sqa: 'SQA',
  ui_ux: 'UI/UX',
}

export interface Profile {
  id: string
  full_name: string
  email: string
  role: Role
  user_status?: UserStatus
  status_from?: string | null
  status_until?: string | null
  whatsapp?: string | null
  /** ISO timestamptz; future = offering help, null/past = not */
  assist_until?: string | null
}

export function isAssisting(assistUntil?: string | null, now = Date.now()): boolean {
  if (!assistUntil) return false
  return new Date(assistUntil).getTime() > now
}

/** Remaining time label, e.g. "3h 20m" / "45m" / "Expired". */
export function formatAssistRemaining(assistUntil: string | Date, now = Date.now()): string {
  const end = typeof assistUntil === 'string' ? new Date(assistUntil).getTime() : assistUntil.getTime()
  const ms = end - now
  if (ms <= 0) return 'Expired'
  const totalMins = Math.ceil(ms / 60_000)
  const h = Math.floor(totalMins / 60)
  const m = totalMins % 60
  if (h <= 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

export function formatStatusSub(
  status: UserStatus,
  from?: string | null,
  until?: string | null,
): string | null {
  const fmt = (d: string) =>
    new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  if (status === 'vacation' && from && until) return from === until ? fmt(from) : `${fmt(from)} – ${fmt(until)}`
  if (status === 'on_leave' && from) return (!until || from === until) ? fmt(from) : `${fmt(from)} – ${fmt(until)}`
  if (status === 'in_meeting' && from) return fmt(from)
  return null
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
  /** ISO date (YYYY-MM-DD); null = backlog */
  task_date: string | null
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
  overloaded:  { label: 'Overloaded',  emoji: '🔴', bg: 'bg-red-50',     text: 'text-red-600',    border: 'border-red-500',    solid: '#dc2626' },
  full:        { label: 'Occupied',    emoji: '🔵', bg: 'bg-brand-50',   text: 'text-brand-600',  border: 'border-brand-500',  solid: '#0078b7' },
  underloaded: { label: 'Underloaded', emoji: '🟡', bg: 'bg-amber-50',   text: 'text-amber-600',  border: 'border-amber-400',  solid: '#d97706' },
  available:   { label: 'Available',   emoji: '🟢', bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-400', solid: '#25D366' },
}
