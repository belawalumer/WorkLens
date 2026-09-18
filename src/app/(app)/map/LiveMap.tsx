'use client'

import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Role, ROLE_LABELS, UNAVAILABLE_STATUSES, UserStatus } from '@/types'

// Fix default marker icon paths broken by webpack
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

function makeIcon(color: string, isMe: boolean) {
  const size = isMe ? 38 : 32
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 40 40">
      <circle cx="20" cy="20" r="18" fill="${color}" stroke="white" stroke-width="3"/>
      ${isMe ? '<circle cx="20" cy="20" r="22" fill="none" stroke="' + color + '" stroke-width="2" opacity="0.4"/>' : ''}
    </svg>`
  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -(size / 2) - 4],
  })
}

const ROLE_COLOR: Record<Role, string> = {
  super_admin: '#7c3aed',
  hr_admin:    '#0078b7',
  developer:   '#64748b',
  sqa:         '#0d9488',
  ui_ux:       '#7c3aed',
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

const PAKISTAN_BOUNDS = L.latLngBounds([23.5, 60.5], [37.5, 77.5])

function FitBounds({ pins }: { pins: ProfilePin[] }) {
  const map = useMap()
  useEffect(() => {
    if (pins.length < 2) return
    const bounds = L.latLngBounds(pins.map(p => [p.lat!, p.lng!]))
    map.fitBounds(bounds.extend(PAKISTAN_BOUNDS), { padding: [60, 60], maxZoom: 12 })
  }, [pins, map])
  return null
}

function formatRelative(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

interface Props {
  profiles: ProfilePin[]
  currentUserId: string
}

export default function LiveMap({ profiles, currentUserId }: Props) {
  if (profiles.length === 0) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50 gap-3">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
          <circle cx="12" cy="9" r="2.5"/>
        </svg>
        <p className="text-sm text-slate-400 font-medium">No locations shared yet</p>
        <p className="text-xs text-slate-300">Click &quot;Share my location&quot; to appear on the map</p>
      </div>
    )
  }

  return (
    <MapContainer center={[30.3753, 69.3451]} zoom={5} style={{ width: '100%', height: '100%' }} zoomControl>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds pins={profiles} />
      {profiles.map(p => {
        const isMe = p.id === currentUserId
        const isUnavailable = UNAVAILABLE_STATUSES.includes((p.user_status ?? 'active') as UserStatus)
        const color = isUnavailable ? '#94a3b8' : ROLE_COLOR[p.role]
        const icon = makeIcon(color, isMe)
        return (
          <Marker key={p.id} position={[p.lat!, p.lng!]} icon={icon}>
            <Popup>
              <div className="text-sm">
                <p className="font-semibold text-slate-800">{p.full_name}{isMe ? ' (you)' : ''}</p>
                <p className="text-slate-500 text-xs mt-0.5">{ROLE_LABELS[p.role]}</p>
                {p.location_updated_at && (
                  <p className="text-slate-400 text-xs mt-1">Updated {formatRelative(p.location_updated_at)}</p>
                )}
              </div>
            </Popup>
          </Marker>
        )
      })}
    </MapContainer>
  )
}
