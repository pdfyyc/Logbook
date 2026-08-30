// Client for NOAA's Aviation Weather Center Data API — a public, free,
// no-key API that serves METAR/TAF for any ICAO station worldwide (Canadian
// stations included). This sandbox couldn't reach aviationweather.gov to
// verify the exact current response schema, so field extraction below tries
// several known/plausible field-name variants rather than assuming one, and
// always falls back to raw text — a METAR/TAF's raw string is the one thing
// guaranteed to be readable by a pilot regardless of how the JSON is shaped.

export type FlightCategory = "VFR" | "MVFR" | "IFR" | "LIFR"

export interface MetarSnapshot {
  icao: string
  raw: string | null
  flightCategory: FlightCategory | null
  tempC: number | null
  windDirDeg: number | null
  windSpeedKt: number | null
  visibilitySm: string | null
  observedAt: string | null
}

export interface TafSnapshot {
  icao: string
  raw: string | null
  issuedAt: string | null
}

function firstString(obj: unknown, keys: string[]): string | null {
  if (typeof obj !== "object" || obj === null) return null
  const record = obj as Record<string, unknown>
  for (const key of keys) {
    const value = record[key]
    if (typeof value === "string" && value.trim()) return value
    if (typeof value === "number") return String(value)
  }
  return null
}

function firstNumber(obj: unknown, keys: string[]): number | null {
  if (typeof obj !== "object" || obj === null) return null
  const record = obj as Record<string, unknown>
  for (const key of keys) {
    const value = record[key]
    if (typeof value === "number" && Number.isFinite(value)) return value
  }
  return null
}

function normalizeFlightCategory(raw: string | null): FlightCategory | null {
  if (!raw) return null
  const upper = raw.toUpperCase().trim()
  if (upper === "VFR" || upper === "MVFR" || upper === "IFR" || upper === "LIFR") return upper
  return null
}

async function fetchJsonArray(url: string): Promise<unknown[]> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Weather service returned ${res.status}`)
  const data = await res.json()
  if (Array.isArray(data)) return data
  // Some deployments of this API wrap the array in a data/response envelope.
  if (data && typeof data === "object" && Array.isArray((data as Record<string, unknown>).data)) {
    return (data as Record<string, unknown>).data as unknown[]
  }
  return []
}

export async function fetchMetar(icao: string): Promise<MetarSnapshot | null> {
  const rows = await fetchJsonArray(
    `https://aviationweather.gov/api/data/metar?ids=${encodeURIComponent(icao)}&format=json`,
  )
  const row = rows[0]
  if (!row) return null

  return {
    icao: icao.toUpperCase(),
    raw: firstString(row, ["rawOb", "raw_text", "rawText"]),
    flightCategory: normalizeFlightCategory(firstString(row, ["fltcat", "flight_category", "flightCategory"])),
    tempC: firstNumber(row, ["temp", "temp_c"]),
    windDirDeg: firstNumber(row, ["wdir", "wind_dir_degrees"]),
    windSpeedKt: firstNumber(row, ["wspd", "wind_speed_kt"]),
    visibilitySm: firstString(row, ["visib", "visibility_statute_mi"]),
    observedAt: firstString(row, ["reportTime", "observation_time"]),
  }
}

export async function fetchTaf(icao: string): Promise<TafSnapshot | null> {
  const rows = await fetchJsonArray(
    `https://aviationweather.gov/api/data/taf?ids=${encodeURIComponent(icao)}&format=json`,
  )
  const row = rows[0]
  if (!row) return null

  return {
    icao: icao.toUpperCase(),
    raw: firstString(row, ["rawTAF", "raw_text", "rawText"]),
    issuedAt: firstString(row, ["issueTime", "issue_time"]),
  }
}
