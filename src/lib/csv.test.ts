// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest"
import type { Aircraft, Flight } from "../types"
import { downloadTextFile, flightsToCsv } from "./csv"

afterEach(() => vi.restoreAllMocks())

it("neutralizes formulas in every exported text position", () => { const aircraft = [{ id: "a", tailNumber: "=REG", makeModel: "@TYPE" }] as Aircraft[]; const flight = { id: "f", aircraftId: "a", date: "2026-01-01", from: "+FROM", to: "-TO", route: "=ROUTE", remarks: "@REMARK", sourceAircraftText: "=SOURCE", totalTime: 1, pic: 1, sic: 0, solo: 0, dualReceived: 0, dualGiven: 0, crossCountry: 0, night: 0, actualInstrument: 0, simulatedInstrument: 0, dayLandings: 1, nightLandings: 0, approaches: 0, holds: 0, simTime: 0 } as Flight; const csv = flightsToCsv([flight], aircraft); expect(csv).toContain("'=REG"); expect(csv).toContain("'+FROM"); expect(csv).toContain("'-TO"); expect(csv).toContain("'=ROUTE"); expect(csv).toContain("'@REMARK"); expect(csv).toContain("'=SOURCE") })

it("attaches recovery downloads before activating them", () => {
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test")
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined)
  const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    expect(this.isConnected).toBe(true)
  })
  downloadTextFile("recovery.json", "{}", "application/json")
  expect(click).toHaveBeenCalledOnce()
  expect(document.querySelector('a[download="recovery.json"]')).toBeNull()
})
