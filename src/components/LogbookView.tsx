import { useMemo, useState } from "react"
import { Ban, Download, FileText, History, Pencil, Plus, Search, Upload } from "lucide-react"
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
  onVoid: (flight: Flight) => void
  onExperienceSummary: () => void
  onImportFile: (file: File) => void
  onImportJson: (file: File) => void
}

type SortKey = "date" | "totalTime"

export function LogbookView({
  flights,
  aircraft,
  aircraftById,
  onAdd,
  onEdit,
  onVoid,
  onExperienceSummary,
  onImportFile,
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
              <Upload size={15} /> Restore JSON
            </span>
          </label>
          <label className="cursor-pointer">
            <input type="file" accept=".csv,.tsv,.xlsx,text/csv,text/tab-separated-values,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) onImportFile(file); e.target.value = "" }} />
            <span className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-inset)] px-3.5 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--border)]/40"><Upload size={15} /> Import CSV / Excel</span>
          </label>
          <Button
            variant="secondary"
            onClick={() => downloadTextFile("logbook.csv", flightsToCsv(flights, aircraft), "text/csv")}
          >
            <Download size={15} /> CSV
          </Button>
          <Button variant="secondary" onClick={onExperienceSummary}>
            <FileText size={15} /> Experience summary
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
                  className={`border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg-inset)]/60 ${f.voidedAt ? "opacity-60" : ""}`}
                >
                  <td className={`px-3 py-2 whitespace-nowrap text-[var(--text)] ${f.voidedAt ? "line-through" : ""}`}>{f.date}</td>
                  <td className={`px-3 py-2 whitespace-nowrap text-[var(--text)] ${f.voidedAt ? "line-through" : ""}`}>
                    {ac?.tailNumber ?? "—"}
                  </td>
                  <td className={`px-3 py-2 whitespace-nowrap text-[var(--text-muted)] ${f.voidedAt ? "line-through" : ""}`}>
                    {f.from}
                    {f.to ? ` → ${f.to}` : ""}
                  </td>
                  <td className={`px-3 py-2 text-right font-mono text-[var(--text)] ${f.voidedAt ? "line-through" : ""}`}>
                    {formatHours(f.totalTime)}
                  </td>
                  <td className={`px-3 py-2 text-right font-mono text-[var(--text-muted)] ${f.voidedAt ? "line-through" : ""}`}>
                    {formatHours(f.pic)}
                  </td>
                  <td className={`px-3 py-2 text-right font-mono text-[var(--text-muted)] ${f.voidedAt ? "line-through" : ""}`}>
                    {formatHours(f.night)}
                  </td>
                  <td className={`px-3 py-2 text-right font-mono text-[var(--text-muted)] ${f.voidedAt ? "line-through" : ""}`}>
                    {f.dayLandings + f.nightLandings}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-1">
                      {(f.amendments?.length ?? 0) > 0 && (
                        <span
                          className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)]"
                          title={`${f.amendments!.length} amendment${f.amendments!.length === 1 ? "" : "s"}; latest: ${f.amendments!.at(-1)?.reason}`}
                        >
                          <History size={12} /> Amended
                        </span>
                      )}
                      <button
                        onClick={() => onEdit(f)}
                        disabled={Boolean(f.voidedAt)}
                        className="rounded-md p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-inset)] hover:text-[var(--text)] cursor-pointer"
                        aria-label="Edit flight"
                      >
                        <Pencil size={14} />
                      </button>
                      {!f.voidedAt ? (
                        <button
                          onClick={() => onVoid(f)}
                          className="rounded-md p-1.5 text-[var(--text-muted)] hover:bg-amber-500/10 hover:text-amber-500 cursor-pointer"
                          aria-label="Void flight"
                        >
                          <Ban size={14} />
                        </button>
                      ) : (
                        <span className="text-[10px] font-medium uppercase tracking-wide text-amber-500" title={f.voidReason}>
                          Voided
                        </span>
                      )}
                    </div>
                    {f.voidedAt && (
                      <p className="mt-1 text-right text-[10px] text-[var(--text-muted)]">{f.voidReason}</p>
                    )}
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
