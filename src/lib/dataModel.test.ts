import { describe, expect, it } from "vitest"
import { legacyV0Aircraft, legacyV0Flights, legacyV0Profile } from "../test-fixtures/legacy-v0"
import { migrateBackup, migrateLegacy, validateDocument } from "./dataModel"
import { JOURNAL_KEY, LAST_GOOD_KEY, ROOT_DOCUMENT_KEY, isExternalRevision, loadLogbookDocument, persistLogbookDocument, restoreLogbookDocument } from "./storage"

class MemoryStorage implements Storage {
  data = new Map<string, string>(); failOn: string | null = null
  get length() { return this.data.size } clear() { this.data.clear() } key(index: number) { return [...this.data.keys()][index] ?? null }
  getItem(key: string) { return this.data.get(key) ?? null } removeItem(key: string) { this.data.delete(key) }
  setItem(key: string, value: string) { if (this.failOn === key) throw new DOMException("full", "QuotaExceededError"); this.data.set(key, value) }
}

describe("root data model and transactional storage", () => {
  it("migrates the complete legacy fixture without losing data", () => { const result = migrateLegacy(legacyV0Aircraft, legacyV0Flights, legacyV0Profile); expect(result.flights[0]).toMatchObject({ remarks: "Preserve me", sourceAircraftText: "c fxyz", passengers: ["Sample Passenger"] }); expect(result.flights[0].amendments).toHaveLength(1); expect(result.profile.qualifications).toHaveLength(1); expect(result.uncertainties.map((item) => item.path)).toContain("flights[0].dayTakeoffs") })
  it("round trips and verifies a root document", () => { const storage = new MemoryStorage(); const original = migrateLegacy(legacyV0Aircraft, legacyV0Flights, legacyV0Profile); const saved = persistLogbookDocument(original, storage); expect(loadLogbookDocument(storage).document.flights).toEqual(saved.flights); expect(storage.getItem(LAST_GOOD_KEY)).toBeTruthy(); expect(storage.getItem(JOURNAL_KEY)).toBeNull() })
  it("refuses invalid, partial, and future backups", () => { expect(() => migrateBackup({})).toThrow(/incomplete/i); expect(() => migrateBackup({ schemaVersion: 99, aircraft: [], flights: [], profile: {} })).toThrow(/future/i); expect(validateDocument({ schemaVersion: 1, aircraft: [], flights: [] }).valid).toBe(false) })
  it("rolls back a failed persistence write", () => { const storage = new MemoryStorage(); const current = persistLogbookDocument(migrateLegacy([], [], legacyV0Profile), storage); const before = storage.getItem(ROOT_DOCUMENT_KEY); storage.failOn = ROOT_DOCUMENT_KEY; expect(() => persistLogbookDocument({ ...current, flights: legacyV0Flights }, storage)).toThrow(/rolled back|full/i); expect(storage.getItem(ROOT_DOCUMENT_KEY)).toBe(before) })
  it("recovers corrupt root data from last known good", () => { const storage = new MemoryStorage(); const document = persistLogbookDocument(migrateLegacy(legacyV0Aircraft, legacyV0Flights, legacyV0Profile), storage); storage.setItem(ROOT_DOCUMENT_KEY, "{"); const loaded = loadLogbookDocument(storage); expect(loaded.recoveredFrom).toBe("last-good"); expect(loaded.document.flights).toEqual(document.flights) })
  it("recovers an interrupted journal when root is corrupt", () => { const storage = new MemoryStorage(); const document = migrateLegacy(legacyV0Aircraft, legacyV0Flights, legacyV0Profile); storage.setItem(ROOT_DOCUMENT_KEY, "bad"); storage.setItem(JOURNAL_KEY, JSON.stringify(document)); expect(loadLogbookDocument(storage).recoveredFrom).toBe("journal") })
  it("restores only after validation and retains recovery data", () => { const storage = new MemoryStorage(); persistLogbookDocument(migrateLegacy([], [], legacyV0Profile), storage); const incoming = migrateLegacy(legacyV0Aircraft, legacyV0Flights, legacyV0Profile); const result = restoreLogbookDocument(incoming, storage); expect(result.document.flights).toHaveLength(1); expect(JSON.parse(result.recoveryBackup).flights).toHaveLength(0) })
  it("detects a different multi-tab revision", () => { expect(isExternalRevision("one", "two")).toBe(true); expect(isExternalRevision("one", "one")).toBe(false) })
})
