import type { Aircraft, Flight, FlightDraft } from "../types"
import { deriveDayTime } from "./numericPolicy"

export type ManagedTimeKey = "pic" | "sic" | "dualReceived" | "dualGiven" | "dayTime"

export function suggestedDeparture(flights: Flight[], aircraft: Aircraft[], homeAirport = "") {
  const byId = new Map(aircraft.map((item) => [item.id, item]))
  const latest = flights.filter((flight) => !flight.voidedAt && flight.to && !["simulator", "ftd"].includes(byId.get(flight.aircraftId)?.recordKind ?? "aircraft"))
    .sort((a, b) => b.date.localeCompare(a.date))[0]
  return (latest?.to || homeAirport).trim().toUpperCase()
}

export function suggestedTimes(role: FlightDraft["myRole"], total: number, night: number): Pick<FlightDraft, ManagedTimeKey> {
  const value = Math.max(0, total)
  return {
    pic: role === "pic" || role === "instructor" || role === "solo-student" ? value : 0,
    sic: role === "copilot" ? value : 0,
    dualReceived: role === "student" ? value : 0,
    dualGiven: role === "instructor" ? value : 0,
    dayTime: Math.max(0, Number((value - Math.max(0, night)).toFixed(1))),
  }
}

export function flightWarnings(draft: FlightDraft, aircraft?: Aircraft): string[] {
  const warnings: string[] = []
  if (!draft.aircraftId) warnings.push("Choose an aircraft or simulator.")
  if (!draft.from.trim() || !draft.to.trim()) warnings.push("Enter both departure and destination.")
  if (draft.totalTime <= 0) warnings.push("Enter total flight time.")
  if (draft.myRole === "instructor" && !draft.primaryCrewName?.trim()) warnings.push("Enter the student's name for this instructor flight.")
  if (draft.myRole === "student" && !draft.instructorName?.trim()) warnings.push("Enter the instructor's name for this training flight.")
  if (draft.dualGiven > 0 && draft.myRole !== "instructor") warnings.push("Instructor time is entered, but your role is not Instructor.")
  if (draft.dualGiven > 0 && draft.dualReceived > 0) warnings.push("Dual received and instructor time are both entered; confirm or correct the time breakdown.")
  for (const [label, value] of [["PIC", draft.pic], ["co-pilot", draft.sic], ["dual received", draft.dualReceived], ["instructor", draft.dualGiven], ["instrument", draft.actualInstrument + draft.simulatedInstrument]] as const) if (value > draft.totalTime) warnings.push(`${label} time cannot exceed total flight time.`)
  const dayTime = draft.dayTime ?? deriveDayTime(draft.totalTime, draft.night, draft.simTime)
  if (Math.abs(dayTime + draft.night + draft.simTime - draft.totalTime) > 0.01) warnings.push("Day plus night plus simulator time must equal total recorded time.")
  if (!["simulator", "ftd"].includes(aircraft?.recordKind ?? "aircraft") && draft.simTime > 0) warnings.push("Simulator time cannot be mixed with an aircraft flight.")
  if (["simulator", "ftd"].includes(aircraft?.recordKind ?? "") && draft.totalTime > 0 && draft.simTime !== draft.totalTime) warnings.push("For a simulator or FTD session, simulator time should equal total time.")
  if (draft.myRole === "copilot" && !draft.legalPicName?.trim()) warnings.push("Enter the legal PIC before logging co-pilot time.")
  if (draft.myRole === "copilot" && !draft.copilotCreditConfirmed) warnings.push("Confirm that this aircraft and operation permit the co-pilot time to be credited.")
  return [...new Set(warnings)]
}
