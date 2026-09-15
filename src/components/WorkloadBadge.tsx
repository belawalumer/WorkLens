import { WorkloadStatus, STATUS_CONFIG } from '@/types'

export default function WorkloadBadge({ status }: { status: WorkloadStatus }) {
  const cfg = STATUS_CONFIG[status]
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      {cfg.emoji} {cfg.label}
    </span>
  )
}
