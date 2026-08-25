import type { Aircraft, Flight } from "../types"

const AIRCRAFT_KEY = "logbook:aircraft"
const FLIGHTS_KEY = "logbook:flights"
const THEME_KEY = "logbook:theme"

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
  return read<"light" | "dark">(THEME_KEY, "light")
}

export function saveTheme(theme: "light" | "dark") {
  write(THEME_KEY, theme)
}

export interface LogbookExport {
  version: 1
  exportedAt: string
  aircraft: Aircraft[]
  flights: Flight[]
}

export function exportData(aircraft: Aircraft[], flights: Flight[]): LogbookExport {
  return { version: 1, exportedAt: new Date().toISOString(), aircraft, flights }
}

export function isLogbookExport(value: unknown): value is LogbookExport {
  if (!value || typeof value !== "object") return false
  const v = value as Record<string, unknown>
  return Array.isArray(v.aircraft) && Array.isArray(v.flights)
}
