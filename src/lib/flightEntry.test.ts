import { describe, expect, it } from "vitest"
import type { Aircraft, Flight } from "../types"
import { suggestedDeparture, suggestedTimes } from "./flightEntry"

const aircraft = [{ id: "a", tailNumber: "C-A", makeModel: "A", category: "ASEL", recordKind: "aircraft" }, { id: "s", tailNumber: "SIM", makeModel: "Sim", category: "Other", recordKind: "simulator" }] as Aircraft[]
const flight = (id: string, aircraftId: string, date: string, to: string) => ({ id, aircraftId, date, to, from: "CEN4", totalTime: 1 } as Flight)

describe("flight entry suggestions", () => {
  it("uses the latest aircraft destination", () => expect(suggestedDeparture([flight("1", "a", "2026-01-01", "CYBW")], aircraft, "CYYC")).toBe("CYBW"))
  it("ignores simulator destinations and falls back to home", () => expect(suggestedDeparture([flight("1", "s", "2026-01-02", "SIM")], aircraft, "cyyc")).toBe("CYYC"))
  it("suggests instructor time", () => expect(suggestedTimes("instructor", 1.2, 0)).toMatchObject({ pic: 1.2, dualGiven: 1.2, dualReceived: 0, sic: 0, dayTime: 1.2 }))
  it("suggests student time without PIC", () => expect(suggestedTimes("student", 1.2, 0)).toMatchObject({ pic: 0, dualReceived: 1.2 }))
  it("suggests PIC and solo-student time", () => { expect(suggestedTimes("pic", 1.2, 0).pic).toBe(1.2); expect(suggestedTimes("solo-student", 1.2, 0).pic).toBe(1.2) })
})
