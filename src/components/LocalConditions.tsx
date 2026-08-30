import { MapPin, RefreshCw } from "lucide-react"
import { useGeolocation } from "../lib/useGeolocation"
import { nearestAirport } from "../lib/airports"
import { Card } from "./ui/Card"
import { WeatherWidget } from "./WeatherWidget"
import { GfaWidget } from "./GfaWidget"
import { AirportBriefingWidget } from "./AirportBriefingWidget"

/** Requests location once and renders the weather + GFA + airport-briefing
 *  widgets from the same coordinates, so the user only sees a single
 *  permission prompt. The briefing widget still works without location —
 *  it just falls back to manual ICAO entry. */
export function LocalConditions() {
  const { state, refresh } = useGeolocation()

  if (state.status === "loading") {
    return (
      <Card className="flex items-center gap-2 p-4 text-sm text-[var(--text-muted)]">
        <RefreshCw size={14} className="animate-spin" />
        Finding your location…
      </Card>
    )
  }

  if (state.status === "unsupported" || state.status === "denied" || state.status === "error") {
    return (
      <div className="space-y-3">
        {state.status === "denied" && (
          <Card className="flex items-center justify-between gap-3 p-4">
            <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
              <MapPin size={14} />
              Location access is off — enable it for local weather and the nearest GFA area.
            </div>
            <button onClick={refresh} className="shrink-0 text-xs font-medium text-[var(--accent)] cursor-pointer">
              Try again
            </button>
          </Card>
        )}
        {state.status === "error" && (
          <Card className="flex items-center justify-between gap-3 p-4 text-sm text-[var(--text-muted)]">
            Couldn't get your location.
            <button onClick={refresh} className="shrink-0 text-xs font-medium text-[var(--accent)] cursor-pointer">
              Retry
            </button>
          </Card>
        )}
        <AirportBriefingWidget nearestIcao={null} />
      </div>
    )
  }

  const nearest = nearestAirport(state.lat, state.lon)

  return (
    <div className="space-y-3">
      <WeatherWidget lat={state.lat} lon={state.lon} />
      <GfaWidget lat={state.lat} lon={state.lon} />
      <AirportBriefingWidget nearestIcao={nearest.icao} />
    </div>
  )
}
