import { Award, GraduationCap, Square, Trash2 } from "lucide-react"
import type { Aircraft, Flight, PilotProfile } from "../types"
import {
  LICENSE_TEMPLATES,
  computeLicenseProgress,
  getLicenseTemplate,
  type RequirementProgress,
} from "../lib/licenseRequirements"
import { formatHours } from "../lib/calc"
import { Card } from "./ui/Card"
import { Button } from "./ui/Button"

function formatAmount(value: number, unit: RequirementProgress["unit"]): string {
  return unit === "count" ? String(Math.round(value)) : `${formatHours(value)}h`
}

interface Props {
  flights: Flight[]
  profile: PilotProfile
  aircraftById: Map<string, Aircraft>
  trackedGoals: string[]
  onAddGoal: (templateId: string) => void
  onRemoveGoal: (templateId: string) => void
}

export function LicenseProgress({ flights, profile, aircraftById, trackedGoals, onAddGoal, onRemoveGoal }: Props) {
  const untracked = LICENSE_TEMPLATES.filter((t) => !trackedGoals.includes(t.id))

  return (
    <Card className="p-4">
      <div className="mb-1 flex items-center gap-2">
        <GraduationCap size={16} className="text-[var(--accent)]" />
        <h3 className="text-sm font-semibold text-[var(--text)]">Licence & rating progress</h3>
      </div>
      <p className="mb-3 text-xs text-[var(--text-muted)]">
        Hour requirements are taken from the Transport Canada standard cited on each licence below. Standards are
        amended from time to time — confirm against the current published text before a flight test application.
      </p>

      {trackedGoals.length === 0 && (
        <p className="py-4 text-center text-sm text-[var(--text-muted)]">
          Not tracking any licence or rating yet.
        </p>
      )}

      <div className="space-y-4">
        {trackedGoals.map((id) => {
          const template = getLicenseTemplate(id)
          if (!template) return null
          const progress = computeLicenseProgress(template, flights, profile, aircraftById)

          return (
            <div key={id} className="rounded-lg border border-[var(--border)] p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Award size={14} className="shrink-0 text-[var(--accent)]" />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-[var(--text)]">{template.name}</div>
                    <div className="font-mono text-[10px] uppercase tracking-wide text-[var(--text-muted)]">
                      {template.citation}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-[var(--text-muted)]">
                    {progress.metCount} / {progress.totalCount} met
                  </span>
                  <button
                    onClick={() => onRemoveGoal(id)}
                    className="rounded-md p-1 text-[var(--text-muted)] hover:bg-red-500/10 hover:text-red-500 cursor-pointer"
                    aria-label="Stop tracking"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                {progress.items.map((item) => (
                  <div key={item.id}>
                    <div className="mb-0.5 flex items-center justify-between gap-2 text-xs">
                      <span className="text-[var(--text)]">
                        {item.label}
                        {item.approximate && <span className="text-[var(--text-muted)]"> *</span>}
                      </span>
                      <span className="font-mono text-[var(--text-muted)]">
                        {item.blockedReason ? "—" : formatAmount(item.have, item.unit)} /{" "}
                        {formatAmount(item.required, item.unit)}
                      </span>
                    </div>
                    {item.blockedReason ? (
                      <p className="text-[10px] italic text-amber-500">{item.blockedReason}</p>
                    ) : (
                      <div className="h-1.5 overflow-hidden rounded-full bg-[var(--bg-inset)]">
                        <div
                          className={`h-full rounded-full ${item.met ? "bg-emerald-500" : "bg-[var(--accent)]"}`}
                          style={{ width: `${item.pct}%` }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <p className="mt-2 text-[10px] text-[var(--text-muted)]">
                * Approximated from flights logged as wholly solo or wholly dual — a mixed flight won't split
                correctly.
              </p>

              {template.manualRequirements.length > 0 && (
                <div className="mt-3 border-t border-[var(--border)] pt-2">
                  <p className="mb-1.5 text-[11px] font-medium text-[var(--text)]">Check these yourself</p>
                  <ul className="space-y-1.5">
                    {template.manualRequirements.map((req) => (
                      <li key={req} className="flex items-start gap-1.5 text-[11px] leading-snug text-[var(--text-muted)]">
                        <Square size={11} className="mt-0.5 shrink-0" />
                        <span>{req}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {untracked.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {untracked.map((t) => (
            <Button key={t.id} variant="secondary" onClick={() => onAddGoal(t.id)}>
              + Track {t.name}
            </Button>
          ))}
        </div>
      )}

      <p className="mt-3 text-[10px] text-[var(--text-muted)]">
        Aeroplane permits, licences and ratings only. Helicopter, glider and balloon requirements differ and aren't
        modelled here.
      </p>
    </Card>
  )
}
