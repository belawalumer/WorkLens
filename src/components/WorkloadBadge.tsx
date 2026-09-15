import { WorkloadStatus, STATUS_CONFIG } from '@/types'

const fmt = (n: number) => n % 1 === 0 ? String(Math.round(n)) : n.toFixed(1)

interface Props {
  status: WorkloadStatus
  freeToday?: number
  freeWeek?: number
}

export default function WorkloadBadge({ status, freeToday, freeWeek }: Props) {
  const cfg = STATUS_CONFIG[status]
  const showHours = status === 'available' && freeToday !== undefined && freeWeek !== undefined

  return (
    <div className={`inline-flex flex-col items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      <span className="flex items-center gap-1">{cfg.emoji} {cfg.label}</span>
      {showHours && (
        <span className="text-[10px] font-medium opacity-70 leading-tight mt-0.5">
          {fmt(freeToday!)}h today · {fmt(freeWeek!)}h/wk
        </span>
      )}
    </div>
  )
}
