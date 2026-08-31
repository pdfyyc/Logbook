import type { Aircraft, Flight, FlightDraft, PilotProfile } from "../types"

export interface RouteShortcut { key: string; from: string; to: string; route: string; uses: number }

const personKey = (value: string) => value.trim().replace(/\s+/g, " ").toLocaleLowerCase()
export const cleanPersonName = (value = "") => value.trim().replace(/\s+/g, " ")

export function normalizeFlightPeople(draft: FlightDraft): FlightDraft {
  const legalPicName = cleanPersonName(draft.legalPicName)
  const primaryCrewName = cleanPersonName(draft.primaryCrewName)
  const instructorName = cleanPersonName(draft.instructorName)
  const crew = new Set([legalPicName, primaryCrewName, instructorName].filter(Boolean).map(personKey))
  const seen = new Set<string>()
  const passengers = (draft.passengers ?? []).map(cleanPersonName).filter((name) => {
    const key = personKey(name)
    if (!key || crew.has(key) || seen.has(key)) return false
    seen.add(key)
    return true
  })
  return { ...draft, legalPicName, primaryCrewName, instructorName, passengers }
}

export function peopleConflicts(draft: FlightDraft): string[] {
  const errors: string[] = []
  const legal = cleanPersonName(draft.legalPicName); const crew = cleanPersonName(draft.primaryCrewName); const instructor = cleanPersonName(draft.instructorName)
  const crewRole = draft.primaryCrewRole === "student" ? "student" : "copilot or crew member"
  if (legal && crew && personKey(legal) === personKey(crew)) errors.push(`${legal} is entered as both pilot-in-command and ${crewRole}. Review the people roles.`)
  if (crew && instructor && personKey(crew) === personKey(instructor)) errors.push(`${crew} is entered as both ${crewRole} and instructor. Review the people roles.`)
  // The same instructor may truthfully also be the legal PIC on a training flight.
  const occupied = new Map([[legal && personKey(legal), "pilot-in-command"], [crew && personKey(crew), crewRole], [instructor && personKey(instructor), "instructor"]].filter((item): item is [string, string] => Boolean(item[0])))
  for (const raw of draft.passengers ?? []) {
    const name = cleanPersonName(raw)
    if (!name) continue
    const prior = occupied.get(personKey(name))
    if (prior) errors.push(`${name} is entered as both ${prior} and a passenger.`)
  }
  return [...new Set(errors)]
}

export function recentAirportSuggestions(flights: Flight[], homeAirport = ""): string[] {
  const values = new Map<string, { value: string; count: number; latest: number }>()
  const add = (raw: string | undefined, index: number, boost = 0) => {
    const value = raw?.trim().toUpperCase()
    if (!value) return
    const current = values.get(value)
    values.set(value, { value, count: (current?.count ?? 0) + 1 + boost, latest: Math.min(current?.latest ?? index, index) })
  }
  add(homeAirport, -1, 1000)
  flights.filter((flight) => !flight.voidedAt).slice().sort((a, b) => b.date.localeCompare(a.date)).forEach((flight, index) => { add(flight.from, index); add(flight.to, index) })
  return [...values.values()].sort((a, b) => b.count - a.count || a.latest - b.latest || a.value.localeCompare(b.value)).map((item) => item.value)
}

export function recentRouteShortcuts(flights: Flight[], limit = 6): RouteShortcut[] {
  const routes = new Map<string, RouteShortcut & { latest: string }>()
  flights.filter((flight) => !flight.voidedAt && flight.from.trim() && flight.to.trim()).forEach((flight) => {
    const from = flight.from.trim().toUpperCase(); const to = flight.to.trim().toUpperCase(); const route = flight.route.trim()
    const key = `${from}|${to}|${route.toLocaleLowerCase()}`
    const current = routes.get(key)
    routes.set(key, { key, from, to, route, uses: (current?.uses ?? 0) + 1, latest: current && current.latest > flight.date ? current.latest : flight.date })
  })
  return [...routes.values()].sort((a, b) => b.uses - a.uses || b.latest.localeCompare(a.latest)).slice(0, limit).map(({ latest: _latest, ...route }) => route)
}

export function duplicateFlightDraft(flight: Flight): FlightDraft {
  const { id: _id, voidedAt: _voidedAt, voidReason: _voidReason, amendments: _amendments, ...draft } = flight
  return { ...draft, date: new Date().toISOString().slice(0, 10) }
}

export function newFlightDefaults(aircraft: Aircraft[], flights: Flight[], profile: PilotProfile, today = new Date().toISOString().slice(0, 10)): Partial<FlightDraft> {
  const active = aircraft.filter((item) => !item.archived)
  const preferred = active.find((item) => item.defaultAircraft) ?? active[0]
  const airports = recentAirportSuggestions(flights, profile.homeAirport)
  return { date: today, aircraftId: preferred?.id ?? "", from: airports[0] ?? "", myRole: profile.defaultRole ?? "" }
}
