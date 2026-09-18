'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Role } from '@/types'
import { getPKTDate } from '@/lib/date'

interface InactivePerson {
  id: string
  name: string
  whatsapp: string | null
}

function isPKTCheckTime() {
  const h = parseInt(new Date().toLocaleString('en-US', {
    timeZone: 'Asia/Karachi', hour: 'numeric', hour12: false,
  })) % 24
  return h >= 12
}

function initials(name: string) {
  const p = name.trim().split(/\s+/)
  return p.length === 1 ? p[0][0].toUpperCase() : (p[0][0] + p[p.length - 1][0]).toUpperCase()
}

export default function InactiveSidebar({ userRole, userId }: { userRole: Role; userId: string }) {
  const [open, setOpen] = useState(false)
  const [inactive, setInactive] = useState<InactivePerson[]>([])
  const supabase = createClient()

  useEffect(() => {
    const TODAY = getPKTDate()

    async function check() {
      if (!isPKTCheckTime()) { setInactive([]); return }

      if (userRole === 'developer') {
        const { data: myTasks } = await supabase.from('tasks').select('id').eq('developer_id', userId).eq('task_date', TODAY)
        if ((myTasks?.length ?? 0) === 0) {
          const { data: me } = await supabase.from('profiles').select('full_name, whatsapp').eq('id', userId).single()
          const p = me as { full_name: string; whatsapp: string | null } | null
          setInactive([{ id: userId, name: p?.full_name ?? 'You', whatsapp: p?.whatsapp ?? null }])
        } else {
          setInactive([])
        }
      } else {
        const [{ data: profs }, { data: todayTasks }] = await Promise.all([
          supabase.from('profiles').select('id, full_name, whatsapp').neq('role', 'super_admin'),
          supabase.from('tasks').select('developer_id').eq('task_date', TODAY),
        ])
        const activeIds = new Set((todayTasks ?? []).map((t: { developer_id: string }) => t.developer_id))
        setInactive(
          (profs ?? [])
            .filter((p: { id: string }) => !activeIds.has(p.id))
            .map((p: { id: string; full_name: string; whatsapp: string | null }) => ({ id: p.id, name: p.full_name, whatsapp: p.whatsapp }))
        )
      }
    }

    check()
    const iv = setInterval(check, 5 * 60 * 1000)
    return () => clearInterval(iv)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function buildWhatsAppUrl(person: InactivePerson) {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const message = encodeURIComponent(
      `Hi ${person.name.split(' ')[0]}! 👋 Hope you're having a great day. Just a friendly reminder to log your tasks for today on WorkLens. Here's the link: ${origin}/my-tasks — Don't forget, your updates help the whole team stay in sync! 😊`
    )
    const phone = (person.whatsapp ?? '').replace(/\D/g, '')
    return `https://wa.me/${phone}?text=${message}`
  }

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="relative w-9 h-9 flex items-center justify-center rounded-xl hover:bg-brand-50 transition-colors"
        aria-label="Team activity"
        title="Members without today's tasks"
      >
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
        {inactive.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-amber-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 leading-none">
            {inactive.length > 9 ? '9+' : inactive.length}
          </span>
        )}
      </button>

      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/25 z-40 transition-opacity duration-300 ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setOpen(false)}
      />

      {/* Sidebar panel */}
      <div className={`fixed top-0 right-0 h-full w-80 bg-white shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-out ${open ? 'translate-x-0' : 'translate-x-full'}`}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <div>
            <h2 className="text-sm font-bold text-slate-800">Missing Tasks Today</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {inactive.length === 0 ? 'All team members are up to date' : `${inactive.length} member${inactive.length !== 1 ? 's' : ''} haven't logged tasks`}
            </p>
          </div>
          <button onClick={() => setOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* Body */}
        {inactive.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-green-50 flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            </div>
            <p className="text-sm font-semibold text-slate-700">Everyone's logged in!</p>
            <p className="text-xs text-slate-500">All team members have added their tasks for today.</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {inactive.map(person => (
              <div key={person.id} className="bg-slate-50 rounded-2xl p-4 space-y-3 border border-slate-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                    <span className="text-amber-700 font-bold text-sm">{initials(person.name)}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{person.name}</p>
                    <p className="text-xs text-slate-500">Hasn't added today's tasks</p>
                  </div>
                </div>
                {person.whatsapp ? (
                  <a
                    href={buildWhatsAppUrl(person)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-2.5 bg-[#25D366] text-white text-xs font-semibold rounded-xl hover:bg-[#20ba58] transition-colors"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                    Send Reminder to {person.name.split(' ')[0]}
                  </a>
                ) : (
                  <div className="w-full py-2.5 text-center text-xs text-slate-400 bg-white border border-slate-200 rounded-xl">
                    No WhatsApp number on file
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
