import { useState } from "react"
import { ChevronDown, ChevronUp, LocateFixed, RefreshCw, Search } from "lucide-react"
import { useAirportBriefing } from "../lib/useAirportBriefing"
import { loadMetarIcaoOverride, saveMetarIcaoOverride } from "../lib/storage"
import type { FlightCategory } from "../lib/metar"
import { Card } from "./ui/Card"
import { Badge } from "./ui/Badge"

const categoryTone: Record<FlightCategory, "success" | "warning" | "danger"> = {
  VFR: "success",
  MVFR: "warning",
  IFR: "danger",
  LIFR: "danger",
}

interface Props {
  nearestIcao: string | null
}

export function AirportBriefingWidget({ nearestIcao }: Props) {
  const [override, setOverride] = useState<string | null>(() => loadMetarIcaoOverride())
  // null = the field hasn't been hand-edited yet, so it follows override/nearest.
  // Once the user types, this takes over and stays in control of the field.
  const [typed, setTyped] = useState<string | null>(null)
  const [tafOpen, setTafOpen] = useState(false)

  const activeIcao = override ?? nearestIcao
  const inputValue = typed ?? override ?? nearestIcao ?? ""

  const briefing = useAirportBriefing(activeIcao)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const code = inputValue.trim().toUpperCase()
    if (code.length < 3) return
    setOverride(code)
    saveMetarIcaoOverride(code)
    setTyped(null)
  }

  function useNearest() {
    if (!nearestIcao) return
    setOverride(null)
    saveMetarIcaoOverride(null)
    setTyped(null)
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-[var(--text-muted)]">Airport weather (METAR / TAF)</p>
        {nearestIcao && override && override !== nearestIcao && (
          <button
            onClick={useNearest}
            className="flex items-center gap-1 text-xs font-medium text-[var(--accent)] cursor-pointer"
          >
            <LocateFixed size={12} /> Use nearest ({nearestIcao})
          </button>
        )}
      </div>

      <form onSubmit={submit} className="mt-2 flex gap-2">
        <div className="relative flex-1">
          <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            value={inputValue}
            onChange={(e) => setTyped(e.target.value.toUpperCase())}
            placeholder="ICAO, e.g. CYYZ"
            maxLength={4}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] py-1.5 pl-8 pr-2.5 text-sm uppercase text-[var(--text)] outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)]"
          />
        </div>
        <button
          type="submit"
          className="rounded-lg bg-[var(--bg-inset)] px-3 py-1.5 text-sm font-medium text-[var(--text)] border border-[var(--border)] hover:bg-[var(--border)]/40 cursor-pointer"
        >
          Look up
        </button>
      </form>

      {briefing.status === "idle" && (
        <p className="mt-3 text-xs text-[var(--text-muted)]">Enter an airport's ICAO code to see its weather.</p>
      )}

      {briefing.status === "loading" && (
        <p className="mt-3 flex items-center gap-2 text-xs text-[var(--text-muted)]">
          <RefreshCw size={12} className="animate-spin" /> Loading {activeIcao}…
        </p>
      )}

      {briefing.status === "error" && (
        <p className="mt-3 text-xs text-[var(--text-muted)]">Couldn't reach the weather service. Try again shortly.</p>
      )}

      {briefing.status === "ready" && (
        <div className="mt-3 space-y-2.5">
          {briefing.metar ? (
            <div>
              <div className="mb-1 flex items-center gap-2">
                {briefing.metar.flightCategory && (
                  <Badge tone={categoryTone[briefing.metar.flightCategory]}>{briefing.metar.flightCategory}</Badge>
                )}
                <span className="text-xs text-[var(--text-muted)]">METAR</span>
              </div>
              <p className="rounded-lg bg-[var(--bg-inset)] p-2.5 font-mono text-xs leading-relaxed text-[var(--text)]">
                {briefing.metar.raw ?? "No raw report available."}
              </p>
            </div>
          ) : (
            <p className="text-xs text-[var(--text-muted)]">No current METAR for {activeIcao}.</p>
          )}

          {briefing.taf?.raw && (
            <div>
              <button
                type="button"
                onClick={() => setTafOpen((v) => !v)}
                className="flex items-center gap-1 text-xs font-medium text-[var(--accent)] cursor-pointer"
              >
                {tafOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                {tafOpen ? "Hide" : "Show"} TAF
              </button>
              {tafOpen && (
                <p className="mt-1.5 whitespace-pre-wrap rounded-lg bg-[var(--bg-inset)] p-2.5 font-mono text-xs leading-relaxed text-[var(--text)]">
                  {briefing.taf.raw}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      <p className="mt-3 text-[10px] text-[var(--text-muted)]">
        Source: NOAA Aviation Weather Center. Situational awareness only — this is not your official CARs
        pre-flight briefing; use wxbrief.ca or an FSS briefer for that.
      </p>
    </Card>
  )
}
