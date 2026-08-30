import type { FlightDraft } from "../types"
import { normalizeCount, normalizeHours } from "./numericPolicy"
import { suggestedTimes, type ManagedTimeKey } from "./flightEntry"

export type ManagedKey = ManagedTimeKey | "night" | "simTime"
export interface FlightEntryState { draft: FlightDraft; mode: Record<ManagedKey, "automatic" | "manual">; historical: boolean }
export type FlightEntryAction =
  | { type: "field"; key: keyof FlightDraft; value: FlightDraft[keyof FlightDraft] }
  | { type: "number"; key: keyof FlightDraft; value: unknown; count?: boolean }
  | { type: "total"; value: unknown; device: boolean }
  | { type: "role"; role: FlightDraft["myRole"] }
  | { type: "aircraft-kind"; kind: "aircraft" | "simulator" | "ftd" | "historical" }
  | { type: "reset-times" }
  | { type: "replace"; draft: FlightDraft; preserveModes?: boolean }

const managed: ManagedKey[] = ["pic", "sic", "dualReceived", "dualGiven", "dayTime", "night", "simTime"]
export function createFlightEntryState(draft: FlightDraft, historical = false): FlightEntryState { return { draft, historical, mode: Object.fromEntries(managed.map((key) => [key, historical ? "manual" : "automatic"])) as FlightEntryState["mode"] } }

function recalculate(state: FlightEntryState, draft: FlightDraft, reset = false): FlightDraft {
  if (state.historical && !reset) return draft
  const values = suggestedTimes(draft.myRole, draft.totalTime, draft.night)
  const next = { ...draft }
  for (const key of ["pic", "sic", "dualReceived", "dualGiven", "dayTime"] as const) if (reset || state.mode[key] === "automatic") next[key] = values[key] ?? 0
  return next
}

export function flightEntryReducer(state: FlightEntryState, action: FlightEntryAction): FlightEntryState {
  if (action.type === "field") return { ...state, draft: { ...state.draft, [action.key]: action.value } }
  if (action.type === "replace") return { ...state, draft: action.draft, mode: action.preserveModes ? state.mode : createFlightEntryState(action.draft, state.historical).mode }
  if (action.type === "number") {
    const value = action.count ? normalizeCount(action.value) : normalizeHours(action.value); if (value === null) return state
    const mode = managed.includes(action.key as ManagedKey) ? { ...state.mode, [action.key]: "manual" as const } : state.mode
    let draft = { ...state.draft, [action.key]: value }
    if (action.key === "night" && mode.dayTime === "automatic") draft.dayTime = Math.max(0, Number((draft.totalTime - value).toFixed(1)))
    return { ...state, draft, mode }
  }
  if (action.type === "total") {
    const total = normalizeHours(action.value); if (total === null) return state
    let draft = { ...state.draft, totalTime: total }
    if (action.device) { if (state.mode.simTime === "automatic") draft.simTime = total; if (state.mode.dayTime === "automatic") draft.dayTime = 0; draft.dayTakeoffs = 0; draft.nightTakeoffs = 0; draft.dayLandings = 0; draft.nightLandings = 0 }
    else draft = recalculate(state, draft)
    return { ...state, draft }
  }
  if (action.type === "role") return { ...state, draft: recalculate(state, { ...state.draft, myRole: action.role }) }
  if (action.type === "aircraft-kind") {
    const device = action.kind === "simulator" || action.kind === "ftd"
    const draft = device ? { ...state.draft, simTime: state.mode.simTime === "automatic" ? state.draft.totalTime : state.draft.simTime, dayTime: state.mode.dayTime === "automatic" ? 0 : state.draft.dayTime, dayTakeoffs: 0, nightTakeoffs: 0, dayLandings: 0, nightLandings: 0 } : state.draft
    return { ...state, draft }
  }
  const mode = Object.fromEntries(managed.map((key) => [key, "automatic"])) as FlightEntryState["mode"]
  return { ...state, historical: false, mode, draft: recalculate({ ...state, historical: false, mode }, state.draft, true) }
}
