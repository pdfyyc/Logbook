import { useMemo, useState } from "react"
import { Download, Pencil, Plus, Search, Trash2, Upload } from "lucide-react"
import type { Aircraft, Flight } from "../types"
import { formatHours } from "../lib/calc"
import { downloadTextFile, flightsToCsv } from "../lib/csv"
import { Button } from "./ui/Button"
import { Card } from "./ui/Card"
import { Input, Select } from "./ui/Field"

interface Props {
  flights: Flight[]
  aircraft: Aircraft[]
  aircraftById: Map<string, Aircraft>
  onAdd: () => void
  onEdit: (flight: Flight) => void
  onDelete: (id: string) => void
  onImportJson: (file: File) => void
}

type SortKey = "date" | "totalTime"

export function LogbookView({
  flights,
  aircraft,
  aircraftById,
  onAdd,
  onEdit,
  onDelete,
  onImportJson,
}: Props) {
  const [query, setQuery] = useState("")
  const [aircraftFilter, setAircraftFilter] = useState("all")
  const [sortKey, setSortKey] = useState<SortKey>("date")

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return flights
      .filter((f) => aircraftFilter === "all" || f.aircraftId === aircraftFilter)
      .filter((f) => {
        if (!q) return true
        const ac = aircraftById.get(f.aircraftId)
        return [f.from, f.to, f.route, f.remarks, ac?.tailNumber, ac?.makeModel]
          .filter(Boolean)
          .some((v) => v!.toLowerCase().includes(q))
      })
      .sort((a, b) =>
        sortKey === "date"
          ? b.date.localeCompare(a.date)
          : b.totalTime - a.totalTime,
      )
  }, [flights, query, aircraftFilter, sortKey, aircraftById])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-48">
          <Search
            size={15}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search route, aircraft, remarks..."
            className="pl-8"
          />
        </div>
        <Select value={aircraftFilter} onChange={(e) => setAircraftFilter(e.target.value)} className="w-auto">
          <option value="all">All aircraft</option>
          {aircraft.map((a) => (
            <option key={a.id} value={a.id}>
              {a.tailNumber}
            </option>
          ))}
        </Select>
        <Select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)} className="w-auto">
          <option value="date">Sort: date</option>
          <option value="totalTime">Sort: duration</option>
        </Select>

        <div className="ml-auto flex items-center gap-2">
          <label className="cursor-pointer">
            <input
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) onImportJson(file)
                e.target.value = ""
              }}
            />
            <span className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-inset)] px-3.5 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--border)]/40">
              <Upload size={15} /> Import
            </span>
          </label>
          <Button
            variant="secondary"
            onClick={() => downloadTextFile("logbook.csv", flightsToCsv(flights, aircraft), "text/csv")}
          >
            <Download size={15} /> CSV
          </Button>
          <Button onClick={onAdd}>
            <Plus size={15} /> Add flight
          </Button>
        </div>
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wide text-[var(--text-muted)]">
              <th className="px-3 py-2 font-medium">Date</th>
              <th className="px-3 py-2 font-medium">Aircraft</th>
              <th className="px-3 py-2 font-medium">Route</th>
              <th className="px-3 py-2 font-medium text-right">Total</th>
              <th className="px-3 py-2 font-medium text-right">PIC</th>
              <th className="px-3 py-2 font-medium text-right">Night</th>
              <th className="px-3 py-2 font-medium text-right">Ldg</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((f) => {
              const ac = aircraftById.get(f.aircraftId)
              return (
                <tr
                  key={f.id}
                  className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg-inset)]/60"
                >
                  <td className="px-3 py-2 whitespace-nowrap text-[var(--text)]">{f.date}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-[var(--text)]">
                    {ac?.tailNumber ?? "—"}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-[var(--text-muted)]">
                    {f.from}
                    {f.to ? ` → ${f.to}` : ""}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-[var(--text)]">
                    {formatHours(f.totalTime)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-[var(--text-muted)]">
                    {formatHours(f.pic)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-[var(--text-muted)]">
                    {formatHours(f.night)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-[var(--text-muted)]">
                    {f.dayLandings + f.nightLandings}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => onEdit(f)}
                        className="rounded-md p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-inset)] hover:text-[var(--text)] cursor-pointer"
                        aria-label="Edit flight"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => onDelete(f.id)}
                        className="rounded-md p-1.5 text-[var(--text-muted)] hover:bg-red-500/10 hover:text-red-500 cursor-pointer"
                        aria-label="Delete flight"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-10 text-center text-sm text-[var(--text-muted)]">
                  No flights match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
