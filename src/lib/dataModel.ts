import type { Aircraft, Flight, FlightDraft, PilotProfile } from "../types"
import { defaultPilotProfile } from "../types"
import { normalizeRegistration } from "./aircraftRegistry"
import { validateFlightNumbers } from "./numericPolicy"

export const ROOT_SCHEMA_VERSION = 1
export interface MigrationUncertainty { path: string; reason: string; originalValue?: unknown }
export interface LogbookDocument { schemaVersion: 1; savedAt: string; revision: string; aircraft: Aircraft[]; flights: Flight[]; profile: PilotProfile; draft?: { value: FlightDraft; updatedAt: string }; uncertainties: MigrationUncertainty[] }
export interface ValidationResult { valid: boolean; errors: string[]; warnings: string[] }

const object = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value)
export function validateDocument(value: unknown): ValidationResult {
  const errors: string[] = []; const warnings: string[] = []
  if (!object(value)) return { valid: false, errors: ["Backup root must be an object."], warnings }
  const version = value.schemaVersion
  if (typeof version !== "number") errors.push("Backup has no root schema version.")
  else if (version > ROOT_SCHEMA_VERSION) errors.push(`Backup schema ${version} is newer than supported schema ${ROOT_SCHEMA_VERSION}.`)
  if (!Array.isArray(value.aircraft)) errors.push("Aircraft must be an array.")
  if (!Array.isArray(value.flights)) errors.push("Flights must be an array.")
  if (!object(value.profile)) errors.push("Profile must be present.")
  if (object(value.profile) && (typeof value.profile.pilotName !== "string" || !Array.isArray(value.profile.qualifications) || !Array.isArray(value.profile.trackedLicenseGoals))) errors.push("Profile fields are incomplete.")
  const aircraftIds = new Set<string>()
  if (Array.isArray(value.flights)) value.flights.forEach((flight, index) => {
    if (!object(flight) || typeof flight.id !== "string" || typeof flight.date !== "string" || typeof flight.aircraftId !== "string") errors.push(`Flight ${index + 1} is incomplete.`)
    else validateFlightNumbers(flight).forEach((error) => errors.push(`Flight ${index + 1}: ${error}`))
  })
  if (Array.isArray(value.aircraft)) value.aircraft.forEach((aircraft, index) => { if (!object(aircraft) || typeof aircraft.id !== "string" || typeof aircraft.tailNumber !== "string" || typeof aircraft.makeModel !== "string") errors.push(`Aircraft ${index + 1} is incomplete.`); else if (aircraftIds.has(aircraft.id)) errors.push(`Aircraft ${index + 1} has a duplicate ID.`); else aircraftIds.add(aircraft.id) })
  const flightIds = new Set<string>()
  if (Array.isArray(value.flights)) value.flights.forEach((flight, index) => { if (!object(flight) || typeof flight.id !== "string") return; if (flightIds.has(flight.id)) errors.push(`Flight ${index + 1} has a duplicate ID.`); else flightIds.add(flight.id); if (typeof flight.aircraftId === "string" && !aircraftIds.has(flight.aircraftId)) warnings.push(`Flight ${index + 1} refers to a missing aircraft; the original reference was preserved.`) })
  if (object(value.draft) && (typeof value.draft.updatedAt !== "string" || !object(value.draft.value))) errors.push("Draft metadata is invalid.")
  return { valid: errors.length === 0, errors, warnings }
}

export function migrateLegacy(aircraft: Aircraft[], flights: Flight[], profile: Partial<PilotProfile>, draft?: FlightDraft): LogbookDocument {
  const uncertainties: MigrationUncertainty[] = []
  const migratedFlights = flights.map((flight, index) => {
    const next = { ...flight }
    if (next.dayTime === undefined) { next.dayTime = Math.max(0, Number((next.totalTime - next.night).toFixed(1))); uncertainties.push({ path: `flights[${index}].dayTime`, reason: "Inferred as total minus night because legacy records did not store day time." }) }
    if (next.dayTakeoffs === undefined) { next.dayTakeoffs = next.dayLandings; uncertainties.push({ path: `flights[${index}].dayTakeoffs`, reason: "Inferred from legacy day landings; original takeoff count was not stored." }) }
    if (next.nightTakeoffs === undefined) { next.nightTakeoffs = next.nightLandings; uncertainties.push({ path: `flights[${index}].nightTakeoffs`, reason: "Inferred from legacy night landings; original takeoff count was not stored." }) }
    return next
  })
  return { schemaVersion: 1, savedAt: new Date().toISOString(), revision: crypto.randomUUID(), aircraft: aircraft.map((item) => ({ ...item, tailNumber: normalizeRegistration(item.tailNumber), recordKind: item.recordKind ?? "aircraft", archived: item.archived ?? false })), flights: migratedFlights, profile: { ...defaultPilotProfile, ...profile, qualifications: profile.qualifications ?? [], trackedLicenseGoals: profile.trackedLicenseGoals ?? [] }, draft: draft ? { value: draft, updatedAt: new Date().toISOString() } : undefined, uncertainties }
}

export function migrateBackup(value: unknown): LogbookDocument {
  if (!object(value)) throw new Error("Backup root must be an object.")
  if (typeof value.schemaVersion === "number") {
    if (value.schemaVersion > ROOT_SCHEMA_VERSION) throw new Error(`This backup uses unsupported future schema ${value.schemaVersion}.`)
    const result = validateDocument(value); if (!result.valid) throw new Error(result.errors.join(" "))
    return value as unknown as LogbookDocument
  }
  if (Array.isArray(value.aircraft) && Array.isArray(value.flights)) return migrateLegacy(value.aircraft as Aircraft[], value.flights as Flight[], object(value.profile) ? value.profile as Partial<PilotProfile> : {})
  throw new Error("Backup is incomplete: aircraft and flights arrays are required.")
}
