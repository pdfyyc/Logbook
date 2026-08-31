// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react"
import { expect, it, vi } from "vitest"
import type { Aircraft, Flight } from "../types"
import { LogbookHealthCheck } from "./LogbookHealthCheck"

it("opens the exact affected flight from a health warning", () => {
  const flight = { id: "affected", date: "bad-date", aircraftId: "a", from: "", to: "CYBW", totalTime: 1, pic: 1, sic: 0, solo: 0, dualReceived: 0, dualGiven: 0, crossCountry: 0, night: 0, actualInstrument: 0, simulatedInstrument: 0, dayLandings: 1, nightLandings: 0, approaches: 0, holds: 0, simTime: 0, route: "", remarks: "" } as Flight
  const aircraft = { id: "a", tailNumber: "C-FXYZ", makeModel: "Test aircraft", recordKind: "aircraft" } as Aircraft
  const review = vi.fn(); render(<LogbookHealthCheck flights={[flight]} aircraftById={new Map([["a", aircraft]])} onReviewFlight={review}/>)
  fireEvent.click(screen.getAllByRole("button", { name: "Review flight" })[0]); expect(review.mock.calls[0][0].id).toBe("affected")
})
