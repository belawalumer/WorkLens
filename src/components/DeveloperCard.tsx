'use client'

import { useState } from 'react'
import { DeveloperWithData, Role, ROLE_LABELS, UNAVAILABLE_STATUSES, UserStatus, USER_STATUS_CONFIG, STATUS_CONFIG, formatStatusSub } from '@/types'
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

const TOP_BORDER: Record<string, string> = {
  overloaded:  'border-t-red-500',
  full:        'border-t-brand-500',
  underloaded: 'border-t-amber-400',
  available:   'border-t-emerald-400',
}

const BAR_BG: Record<string, string> = {
  overloaded:  'bg-red-500',
  full:        'bg-brand-500',
  underloaded: 'bg-amber-400',
  available:   'bg-emerald-400',
}

export default function DeveloperCard({ dev, isMe, viewerRole }: Props) {
  const [expanded, setExpanded] = useState(false)
  const primaryRole    = dev.roles[0]
  const showRoleBadge  = viewerRole !== 'developer' && dev.role !== 'developer'
  const isUnavailable  = UNAVAILABLE_STATUSES.includes((dev.user_status ?? 'active') as UserStatus)
  const freeToday      = Math.max(0, dev.freeHours)
  const fillPct        = Math.min(100, (dev.todayHours / 8) * 100)
  const topBorder      = isMe ? 'border-t-green-400' : isUnavailable ? 'border-t-slate-200' : (TOP_BORDER[dev.status] ?? 'border-t-slate-200')

  return (
    <div className={`bg-white rounded-2xl border border-slate-200 border-t-4 flex flex-col transition-opacity ${topBorder} ${isUnavailable ? 'opacity-60' : ''}`}>

      {/* ── Header ───────────────────────────────────────────── */}
      <div className="px-4 pt-4 pb-3 flex items-start gap-3 min-h-[112px]">
        {/* Avatar + status badge */}
        <div className="relative shrink-0 group/status">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold ${
            isMe ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'
          }`}>
            {initials(dev.full_name)}
          </div>
          <span className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full ring-2 ring-white shadow-sm ${USER_STATUS_CONFIG[(dev.user_status ?? 'active') as UserStatus].dotBg}`} />
          <div className="pointer-events-none absolute bottom-full left-0 mb-2 px-2 py-1 text-[11px] font-medium bg-slate-800 text-white rounded-lg whitespace-nowrap opacity-0 group-hover/status:opacity-100 transition-opacity z-20">
            {USER_STATUS_CONFIG[(dev.user_status ?? 'active') as UserStatus].label}
            {(() => {
              const sub = formatStatusSub((dev.user_status ?? 'active') as UserStatus, dev.status_from, dev.status_until)
              return sub ? ` · ${sub}` : ''
            })()}
          </div>
        </div>

        {/* Name + role */}
        <div className="flex-1 min-w-0 pt-0.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="font-bold text-slate-900 text-sm leading-snug">{dev.full_name}</p>
            {isMe && <span className="text-[11px] text-brand-500 font-medium shrink-0">(you)</span>}
            {showRoleBadge && (
              <span className={`text-[11px] px-1.5 py-0.5 rounded font-semibold shrink-0 ${ROLE_BADGE[dev.role]}`}>
                {ROLE_LABELS[dev.role]}
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">{primaryRole?.title ?? <>&nbsp;</>}</p>
        </div>

        {/* Workload / user status tag */}
        {isUnavailable ? (
          <span className="shrink-0 self-start px-2 py-1 rounded-full text-[10px] font-semibold border bg-slate-50 text-slate-500 border-slate-200">
            {USER_STATUS_CONFIG[(dev.user_status ?? 'active') as UserStatus].emoji}{' '}
            {USER_STATUS_CONFIG[(dev.user_status ?? 'active') as UserStatus].label}
          </span>
        ) : (
          <span className={`shrink-0 self-start px-2 py-1 rounded-full text-[10px] font-semibold border ${STATUS_CONFIG[dev.status].bg} ${STATUS_CONFIG[dev.status].text} ${STATUS_CONFIG[dev.status].border}`}>
            {STATUS_CONFIG[dev.status].emoji} {STATUS_CONFIG[dev.status].label}
          </span>
        )}
      </div>

      {/* ── Stats + bar (active devs) ─────────────────────────── */}
      {!isUnavailable ? (
        <>
          <div className="grid grid-cols-3 divide-x divide-slate-100 border-t border-slate-100">
            <div className="px-3 py-2.5 text-center">
              <p className="text-base font-bold text-slate-800 tabular-nums leading-none">{fmt(dev.todayHours)}h</p>
              <p className="text-[10px] text-slate-500 font-medium mt-1">planned</p>
            </div>
            <div className="px-3 py-2.5 text-center">
              <p className={`text-base font-bold tabular-nums leading-none ${freeToday > 2 ? 'text-brand-600' : 'text-slate-400'}`}>
                {fmt(freeToday)}h
              </p>
              <p className="text-[10px] text-slate-500 font-medium mt-1">free today</p>
            </div>
            <div className="px-3 py-2.5 text-center">
              <p className="text-base font-bold text-slate-800 tabular-nums leading-none">{dev.tasks.length}</p>
              <p className="text-[10px] text-slate-500 font-medium mt-1">tasks</p>
            </div>
          </div>
          <div className="px-4 pb-3">
            <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${BAR_BG[dev.status] ?? 'bg-slate-300'}`}
                style={{ width: `${fillPct}%` }}
              />
            </div>
          </div>
        </>
      ) : (
        <div className="px-4 py-3 border-t border-slate-100">
          <p className="text-xs text-slate-500">
            {USER_STATUS_CONFIG[(dev.user_status ?? 'active') as UserStatus].emoji}{' '}
            {USER_STATUS_CONFIG[(dev.user_status ?? 'active') as UserStatus].label}
            {(() => {
              const sub = formatStatusSub(dev.user_status as UserStatus, dev.status_from, dev.status_until)
              return sub ? ` · ${sub}` : ''
            })()}
          </p>
        </div>
      )}

      {/* ── Task list ─────────────────────────────────────────── */}
      <div className="px-4 py-3 border-t border-slate-100 flex-1 space-y-1.5">
        {dev.tasks.length > 0 ? (
          <>
            {(expanded ? dev.tasks : dev.tasks.slice(0, 3)).map(task => (
              <div key={task.id} className="relative flex items-center gap-2 group/task">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${task.completed ? 'bg-green-400' : 'bg-slate-300'}`} />
                <span className={`flex-1 truncate text-xs ${task.completed ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                  {task.title}
                </span>
                {task.project?.name && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand-50 text-brand-600 font-medium shrink-0 max-w-[72px] truncate">
                    {task.project.name}
                  </span>
                )}
                <span className="text-[11px] text-slate-500 shrink-0 tabular-nums">{fmt(task.estimated_hours)}h</span>
                <div className="pointer-events-none absolute bottom-full left-0 mb-1.5 px-2.5 py-1.5 text-xs bg-slate-800 text-white rounded-lg whitespace-normal max-w-[220px] opacity-0 group-hover/task:opacity-100 transition-opacity z-30 shadow-lg leading-snug">
                  {task.title}
                </div>
              </div>
            ))}
            {dev.tasks.length > 3 && (
              <button onClick={() => setExpanded(e => !e)}
                className="text-[11px] text-brand-500 hover:text-brand-700 pl-3.5 transition-colors">
                {expanded ? 'Show less' : `+${dev.tasks.length - 3} more`}
              </button>
            )}
          </>
        ) : (
          <p className="text-xs text-slate-400 italic">No tasks today</p>
        )}
      </div>

      {/* ── Me link ───────────────────────────────────────────── */}
      {isMe && (
        <div className="px-4 pb-4 border-t border-slate-100 pt-3">
          <Link href="/my-tasks"
            className="block text-center text-xs font-semibold text-green-700 bg-green-50 hover:bg-green-100 rounded-xl py-2 transition-colors">
            Manage my tasks →
          </Link>
        </div>
      )}
    </div>
  )
}
