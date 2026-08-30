import type { Aircraft, Flight } from "../types"

export type HealthIssueLevel = "warning" | "error"

export interface LogbookHealthIssue {
  id: string
  level: HealthIssueLevel
  title: string
  detail: string
  flightIds: string[]
  suggestion: string
}

const EPSILON = 0.001

function exceeds(value: number, limit: number) {
  return value > limit + EPSILON
}

/**
 * Finds entries that deserve a pilot's review. These are warnings, not a
 * determination that a flight was logged illegally: the app lacks enough
 * context to make that claim.
 */
export function checkLogbookHealth(flights: Flight[], aircraftById: Map<string, Aircraft>): LogbookHealthIssue[] {
  const issues: LogbookHealthIssue[] = []
  const seen = new Map<string, Flight[]>()
  const today = new Date().toISOString().slice(0, 10)

  for (const flight of flights) {
    if (flight.voidedAt) continue
    const aircraft = aircraftById.get(flight.aircraftId)
    const short = (n: number) => n.toFixed(1)

    if (!aircraft) {
      issues.push({
        id: `missing-aircraft-${flight.id}`,
        level: "error",
        title: "Missing aircraft record",
        detail: `${flight.date} refers to an aircraft that is no longer in the fleet list. Restore or identify the aircraft before relying on this entry.`,
        flightIds: [flight.id],
        suggestion: "Choose the correct aircraft record, or restore its archived aircraft entry.",
      })
    }
    if (flight.date > today) {
      issues.push({
        id: `future-date-${flight.id}`,
        level: "warning",
        title: "Future-dated flight",
        detail: `${flight.date} is later than today. Confirm that the date was entered intentionally.`,
        flightIds: [flight.id],
        suggestion: "Change the flight date if it was entered accidentally.",
      })
    }
    if (exceeds(flight.night, flight.totalTime)) {
      issues.push({
        id: `night-total-${flight.id}`,
        level: "error",
        title: "Night time exceeds total time",
        detail: `${flight.date}: ${short(flight.night)}h night is greater than ${short(flight.totalTime)}h total.`,
        flightIds: [flight.id],
        suggestion: "Reduce night time to no more than total time, or correct the total time.",
      })
    }
    const instrument = flight.actualInstrument + flight.simulatedInstrument
    if (exceeds(instrument, flight.totalTime)) {
      issues.push({
        id: `instrument-total-${flight.id}`,
        level: "error",
        title: "Instrument time exceeds total time",
        detail: `${flight.date}: ${short(instrument)}h instrument is greater than ${short(flight.totalTime)}h total.`,
        flightIds: [flight.id],
        suggestion: "Reduce actual or simulated instrument time, or correct the total time.",
      })
    }
    if (exceeds(flight.simTime, flight.totalTime)) {
      issues.push({
        id: `sim-total-${flight.id}`,
        level: "error",
        title: "Simulator time exceeds total time",
        detail: `${flight.date}: ${short(flight.simTime)}h simulator/FTD is greater than ${short(flight.totalTime)}h total.`,
        flightIds: [flight.id],
        suggestion: "For a simulator session, make simulator time equal the session total; otherwise remove simulator time.",
      })
    }
    for (const [key, label, value] of [["pic", "PIC", flight.pic], ["sic", "co-pilot", flight.sic], ["dual-received", "dual received", flight.dualReceived], ["dual-given", "instructor", flight.dualGiven]] as const) {
      if (!exceeds(value, flight.totalTime)) continue
      issues.push({ id: `role-${key}-total-${flight.id}`, level: "error", title: `${label} time exceeds total time`, detail: `${flight.date}: ${short(value)}h ${label} is greater than ${short(flight.totalTime)}h total.`, flightIds: [flight.id], suggestion: `Reduce ${label} time to the amount actually credited, or correct total flight time.` })
    }
    if (flight.dualReceived > 0 && flight.dualGiven > 0) {
      issues.push({ id: `dual-conflict-${flight.id}`, level: "warning", title: "Dual received and instructor time both entered", detail: `${flight.date}: the entry contains both dual received and dual given. This is unusual for one pilot's logbook.`, flightIds: [flight.id], suggestion: "Confirm whether you were receiving or providing instruction and remove the category that does not apply." })
    }
    const duplicateKey = [flight.date, flight.aircraftId, flight.from.trim(), flight.to.trim(), flight.totalTime].join("|")
    const group = seen.get(duplicateKey) ?? []
    group.push(flight)
    seen.set(duplicateKey, group)
  }

  for (const duplicates of seen.values()) {
    if (duplicates.length < 2) continue
    const example = duplicates[0]
    issues.push({
      id: `duplicate-${duplicates.map((f) => f.id).sort().join("-")}`,
      level: "warning",
      title: "Possible duplicate flights",
      detail: `${duplicates.length} active entries share ${example.date}, aircraft, route, and total time. Review them and void any accidental duplicate rather than deleting it.`,
      flightIds: duplicates.map((f) => f.id),
      suggestion: "Open each entry and void only the accidental duplicate; preserve legitimate repeated flights.",
    })
  }

  return issues
}
