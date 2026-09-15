'use client'

import { DeveloperWithData, Role, ROLE_LABELS } from '@/types'

const fmt = (n: number) => n % 1 === 0 ? String(Math.round(n)) : n.toFixed(1)
import WorkloadBadge from './WorkloadBadge'
import Link from 'next/link'

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
  const freeHours = Math.max(0, dev.freeHours)
  const showRoleBadge = viewerRole !== 'developer' && dev.role !== 'developer'
  const fillPct = Math.min(100, (dev.todayHours / 8) * 100)

  return (
    <div className={`bg-white rounded-2xl border shadow-sm flex flex-col gap-4 overflow-hidden transition-shadow hover:shadow-md ${
      isMe
        ? 'border-green-300 ring-1 ring-green-200'
        : 'border-slate-200'
    }`}>
      <div className="px-5 pt-4 flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            {/* Avatar */}
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 ${
              isMe ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'
            }`}>
              {dev.full_name.charAt(0).toUpperCase()}
            </div>
            {/* Name + meta */}
            <div className="min-w-0 flex-1">
              <p className="font-bold text-slate-900 text-sm leading-snug">{dev.full_name}</p>
              <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                {showRoleBadge && (
                  <span className={`text-[11px] px-1.5 py-0.5 rounded font-semibold ${ROLE_BADGE[dev.role]}`}>
                    {ROLE_LABELS[dev.role]}
                  </span>
                )}
                {primaryRole && (
                  <span className="text-[11px] text-slate-400 truncate">
                    {primaryRole.title}
                  </span>
                )}
              </div>
            </div>
          </div>
          <WorkloadBadge status={dev.status} />
        </div>

        {/* Progress bar */}
        <div>
          <div className="flex justify-between text-xs text-slate-500 mb-1.5">
            <span className="font-medium">{fmt(dev.todayHours)}h planned</span>
            <span>{fmt(dev.completedHours)}h done</span>
          </div>
          <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                dev.status === 'overloaded' ? 'bg-red-500'
                : dev.status === 'full' ? 'bg-green-500'
                : dev.status === 'underloaded' ? 'bg-amber-400'
                : 'bg-emerald-400'
              }`}
              style={{ width: `${fillPct}%` }}
            />
          </div>
          <div className="flex justify-between text-xs mt-1.5">
            <span className="text-slate-400">{fmt(dev.remainingHours)}h left</span>
            <span className={`font-semibold ${freeHours > 2 ? 'text-brand-600' : 'text-slate-400'}`}>
              {fmt(freeHours)}h free
            </span>
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
                <span className="text-[11px] text-slate-400 shrink-0 font-medium">{task.estimated_hours}h</span>
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

      {/* Footer */}
      {isMe && (
        <div className="px-5 pb-4">
          <Link href="/my-tasks"
            className="block text-center text-xs font-semibold text-green-700 bg-green-50 hover:bg-green-100 rounded-xl py-2 transition-colors">
            Manage my tasks →
          </Link>
        </div>
      )}
      {!isMe && <div className="pb-1" />}
    </div>
  )
}
