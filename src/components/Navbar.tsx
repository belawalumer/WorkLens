'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function Navbar({ userName }: { userName: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="font-bold text-slate-900 text-lg">WorkLens</Link>
          <nav className="hidden sm:flex items-center gap-1">
            <Link
              href="/"
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${pathname === '/' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-900'}`}
            >
              Dashboard
            </Link>
            <Link
              href="/my-tasks"
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${pathname === '/my-tasks' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-900'}`}
            >
              My Tasks
            </Link>
            <Link
              href="/profile"
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${pathname === '/profile' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-900'}`}
            >
              Profile
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-600 hidden sm:block">{userName}</span>
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
