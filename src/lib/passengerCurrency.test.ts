import { describe, expect, it } from "vitest"
import type { Aircraft, Flight } from "../types"
import { defaultPilotProfile } from "../types"
import { computeCarsCurrency } from "./calc"

const aircraft = { id: "amel", tailNumber: "C-FXYZ", makeModel: "PA-23", category: "AMEL", recordKind: "aircraft" } as Aircraft
function flight(values: Partial<Flight>): Flight {
  return { id: "f", date: "2026-08-30", aircraftId: "amel", from: "CEN4", to: "CYBW", route: "", totalTime: 1, pic: 1, sic: 0, solo: 0, dualReceived: 0, dualGiven: 0, crossCountry: 0, night: 0, actualInstrument: 0, simulatedInstrument: 0, dayLandings: 0, nightLandings: 0, approaches: 0, holds: 0, simTime: 0, remarks: "", ...values }
}

describe("passenger currency takeoff and landing synchronization", () => {
  it("uses the lower of takeoffs and landings", () => {
    const items = computeCarsCurrency([flight({ dayTakeoffs: 5, dayLandings: 1 })], defaultPilotProfile, new Map([[aircraft.id, aircraft]]), new Date("2026-08-30T12:00:00Z"))
    const day = items.find((item) => item.id === "passenger-day-amel")!
    expect(day.current).toBe(false)
    expect(day.detail).toContain("1 of 5")
    expect(day.fixIt).toContain("4 more")
  })

  it("preserves legacy flights by treating their landing count as an equal takeoff count", () => {
    const items = computeCarsCurrency([flight({ dayLandings: 5 })], defaultPilotProfile, new Map([[aircraft.id, aircraft]]), new Date("2026-08-30T12:00:00Z"))
    expect(items.find((item) => item.id === "passenger-day-amel")?.current).toBe(true)
  })
})
