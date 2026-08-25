import { useState } from "react"
import {
  ChevronDown,
  ChevronUp,
  Clock,
  Moon,
  MoveRight,
  Plane,
  PlaneTakeoff,
  Radar,
  Rocket,
  User,
} from "lucide-react"
import type { Aircraft, Flight, PilotProfile } from "../types"
import {
  computeCarsCurrency,
  computeMonthTotals,
  computeTotals,
  formatHours,
  type CurrencyItem,
  type CurrencyLevel,
} from "../lib/calc"
import { StatCard } from "./ui/StatCard"
import { Card } from "./ui/Card"
import { Badge } from "./ui/Badge"
import { Button } from "./ui/Button"
import { Avatar } from "./ui/Avatar"
import { LocalConditions } from "./LocalConditions"

interface Props {
  flights: Flight[]
  aircraftById: Map<string, Aircraft>
  profile: PilotProfile
  onAddFlight: () => void
  onViewAllFlights: () => void
}

function formatShortDate(iso: string): string {
  const d = new Date(iso + "T00:00:00")
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

export function Dashboard({ flights, aircraftById, profile, onAddFlight, onViewAllFlights }: Props) {
  const totals = computeTotals(flights)
  const month = computeMonthTotals(flights)
  const currency = computeCarsCurrency(flights, profile)
  const name = profile.pilotName || "Pilot"

  const recent = flights
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Avatar name={name} />
        <div>
          <p className="text-sm text-[var(--text-muted)]">Welcome,</p>
          <h1 className="text-lg font-bold text-[var(--text)]">{name}</h1>
        </div>
      </div>

      <LocalConditions />

      <Button variant="gradient" pill className="w-full" onClick={onAddFlight}>
        <Rocket size={16} /> New log entry
      </Button>

      {flights.length === 0 ? (
        <Card className="mx-auto flex max-w-md flex-col items-center gap-3 px-4 py-16 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
            <PlaneTakeoff size={22} />
          </span>
          <h2 className="text-lg font-semibold text-[var(--text)]">No flights logged yet</h2>
          <p className="text-sm text-[var(--text-muted)]">
            Add your first flight to start tracking hours, currency, and totals.
          </p>
        </Card>
      ) : (
        <>
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

          <div>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-bold text-[var(--text)]">Recent Flights</h3>
              <button
                onClick={onViewAllFlights}
                className="text-xs font-medium text-[var(--accent)] cursor-pointer"
              >
                See all
              </button>
            </div>
            <div className="space-y-2">
              {recent.map((f) => (
                <FlightRow key={f.id} flight={f} aircraft={aircraftById.get(f.aircraftId)} />
              ))}
            </div>
          </div>

          <div className="rounded-2xl bg-gradient-to-r from-[var(--brand-from)] to-[var(--brand-to)] p-4 text-white">
            <p className="text-xs font-semibold uppercase tracking-wide text-white/80">Flight totals</p>
            <div className="mt-1.5 flex flex-wrap gap-x-5 gap-y-1 text-sm font-semibold">
              <span>This month: {formatHours(month.hours)} hrs</span>
              <span>PIC: {formatHours(month.pic)} hrs</span>
              <span>Landings: {month.landings}</span>
            </div>
          </div>
        </>
      )}

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
    </div>
  )
}

function FlightRow({ flight: f, aircraft: ac }: { flight: Flight; aircraft?: Aircraft }) {
  const tags = [
    f.night > 0 && "Night",
    f.crossCountry > 0 && "XC",
    f.actualInstrument + f.simulatedInstrument > 0 && "Inst",
  ].filter((t): t is string => Boolean(t))

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-3">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
        <Plane size={18} className="-rotate-45" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-semibold text-[var(--text)]">
            {f.from || "—"} → {f.to || "—"}
          </span>
          <span className="shrink-0 font-mono text-sm font-semibold text-[var(--text)]">
            {formatHours(f.totalTime)}h
          </span>
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-[var(--text-muted)]">
          <span>{formatShortDate(f.date)}</span>
          <span>·</span>
          <span>{ac ? ac.tailNumber : "Unknown aircraft"}</span>
          {tags.map((t) => (
            <Badge key={t}>{t}</Badge>
          ))}
        </div>
      </div>
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
