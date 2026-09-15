'use client'

import { useEffect, useRef, useState } from 'react'
import { TOAST_EVENT, ToastType } from '@/lib/toast'

interface ToastItem { id: number; message: string; type: ToastType }

const TYPE_STYLE: Record<ToastType, string> = {
  success: 'bg-emerald-50 border border-emerald-200 text-emerald-900',
  error:   'bg-red-50 border border-red-200 text-red-900',
  info:    'bg-brand-50 border border-brand-200 text-brand-900',
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
