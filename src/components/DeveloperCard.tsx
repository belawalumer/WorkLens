'use client'

import { DeveloperWithData, Role, ROLE_LABELS, UNAVAILABLE_STATUSES, UserStatus, USER_STATUS_CONFIG, formatStatusSub } from '@/types'
import WorkloadBadge from './WorkloadBadge'
import Link from 'next/link'

const fmt = (n: number) => n % 1 === 0 ? String(Math.round(n)) : n.toFixed(1)
const initials = (name: string) => {
  const p = name.trim().split(/\s+/)
  return p.length === 1 ? p[0][0].toUpperCase() : (p[0][0] + p[p.length - 1][0]).toUpperCase()
}

interface Props {
  dev: DeveloperWithData
  isMe: boolean
  viewerRole: Role
}

const ROLE_BADGE: Record<Role, string> = {
  super_admin: 'bg-purple-100 text-purple-700',
  hr_admin:    'bg-brand-100 text-brand-700',
  developer:   '',
}

export default function DeveloperCard({ dev, isMe, viewerRole }: Props) {
  const primaryRole = dev.roles[0]
  const showRoleBadge = viewerRole !== 'developer' && dev.role !== 'developer'
  const fillPct = Math.min(100, (dev.todayHours / 8) * 100)
  const isUnavailable = UNAVAILABLE_STATUSES.includes((dev.user_status ?? 'active') as UserStatus)
  const freeToday = Math.max(0, dev.freeHours)

  return (
    <div className={`bg-white rounded-2xl border flex flex-col gap-4 transition-opacity ${
      isMe ? 'border-green-300 ring-1 ring-green-200' : 'border-slate-200'
    } ${isUnavailable ? 'opacity-60' : ''}`}>
      <div className="px-5 pt-4 flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-start gap-3 min-w-0">
          {/* Avatar */}
          <div className="relative shrink-0 group/status">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold ${
              isMe ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'
            }`}>
              {initials(dev.full_name)}
            </div>
            <span className="absolute -bottom-1 -right-1 flex items-center justify-center w-4 h-4 bg-white rounded-full text-[9px] leading-none shadow-sm ring-1 ring-slate-100">
              {USER_STATUS_CONFIG[(dev.user_status ?? 'active') as UserStatus].emoji}
            </span>
            <div className="pointer-events-none absolute bottom-full left-0 mb-2 px-2 py-1 text-[11px] font-medium bg-slate-800 text-white rounded-lg whitespace-nowrap opacity-0 group-hover/status:opacity-100 transition-opacity z-20">
              {USER_STATUS_CONFIG[(dev.user_status ?? 'active') as UserStatus].label}
              {(() => {
                const sub = formatStatusSub((dev.user_status ?? 'active') as UserStatus, dev.status_from, dev.status_until)
                return sub ? ` · ${sub}` : ''
              })()}
            </div>
          </div>

          {/* Name + role badge on same row, project title below */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="font-bold text-slate-900 text-sm leading-snug">{dev.full_name}</p>
              {showRoleBadge && (
                <span className={`text-[11px] px-1.5 py-0.5 rounded font-semibold ${ROLE_BADGE[dev.role]}`}>
                  {ROLE_LABELS[dev.role]}
                </span>
              )}
            </div>
            {primaryRole && (
              <span className="text-[11px] text-slate-400">{primaryRole.title}</span>
            )}
          </div>
        </div>

        {/* Progress bar — planned + free only */}
        <div>
          <div className="flex justify-between text-xs text-slate-500 mb-1.5">
            <span className="font-medium">{fmt(dev.todayHours)}h planned</span>
            <span className={`font-semibold ${freeToday > 2 ? 'text-brand-600' : 'text-slate-400'}`}>
              {fmt(freeToday)}h free
            </span>
          </div>
          <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                dev.status === 'overloaded' ? 'bg-red-500'
                : dev.status === 'full'      ? 'bg-green-500'
                : dev.status === 'underloaded' ? 'bg-amber-400'
                : 'bg-emerald-400'
              }`}
              style={{ width: `${fillPct}%` }}
            />
          </div>
        </div>

        {/* Task list */}
        {dev.tasks.length > 0 ? (
          <div className="space-y-1.5">
            {dev.tasks.slice(0, 3).map(task => (
              <div key={task.id} className="flex items-center gap-2 text-sm">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${task.completed ? 'bg-green-400' : 'bg-slate-300'}`} />
                <span className={`flex-1 truncate text-xs ${task.completed ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                  {task.title}
                </span>
                <span className="text-[11px] text-slate-400 shrink-0 font-medium">{fmt(task.estimated_hours)}h</span>
              </div>
            ))}
            {dev.tasks.length > 3 && (
              <p className="text-[11px] text-slate-400 pl-3">+{dev.tasks.length - 3} more tasks</p>
            )}
          </div>
        ) : (
          <p className="text-xs text-slate-400 italic">No tasks today</p>
        )}
      </div>

      {/* Footer: workload (active devs only) */}
      {(!dev.user_status || dev.user_status === 'active') && (
        <div className={`border-t border-slate-100 px-5 py-2.5 flex items-center gap-2 ${isMe ? '' : 'pb-3'}`}>
          <WorkloadBadge status={dev.status} freeToday={freeToday} freeWeek={Math.max(0, 40 - dev.weeklyHours)} />
        </div>
      )}

      {/* Footer: me link */}
      {isMe && (
        <div className="px-5 pb-4">
          <Link href="/my-tasks"
            className="block text-center text-xs font-semibold text-green-700 bg-green-50 hover:bg-green-100 rounded-xl py-2 transition-colors">
            Manage my tasks →
          </Link>
        </div>
      )}
    </div>
  )
}
