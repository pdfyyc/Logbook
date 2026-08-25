import { useState } from "react"
import { ChevronDown, ChevronUp, Clock, Moon, MoveRight, PlaneTakeoff, Radar, User } from "lucide-react"
import type { Aircraft, Flight, PilotProfile } from "../types"
import { computeCarsCurrency, computeTotals, formatHours, type CurrencyItem, type CurrencyLevel } from "../lib/calc"
import { StatCard } from "./ui/StatCard"
import { Card } from "./ui/Card"
import { Badge } from "./ui/Badge"

interface Props {
  flights: Flight[]
  aircraftById: Map<string, Aircraft>
  profile: PilotProfile
  onAddFlight: () => void
}

export function Dashboard({ flights, aircraftById, profile, onAddFlight }: Props) {
  const totals = computeTotals(flights)
  const currency = computeCarsCurrency(flights, profile)

  const recent = flights
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 6)

  if (flights.length === 0) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-24 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
          <PlaneTakeoff size={22} />
        </span>
        <h2 className="text-lg font-semibold text-[var(--text)]">No flights logged yet</h2>
        <p className="text-sm text-[var(--text-muted)]">
          Add your first flight to start tracking hours, currency, and totals.
        </p>
        <button
          onClick={onAddFlight}
          className="mt-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:brightness-110 cursor-pointer"
        >
          Log your first flight
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Total time" value={formatHours(totals.totalTime)} icon={Clock} />
        <StatCard label="PIC" value={formatHours(totals.pic)} icon={User} />
        <StatCard label="Cross-country" value={formatHours(totals.crossCountry)} icon={MoveRight} />
        <StatCard label="Night" value={formatHours(totals.night)} icon={Moon} />
        <StatCard
          label="Instrument"
          value={formatHours(totals.actualInstrument + totals.simulatedInstrument)}
          icon={Radar}
        />
      </div>

      <Card className="p-4">
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold text-[var(--text)]">Currency & recency</h3>
          <span className="text-xs text-[var(--text-muted)]">
            Rolling windows, recalculated on every flight — for planning only, verify against the CARs
          </span>
        </div>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {currency.map((item) => (
            <CurrencyCard key={item.id} item={item} />
          ))}
        </div>
      </Card>

      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--text)]">Recent flights</h3>
        </div>
        <div className="divide-y divide-[var(--border)]">
          {recent.map((f) => {
            const ac = aircraftById.get(f.aircraftId)
            return (
              <div key={f.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <div className="font-medium text-[var(--text)]">
                    {f.from || "—"} → {f.to || "—"}
                  </div>
                  <div className="truncate text-xs text-[var(--text-muted)]">
                    {f.date} · {ac ? `${ac.tailNumber} (${ac.makeModel})` : "Unknown aircraft"}
                  </div>
                </div>
                <div className="shrink-0 font-mono text-[var(--text)]">
                  {formatHours(f.totalTime)}h
                </div>
              </div>
            )
          })}
        </div>
      </Card>
    </div>
  )
}

const levelTone: Record<CurrencyLevel, "success" | "warning" | "danger"> = {
  green: "success",
  yellow: "warning",
  red: "danger",
}

const levelDot: Record<CurrencyLevel, string> = {
  green: "bg-emerald-500",
  yellow: "bg-amber-500",
  red: "bg-red-500",
}

function CurrencyCard({ item }: { item: CurrencyItem }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="rounded-lg border border-[var(--border)] p-3">
      <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className={`h-2 w-2 shrink-0 rounded-full ${levelDot[item.level]}`} aria-hidden />
        <span className="text-sm font-medium text-[var(--text)]">{item.label}</span>
        <Badge tone={levelTone[item.level]}>{item.statusText}</Badge>
        <span className="ml-auto text-[10px] font-mono uppercase tracking-wide text-[var(--text-muted)]">
          {item.citation}
        </span>
      </div>
      <p className="text-xs text-[var(--text-muted)]">{item.detail}</p>
      <p className="mt-1.5 text-xs font-medium text-[var(--text)]">{item.fixIt}</p>

      {item.qualifying.length > 0 && (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1 text-xs font-medium text-[var(--accent)] cursor-pointer"
          >
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {expanded ? "Hide" : "Show"} qualifying flights ({item.qualifying.length})
          </button>
          {expanded && (
            <ul className="mt-2 space-y-1 border-t border-[var(--border)] pt-2">
              {item.qualifying
                .slice()
                .sort((a, b) => b.date.localeCompare(a.date))
                .map((q) => (
                  <li key={q.flightId} className="flex justify-between gap-2 text-xs text-[var(--text-muted)]">
                    <span>{q.date}</span>
                    <span>{q.note}</span>
                  </li>
                ))}
            </ul>
          )}
          {item.windowStart && item.windowEnd && (
            <p className="mt-2 text-[10px] text-[var(--text-muted)]">
              Window: {item.windowStart} → {item.windowEnd}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
