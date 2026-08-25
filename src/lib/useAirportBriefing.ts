import { useEffect, useState } from "react"
import { fetchMetar, fetchTaf, type MetarSnapshot, type TafSnapshot } from "./metar"

export type BriefingState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; metar: MetarSnapshot | null; taf: TafSnapshot | null }

interface Resolved {
  icao: string
  metar: MetarSnapshot | null
  taf: TafSnapshot | null
}

export function useAirportBriefing(icao: string | null): BriefingState {
  const [resolved, setResolved] = useState<Resolved | null>(null)
  const [erroredIcao, setErroredIcao] = useState<string | null>(null)

  useEffect(() => {
    if (!icao) return
    let cancelled = false

    Promise.allSettled([fetchMetar(icao), fetchTaf(icao)]).then(([metarRes, tafRes]) => {
      if (cancelled) return
      if (metarRes.status === "rejected" && tafRes.status === "rejected") {
        setErroredIcao(icao)
        return
      }
      setErroredIcao(null)
      setResolved({
        icao,
        metar: metarRes.status === "fulfilled" ? metarRes.value : null,
        taf: tafRes.status === "fulfilled" ? tafRes.value : null,
      })
    })

    return () => {
      cancelled = true
    }
  }, [icao])

  // Derived purely from render-time comparison — no state is set
  // synchronously inside the effect, only from its async callback.
  if (!icao) return { status: "idle" }
  if (erroredIcao === icao) return { status: "error" }
  if (resolved && resolved.icao === icao) return { status: "ready", metar: resolved.metar, taf: resolved.taf }
  return { status: "loading" }
}
