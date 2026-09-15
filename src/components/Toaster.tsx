'use client'

import { useEffect, useRef, useState } from 'react'
import { TOAST_EVENT, ToastType } from '@/lib/toast'

interface ToastItem { id: number; message: string; type: ToastType }

const TYPE_STYLE: Record<ToastType, string> = {
  success: 'bg-white border border-slate-200 text-slate-900 border-l-4 border-l-brand-600',
  error:   'bg-white border border-slate-200 text-slate-900 border-l-4 border-l-slate-900',
  info:    'bg-white border border-slate-200 text-slate-900 border-l-4 border-l-brand-400',
}

export default function Toaster() {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const idRef = useRef(0)

  useEffect(() => {
    function add(message: string, type: ToastType) {
      const id = ++idRef.current
      setToasts(prev => [...prev, { id, message, type }])
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500)
    }

    function handler(e: Event) {
      const { message, type } = (e as CustomEvent<{ message: string; type: ToastType }>).detail
      add(message, type)
    }
    window.addEventListener(TOAST_EVENT, handler)
    return () => window.removeEventListener(TOAST_EVENT, handler)
  }, [])

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id}
          className={`text-sm px-4 py-2.5 rounded-xl shadow-md animate-fade-in ${TYPE_STYLE[t.type]}`}>
          {t.message}
        </div>
      ))}
    </div>
  )
}
