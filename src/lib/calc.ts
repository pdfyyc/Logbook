import type { Flight } from "../types"

export interface Totals {
  totalTime: number
  pic: number
  sic: number
  solo: number
  dualReceived: number
  dualGiven: number
  crossCountry: number
  night: number
  actualInstrument: number
  simulatedInstrument: number
  dayLandings: number
  nightLandings: number
  approaches: number
  flights: number
}

const emptyTotals: Totals = {
  totalTime: 0,
  pic: 0,
  sic: 0,
  solo: 0,
  dualReceived: 0,
  dualGiven: 0,
  crossCountry: 0,
  night: 0,
  actualInstrument: 0,
  simulatedInstrument: 0,
  dayLandings: 0,
  nightLandings: 0,
  approaches: 0,
  flights: 0,
}

export function computeTotals(flights: Flight[]): Totals {
  return flights.reduce<Totals>((acc, f) => {
    acc.totalTime += f.totalTime
    acc.pic += f.pic
    acc.sic += f.sic
    acc.solo += f.solo
    acc.dualReceived += f.dualReceived
    acc.dualGiven += f.dualGiven
    acc.crossCountry += f.crossCountry
    acc.night += f.night
    acc.actualInstrument += f.actualInstrument
    acc.simulatedInstrument += f.simulatedInstrument
    acc.dayLandings += f.dayLandings
    acc.nightLandings += f.nightLandings
    acc.approaches += f.approaches
    acc.flights += 1
    return acc
  }, { ...emptyTotals })
}

function daysAgo(dateIso: string, referenceDate: Date): number {
  const d = new Date(dateIso + "T00:00:00")
  const diffMs = referenceDate.getTime() - d.getTime()
  return diffMs / (1000 * 60 * 60 * 24)
}

export interface CurrencyStatus {
  dayCurrent: boolean
  dayLandingsIn90: number
  nightCurrent: boolean
  nightLandingsIn90: number
  instrumentCurrent: boolean
  approachesIn6mo: number
}

export function computeCurrency(flights: Flight[], now: Date = new Date()): CurrencyStatus {
  let dayLandingsIn90 = 0
  let nightLandingsIn90 = 0
  let approachesIn6mo = 0

  for (const f of flights) {
    const age = daysAgo(f.date, now)
    if (age <= 90) {
      dayLandingsIn90 += f.dayLandings + f.nightLandings
      nightLandingsIn90 += f.nightLandings
    }
    if (age <= 182) {
      approachesIn6mo += f.approaches
    }
  }

  return {
    dayCurrent: dayLandingsIn90 >= 3,
    dayLandingsIn90,
    nightCurrent: nightLandingsIn90 >= 3,
    nightLandingsIn90,
    instrumentCurrent: approachesIn6mo >= 6,
    approachesIn6mo,
  }
}

export function formatHours(hours: number): string {
  return hours.toFixed(1)
}
