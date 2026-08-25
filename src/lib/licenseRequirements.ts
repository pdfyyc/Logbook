import type { Flight } from "../types"

export interface LicenseRequirementItem {
  id: string
  label: string
  requiredHours: number
  compute: (flights: Flight[]) => number
  /** Set when the computed value is an approximation of what the flight-log
   *  data model can actually express (see the note on cross-country/instrument
   *  splitting below), rather than a direct sum of a single logged field. */
  approximate?: boolean
}

export interface LicenseTemplate {
  id: string
  name: string
  citation: string
  items: LicenseRequirementItem[]
}

function sum(flights: Flight[], pick: (f: Flight) => number): number {
  return flights.reduce((s, f) => s + pick(f), 0)
}

// The flight log records cross-country and instrument time as per-flight
// totals, not split by solo/dual — so "solo cross-country" and "dual
// cross-country" are approximated from flights that are purely one or the
// other (solo>0 & dual=0, or the reverse). A single logged flight that mixes
// solo and dual time (e.g. a supervised solo where the instructor got out
// partway through) won't be attributed correctly — log it as two entries to
// avoid that.
function soloCrossCountry(flights: Flight[]): number {
  return sum(
    flights.filter((f) => f.solo > 0 && f.dualReceived === 0),
    (f) => f.crossCountry,
  )
}

function dualCrossCountry(flights: Flight[]): number {
  return sum(
    flights.filter((f) => f.dualReceived > 0 && f.solo === 0),
    (f) => f.crossCountry,
  )
}

function dualInstrument(flights: Flight[]): number {
  return sum(
    flights.filter((f) => f.dualReceived > 0),
    (f) => f.actualInstrument + f.simulatedInstrument,
  )
}

// Recalled from memory, not verified against the current Standard 421 text —
// this sandbox couldn't reach any regulatory source to confirm it (same
// issue that produced a wrong IFR-recency citation earlier in this app's
// history, corrected only once the actual CAR 401.05 text was supplied).
// Treat every number here as a planning estimate, not a source of truth for
// a flight test application — confirm with your flight school or the
// current Standard 421 before relying on it.
export const PPL_AEROPLANE: LicenseTemplate = {
  id: "ppl-aeroplane",
  name: "Private Pilot Licence — Aeroplane",
  citation: "CARs Standard 421 — PPL (Aeroplane) minimum experience — UNVERIFIED, see disclaimer",
  items: [
    { id: "total", label: "Total flight time", requiredHours: 45, compute: (fl) => sum(fl, (f) => f.totalTime) },
    { id: "dual", label: "Dual instruction time", requiredHours: 17, compute: (fl) => sum(fl, (f) => f.dualReceived) },
    { id: "solo", label: "Solo flight time", requiredHours: 12, compute: (fl) => sum(fl, (f) => f.solo) },
    {
      id: "dual-xc",
      label: "Cross-country dual instruction",
      requiredHours: 3,
      compute: dualCrossCountry,
      approximate: true,
    },
    {
      id: "dual-instrument",
      label: "Instrument time (dual)",
      requiredHours: 5,
      compute: dualInstrument,
      approximate: true,
    },
    {
      id: "solo-xc",
      label: "Solo cross-country time",
      requiredHours: 5,
      compute: soloCrossCountry,
      approximate: true,
    },
  ],
}

export const LICENSE_TEMPLATES: LicenseTemplate[] = [PPL_AEROPLANE]

export function getLicenseTemplate(id: string): LicenseTemplate | undefined {
  return LICENSE_TEMPLATES.find((t) => t.id === id)
}

export interface RequirementProgress {
  id: string
  label: string
  have: number
  required: number
  met: boolean
  pct: number
  approximate: boolean
}

export interface LicenseProgress {
  template: LicenseTemplate
  items: RequirementProgress[]
  metCount: number
  totalCount: number
}

export function computeLicenseProgress(template: LicenseTemplate, flights: Flight[]): LicenseProgress {
  const items: RequirementProgress[] = template.items.map((item) => {
    const have = item.compute(flights)
    const met = have >= item.requiredHours
    const pct = item.requiredHours > 0 ? Math.min(100, Math.round((have / item.requiredHours) * 100)) : 100
    return { id: item.id, label: item.label, have, required: item.requiredHours, met, pct, approximate: Boolean(item.approximate) }
  })

  return {
    template,
    items,
    metCount: items.filter((i) => i.met).length,
    totalCount: items.length,
  }
}
