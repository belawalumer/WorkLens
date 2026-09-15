'use client'

import { DeveloperWithData } from '@/types'
import WorkloadBadge from './WorkloadBadge'
import Link from 'next/link'

interface Props {
  dev: DeveloperWithData
  isMe: boolean
}

export default function DeveloperCard({ dev, isMe }: Props) {
  const primaryRole = dev.roles[0]
  const freeHoursDisplay = Math.max(0, dev.freeHours).toFixed(1)

  return (
    <div className={`bg-white rounded-2xl border shadow-sm p-5 flex flex-col gap-4 transition-shadow hover:shadow-md ${isMe ? 'border-slate-400 ring-1 ring-slate-300' : 'border-slate-200'}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-sm font-bold text-slate-600 shrink-0">
              {dev.full_name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-slate-900 truncate">{dev.full_name}</p>
              {primaryRole && (
                <p className="text-xs text-slate-500 truncate">
                  {primaryRole.title} — {primaryRole.project?.name}
                </p>
              )}
            </div>
          </div>
        </div>
        <WorkloadBadge status={dev.status} />
      </div>

      {/* Hours bar */}
      <div>
        <div className="flex justify-between text-xs text-slate-500 mb-1">
          <span>{dev.todayHours.toFixed(1)}h planned</span>
          <span>{dev.completedHours.toFixed(1)}h done</span>
        </div>
        <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-slate-700 transition-all"
            style={{ width: `${Math.min(100, (dev.todayHours / 8) * 100)}%` }}
          />
        </div>
        <div className="flex justify-between text-xs mt-1">
          <span className="text-slate-400">{dev.remainingHours.toFixed(1)}h remaining</span>
          <span className={`font-semibold ${parseFloat(freeHoursDisplay) > 2 ? 'text-blue-600' : 'text-slate-500'}`}>
            {freeHoursDisplay}h free
          </span>
        </div>
      </div>

      {/* Today's tasks preview */}
      {dev.tasks.length > 0 && (
        <div className="space-y-1.5">
          {dev.tasks.slice(0, 3).map(task => (
            <div key={task.id} className="flex items-center gap-2 text-sm">
              <span className={`w-2 h-2 rounded-full shrink-0 ${task.completed ? 'bg-green-400' : 'bg-slate-300'}`} />
              <span className={`truncate ${task.completed ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                {task.title}
              </span>
              <span className="ml-auto text-xs text-slate-400 shrink-0">{task.estimated_hours}h</span>
            </div>
          ))}
          {dev.tasks.length > 3 && (
            <p className="text-xs text-slate-400 pl-4">+{dev.tasks.length - 3} more</p>
          )}
        </div>
      )}

      {dev.tasks.length === 0 && (
        <p className="text-sm text-slate-400 italic">No tasks for today</p>
      )}

      {/* Footer */}
      {isMe && (
        <Link
          href="/my-tasks"
          className="mt-auto block text-center text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg py-1.5 transition-colors"
        >
          Manage my tasks →
        </Link>
      )}
    </div>
  )
}
