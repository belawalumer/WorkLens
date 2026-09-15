'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useRef, useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Role, ROLE_LABELS } from '@/types'
import NotificationBell from './NotificationBell'

interface Props {
  userName: string
  userRole: Role
}

export default function Navbar({ userName, userRole }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
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
          </nav>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2">
          <NotificationBell userRole={userRole} />

          {/* User dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(o => !o)}
              className="hidden sm:flex items-center gap-2 pl-2 ml-1 border-l border-slate-200 hover:bg-slate-50 rounded-lg px-2 py-1.5 transition-colors"
            >
              <div className="w-7 h-7 rounded-full bg-brand-100 flex items-center justify-center shrink-0">
                <span className="text-brand-700 text-xs font-bold">{userName.charAt(0).toUpperCase()}</span>
              </div>
              <div className="hidden md:block text-left">
                <p className="text-sm font-medium text-slate-800 leading-none">{userName}</p>
                <p className="text-xs text-slate-400 mt-0.5">{ROLE_LABELS[userRole]}</p>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400 hidden md:block">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 top-12 w-48 bg-white border border-slate-200 rounded-xl shadow-lg z-50 py-1 overflow-hidden">
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
                <div className="border-t border-slate-100 my-1" />
                <button
                  onClick={signOut}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
                  </svg>
                  Sign out
                </button>
              </div>
            )}
          </div>

          {/* Mobile sign out */}
          <button
            onClick={signOut}
            className="sm:hidden text-xs text-slate-500 hover:text-slate-900 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors font-medium"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  )
}
