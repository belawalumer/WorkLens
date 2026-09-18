'use client'

import Link from 'next/link'
import {
  DeveloperWithData, Role, ROLE_LABELS,
  UNAVAILABLE_STATUSES, UserStatus, USER_STATUS_CONFIG, formatStatusSub,
} from '@/types'

const fmt = (n: number) => n % 1 === 0 ? String(Math.round(n)) : n.toFixed(1)
const initials = (name: string) => {
  const p = name.trim().split(/\s+/)
  return p.length === 1 ? p[0][0].toUpperCase() : (p[0][0] + p[p.length - 1][0]).toUpperCase()
}

const ROLE_BADGE: Record<Role, string> = {
  super_admin: 'bg-purple-100 text-purple-700',
  hr_admin:    'bg-brand-100 text-brand-700',
  developer:   'bg-slate-100 text-slate-500',
  sqa:         'bg-teal-100 text-teal-700',
  ui_ux:       'bg-violet-100 text-violet-700',
}

const BAR_COLOR: Record<string, string> = {
  overloaded:  'bg-red-500',
  full:        'bg-green-500',
  underloaded: 'bg-amber-400',
  available:   'bg-emerald-400',
}

interface Props {
  dev: DeveloperWithData
  isMe: boolean
  viewerRole: Role
}

export default function MemberRow({ dev, isMe, viewerRole }: Props) {
  const primaryRole    = dev.roles[0]
  const isUnavailable  = UNAVAILABLE_STATUSES.includes((dev.user_status ?? 'active') as UserStatus)
  const freeToday      = Math.max(0, dev.freeHours)
  const fillPct        = Math.min(100, (dev.todayHours / 8) * 100)
  const showRoleBadge  = true
  const hasTasks = dev.tasks.length > 0

  return (
    <div className={`transition-colors ${isMe ? 'bg-brand-50/40' : 'hover:bg-slate-50/80'} ${isUnavailable ? 'opacity-60' : ''}`}>

      {/* ── Main row ─────────────────────────────────────────── */}
      <div className="flex items-center gap-4 px-5 pt-3.5 pb-2">

        {/* Avatar */}
        <div className="relative shrink-0 group/status">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold ${
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

        {/* Name + title */}
        <div className="w-44 shrink-0 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-sm font-semibold text-slate-900 truncate">{dev.full_name}</p>
            {isMe && <span className="text-[11px] text-brand-500 font-medium shrink-0">(you)</span>}
            {showRoleBadge && (
              <span className={`text-[11px] px-1.5 py-0.5 rounded font-semibold shrink-0 ${ROLE_BADGE[dev.role]}`}>
                {ROLE_LABELS[dev.role]}
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-400 truncate">{primaryRole?.title ?? <>&nbsp;</>}</p>
        </div>

        {/* Progress bar + hours */}
        <div className="flex-1 hidden sm:block">
          {isUnavailable ? (
            <p className="text-xs text-slate-400">
              {USER_STATUS_CONFIG[(dev.user_status ?? 'active') as UserStatus].emoji}{' '}
              {USER_STATUS_CONFIG[(dev.user_status ?? 'active') as UserStatus].label}
              {(() => {
                const sub = formatStatusSub(dev.user_status as UserStatus, dev.status_from, dev.status_until)
                return sub ? ` · ${sub}` : ''
              })()}
            </p>
          ) : (
            <div className="flex items-center gap-3">
              <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${BAR_COLOR[dev.status] ?? 'bg-slate-300'}`}
                  style={{ width: `${fillPct}%` }}
                />
              </div>
              <div className="flex justify-between gap-4 text-xs shrink-0 tabular-nums">
                <span className="text-slate-500">{fmt(dev.todayHours)}h planned</span>
                <span className={freeToday > 2 ? 'text-brand-600 font-semibold' : 'text-slate-400'}>
                  {fmt(freeToday)}h free
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Me link */}
        <div className="flex items-center gap-4 shrink-0">
          {isMe && (
            <Link href="/my-tasks" className="hidden sm:block text-xs font-semibold text-brand-600 hover:text-brand-700 transition-colors whitespace-nowrap">
              My tasks →
            </Link>
          )}
        </div>
      </div>

      {/* ── Task list ────────────────────────────────────────── */}
      {hasTasks && (
        <div className="pl-[72px] pr-5 pb-3 space-y-1">
          {dev.tasks.slice(0, 4).map(task => (
            <div key={task.id} className="flex items-center gap-2">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${task.completed ? 'bg-green-400' : 'bg-slate-300'}`} />
              <span className={`flex-1 text-xs truncate ${task.completed ? 'line-through text-slate-400' : 'text-slate-600'}`}>
                {task.title}
              </span>
              <span className="text-[11px] text-slate-400 shrink-0 tabular-nums">{fmt(task.estimated_hours)}h</span>
            </div>
          ))}
          {dev.tasks.length > 4 && (
            <p className="text-[11px] text-slate-400 pl-3.5">+{dev.tasks.length - 4} more</p>
          )}
        </div>
      )}
    </div>
  )
}
