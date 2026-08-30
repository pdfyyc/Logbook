import { describe, expect, it } from "vitest"
import type { Flight } from "../types"
import { checkLogbookHealth } from "./healthCheck"

const flight = { id: "f", date: "2026-08-30", aircraftId: "a", from: "CEN4", to: "CYBW", route: "", totalTime: 1.4, pic: 1.4, sic: 0, solo: 0, dualReceived: 0, dualGiven: 1.4, crossCountry: 0, night: 0, actualInstrument: 0, simulatedInstrument: 0, dayLandings: 1, nightLandings: 0, approaches: 0, holds: 0, simTime: 0, remarks: "" } as Flight

describe("logbook health role-time checks", () => {
  it("does not add overlapping PIC and instructor time", () => expect(checkLogbookHealth([flight], new Map([["a", {} as never]]))).toEqual([]))
  it("flags an individual credited category over total", () => expect(checkLogbookHealth([{ ...flight, pic: 1.5 }], new Map([["a", {} as never]])).some((issue) => issue.id.startsWith("role-pic-total"))).toBe(true))
  it("flags dual received and dual given together", () => expect(checkLogbookHealth([{ ...flight, dualReceived: 1 }], new Map([["a", {} as never]])).some((issue) => issue.id.startsWith("dual-conflict"))).toBe(true))
})
