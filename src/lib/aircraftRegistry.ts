import type { Aircraft, AircraftCategory } from "../types"

export function normalizeRegistration(value: string): string {
  const compact = value.trim().toUpperCase().replace(/\s+/g, "").replace(/-/g, "")
  return /^C[A-Z]{3,5}$/.test(compact) ? `C-${compact.slice(1)}` : compact
}

export function isDuplicateRegistration(aircraft: Aircraft[], registration: string, exceptId?: string) {
  const normalized = normalizeRegistration(registration)
  return aircraft.some((a) => a.id !== exceptId && normalizeRegistration(a.tailNumber) === normalized)
}

export interface AircraftSuggestion { makeModel: string; category: AircraftCategory; icaoType?: string }

export interface AircraftLookupResult extends AircraftSuggestion {
  registration?: string
  sourceLabel: string
  requiresConfirmation: true
}

export interface AircraftLookupProvider {
  id: string
  lookup(query: string): Promise<AircraftLookupResult | null>
}

export interface SharedAircraftProvider {
  id: string
  listSharedAircraft(): Promise<Aircraft[]>
}

// Local suggestions only. They are never an authoritative registration lookup.
const TYPE_SUGGESTIONS: Record<string, AircraftSuggestion> = {
  DA40: { makeModel: "Diamond DA40", category: "ASEL", icaoType: "DA40" },
  C172: { makeModel: "Cessna 172", category: "ASEL", icaoType: "C172" },
  PA28: { makeModel: "Piper PA-28", category: "ASEL", icaoType: "PA28" },
}

export function suggestAircraft(value: string): AircraftSuggestion | null {
  return TYPE_SUGGESTIONS[value.trim().toUpperCase()] ?? null
}

export const localAircraftLookupProvider: AircraftLookupProvider = {
  id: "local-type-suggestions",
  async lookup(query) {
    const suggestion = suggestAircraft(query)
    return suggestion ? { ...suggestion, sourceLabel: "Local type suggestion", requiresConfirmation: true } : null
  },
}
