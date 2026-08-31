import type { FlightDraft } from "../types"

export const MAX_FLIGHT_HOURS = 24
export const HOURS_DECIMALS = 1
const hourKeys = ["totalTime", "dayTime", "pic", "sic", "solo", "dualReceived", "dualGiven", "crossCountry", "night", "actualInstrument", "simulatedInstrument", "simTime"] as const
const countKeys = ["dayTakeoffs", "nightTakeoffs", "dayLandings", "nightLandings", "approaches", "holds"] as const

export function normalizeHours(value: unknown): number | null {
  if (value === "") return 0
  const number = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(number) || number < 0 || number > MAX_FLIGHT_HOURS) return null
  return Number(number.toFixed(HOURS_DECIMALS))
}

export function normalizeCount(value: unknown): number | null {
  if (value === "") return 0
  const number = typeof value === "number" ? value : Number(value)
  return Number.isSafeInteger(number) && number >= 0 && number <= 1000 ? number : null
}

/** Derive the day-flight bucket when older data has no explicit dayTime.
 * Simulator/FTD time is a separate bucket and must not be reported as day
 * flight time. Keep every fallback calculation routed through this helper. */
export function deriveDayTime(
  totalTime: number,
  nightTime: number,
  simulatorTime: number,
): number {
  return Math.max(0, totalTime - nightTime - simulatorTime)
}

export function validateFlightNumbers(flight: Partial<FlightDraft>): string[] {
  const errors: string[] = []
  for (const key of hourKeys) if (normalizeHours(flight[key] ?? 0) === null) errors.push(`${key} must be a finite number from 0 to ${MAX_FLIGHT_HOURS} with at most ${HOURS_DECIMALS} decimal place.`)
  for (const key of countKeys) if (normalizeCount(flight[key] ?? 0) === null) errors.push(`${key} must be a non-negative whole number.`)
  const total = normalizeHours(flight.totalTime ?? 0) ?? 0
  const night = normalizeHours(flight.night ?? 0) ?? 0
  const simulator = normalizeHours(flight.simTime ?? 0) ?? 0
  const day = normalizeHours(flight.dayTime ?? deriveDayTime(total, night, simulator)) ?? 0
  if (Math.abs(day + night + simulator - total) > 0.001) errors.push("Day plus night plus simulator time must equal total recorded time.")
  for (const key of ["pic", "sic", "solo", "dualReceived", "dualGiven", "crossCountry", "actualInstrument", "simulatedInstrument", "simTime"] as const) if ((normalizeHours(flight[key] ?? 0) ?? 0) > total) errors.push(`${key} cannot exceed total flight time.`)
  return [...new Set(errors)]
}
