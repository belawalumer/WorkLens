'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
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

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

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
        {/* Logo */}
        <div className="flex items-center gap-6 shrink-0">
          <Link href="/" prefetch className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center">
              <span className="text-white text-xs font-bold">W</span>
            </div>
            <span className="font-bold text-slate-900 text-base hidden sm:block">WorkLens</span>
          </Link>

          <nav className="hidden sm:flex items-center gap-1">
            {navLink('/', 'Dashboard')}
            {navLink('/my-tasks', 'My Tasks')}
            {navLink('/team', 'Team')}
            {navLink('/profile', 'Profile')}
          </nav>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2">
          <NotificationBell userRole={userRole} />

          <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-slate-200 ml-1">
            <div className="w-7 h-7 rounded-full bg-brand-100 flex items-center justify-center shrink-0">
              <span className="text-brand-700 text-xs font-bold">{userName.charAt(0).toUpperCase()}</span>
            </div>
            <div className="hidden md:block">
              <p className="text-sm font-medium text-slate-800 leading-none">{userName}</p>
              <p className="text-xs text-slate-400 mt-0.5">{ROLE_LABELS[userRole]}</p>
            </div>
          </div>

          <button
            onClick={signOut}
            className="text-xs text-slate-500 hover:text-slate-900 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors font-medium"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  )
}
