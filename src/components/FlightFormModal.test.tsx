// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Aircraft, Flight, FlightDraft, PilotProfile } from "../types"
import { defaultPilotProfile } from "../types"
import { FlightFormModal } from "./FlightFormModal"
import { migrateLegacy } from "../lib/dataModel"
import { ROOT_DOCUMENT_KEY } from "../lib/storage"

const aircraft = [{ id: "a", tailNumber: "C-GSPB", makeModel: "DA40", category: "ASEL", recordKind: "aircraft", isComplex: false, isHighPerformance: false, isTailwheel: false, isTaa: true, notes: "" }] as Aircraft[]
const profile: PilotProfile = { ...defaultPilotProfile, pilotName: "Test Pilot", defaultRole: "instructor", frequentStudents: ["Training Student"] }

describe("FlightFormModal automatic and manual times", () => {
  beforeEach(() => localStorage.clear())
  afterEach(cleanup)
  it("updates instructor fields through the rendered form without repeated typing", () => {
    render(<FlightFormModal aircraft={aircraft} flights={[]} profile={profile} onSave={vi.fn()} onClose={vi.fn()} onAddAircraft={vi.fn()}/>)
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "CEN4" } }); fireEvent.change(screen.getByLabelText("To"), { target: { value: "CYBW" } })
    fireEvent.change(screen.getByLabelText("Total time (hrs)"), { target: { value: "1.2" } }); fireEvent.click(screen.getByRole("button", { name: /Review time breakdown/i }))
    expect((screen.getByLabelText("PIC") as HTMLInputElement).value).toBe("1.2"); expect((screen.getByLabelText("Dual given") as HTMLInputElement).value).toBe("1.2"); expect((screen.getByLabelText("Day") as HTMLInputElement).value).toBe("1.2")
  })
  it("does not overwrite a manually corrected PIC value", () => {
    render(<FlightFormModal aircraft={aircraft} flights={[]} profile={profile} onSave={vi.fn()} onClose={vi.fn()} onAddAircraft={vi.fn()}/>)
    fireEvent.change(screen.getByLabelText("Total time (hrs)"), { target: { value: "1.2" } }); fireEvent.click(screen.getByRole("button", { name: /Review time breakdown/i })); fireEvent.change(screen.getByLabelText("PIC"), { target: { value: ".7" } }); fireEvent.change(screen.getByLabelText("Total time (hrs)"), { target: { value: "1.5" } })
    expect(Number((screen.getByLabelText("PIC") as HTMLInputElement).value)).toBe(0.7); expect((screen.getByLabelText("Dual given") as HTMLInputElement).value).toBe("1.5")
  })
  it("warns before a possible duplicate and allows explicit save anyway", () => {
    const existing = { ...({ date: "2026-08-30", aircraftId: "a", from: "CEN4", to: "CYBW", route: "", totalTime: 1.2, dayTime: 1.2, pic: 1.2, sic: 0, solo: 0, dualReceived: 0, dualGiven: 0, crossCountry: 0, night: 0, actualInstrument: 0, simulatedInstrument: 0, dayTakeoffs: 1, nightTakeoffs: 0, dayLandings: 1, nightLandings: 0, approaches: 0, holds: 0, simTime: 0, remarks: "", myRole: "pic", primaryCrewName: "" } as const), id: "existing" }
    const onSave = vi.fn(); const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true)
    render(<FlightFormModal aircraft={aircraft} flights={[existing]} profile={profile} initialDraft={existing} onSave={onSave} onClose={vi.fn()} onAddAircraft={vi.fn()}/>)
    fireEvent.click(screen.getByRole("button", { name: "Save duplicate" })); expect(confirm).toHaveBeenCalled(); expect(onSave).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "Save duplicate" })); expect(onSave).toHaveBeenCalledOnce()
  })
  it("offers an explicit resume or discard choice for a saved draft", () => {
    const saved = { date: "2026-08-20", aircraftId: "a", from: "CEN4", to: "CYBW", route: "DCT", totalTime: 1.1, dayTime: 1.1, pic: 1.1, sic: 0, solo: 0, dualReceived: 0, dualGiven: 1.1, crossCountry: 0, night: 0, actualInstrument: 0, simulatedInstrument: 0, dayTakeoffs: 1, nightTakeoffs: 0, dayLandings: 1, nightLandings: 0, approaches: 0, holds: 0, simTime: 0, remarks: "Recover me", myRole: "instructor", legalPicName: "Test Pilot", primaryCrewName: "Training Student", primaryCrewRole: "student", instructorName: "Test Pilot", passengers: [] } as FlightDraft
    const document = migrateLegacy(aircraft, [], profile, saved); localStorage.setItem(ROOT_DOCUMENT_KEY, JSON.stringify(document))
    render(<FlightFormModal aircraft={aircraft} flights={[]} profile={profile} onSave={vi.fn()} onClose={vi.fn()} onAddAircraft={vi.fn()}/>); expect(screen.getByText(/Recoverable unfinished flight found/)).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Resume draft" })); expect((screen.getByLabelText("Remarks") as HTMLInputElement).value).toBe("Recover me")
  })
  it("deliberately discards a recoverable draft", () => {
    const saved = { date: "2026-08-20", aircraftId: "a", from: "CEN4", to: "CYBW", route: "", totalTime: 1, dayTime: 1, pic: 1, sic: 0, solo: 0, dualReceived: 0, dualGiven: 1, crossCountry: 0, night: 0, actualInstrument: 0, simulatedInstrument: 0, dayTakeoffs: 1, nightTakeoffs: 0, dayLandings: 1, nightLandings: 0, approaches: 0, holds: 0, simTime: 0, remarks: "Discard me", myRole: "instructor", legalPicName: "Test Pilot", primaryCrewName: "Training Student", primaryCrewRole: "student", instructorName: "Test Pilot", passengers: [] } as FlightDraft
    localStorage.setItem(ROOT_DOCUMENT_KEY, JSON.stringify(migrateLegacy(aircraft, [], profile, saved)))
    render(<FlightFormModal aircraft={aircraft} flights={[]} profile={profile} onSave={vi.fn()} onClose={vi.fn()} onAddAircraft={vi.fn()}/>); fireEvent.click(screen.getByRole("button", { name: "Discard saved draft" })); expect(screen.queryByText(/Recoverable unfinished flight found/)).toBeNull(); expect((screen.getByLabelText("Remarks") as HTMLInputElement).value).toBe("")
  })
  it("does not reapply new profile defaults while editing and preserves hidden fields", () => {
    const existing = { id: "edit", date: "2026-08-20", aircraftId: "a", from: "CEN4", to: "CYBW", route: "DCT", totalTime: 1.1, dayTime: 1, pic: 0, sic: 0, solo: 0, dualReceived: 1.1, dualGiven: 0, crossCountry: .5, night: .1, actualInstrument: .2, simulatedInstrument: 0, dayTakeoffs: 1, nightTakeoffs: 0, dayLandings: 1, nightLandings: 0, approaches: 1, holds: 0, simTime: 0, remarks: "Stored", myRole: "student", legalPicName: "Stored Instructor", primaryCrewName: "Stored Student", primaryCrewRole: "student", instructorName: "Stored Instructor", passengers: [] } as Flight
    const onSave = vi.fn(); render(<FlightFormModal aircraft={aircraft} flights={[]} profile={profile} initial={existing} onSave={onSave} onClose={vi.fn()} onAddAircraft={vi.fn()}/>)
    expect(screen.getByRole("button", { name: "Student" }).className).toContain("accent"); expect((screen.getByLabelText("Instructor") as HTMLInputElement).value).toBe("Stored Instructor")
    fireEvent.change(screen.getByLabelText("Reason for amendment"), { target: { value: "Verified correction" } }); fireEvent.click(screen.getByRole("button", { name: "Save amendment" })); expect(onSave.mock.calls[0][0]).toMatchObject({ crossCountry: .5, actualInstrument: .2, approaches: 1 })
  })
  it("prevents repeated save clicks from creating two entries", () => {
    const onSave = vi.fn(); render(<FlightFormModal aircraft={aircraft} flights={[]} profile={profile} initialDraft={{ date: "2026-08-30", aircraftId: "a", from: "CEN4", to: "CYBW", route: "", totalTime: 1, dayTime: 1, pic: 1, sic: 0, solo: 0, dualReceived: 0, dualGiven: 0, crossCountry: 0, night: 0, actualInstrument: 0, simulatedInstrument: 0, dayTakeoffs: 1, nightTakeoffs: 0, dayLandings: 1, nightLandings: 0, approaches: 0, holds: 0, simTime: 0, remarks: "", myRole: "pic", legalPicName: "Test Pilot", primaryCrewName: "", primaryCrewRole: "", instructorName: "", passengers: [] }} onSave={onSave} onClose={vi.fn()} onAddAircraft={vi.fn()}/>)
    const save = screen.getByRole("button", { name: "Save duplicate" }); fireEvent.click(save); fireEvent.click(save); expect(onSave).toHaveBeenCalledOnce()
  })
  it("shows the selected registration and type and preserves historical source text", () => {
    const historical = { ...aircraft[0], id: "history", tailNumber: "Historical aircraft", makeModel: "PA-28", recordKind: "historical" } as Aircraft
    const onSave = vi.fn(); render(<FlightFormModal aircraft={[...aircraft, historical]} flights={[]} profile={{ ...profile, defaultRole: "pic" }} initialDraft={{ date: "2026-08-30", aircraftId: "history", from: "CEN4", to: "CYBW", route: "", totalTime: 1, dayTime: 1, pic: 1, sic: 0, solo: 0, dualReceived: 0, dualGiven: 0, crossCountry: 0, night: 0, actualInstrument: 0, simulatedInstrument: 0, dayTakeoffs: 1, nightTakeoffs: 0, dayLandings: 1, nightLandings: 0, approaches: 0, holds: 0, simTime: 0, remarks: "", myRole: "pic", legalPicName: "Test Pilot", primaryCrewName: "", primaryCrewRole: "", instructorName: "", passengers: [], sourceAircraftText: "Original mark" }} onSave={onSave} onClose={vi.fn()} onAddAircraft={vi.fn()}/>)
    expect(screen.getAllByText(/Historical aircraft · PA-28/).length).toBeGreaterThan(0); fireEvent.change(screen.getByLabelText("Original aircraft text"), { target: { value: "C FHIS / PA28" } }); fireEvent.click(screen.getByRole("button", { name: "Save duplicate" })); expect(onSave.mock.calls[0][0].sourceAircraftText).toBe("C FHIS / PA28")
  })
  it("visibly focuses warning-only blockers after a failed save attempt", async () => {
    const onSave = vi.fn()
    render(<FlightFormModal aircraft={aircraft} flights={[]} profile={profile} initialDraft={{ date: "2026-08-30", aircraftId: "a", from: "CEN4", to: "CYBW", route: "", totalTime: 1, dayTime: 1, pic: 1, sic: 0, solo: 0, dualReceived: .5, dualGiven: .5, crossCountry: 0, night: 0, actualInstrument: 0, simulatedInstrument: 0, dayTakeoffs: 1, nightTakeoffs: 0, dayLandings: 1, nightLandings: 0, approaches: 0, holds: 0, simTime: 0, remarks: "", myRole: "instructor", legalPicName: "Test Pilot", primaryCrewName: "Training Student", primaryCrewRole: "student", instructorName: "Test Pilot", passengers: [] }} onSave={onSave} onClose={vi.fn()} onAddAircraft={vi.fn()}/>)
    fireEvent.click(screen.getByRole("button", { name: "Save duplicate" }))
    const alert = screen.getByRole("alert")
    expect(alert.textContent).toMatch(/Flight not saved — resolve these items/i)
    await waitFor(() => expect(document.activeElement).toBe(alert))
    expect(onSave).not.toHaveBeenCalled()
  })
})
