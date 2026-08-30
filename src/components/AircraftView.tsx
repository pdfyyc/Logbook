import { Pencil, Plane, Plus, Trash2 } from "lucide-react"
import type { Aircraft, Flight } from "../types"
import { formatHours } from "../lib/calc"
import { Button } from "./ui/Button"
import { Card } from "./ui/Card"
import { Badge } from "./ui/Badge"

interface Props {
  aircraft: Aircraft[]
  flights: Flight[]
  onAdd: () => void
  onEdit: (aircraft: Aircraft) => void
  onDelete: (id: string) => void
}

export function AircraftView({ aircraft, flights, onAdd, onEdit, onDelete }: Props) {
  const activeAircraft = aircraft.filter((a) => !a.archived)
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--text)]">Your aircraft</h2>
        <Button onClick={onAdd}>
          <Plus size={15} /> Add aircraft
        </Button>
      </div>

      {activeAircraft.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 py-16 text-center">
          <Plane size={22} className="text-[var(--accent)]" />
          <p className="text-sm text-[var(--text-muted)]">No aircraft added yet.</p>
          <Button variant="secondary" onClick={onAdd}>
            Add your first aircraft
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {activeAircraft.map((a) => {
            const hours = flights
              .filter((f) => f.aircraftId === a.id)
              .reduce((sum, f) => sum + f.totalTime, 0)
            const tags = [
              a.isComplex && "Complex",
              a.isHighPerformance && "High perf.",
              a.isTailwheel && "Tailwheel",
              a.isTaa && "TAA",
            ].filter(Boolean) as string[]

            return (
              <Card key={a.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-semibold text-[var(--text)]">{a.favourite ? "★ " : ""}{a.nickname || a.tailNumber}</div>
                    {a.nickname && <div className="text-xs text-[var(--text-muted)]">{a.tailNumber}</div>}
                    <div className="text-sm text-[var(--text-muted)]">{a.makeModel}</div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => onEdit(a)}
                      className="rounded-md p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-inset)] hover:text-[var(--text)] cursor-pointer"
                      aria-label="Edit aircraft"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => onDelete(a.id)}
                      className="rounded-md p-1.5 text-[var(--text-muted)] hover:bg-red-500/10 hover:text-red-500 cursor-pointer"
                      aria-label="Delete aircraft"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Badge>{a.category}</Badge>
                  {a.defaultAircraft && <Badge tone="success">Default</Badge>}
                  {a.recordKind && a.recordKind !== "aircraft" && <Badge tone="warning">{a.recordKind.toUpperCase()}</Badge>}
                  {tags.map((t) => (
                    <Badge key={t}>{t}</Badge>
                  ))}
                </div>

                <div className="mt-3 border-t border-[var(--border)] pt-2 text-sm text-[var(--text-muted)]">
                  {formatHours(hours)} hrs logged
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
