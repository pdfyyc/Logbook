import { Clock, Moon, MoveRight, PlaneTakeoff, Radar, User } from "lucide-react"
import type { Aircraft, Flight } from "../types"
import { computeCurrency, computeTotals, formatHours } from "../lib/calc"
import { StatCard } from "./ui/StatCard"
import { Card } from "./ui/Card"
import { Badge } from "./ui/Badge"

interface Props {
  flights: Flight[]
  aircraftById: Map<string, Aircraft>
  onAddFlight: () => void
}

export function Dashboard({ flights, aircraftById, onAddFlight }: Props) {
  const totals = computeTotals(flights)
  const currency = computeCurrency(flights)

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
        <h3 className="mb-3 text-sm font-semibold text-[var(--text)]">Currency</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <CurrencyRow
            label="Passenger — day"
            ok={currency.dayCurrent}
            detail={`${currency.dayLandingsIn90} landings in last 90 days (need 3)`}
          />
          <CurrencyRow
            label="Passenger — night"
            ok={currency.nightCurrent}
            detail={`${currency.nightLandingsIn90} night landings in last 90 days (need 3)`}
          />
          <CurrencyRow
            label="Instrument"
            ok={currency.instrumentCurrent}
            detail={`${currency.approachesIn6mo} approaches in last 6 months (need 6)`}
          />
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

function CurrencyRow({ label, ok, detail }: { label: string; ok: boolean; detail: string }) {
  return (
    <div className="rounded-lg border border-[var(--border)] p-3">
      <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-sm font-medium text-[var(--text)]">{label}</span>
        <Badge tone={ok ? "success" : "warning"}>{ok ? "Current" : "Not current"}</Badge>
      </div>
      <p className="text-xs text-[var(--text-muted)]">{detail}</p>
    </div>
  )
}
