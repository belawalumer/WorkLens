'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useRef, useState, useEffect } from 'react'
import { mutate } from 'swr'
import { createClient } from '@/lib/supabase/client'
import { Role, ROLE_LABELS, UserStatus, USER_STATUS_CONFIG, formatStatusSub, UNAVAILABLE_STATUSES, isAssisting, formatAssistRemaining, WorkloadStatus } from '@/types'
import { toast } from '@/lib/toast'
import { getPKTDate } from '@/lib/date'

const initials = (name: string) => {
  const p = name.trim().split(/\s+/)
  return p.length === 1 ? p[0][0].toUpperCase() : (p[0][0] + p[p.length - 1][0]).toUpperCase()
}
import NotificationBell from './NotificationBell'
import DatePicker from './DatePicker'

interface Props {
  userName: string
  userRole: Role
  userId: string
  userStatus: UserStatus
  statusFrom: string | null
  statusUntil: string | null
  assistUntil: string | null
  workloadStatus: WorkloadStatus
}

const TODAY = getPKTDate()

export default function Navbar({ userName, userRole, userId, userStatus, statusFrom, statusUntil, assistUntil, workloadStatus }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [status, setStatus] = useState<UserStatus>(userStatus)
  const [from, setFrom] = useState(statusFrom ?? '')
  const [until, setUntil] = useState(statusUntil ?? '')
  const [pendingStatus, setPendingStatus] = useState<UserStatus | null>(null)
  const [pendingFrom, setPendingFrom] = useState(TODAY)
  const [pendingUntil, setPendingUntil] = useState(TODAY)
  const [localAssistUntil, setLocalAssistUntil] = useState<string | null>(assistUntil)
  const [now, setNow] = useState(() => Date.now())
  const [assistOpen, setAssistOpen] = useState(false)
  const [assistMode, setAssistMode] = useState<'menu' | 'picker'>('menu')
  const [assistSaving, setAssistSaving] = useState(false)
  const [assistHours, setAssistHours] = useState(1)
  const [assistMinutes, setAssistMinutes] = useState(1)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const assistRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  const assisting = isAssisting(localAssistUntil, now)
  const canStartAssist = !assisting && !UNAVAILABLE_STATUSES.includes(status) && (workloadStatus === 'available' || workloadStatus === 'underloaded')

  useEffect(() => {
    if (!localAssistUntil) return
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [localAssistUntil])

  // Clear expired on_leave/vacation at 12:01 AM without page reload.
  // Reschedules every night so multi-day leave clears on the correct morning.
  useEffect(() => {
    if (status !== 'on_leave' && status !== 'vacation') return
    let id: ReturnType<typeof setTimeout>
    function schedule() {
      const now = new Date()
      const next = new Date(now)
      next.setDate(now.getDate() + 1)
      next.setHours(0, 1, 0, 0)
      id = setTimeout(() => {
        const today = getPKTDate()
        if (until && until < today) {
          setStatus('active')
          setFrom('')
          setUntil('')
        } else {
          schedule() // still on leave, check again tomorrow
        }
      }, next.getTime() - now.getTime())
    }
    schedule()
    return () => clearTimeout(id)
  }, [status, until])

  async function startAssist(minutes: number) {
    if (!minutes) return
    setAssistOpen(false)
    setAssistMode('menu')
    setAssistSaving(true)
    const until = new Date(Date.now() + minutes * 60 * 1000).toISOString()
    const { error } = await supabase.from('profiles').update({ assist_until: until }).eq('id', userId)
    setAssistSaving(false)
    if (error) { toast.error(error.message); return }
    setLocalAssistUntil(until)
    mutate('profiles')
    const h = Math.floor(minutes / 60), m = minutes % 60
    toast.success(`You're available for ${h > 0 ? `${h}h` : ''}${m > 0 ? ` ${m}m` : ''}`.trim())
  }

  async function endAssist() {
    setAssistSaving(true)
    const { error } = await supabase.from('profiles').update({ assist_until: null }).eq('id', userId)
    setAssistSaving(false)
    if (error) { toast.error(error.message); return }
    setLocalAssistUntil(null)
    mutate('profiles')
    toast.success('Availability ended')
  }

  function signOut() {
    setSigningOut(true)
    toast('Signed out successfully')
    supabase.auth.signOut().then(() => router.refresh())
    router.push('/login')
  }

  async function applyStatus(s: UserStatus, f: string | null, u: string | null) {
    // Remove auto-created leave records from today onwards when leaving "on_leave"
    // Past days in the range are kept — they were actual leave days
    if (status === 'on_leave' && s !== 'on_leave' && from) {
      await supabase.from('leave_records')
        .delete()
        .eq('developer_id', userId)
        .eq('created_by', userId)
        .gte('leave_date', TODAY)
        .lte('leave_date', until || from)
    }

    setStatus(s)
    setFrom(f ?? '')
    setUntil(u ?? '')
    setPendingStatus(null)
    await supabase.from('profiles').update({ user_status: s, status_from: f, status_until: u }).eq('id', userId)

    // Auto-create leave records for every weekday in the on_leave range
    if (s === 'on_leave' && f) {
      const records: { developer_id: string; leave_date: string; leave_type: string; created_by: string }[] = []
      const cur = new Date(f + 'T12:00:00')
      const end = new Date((u || f) + 'T12:00:00')
      while (cur <= end) {
        const dow = cur.getDay()
        if (dow !== 0 && dow !== 6) {
          records.push({ developer_id: userId, leave_date: cur.toISOString().split('T')[0], leave_type: 'full', created_by: userId })
        }
        cur.setDate(cur.getDate() + 1)
      }
      if (records.length) {
        const { error } = await supabase.from('leave_records').upsert(records, { onConflict: 'developer_id,leave_date', ignoreDuplicates: true })
        if (error) toast.error(`Leave records: ${error.message}`)
      }
    }

    mutate('profiles')
    mutate('leave-records')
    toast.success(`Status set to ${USER_STATUS_CONFIG[s].label}`)
  }

  function handleStatusClick(s: UserStatus) {
    if (s === 'vacation' || s === 'on_leave') {
      setPendingStatus(s)
      setPendingFrom(TODAY)
      setPendingUntil(TODAY)
    } else if (s === 'in_meeting') {
      applyStatus(s, TODAY, null)
    } else {
      applyStatus(s, null, null)
    }
  }

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setDropdownOpen(false)
      if (assistRef.current && !assistRef.current.contains(e.target as Node)) { setAssistOpen(false); setAssistMode('menu') }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const navLink = (href: string, label: string) => {
    const active = pathname === href
    return (
      <Link
        href={href}
        prefetch
        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
          active
            ? 'bg-brand-50 text-brand-700'
            : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
        }`}
      >
        {label}
      </Link>
    )
  }

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        {/* Logo + nav */}
        <div className="flex items-center gap-6 shrink-0">
          <Link href="/" prefetch className="flex items-center">
            <span className="text-brand-600 font-black text-lg tracking-tight">Work</span>
            <span className="text-slate-900 font-black text-lg tracking-tight">Lens</span>
          </Link>

          <nav className="hidden sm:flex items-center gap-1">
            {navLink('/', 'Dashboard')}
            {navLink('/my-tasks', 'My Tasks')}
            {navLink('/team', 'Team')}
            {navLink('/projects', 'Projects')}
            {navLink('/reports', 'Reports')}
            {(userRole === 'super_admin' || userRole === 'hr_admin') && navLink('/settings', 'Settings')}
          </nav>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2">
          {/* Assist availability — desktop */}
          {(assisting || canStartAssist) && (
            <div className="relative hidden sm:block" ref={assistRef}>
              {assisting ? (
                <button
                  type="button"
                  onClick={() => setAssistOpen(o => !o)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-brand-50 text-brand-700 border border-brand-200 hover:bg-brand-100 transition-colors"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse" />
                  {formatAssistRemaining(localAssistUntil!)}
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setAssistOpen(o => !o)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-brand-700 bg-brand-50 border border-brand-200 hover:bg-brand-100 transition-colors"
                >
                  I&apos;m open to help
                </button>
              )}

              {assistOpen && (
                assisting && assistMode === 'menu' ? (
                  <div className="absolute right-0 top-10 w-52 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden">
                    <button type="button" onClick={() => setAssistMode('picker')}
                      className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 transition-colors text-left">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                      Update availability time
                    </button>
                    <div className="border-t border-slate-100" />
                    <button type="button" disabled={assistSaving} onClick={() => { endAssist(); setAssistOpen(false) }}
                      className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors text-left disabled:opacity-50">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                      End availability
                    </button>
                  </div>
                ) : (
                  <div className="absolute right-0 top-10 w-52 bg-white border border-slate-200 rounded-xl shadow-lg z-50 p-3 space-y-2.5">
                    <p className="text-[11px] font-semibold text-slate-500 text-center">Available for how long?</p>
                    <div className="flex items-center gap-1.5">
                      <select value={assistHours} onChange={e => setAssistHours(Number(e.target.value))}
                        className="flex-1 border border-slate-200 rounded-xl px-2 py-2 text-sm text-center text-slate-800 bg-slate-50 hover:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400 transition-colors">
                        {Array.from({ length: 8 }, (_, i) => (
                          <option key={i + 1} value={i + 1}>{String(i + 1).padStart(2, '0')}</option>
                        ))}
                      </select>
                      <span className="text-slate-400 font-bold">:</span>
                      <select value={assistMinutes} onChange={e => setAssistMinutes(Number(e.target.value))}
                        className="flex-1 border border-slate-200 rounded-xl px-2 py-2 text-sm text-center text-slate-800 bg-slate-50 hover:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400 transition-colors">
                        {Array.from({ length: 60 }, (_, i) => (
                          <option key={i + 1} value={i + 1}>{String(i + 1).padStart(2, '0')}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <button type="button" disabled={assistSaving} onClick={() => startAssist(assistHours * 60 + assistMinutes)}
                        className="flex-1 text-xs font-semibold py-2 rounded-xl bg-brand-600 text-white hover:bg-brand-700 transition-colors disabled:opacity-50">
                        {assistSaving ? '…' : assisting ? 'Update' : 'Set'}
                      </button>
                      {assisting ? (
                        <button type="button" onClick={() => setAssistMode('menu')}
                          className="px-3 text-[11px] text-slate-500 hover:text-slate-700">
                          Back
                        </button>
                      ) : (
                        <button type="button" onClick={() => setAssistOpen(false)}
                          className="px-3 text-[11px] text-slate-500 hover:text-slate-700">
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                )
              )}
            </div>
          )}

          {userRole !== 'hr_admin' && <NotificationBell userRole={userRole} userId={userId} />}

          {/* User dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(o => !o)}
              className="flex items-center gap-2 pl-2 ml-1 px-2 py-1.5 transition-colors"
            >
              <div className="relative w-7 h-7 shrink-0">
                <div className="w-7 h-7 rounded-full bg-brand-100 flex items-center justify-center">
                  <span className="text-brand-700 text-xs font-bold">{initials(userName)}</span>
                </div>
                <span className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full ring-2 ring-white shadow-sm ${USER_STATUS_CONFIG[status].dotBg}`} title={USER_STATUS_CONFIG[status].label} />
              </div>
              <div className="hidden md:block text-left">
                <p className="text-sm font-medium text-slate-800 leading-none">{userName}</p>
                <p className="text-xs text-slate-500 mt-0.5">{ROLE_LABELS[userRole]}</p>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400 hidden md:block">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 top-12 w-60 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden">
                {/* Status picker */}
                <div className="px-2 pt-2 pb-1.5">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide px-2 mb-1">Set Status</p>
                  {(Object.keys(USER_STATUS_CONFIG) as UserStatus[]).map(s => {
                    const isCurrent = status === s && !pendingStatus
                    const isPending = pendingStatus === s
                    return (
                      <button key={s} onClick={() => handleStatusClick(s)}
                        className={`w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-lg transition-colors text-left ${
                          isCurrent || isPending ? 'bg-slate-100 text-slate-900 font-medium' : 'text-slate-600 hover:bg-slate-50'
                        }`}>
                        <span className="text-base leading-none">{USER_STATUS_CONFIG[s].emoji}</span>
                        <div className="flex-1 min-w-0">
                          <span className="block">{USER_STATUS_CONFIG[s].label}</span>
                          {isCurrent && !pendingStatus && (() => {
                            const sub = formatStatusSub(s, from, until)
                            return sub ? <span className="text-[10px] text-slate-400 font-normal">{sub}</span> : null
                          })()}
                        </div>
                        {isCurrent && !pendingStatus && <span className="text-brand-500 text-xs shrink-0">✓</span>}
                      </button>
                    )
                  })}
                </div>

                {/* Date picker for vacation / on_leave */}
                {pendingStatus && (
                  <div className="border-t border-slate-100 bg-slate-50 px-3 py-3 space-y-2.5">
                    <p className="text-xs font-semibold text-slate-700">
                      {USER_STATUS_CONFIG[pendingStatus].emoji} {USER_STATUS_CONFIG[pendingStatus].label} dates
                    </p>
                    <div>
                      <label className="text-[10px] text-slate-500 font-medium">Start date</label>
                      <div className="mt-1">
                        <DatePicker value={pendingFrom} onChange={setPendingFrom} />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 font-medium">
                        End date{pendingStatus === 'on_leave' ? ' (optional)' : ''}
                      </label>
                      <div className="mt-1">
                        <DatePicker value={pendingUntil} onChange={setPendingUntil} min={pendingFrom} />
                      </div>
                    </div>
                    <div className="flex gap-2 pt-0.5">
                      <button
                        onClick={() => applyStatus(pendingStatus, pendingFrom, pendingUntil || null)}
                        disabled={pendingStatus === 'vacation' && (!pendingFrom || !pendingUntil)}
                        className="flex-1 py-1.5 bg-brand-600 text-white text-xs font-semibold rounded-lg hover:bg-brand-700 disabled:opacity-40 transition-colors">
                        Confirm
                      </button>
                      <button onClick={() => setPendingStatus(null)}
                        className="px-3 py-1.5 border border-slate-200 text-xs rounded-lg hover:bg-white text-slate-600 transition-colors">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                <div className="border-t border-slate-100" />
                <div className="py-1">
                  <Link
                    href="/profile"
                    prefetch
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                    </svg>
                    My Profile
                  </Link>
                  <button
                    onClick={signOut}
                    disabled={signingOut}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
                    </svg>
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Hamburger — mobile only */}
          <button
            onClick={() => setMobileMenuOpen(o => !o)}
            className="sm:hidden flex items-center justify-center w-9 h-9 rounded-xl hover:bg-slate-100 transition-colors"
            aria-label="Menu"
          >
            {mobileMenuOpen ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile nav drawer */}
      {mobileMenuOpen && (
        <div className="sm:hidden border-t border-slate-100 bg-white px-4 py-3 space-y-1">
          {([
            ['/', 'Dashboard'],
            ['/my-tasks', 'My Tasks'],
            ['/team', 'Team'],
            ['/projects', 'Projects'],
            ['/reports', 'Reports'],
            ...(userRole === 'super_admin' || userRole === 'hr_admin' ? [['/settings', 'Settings']] : []),
          ] as [string, string][]).map(([href, label]) => {
            const active = pathname === href
            return (
              <Link key={href} href={href} prefetch onClick={() => setMobileMenuOpen(false)}
                className={`block px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${active ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50'}`}>
                {label}
              </Link>
            )
          })}
          <div className="pt-2 border-t border-slate-100 mt-2 space-y-1">
            {assisting ? (
              <div className="space-y-1">
                <button type="button" onClick={() => setAssistOpen(o => !o)}
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium text-brand-700 bg-brand-50 hover:bg-brand-100 transition-colors">
                  <span className="w-2 h-2 rounded-full bg-brand-500 animate-pulse" />
                  <span className="flex-1 text-left">{formatAssistRemaining(localAssistUntil!)} · Available</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                </button>
                {assistOpen && (
                  assistMode === 'menu' ? (
                    <div className="ml-1 rounded-xl border border-slate-200 overflow-hidden">
                      <button type="button" onClick={() => setAssistMode('picker')}
                        className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 transition-colors text-left">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        Update availability time
                      </button>
                      <div className="border-t border-slate-100" />
                      <button type="button" disabled={assistSaving} onClick={() => { endAssist(); setAssistOpen(false); setMobileMenuOpen(false) }}
                        className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors text-left disabled:opacity-50">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                        End availability
                      </button>
                    </div>
                  ) : (
                    <div className="px-1 space-y-2.5 pt-1">
                      <p className="text-[11px] font-semibold text-slate-500 text-center">Available for how long?</p>
                      <div className="flex items-center gap-1.5">
                        <select value={assistHours} onChange={e => setAssistHours(Number(e.target.value))}
                          className="flex-1 border border-slate-200 rounded-xl px-2 py-2.5 text-sm text-center text-slate-800 bg-slate-50 hover:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400 transition-colors">
                          {Array.from({ length: 8 }, (_, i) => (
                            <option key={i + 1} value={i + 1}>{String(i + 1).padStart(2, '0')}</option>
                          ))}
                        </select>
                        <span className="text-slate-400 font-bold">:</span>
                        <select value={assistMinutes} onChange={e => setAssistMinutes(Number(e.target.value))}
                          className="flex-1 border border-slate-200 rounded-xl px-2 py-2.5 text-sm text-center text-slate-800 bg-slate-50 hover:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400 transition-colors">
                          {Array.from({ length: 60 }, (_, i) => (
                            <option key={i + 1} value={i + 1}>{String(i + 1).padStart(2, '0')}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex gap-2">
                        <button type="button" disabled={assistSaving} onClick={() => { startAssist(assistHours * 60 + assistMinutes); setMobileMenuOpen(false) }}
                          className="flex-1 text-xs font-semibold py-2.5 rounded-xl bg-brand-600 text-white hover:bg-brand-700 transition-colors disabled:opacity-50">
                          {assistSaving ? '…' : 'Update'}
                        </button>
                        <button type="button" onClick={() => setAssistMode('menu')}
                          className="px-3 text-[11px] text-slate-500 hover:text-slate-700">
                          Back
                        </button>
                      </div>
                    </div>
                  )
                )}
              </div>
            ) : canStartAssist && (
              assistOpen ? (
                <div className="px-1 space-y-2.5">
                  <p className="text-[11px] font-semibold text-slate-500 text-center">Available for how long?</p>
                  <div className="flex items-center gap-1.5">
                    <select value={assistHours} onChange={e => setAssistHours(Number(e.target.value))}
                      className="flex-1 border border-slate-200 rounded-xl px-2 py-2.5 text-sm text-center text-slate-800 bg-slate-50 hover:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400 transition-colors">
                      {Array.from({ length: 8 }, (_, i) => (
                        <option key={i + 1} value={i + 1}>{String(i + 1).padStart(2, '0')}</option>
                      ))}
                    </select>
                    <span className="text-slate-400 font-bold">:</span>
                    <select value={assistMinutes} onChange={e => setAssistMinutes(Number(e.target.value))}
                      className="flex-1 border border-slate-200 rounded-xl px-2 py-2.5 text-sm text-center text-slate-800 bg-slate-50 hover:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400 transition-colors">
                      {Array.from({ length: 60 }, (_, i) => (
                        <option key={i + 1} value={i + 1}>{String(i + 1).padStart(2, '0')}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" disabled={assistSaving} onClick={() => { startAssist(assistHours * 60 + assistMinutes); setMobileMenuOpen(false) }}
                      className="flex-1 text-xs font-semibold py-2.5 rounded-xl bg-brand-600 text-white hover:bg-brand-700 transition-colors disabled:opacity-50">
                      {assistSaving ? '…' : 'Set'}
                    </button>
                    <button type="button" onClick={() => setAssistOpen(false)}
                      className="px-3 text-[11px] text-slate-500 hover:text-slate-700">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" onClick={() => setAssistOpen(true)}
                  className="w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium text-brand-700 bg-brand-50 hover:bg-brand-100 transition-colors">
                  I&apos;m open to help
                </button>
              )
            )}
            <button onClick={signOut} disabled={signingOut}
              className="w-full text-left px-3 py-2.5 rounded-xl text-sm text-red-600 hover:bg-red-50 transition-colors font-medium disabled:opacity-50">
              {signingOut ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        </div>
      )}
    </header>
  )
}
