import type { Aircraft, Flight, PilotProfile } from "../types"
import { defaultPilotProfile } from "../types"
import type { WeatherSnapshot } from "./weather"

const AIRCRAFT_KEY = "logbook:aircraft"
const FLIGHTS_KEY = "logbook:flights"
const THEME_KEY = "logbook:theme"
const PROFILE_KEY = "logbook:profile"
const WEATHER_KEY = "logbook:weather"
const METAR_ICAO_KEY = "logbook:metarIcao"

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function write<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // storage unavailable (private mode, quota) — fail silently, in-memory state still works
  }
}

export function loadAircraft(): Aircraft[] {
  return read<Aircraft[]>(AIRCRAFT_KEY, [])
}

export function saveAircraft(aircraft: Aircraft[]) {
  write(AIRCRAFT_KEY, aircraft)
}

export function loadFlights(): Flight[] {
  return read<Flight[]>(FLIGHTS_KEY, [])
}

export function saveFlights(flights: Flight[]) {
  write(FLIGHTS_KEY, flights)
}

export function loadTheme(): "light" | "dark" {
  return read<"light" | "dark">(THEME_KEY, "dark")
}

export function saveTheme(theme: "light" | "dark") {
  write(THEME_KEY, theme)
}

export function loadProfile(): PilotProfile {
  return read<PilotProfile>(PROFILE_KEY, defaultPilotProfile)
}

export function saveProfile(profile: PilotProfile) {
  write(PROFILE_KEY, profile)
}

export function loadWeatherCache(): WeatherSnapshot | null {
  return read<WeatherSnapshot | null>(WEATHER_KEY, null)
}

export function saveWeatherCache(snapshot: WeatherSnapshot) {
  write(WEATHER_KEY, snapshot)
}

/** A user-chosen ICAO override for the airport briefing widget — null means
 *  "follow the nearest-detected airport" rather than a fixed choice. */
export function loadMetarIcaoOverride(): string | null {
  return read<string | null>(METAR_ICAO_KEY, null)
}

export function saveMetarIcaoOverride(icao: string | null) {
  write(METAR_ICAO_KEY, icao)
}

export interface LogbookExport {
  version: 1 | 2
  exportedAt: string
  aircraft: Aircraft[]
  flights: Flight[]
  profile?: PilotProfile
}

export function exportData(
  aircraft: Aircraft[],
  flights: Flight[],
  profile: PilotProfile,
): LogbookExport {
  return { version: 2, exportedAt: new Date().toISOString(), aircraft, flights, profile }
}

export function isLogbookExport(value: unknown): value is LogbookExport {
  if (!value || typeof value !== "object") return false
  const v = value as Record<string, unknown>
  return Array.isArray(v.aircraft) && Array.isArray(v.flights)
}
