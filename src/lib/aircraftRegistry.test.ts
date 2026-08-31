import { describe, expect, it } from "vitest"
import { isDuplicateRegistration, localAircraftLookupProvider, normalizeRegistration } from "./aircraftRegistry"
import type { Aircraft } from "../types"

const aircraft = (tailNumber: string): Aircraft => ({ id: tailNumber, tailNumber, makeModel: "", category: "ASEL", isComplex: false, isHighPerformance: false, isTailwheel: false, isTaa: false, notes: "" })

describe("registration normalization", () => {
  it.each(["CGSPB", "C-GSPB", "c-gspb", " c g s p b "])("normalizes %s", (value) => expect(normalizeRegistration(value)).toBe("C-GSPB"))
  it("preserves foreign registrations without inventing Canadian formatting", () => expect(normalizeRegistration(" n 123ab ")).toBe("N123AB"))
  it("does not convert ordinary placeholder words into Canadian registrations", () => expect(normalizeRegistration("CREW")).toBe("CREW"))
  it("prevents formatting-variant duplicates", () => expect(isDuplicateRegistration([aircraft("C-GSPB")], "c gspb")).toBe(true))
  it("returns confirmable local type suggestions", async () => expect(await localAircraftLookupProvider.lookup("da40")).toMatchObject({ makeModel: "Diamond DA40", requiresConfirmation: true }))
  it("returns no result instead of fabricating lookup data", async () => expect(await localAircraftLookupProvider.lookup("C-GSPB")).toBeNull())
})
