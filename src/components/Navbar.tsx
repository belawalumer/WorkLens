'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useRef, useState, useEffect } from 'react'
import { mutate } from 'swr'
import { createClient } from '@/lib/supabase/client'
import { Role, ROLE_LABELS, UserStatus, USER_STATUS_CONFIG, formatStatusSub } from '@/types'
import { toast } from '@/lib/toast'

const initials = (name: string) => {
  const p = name.trim().split(/\s+/)
  return p.length === 1 ? p[0][0].toUpperCase() : (p[0][0] + p[p.length - 1][0]).toUpperCase()
}
import NotificationBell from './NotificationBell'

interface Props {
  userName: string
  userRole: Role
  userId: string
  userStatus: UserStatus
  statusFrom: string | null
  statusUntil: string | null
}

const TODAY = new Date().toISOString().split('T')[0]

export default function Navbar({ userName, userRole, userId, userStatus, statusFrom, statusUntil }: Props) {
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
  const dropdownRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

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
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
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
          <NotificationBell userRole={userRole} userId={userId} />

          {/* User dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(o => !o)}
              className="flex items-center gap-2 pl-2 ml-1 border-l border-slate-200 hover:bg-slate-50 rounded-lg px-2 py-1.5 transition-colors"
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
                      <input type="date" value={pendingFrom} onChange={e => setPendingFrom(e.target.value)}
                        className="mt-1 w-full px-2 py-1.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-400" />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 font-medium">
                        End date{pendingStatus === 'on_leave' ? ' (optional)' : ''}
                      </label>
                      <input type="date" value={pendingUntil} onChange={e => setPendingUntil(e.target.value)}
                        min={pendingFrom}
                        className="mt-1 w-full px-2 py-1.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-400" />
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
          <div className="pt-2 border-t border-slate-100 mt-2">
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
