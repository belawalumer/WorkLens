'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Role, ROLE_LABELS, UserStatus, UNAVAILABLE_STATUSES } from '@/types'
import dynamic from 'next/dynamic'

const LiveMap = dynamic(() => import('./LiveMap'), { ssr: false, loading: () => <MapSkeleton /> })

function MapSkeleton() {
  return <div className="w-full h-full rounded-2xl bg-slate-100 animate-pulse" />
}

interface ProfilePin {
  id: string
  full_name: string
  role: Role
  user_status: UserStatus | null
  lat: number | null
  lng: number | null
  location_updated_at: string | null
}

interface Props {
  profiles: ProfilePin[]
  currentUserId: string
}

type PermissionState = 'idle' | 'requesting' | 'granted' | 'denied' | 'unavailable'

const LOCATION_INTERVAL_MS = 60_000

export default function MapClient({ profiles: initial, currentUserId }: Props) {
  const supabase = createClient()
  const [profiles, setProfiles] = useState<ProfilePin[]>(initial)
  const [permState, setPermState] = useState<PermissionState>('idle')
  const watchId = useRef<number | null>(null)

  // Realtime: keep pins fresh for all users
  useEffect(() => {
    const channel = supabase
      .channel('map-profiles')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, payload => {
        const updated = payload.new as ProfilePin
        setProfiles(prev => prev.map(p => p.id === updated.id ? { ...p, ...updated } : p))
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [supabase])

  async function saveLocation(lat: number, lng: number) {
    await supabase.from('profiles').update({
      lat,
      lng,
      location_updated_at: new Date().toISOString(),
    }).eq('id', currentUserId)
  }

  function requestLocation() {
    if (!navigator.geolocation) { setPermState('unavailable'); return }
    setPermState('requesting')
    navigator.geolocation.getCurrentPosition(
      pos => {
        setPermState('granted')
        saveLocation(pos.coords.latitude, pos.coords.longitude)
        // update every 60s
        watchId.current = window.setInterval(() => {
          navigator.geolocation.getCurrentPosition(
            p => saveLocation(p.coords.latitude, p.coords.longitude),
            () => {},
            { maximumAge: 30_000 }
          )
        }, LOCATION_INTERVAL_MS)
      },
      () => setPermState('denied'),
      { enableHighAccuracy: false, timeout: 10_000 }
    )
  }

  useEffect(() => () => {
    if (watchId.current !== null) clearInterval(watchId.current)
  }, [])

  const pinned = profiles.filter(p => p.lat !== null && p.lng !== null)
  const unpinned = profiles.filter(p => p.lat === null || p.lng === null)
  const me = profiles.find(p => p.id === currentUserId)

  return (
    <div className="page-enter">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Team Map</h1>
          <p className="text-sm text-slate-500 mt-0.5">{pinned.length} of {profiles.length} members sharing location</p>
        </div>

        {/* Location permission CTA */}
        {permState === 'idle' && (
          <button onClick={requestLocation}
            className="px-4 py-2 bg-brand-600 text-white text-sm font-semibold rounded-xl hover:bg-brand-700 transition-colors shadow-sm shadow-brand-200">
            Share my location
          </button>
        )}
        {permState === 'requesting' && (
          <span className="text-sm text-slate-500 flex items-center gap-2">
            <span className="w-4 h-4 rounded-full border-2 border-brand-200 border-t-brand-600 animate-spin inline-block" />
            Waiting for permission…
          </span>
        )}
        {permState === 'granted' && (
          <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-600">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Sharing location
          </span>
        )}
        {permState === 'denied' && (
          <span className="text-sm text-red-500 font-medium">Location access denied — enable it in browser settings</span>
        )}
        {permState === 'unavailable' && (
          <span className="text-sm text-slate-400">Geolocation not supported on this device</span>
        )}
      </div>

      {/* Map */}
      <div className="h-[520px] rounded-2xl border border-slate-200 overflow-hidden mb-5">
        <LiveMap profiles={pinned} currentUserId={currentUserId} />
      </div>

      {/* Members grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {profiles.map(p => {
          const isMe = p.id === currentUserId
          const hasLocation = p.lat !== null && p.lng !== null
          const isUnavailable = UNAVAILABLE_STATUSES.includes((p.user_status ?? 'active') as UserStatus)
          const lastSeen = p.location_updated_at
            ? formatRelative(p.location_updated_at)
            : null

          return (
            <div key={p.id} className={`bg-white border border-slate-200 rounded-2xl px-4 py-3 flex items-center gap-3 ${isUnavailable ? 'opacity-60' : ''}`}>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 ${isMe ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                {initials(p.full_name)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-semibold text-slate-800 truncate">{p.full_name}</p>
                  {isMe && <span className="text-[11px] text-brand-500 font-medium shrink-0">(you)</span>}
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">{ROLE_LABELS[p.role]}</p>
              </div>
              <div className="text-right shrink-0">
                {hasLocation ? (
                  <>
                    <span className="flex items-center gap-1 text-[11px] text-emerald-600 font-medium justify-end">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      On map
                    </span>
                    {lastSeen && <p className="text-[10px] text-slate-400 mt-0.5">{lastSeen}</p>}
                  </>
                ) : (
                  <span className="text-[11px] text-slate-300 font-medium">No location</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const initials = (name: string) => {
  const p = name.trim().split(/\s+/)
  return p.length === 1 ? p[0][0].toUpperCase() : (p[0][0] + p[p.length - 1][0]).toUpperCase()
}

function formatRelative(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}
