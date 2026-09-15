'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Role, ROLE_LABELS } from '@/types'

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

  const navLink = (href: string, label: string) => (
    <Link
      href={href}
      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${pathname === href ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-900'}`}
    >
      {label}
    </Link>
  )

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="font-bold text-slate-900 text-lg">WorkLens</Link>
          <nav className="hidden sm:flex items-center gap-1">
            {navLink('/', 'Dashboard')}
            {navLink('/my-tasks', 'My Tasks')}
            {navLink('/team', 'Team')}
            {navLink('/profile', 'Profile')}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2">
            <span className="text-sm text-slate-600">{userName}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium">
              {ROLE_LABELS[userRole]}
            </span>
          </div>
          <button
            onClick={signOut}
            className="text-sm text-slate-500 hover:text-slate-900 transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  )
}
