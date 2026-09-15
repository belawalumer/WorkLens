'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  // const [fullName, setFullName] = useState('')
  // const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [redirecting, setRedirecting] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const supabase = createClient()
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      setRedirecting(true)
      router.push('/')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setLoading(false)
    }
  }

  if (redirecting) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-brand-50 via-white to-slate-100 gap-4">
        <div className="w-10 h-10 rounded-full border-2 border-brand-200 border-t-brand-600 animate-spin" />
        <p className="text-sm text-slate-500 font-medium">Signing you in…</p>
      </div>
    )
  }

  const inputCls = 'w-full px-3 py-2.5 border border-slate-300 rounded-xl text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-400 transition-colors'

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 via-white to-slate-100 px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="mb-4">
            <span className="text-brand-600 font-black text-4xl tracking-tight">Work</span>
            <span className="text-slate-900 font-black text-4xl tracking-tight">Lens</span>
          </div>
          <h1 className="sr-only">WorkLens</h1>
          <p className="text-slate-500 mt-1 text-sm">Developer workload dashboard</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-7">
          <h2 className="text-base font-semibold text-slate-800 mb-5">
            {/* {mode === 'login' ? 'Sign in to your account' : 'Create your account'} */}
            Sign in to your account
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* {mode === 'signup' && (
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Full name</label>
                <input type="text" value={fullName} onChange={e => setFullName(e.target.value)}
                  required placeholder="Jane Smith" className={inputCls} />
              </div>
            )} */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                required placeholder="you@company.com" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                required placeholder="••••••••" className={inputCls} />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">{error}</p>
            )}

            <button type="submit" disabled={loading}
              className="w-full py-2.5 px-4 bg-brand-600 text-white rounded-xl text-sm font-semibold hover:bg-brand-700 disabled:opacity-50 transition-colors shadow-sm shadow-brand-200">
              {/* {loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'} */}
              {loading ? 'Please wait…' : 'Sign in'}
            </button>
          </form>

          {/* <p className="text-center text-sm text-slate-500 mt-5">
            {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <button onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError('') }}
              className="text-brand-600 font-semibold hover:text-brand-800">
              {mode === 'login' ? 'Sign up' : 'Sign in'}
            </button>
          </p> */}
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">Kodesinc · WorkLens</p>
      </div>
    </div>
  )
}
