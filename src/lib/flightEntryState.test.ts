import { describe, expect, it } from "vitest"
import type { FlightDraft } from "../types"
import { createFlightEntryState, flightEntryReducer } from "./flightEntryState"

const draft = (role: FlightDraft["myRole"] = "instructor"): FlightDraft => ({ date: "2026-08-30", aircraftId: "a", from: "CEN4", to: "CYBW", route: "", totalTime: 0, dayTime: 0, pic: 0, sic: 0, solo: 0, dualReceived: 0, dualGiven: 0, crossCountry: 0, night: 0, actualInstrument: 0, simulatedInstrument: 0, dayTakeoffs: 1, nightTakeoffs: 0, dayLandings: 1, nightLandings: 0, approaches: 0, holds: 0, simTime: 0, remarks: "", myRole: role })
const total = (role: FlightDraft["myRole"]) => flightEntryReducer(createFlightEntryState(draft(role)), { type: "total", value: "1.2", device: false }).draft

describe("deterministic flight-entry state", () => {
  it("calculates instructor, student, PIC, and solo roles", () => { expect(total("instructor")).toMatchObject({ pic: 1.2, dualGiven: 1.2, dayTime: 1.2 }); expect(total("student")).toMatchObject({ pic: 0, dualReceived: 1.2 }); expect(total("pic").pic).toBe(1.2); expect(total("solo-student").pic).toBe(1.2) })
  it("never overwrites a manual value when total or role changes", () => { let state = createFlightEntryState(draft("instructor")); state = flightEntryReducer(state, { type: "number", key: "pic", value: "0.7" }); state = flightEntryReducer(state, { type: "total", value: "1.5", device: false }); state = flightEntryReducer(state, { type: "role", role: "pic" }); expect(state.draft.pic).toBe(0.7) })
  it("updates automatic day when night changes", () => { let state = flightEntryReducer(createFlightEntryState(draft("pic")), { type: "total", value: "1.2", device: false }); state = flightEntryReducer(state, { type: "number", key: "night", value: ".3" }); expect(state.draft.dayTime).toBe(.9) })
  it("resets manual values to role suggestions", () => { let state = flightEntryReducer(createFlightEntryState(draft("student")), { type: "total", value: "1.2", device: false }); state = flightEntryReducer(state, { type: "number", key: "pic", value: ".4" }); state = flightEntryReducer(state, { type: "reset-times" }); expect(state.draft).toMatchObject({ pic: 0, dualReceived: 1.2 }) })
  it("does not recalculate an existing or imported record", () => { const historical = { ...draft("instructor"), totalTime: 1.2, pic: .4, dualGiven: .6 }; const state = flightEntryReducer(createFlightEntryState(historical, true), { type: "total", value: "1.5", device: false }); expect(state.draft).toMatchObject({ pic: .4, dualGiven: .6 }) })
  it("keeps device time separate and removes aircraft movements", () => { const state = flightEntryReducer(createFlightEntryState(draft("observer")), { type: "total", value: "1.3", device: true }); expect(state.draft).toMatchObject({ totalTime: 1.3, simTime: 1.3, dayTime: 0, dayLandings: 0, dayTakeoffs: 0 }) })
})
