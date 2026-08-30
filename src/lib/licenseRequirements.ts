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
  /** Requirements the regulation imposes that can't be computed from logged
   *  hours alone — shown to the student as a manual checklist. */
  manualRequirements: string[]
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

// 421.26(4)(b)(i) allows a maximum of 3 of the 5 instrument hours to be
// "instrument ground time". The log doesn't distinguish instrument ground
// time from the generic sim/FTD field, so this counts in-aircraft instrument
// time only (actual + simulated-in-aircraft, i.e. hood time) — a student
// relying on ground time toward this item should confirm it separately.
function dualInstrument(flights: Flight[]): number {
  return sum(
    flights.filter((f) => f.dualReceived > 0),
    (f) => f.actualInstrument + f.simulatedInstrument,
  )
}

const MAX_SIM_HOURS_TOWARD_TOTAL = 5

// 421.26(4)(a): of the 45 hours, at most 5 may be flown on an approved
// simulator or flight training device. The flight form requires a total time
// on every entry, so sim/FTD hours are assumed to be included in totalTime;
// this subtracts back off any sim time beyond the 5-hour allowance rather
// than adding it in (which would double-count).
function creditedTotalTime(flights: Flight[]): number {
  const total = sum(flights, (f) => f.totalTime)
  const simExcess = Math.max(0, sum(flights, (f) => f.simTime) - MAX_SIM_HOURS_TOWARD_TOTAL)
  return Math.max(0, total - simExcess)
}

// Verified against the Transport Canada Standard 421 text supplied by the
// user — Standard 421.26(4), "Private Pilot Licence — Aeroplanes,
// Requirements: Experience". Still worth confirming against the current
// published standard before a flight test application, since amendments do
// happen (the source document carries entries as recent as 2025).
export const PPL_AEROPLANE: LicenseTemplate = {
  id: "ppl-aeroplane",
  name: "Private Pilot Licence — Aeroplane",
  citation: "CARs Standard 421.26(4)",
  manualRequirements: [
    "One solo cross-country flight of at least 150 nautical miles, including 2 full-stop landings at points other than the point of departure — 421.26(4)(b)(ii). The log doesn't record distances, so tick this off yourself.",
    "All 45 hours must be flown under the direction and supervision of the holder of a Flight Instructor Rating — Aeroplane — 421.26(4)(a).",
  ],
  items: [
    {
      id: "total",
      label: "Total flight training time",
      requiredHours: 45,
      compute: creditedTotalTime,
      approximate: true,
    },
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
      label: "Instrument time (within dual)",
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
