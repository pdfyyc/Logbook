import { describe, expect, it } from "vitest"
import type { Flight } from "../types"
import { duplicateFlightDraft, newFlightDefaults, normalizeFlightPeople, peopleConflicts, recentAirportSuggestions, recentRouteShortcuts } from "./flightEntryUx"

const flight = { id: "f1", date: "2026-08-01", aircraftId: "a", from: " cen4 ", to: "CYBW", route: "DCT", totalTime: 1, dayTime: 1, pic: 1, sic: 0, solo: 0, dualReceived: 0, dualGiven: 0, crossCountry: 0, night: 0, actualInstrument: 0, simulatedInstrument: 0, dayTakeoffs: 1, nightTakeoffs: 0, dayLandings: 1, nightLandings: 0, approaches: 0, holds: 0, simTime: 0, remarks: "", amendments: [{ amendedAt: "x", reason: "x", previous: {} as never }] } as Flight

describe("flight entry UX helpers", () => {
  it("deduplicates airport suggestions by normalized text and ranks home first", () => expect(recentAirportSuggestions([flight, { ...flight, id: "f2", from: "CEN4", to: " cybw " }], " cybw ")).toEqual(["CYBW", "CEN4"]))
  it("creates editable repeated-route shortcuts", () => expect(recentRouteShortcuts([flight, { ...flight, id: "f2" }])[0]).toMatchObject({ from: "CEN4", to: "CYBW", route: "DCT", uses: 2 }))
  it("trims people and removes duplicate passengers without changing display casing", () => expect(normalizeFlightPeople({ ...flight, legalPicName: " Test  Pilot ", passengers: [" Sample Person ", "sample person", "test pilot"] })).toMatchObject({ legalPicName: "Test Pilot", passengers: ["Sample Person"] }))
  it("reports crew and passenger role contradictions", () => expect(peopleConflicts({ ...flight, legalPicName: "Test Pilot", passengers: [" test pilot "] })[0]).toMatch(/passenger/i))
  it("duplicates with a new-entry date and no identity or amendment metadata", () => { const draft = duplicateFlightDraft(flight); expect(draft).not.toHaveProperty("id"); expect(draft).not.toHaveProperty("amendments"); expect(draft.route).toBe("DCT") })
  it("uses saved defaults only for construction of a genuinely new entry", () => expect(newFlightDefaults([{ id: "a", defaultAircraft: true } as never], [flight], { homeAirport: "cybw", defaultRole: "student" } as never, "2026-08-30")).toEqual(expect.objectContaining({ date: "2026-08-30", aircraftId: "a", from: "CYBW", myRole: "student" })))
})
