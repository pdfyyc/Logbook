import { describe, expect, it } from "vitest"
import { migrateAircraftRecords } from "./storage"
import type { Aircraft } from "../types"

describe("aircraft migration", () => {
  it("preserves existing identity while adding local metadata", () => {
    const original: Aircraft = { id: "1", tailNumber: "cgspb", makeModel: "DA40", category: "ASEL", isComplex: false, isHighPerformance: false, isTailwheel: false, isTaa: true, notes: "kept" }
    const [migrated] = migrateAircraftRecords([original], 1)
    expect(migrated).toMatchObject({ id: "1", tailNumber: "C-GSPB", makeModel: "DA40", notes: "kept", recordKind: "aircraft", archived: false })
  })
})
