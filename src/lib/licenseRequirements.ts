import type { Flight, PilotProfile } from "../types"

export type RequirementUnit = "hours" | "count"

export interface LicenseRequirementItem {
  id: string
  label: string
  required: number
  unit: RequirementUnit
  compute: (flights: Flight[]) => number
  /** Set when the computed value is an approximation of what the flight-log
   *  data model can actually express (see the note on solo/dual splitting
   *  below), rather than a direct sum of a single logged field. */
  approximate?: boolean
  /** Only count flights on or after the date the PPL was issued. Requires a
   *  "ppl-issued" qualification on file; without one the item can't be
   *  computed and is reported as blocked rather than guessed at. */
  sincePpl?: boolean
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

// The flight log records cross-country, night and instrument time as
// per-flight totals, not split by solo/dual — so "solo cross-country" and
// "dual cross-country" are approximated from flights that are purely one or
// the other (solo>0 & dual=0, or the reverse). A single logged flight that
// mixes solo and dual time (e.g. a supervised solo where the instructor got
// out partway through) won't be attributed correctly — log it as two entries
// to avoid that.
//
// Requirements that need the INTERSECTION of two time buckets within one
// flight (e.g. "5 hours night including 2 hours cross-country") are not
// computed at all — the log can't express how much of a flight was both, and
// an estimate would overstate progress. Those go in manualRequirements.
const whollyDual = (f: Flight) => f.dualReceived > 0 && f.solo === 0
const whollySolo = (f: Flight) => f.solo > 0 && f.dualReceived === 0

const soloCrossCountry = (fl: Flight[]) => sum(fl.filter(whollySolo), (f) => f.crossCountry)
const dualCrossCountry = (fl: Flight[]) => sum(fl.filter(whollyDual), (f) => f.crossCountry)
const dualNight = (fl: Flight[]) => sum(fl.filter(whollyDual), (f) => f.night)
const soloNight = (fl: Flight[]) => sum(fl.filter(whollySolo), (f) => f.night)
const soloNightLandings = (fl: Flight[]) => sum(fl.filter(whollySolo), (f) => f.nightLandings)
const picCrossCountry = (fl: Flight[]) => sum(fl.filter((f) => f.pic > 0), (f) => f.crossCountry)

const instrumentTime = (f: Flight) => f.actualInstrument + f.simulatedInstrument

// Standards allow a portion of instrument time as "instrument ground time",
// but the log doesn't separate instrument ground time from the generic
// sim/FTD field, so these count in-aircraft instrument time (actual + hood)
// only. A student relying on ground time should confirm it separately.
const dualInstrument = (fl: Flight[]) => sum(fl.filter((f) => f.dualReceived > 0), instrumentTime)
const allInstrument = (fl: Flight[]) => sum(fl, instrumentTime)

const MAX_SIM_HOURS_TOWARD_PPL_TOTAL = 5

// 421.26(4)(a): of the 45 hours, at most 5 may be flown on an approved
// simulator or flight training device. The flight form requires a total time
// on every entry, so sim/FTD hours are assumed to be included in totalTime;
// this subtracts back off any sim time beyond the 5-hour allowance rather
// than adding it in (which would double-count).
function creditedTotalTime(flights: Flight[]): number {
  const total = sum(flights, (f) => f.totalTime)
  const simExcess = Math.max(0, sum(flights, (f) => f.simTime) - MAX_SIM_HOURS_TOWARD_PPL_TOTAL)
  return Math.max(0, total - simExcess)
}

const hrs = (
  id: string,
  label: string,
  required: number,
  compute: (fl: Flight[]) => number,
  opts: { approximate?: boolean; sincePpl?: boolean } = {},
): LicenseRequirementItem => ({ id, label, required, unit: "hours", compute, ...opts })

// ---------------------------------------------------------------------------
// Templates. Every figure below was read from the Transport Canada Standard
// 421 text supplied by the user and cross-checked against the raw regulation
// wording, not recalled from memory. Standards are amended periodically —
// confirm against the current published text before a licensing action.
// ---------------------------------------------------------------------------

export const RECREATIONAL_PERMIT: LicenseTemplate = {
  id: "rpp-aeroplane",
  name: "Recreational Pilot Permit — Aeroplane",
  citation: "CARs Standard 421.22(4)",
  manualRequirements: [
    "All 25 hours must be flown under the direction and supervision of the holder of a Flight Instructor Rating — Aeroplane, in aeroplanes operating with a Certificate of Airworthiness — 421.22(4)(a).",
  ],
  items: [
    hrs("total", "Total flight training time", 25, (fl) => sum(fl, (f) => f.totalTime)),
    hrs("dual", "Dual instruction time", 15, (fl) => sum(fl, (f) => f.dualReceived)),
    hrs("dual-xc", "Cross-country dual instruction", 2, dualCrossCountry, { approximate: true }),
    hrs("solo", "Solo flight time", 5, (fl) => sum(fl, (f) => f.solo)),
  ],
}

export const PPL_AEROPLANE: LicenseTemplate = {
  id: "ppl-aeroplane",
  name: "Private Pilot Licence — Aeroplane",
  citation: "CARs Standard 421.26(4)",
  manualRequirements: [
    "One solo cross-country flight of at least 150 nautical miles, including 2 full-stop landings at points other than the point of departure — 421.26(4)(b)(ii). The log doesn't record distances, so tick this off yourself.",
    "All 45 hours must be flown under the direction and supervision of the holder of a Flight Instructor Rating — Aeroplane — 421.26(4)(a).",
  ],
  items: [
    hrs("total", "Total flight training time", 45, creditedTotalTime, { approximate: true }),
    hrs("dual", "Dual instruction time", 17, (fl) => sum(fl, (f) => f.dualReceived)),
    hrs("solo", "Solo flight time", 12, (fl) => sum(fl, (f) => f.solo)),
    hrs("dual-xc", "Cross-country dual instruction", 3, dualCrossCountry, { approximate: true }),
    hrs("dual-instrument", "Instrument time (within dual)", 5, dualInstrument, { approximate: true }),
    hrs("solo-xc", "Solo cross-country time", 5, soloCrossCountry, { approximate: true }),
  ],
}

export const NIGHT_RATING: LicenseTemplate = {
  id: "night-rating",
  name: "Night Rating — Aeroplane",
  citation: "CARs Standard 421.42(1)(a)",
  manualRequirements: [
    "Of the 5 hours dual night, at least 2 hours must be cross-country — 421.42(1)(a)(i)(A). The log can't tell how much of a flight was both night and cross-country, so confirm this yourself.",
    "The 10 hours dual instrument time must be in addition to the 10 hours night flight time — 421.42(1)(a)(iii). A flight counted toward one shouldn't be counted toward the other.",
    "Up to 5 of the 10 dual instrument hours may be instrument ground time — 421.42(1)(a)(iii). The log doesn't separate instrument ground time, so it isn't counted here.",
    "A qualifying flight within the 12 months preceding application, under a TC Inspector or a person qualified per 425.21(4) — 421.42(1)(b).",
  ],
  items: [
    hrs("total", "Total pilot flight time", 20, (fl) => sum(fl, (f) => f.totalTime)),
    hrs("night", "Night flight time", 10, (fl) => sum(fl, (f) => f.night)),
    hrs("night-dual", "Dual night flight time", 5, dualNight, { approximate: true }),
    hrs("night-solo", "Solo night flight time", 5, soloNight, { approximate: true }),
    {
      id: "night-solo-landings",
      label: "Solo night takeoffs / circuits / landings",
      required: 10,
      unit: "count",
      compute: soloNightLandings,
      approximate: true,
    },
    hrs("dual-instrument", "Dual instrument time", 10, dualInstrument, { approximate: true }),
  ],
}

export const CPL_AEROPLANE: LicenseTemplate = {
  id: "cpl-aeroplane",
  name: "Commercial Pilot Licence — Aeroplane",
  citation: "CARs Standard 421.30(4)",
  manualRequirements: [
    "A solo cross-country of at least 300 nautical miles total, with full-stop landings at 3 different aerodromes other than the departure point, one of which is at least 250 NM straight-line from departure (150 NM if flown on the island of Newfoundland) — 421.30(4)(a)(ii)(B)(I). The log doesn't record distances.",
    "Of the 5 hours dual night, at least 2 hours must be cross-country — 421.30(4)(a)(ii)(A)(I). The log can't tell how much of a flight was both.",
    "Of the 20 hours instrument in commercial training, at most 10 may be on an approved simulator or synthetic flight training device — 421.30(4)(a)(ii)(A)(III).",
    "The 20 instrument hours must be in addition to the night and cross-country experience — 421.30(4)(a)(ii)(A)(III).",
    "A licence may be issued restricted to daylight flying if the night requirements are incomplete, but the total dual and solo requirements must still be met — 421.30(6).",
  ],
  items: [
    hrs("total", "Total flight time in aeroplanes", 200, (fl) => sum(fl, (f) => f.totalTime)),
    hrs("pic", "Pilot-in-command time", 100, (fl) => sum(fl, (f) => f.pic)),
    hrs("pic-xc", "Cross-country PIC time", 20, picCrossCountry, { approximate: true }),
    hrs("post-ppl-dual", "Dual instruction (after PPL)", 35, (fl) => sum(fl, (f) => f.dualReceived), {
      sincePpl: true,
    }),
    hrs("post-ppl-dual-night", "Dual night (after PPL)", 5, dualNight, {
      sincePpl: true,
      approximate: true,
    }),
    hrs("post-ppl-dual-xc", "Dual cross-country (after PPL)", 5, dualCrossCountry, {
      sincePpl: true,
      approximate: true,
    }),
    hrs("post-ppl-instrument", "Instrument time (after PPL)", 20, dualInstrument, {
      sincePpl: true,
      approximate: true,
    }),
    hrs("post-ppl-solo", "Solo flight time (after PPL)", 30, (fl) => sum(fl, (f) => f.solo), {
      sincePpl: true,
    }),
    hrs("post-ppl-solo-night", "Solo night (after PPL)", 5, soloNight, {
      sincePpl: true,
      approximate: true,
    }),
  ],
}

export const INSTRUMENT_RATING: LicenseTemplate = {
  id: "instrument-rating",
  name: "Instrument Rating — Aeroplane (Groups 1–3)",
  citation: "CARs Standard 421.46(2)(b)",
  manualRequirements: [
    "Of the 50 hours cross-country PIC, at least 10 must be in the appropriate category — 421.46(2)(b)(i).",
    "Of the 40 hours instrument time, at most 20 may be instrument ground time — 421.46(2)(b)(ii). The log doesn't separate instrument ground time, so it isn't counted here.",
    "Within the 40 hours: 5 hours dual instrument from the holder of a flight instructor rating, 5 hours in aeroplanes, and 15 hours dual instrument from a qualified person per 425.21(9) — 421.46(2)(b)(ii)(A)–(C). These sit inside the 40-hour total and may overlap, so they aren't tracked as separate blocks.",
    "One dual cross-country in simulated or actual IMC of at least 100 nautical miles, on an IFR flight plan, including an instrument approach to minima at two different locations — 421.46(2)(b)(ii)(D).",
  ],
  items: [
    hrs("xc-pic", "Cross-country PIC time", 50, picCrossCountry, { approximate: true }),
    hrs("instrument", "Instrument time", 40, allInstrument, { approximate: true }),
  ],
}

export const LICENSE_TEMPLATES: LicenseTemplate[] = [
  RECREATIONAL_PERMIT,
  PPL_AEROPLANE,
  NIGHT_RATING,
  CPL_AEROPLANE,
  INSTRUMENT_RATING,
]

export function getLicenseTemplate(id: string): LicenseTemplate | undefined {
  return LICENSE_TEMPLATES.find((t) => t.id === id)
}

export interface RequirementProgress {
  id: string
  label: string
  have: number
  required: number
  unit: RequirementUnit
  met: boolean
  pct: number
  approximate: boolean
  /** Set when the item couldn't be computed — currently only when it needs a
   *  PPL issue date that isn't on file. */
  blockedReason?: string
}

export interface LicenseProgress {
  template: LicenseTemplate
  items: RequirementProgress[]
  metCount: number
  totalCount: number
}

/** The date the pilot's PPL was issued, from a "ppl-issued" qualification —
 *  used to scope the CPL's post-PPL commercial training requirements. */
export function pplIssueDate(profile: PilotProfile): string | null {
  const issued = profile.qualifications
    .filter((q) => q.kind === "ppl-issued" && q.completedOn)
    .map((q) => q.completedOn)
    .sort()
  return issued[0] ?? null
}

export function computeLicenseProgress(
  template: LicenseTemplate,
  flights: Flight[],
  profile: PilotProfile,
): LicenseProgress {
  const pplDate = pplIssueDate(profile)

  const items: RequirementProgress[] = template.items.map((item) => {
    if (item.sincePpl && !pplDate) {
      return {
        id: item.id,
        label: item.label,
        have: 0,
        required: item.required,
        unit: item.unit,
        met: false,
        pct: 0,
        approximate: Boolean(item.approximate),
        blockedReason: "Add your PPL issue date under Qualifications to track this",
      }
    }

    const scoped = item.sincePpl && pplDate ? flights.filter((f) => f.date >= pplDate) : flights
    const have = item.compute(scoped)
    const met = have >= item.required
    const pct = item.required > 0 ? Math.min(100, Math.round((have / item.required) * 100)) : 100
    return {
      id: item.id,
      label: item.label,
      have,
      required: item.required,
      unit: item.unit,
      met,
      pct,
      approximate: Boolean(item.approximate),
    }
  })

  return {
    template,
    items,
    metCount: items.filter((i) => i.met).length,
    totalCount: items.length,
  }
}
