// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Aircraft, PilotProfile } from "../types"
import { defaultPilotProfile } from "../types"
import { FlightFormModal } from "./FlightFormModal"

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
    fireEvent.click(screen.getByRole("button", { name: "Save flight" })); expect(confirm).toHaveBeenCalled(); expect(onSave).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "Save flight" })); expect(onSave).toHaveBeenCalledOnce()
  })
})
