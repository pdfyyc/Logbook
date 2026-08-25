import { Cloud, CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun, MapPin, RefreshCw, Sun } from "lucide-react"
import { useWeather } from "../lib/useWeather"
import type { WeatherIcon } from "../lib/weather"
import { Card } from "./ui/Card"

const iconFor: Record<WeatherIcon, typeof Sun> = {
  sun: Sun,
  "cloud-sun": CloudSun,
  cloud: Cloud,
  "cloud-fog": CloudFog,
  "cloud-rain": CloudRain,
  "cloud-snow": CloudSnow,
  "cloud-lightning": CloudLightning,
}

function relativeTime(iso: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  return `${hours}h ago`
}

interface Props {
  lat: number
  lon: number
}

export function WeatherWidget({ lat, lon }: Props) {
  const { state, retry } = useWeather(lat, lon)

  if (state.status === "loading") {
    return (
      <Card className="flex items-center gap-2 p-4 text-sm text-[var(--text-muted)]">
        <RefreshCw size={14} className="animate-spin" />
        Finding your local weather…
      </Card>
    )
  }

  if (state.status === "error") {
    return (
      <Card className="flex items-center justify-between gap-3 p-4 text-sm text-[var(--text-muted)]">
        Weather unavailable right now.
        <button onClick={retry} className="shrink-0 text-xs font-medium text-[var(--accent)] cursor-pointer">
          Retry
        </button>
      </Card>
    )
  }

  const { snapshot, refreshing } = state
  const Icon = iconFor[snapshot.icon]

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-muted)]">
            <MapPin size={12} />
            <span className="truncate">{snapshot.locationName}</span>
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-sm text-[var(--text)]">
            <Icon size={16} className="text-[var(--accent)]" />
            {snapshot.label} · wind {Math.round(snapshot.windKph)} km/h
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-2xl font-bold text-[var(--text)]">{Math.round(snapshot.temperatureC)}°C</span>
          <button
            onClick={retry}
            aria-label="Refresh weather"
            className="rounded-md p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-inset)] hover:text-[var(--text)] cursor-pointer"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
          </button>
        </div>
      </div>
      <p className="mt-2 text-[10px] text-[var(--text-muted)]">Updated {relativeTime(snapshot.fetchedAt)}</p>
    </Card>
  )
}
