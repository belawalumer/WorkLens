'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  value: string
  onChange: (date: string) => void
  min?: string
  className?: string
  placeholder?: string
  /** Render as a compact chip (for inline task date edits) */
  compact?: boolean
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAYS   = ['Su','Mo','Tu','We','Th','Fr','Sa']
const TODAY  = new Date().toISOString().split('T')[0]

function toISO(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function fmtDisplay(iso: string, placeholder = 'Select date') {
  if (!iso) return placeholder
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function DatePicker({ value, onChange, min, className, placeholder, compact }: Props) {
  const [open, setOpen]         = useState(false)
  const [viewYear, setViewYear] = useState(() => value ? parseInt(value.slice(0,4)) : new Date().getFullYear())
  const [viewMonth, setViewMonth] = useState(() => value ? parseInt(value.slice(5,7)) - 1 : new Date().getMonth())
  const [pos, setPos]           = useState({ top: 0, left: 0 })
  const triggerRef              = useRef<HTMLButtonElement>(null)
  const calRef                  = useRef<HTMLDivElement>(null)
  const [mounted, setMounted]   = useState(false)

  useEffect(() => { setMounted(true) }, [])

  const openCalendar = useCallback(() => {
    if (value) {
      setViewYear(parseInt(value.slice(0,4)))
      setViewMonth(parseInt(value.slice(5,7)) - 1)
    }
    if (triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect()
      const calH = 280
      const spaceBelow = window.innerHeight - r.bottom
      const top = spaceBelow >= calH ? r.bottom + 4 : r.top - calH - 4
      setPos({ top, left: r.left })
    }
    setOpen(true)
  }, [value])

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (
        triggerRef.current?.contains(e.target as Node) ||
        calRef.current?.contains(e.target as Node)
      ) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  function selectDay(day: number) {
    const iso = toISO(viewYear, viewMonth, day)
    if (min && iso < min) return
    onChange(iso)
    setOpen(false)
  }

  const firstDow    = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()

  const triggerCls = compact
    ? `text-[11px] font-medium px-2 py-0.5 rounded-lg border border-brand-400 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-400 ${className ?? ''}`
    : `w-full flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 text-sm hover:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400 transition-colors ${className ?? ''}`

  const calendar = open && mounted && createPortal(
    <div
      ref={calRef}
      style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999 }}
      className="bg-white border border-slate-200 rounded-2xl shadow-2xl p-3 w-64 animate-fade-in"
    >
      {/* Month nav */}
      <div className="flex items-center justify-between mb-3">
        <button type="button" onClick={prevMonth}
          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors text-slate-500">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <span className="text-sm font-semibold text-slate-800">{MONTHS[viewMonth]} {viewYear}</span>
        <button type="button" onClick={nextMonth}
          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors text-slate-500">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAYS.map(d => (
          <div key={d} className="text-center text-[10px] font-semibold text-slate-400 py-1">{d}</div>
        ))}
      </div>

      {/* Date grid */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {Array.from({ length: firstDow }).map((_, i) => <div key={`e${i}`} />)}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1
          const iso = toISO(viewYear, viewMonth, day)
          const isSelected = iso === value
          const isToday    = iso === TODAY
          const isDisabled = !!min && iso < min

          return (
            <button key={day} type="button" disabled={isDisabled} onClick={() => selectDay(day)}
              className={`h-8 w-8 mx-auto flex items-center justify-center rounded-full text-xs font-medium transition-colors
                ${isSelected  ? 'bg-brand-600 text-white font-semibold shadow-sm'
                : isToday     ? 'ring-2 ring-brand-400 text-brand-700 font-semibold'
                : isDisabled  ? 'text-slate-300 cursor-not-allowed'
                : 'text-slate-700 hover:bg-brand-50 hover:text-brand-700'}`}>
              {day}
            </button>
          )
        })}
      </div>

      {/* Today shortcut */}
      <div className="mt-2 pt-2 border-t border-slate-100">
        <button type="button" onClick={() => { if (!min || TODAY >= min) { onChange(TODAY); setOpen(false) } }}
          disabled={!!(min && TODAY < min)}
          className="w-full text-center text-xs font-semibold text-brand-600 hover:text-brand-800 disabled:text-slate-300 disabled:cursor-not-allowed transition-colors py-0.5">
          Today
        </button>
      </div>
    </div>,
    document.body,
  )

  return (
    <div className={`relative ${compact ? '' : 'w-full'}`}>
      <button ref={triggerRef} type="button" onClick={openCalendar} className={triggerCls}>
        {!compact && (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-brand-500 shrink-0">
            <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
        )}
        <span className={value ? (compact ? 'text-slate-700' : 'text-slate-800') : 'text-slate-400'}>
          {compact ? (value ? new Date(value + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : (placeholder ?? '—')) : fmtDisplay(value, placeholder)}
        </span>
      </button>
      {calendar}
    </div>
  )
}
