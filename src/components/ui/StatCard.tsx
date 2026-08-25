import type { LucideIcon } from "lucide-react"

interface Props {
  label: string
  value: string
  icon: LucideIcon
  sub?: string
}

export function StatCard({ label, value, icon: Icon, sub }: Props) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
          {label}
        </span>
        <Icon size={16} className="text-[var(--accent)]" />
      </div>
      <div className="mt-2 text-2xl font-semibold text-[var(--text)]">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-[var(--text-muted)]">{sub}</div>}
    </div>
  )
}
