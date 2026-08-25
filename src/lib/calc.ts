import type { Flight, PilotProfile, Qualification } from "../types"

export interface Totals {
  totalTime: number
  pic: number
  sic: number
  solo: number
  dualReceived: number
  dualGiven: number
  crossCountry: number
  night: number
  actualInstrument: number
  simulatedInstrument: number
  dayLandings: number
  nightLandings: number
  approaches: number
  flights: number
}

const emptyTotals: Totals = {
  totalTime: 0,
  pic: 0,
  sic: 0,
  solo: 0,
  dualReceived: 0,
  dualGiven: 0,
  crossCountry: 0,
  night: 0,
  actualInstrument: 0,
  simulatedInstrument: 0,
  dayLandings: 0,
  nightLandings: 0,
  approaches: 0,
  flights: 0,
}

export function computeTotals(flights: Flight[]): Totals {
  return flights.reduce<Totals>((acc, f) => {
    acc.totalTime += f.totalTime
    acc.pic += f.pic
    acc.sic += f.sic
    acc.solo += f.solo
    acc.dualReceived += f.dualReceived
    acc.dualGiven += f.dualGiven
    acc.crossCountry += f.crossCountry
    acc.night += f.night
    acc.actualInstrument += f.actualInstrument
    acc.simulatedInstrument += f.simulatedInstrument
    acc.dayLandings += f.dayLandings
    acc.nightLandings += f.nightLandings
    acc.approaches += f.approaches
    acc.flights += 1
    return acc
  }, { ...emptyTotals })
}

export function formatHours(hours: number): string {
  return hours.toFixed(1)
}

export interface MonthTotals {
  hours: number
  pic: number
  landings: number
}

export function computeMonthTotals(flights: Flight[], now: Date = new Date()): MonthTotals {
  const monthKey = now.toISOString().slice(0, 7) // yyyy-mm
  return flights
    .filter((f) => f.date.slice(0, 7) === monthKey)
    .reduce<MonthTotals>(
      (acc, f) => {
        acc.hours += f.totalTime
        acc.pic += f.pic
        acc.landings += f.dayLandings + f.nightLandings
        return acc
      },
      { hours: 0, pic: 0, landings: 0 },
    )
}

// ---------------------------------------------------------------------------
// Currency & Recency Intelligence Engine (CARs-based)
//
// Dates are handled as calendar days (UTC midnight) throughout — precise
// enough for recency planning, not a substitute for verifying the current
// text of the CARs before flight.
// ---------------------------------------------------------------------------

export type CurrencyLevel = "green" | "yellow" | "red"

export interface QualifyingFlight {
  flightId: string
  date: string
  note: string
}

export interface CurrencyItem {
  id: string
  label: string
  citation: string
  level: CurrencyLevel
  current: boolean
  statusText: string
  detail: string
  fixIt: string
  windowStart: string | null
  windowEnd: string | null
  qualifying: QualifyingFlight[]
}

function toDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function daysAgo(dateIso: string, referenceDate: Date): number {
  const d = new Date(dateIso + "T00:00:00Z")
  const diffMs = referenceDate.getTime() - d.getTime()
  return diffMs / (1000 * 60 * 60 * 24)
}

function addDays(dateIso: string, days: number): string {
  const d = new Date(dateIso + "T00:00:00Z")
  d.setUTCDate(d.getUTCDate() + Math.round(days))
  return toDateOnly(d)
}

function daysUntil(dateIso: string, now: Date): number {
  const target = new Date(dateIso + "T00:00:00Z")
  return Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

function addMonths(dateIso: string, months: number): string {
  const d = new Date(dateIso + "T00:00:00Z")
  d.setUTCMonth(d.getUTCMonth() + months)
  return toDateOnly(d)
}

/** Finds the date on which a rolling-window count first drops below `required`,
 *  as the oldest contributing entries age out of the window. Returns null if
 *  the count never drops below `required` from what's already logged. */
function findLapseDate(
  ascendingEntries: { date: string; n: number }[],
  total: number,
  required: number,
  windowDays: number,
): string | null {
  let running = total
  for (const e of ascendingEntries) {
    if (running - e.n < required) return addDays(e.date, windowDays)
    running -= e.n
  }
  return null
}

function levelForDaysRemaining(daysRemaining: number): CurrencyLevel {
  if (daysRemaining <= 7) return "red"
  if (daysRemaining <= 30) return "yellow"
  return "green"
}

interface LandingCurrencyOptions {
  id: string
  label: string
  citation: string
  windowDays: number
  required: number
  unit: string
  count: (f: Flight) => number
}

function computeLandingCurrencyItem(
  flights: Flight[],
  now: Date,
  opts: LandingCurrencyOptions,
): CurrencyItem {
  const inWindow = flights
    .map((f) => ({ f, age: daysAgo(f.date, now), n: opts.count(f) }))
    .filter((x) => x.n > 0 && x.age >= 0 && x.age <= opts.windowDays)
    .sort((a, b) => a.f.date.localeCompare(b.f.date))

  const total = inWindow.reduce((s, x) => s + x.n, 0)
  const current = total >= opts.required
  const windowStart = addDays(toDateOnly(now), -opts.windowDays)
  const windowEnd = toDateOnly(now)
  const months = Math.round(opts.windowDays / 30.44)

  const qualifying: QualifyingFlight[] = inWindow.map((x) => ({
    flightId: x.f.id,
    date: x.f.date,
    note: `${x.n} ${opts.unit}`,
  }))

  let level: CurrencyLevel
  let statusText: string
  let fixIt: string

  if (!current) {
    level = "red"
    statusText = "Not current"
    const shortfall = opts.required - total
    fixIt = `Fly ${shortfall} more ${opts.unit} to restore currency.`
  } else {
    const lapseDate = findLapseDate(
      inWindow.map((x) => ({ date: x.f.date, n: x.n })),
      total,
      opts.required,
      opts.windowDays,
    )
    statusText = "Current"
    if (lapseDate) {
      const daysRemaining = daysUntil(lapseDate, now)
      level = levelForDaysRemaining(daysRemaining)
      fixIt = `Currency lapses ${lapseDate} unless you log another ${opts.unit} before then.`
    } else {
      level = "green"
      fixIt = "Currency is secure — nothing will age out of the window soon."
    }
  }

  return {
    id: opts.id,
    label: opts.label,
    citation: opts.citation,
    level,
    current,
    statusText,
    detail: `${total} ${opts.unit} in the last ${months} months (need ${opts.required})`,
    fixIt,
    windowStart,
    windowEnd,
    qualifying,
  }
}

const IFR_WINDOW_DAYS = 182
const IFR_REQUIRED_APPROACHES = 6

// CAR 401.05(3.1): 6 instrument approaches within the preceding 6 months —
// no holding procedure or navaid-tracking requirement exists in the CARs
// (that language is the FAA's 14 CFR 61.57(c), not this regulation). This
// subsection only applies starting the 7th month after the pilot's last
// instrument rating flight test / IPC under 401.05(3) — `graceUntil`, when
// provided, is that cutoff date (completedOn + 6 months) from the most
// recent "instrument-check" qualification on file.
function computeIfrCurrencyItem(flights: Flight[], now: Date, graceUntil: string | null): CurrencyItem {
  if (graceUntil) {
    const daysRemaining = daysUntil(graceUntil, now)
    if (daysRemaining > 0) {
      const level = levelForDaysRemaining(daysRemaining)
      return {
        id: "ifr-recency",
        label: "IFR approach recency",
        citation: "CAR 401.05(3.1)",
        level,
        current: true,
        statusText: "Current (grace period)",
        detail: `Within 6 months of your last instrument check — the 6-approach rule doesn't apply until ${graceUntil}.`,
        fixIt:
          level === "green"
            ? "No approaches needed yet — you're inside the post-check grace period."
            : `Grace period ends ${graceUntil} — after that you'll need 6 approaches in the trailing 6 months.`,
        windowStart: null,
        windowEnd: null,
        qualifying: [],
      }
    }
  }

  const inWindow = flights
    .map((f) => ({ f, age: daysAgo(f.date, now), n: f.approaches }))
    .filter((x) => x.n > 0 && x.age >= 0 && x.age <= IFR_WINDOW_DAYS)
    .sort((a, b) => a.f.date.localeCompare(b.f.date))

  const total = inWindow.reduce((s, x) => s + x.n, 0)
  const current = total >= IFR_REQUIRED_APPROACHES

  const windowStart = addDays(toDateOnly(now), -IFR_WINDOW_DAYS)
  const windowEnd = toDateOnly(now)

  const qualifying: QualifyingFlight[] = inWindow.map((x) => ({
    flightId: x.f.id,
    date: x.f.date,
    note: `${x.n} approach${x.n === 1 ? "" : "es"}`,
  }))

  let level: CurrencyLevel
  let statusText: string
  let fixIt: string

  if (!current) {
    level = "red"
    statusText = "Not current"
    const shortfall = IFR_REQUIRED_APPROACHES - total
    fixIt = `Fly ${shortfall} more instrument approach${shortfall === 1 ? "" : "es"} to restore IFR recency.`
  } else {
    const lapseDate = findLapseDate(
      inWindow.map((x) => ({ date: x.f.date, n: x.n })),
      total,
      IFR_REQUIRED_APPROACHES,
      IFR_WINDOW_DAYS,
    )
    statusText = "Current"
    if (lapseDate) {
      const daysRemaining = daysUntil(lapseDate, now)
      level = levelForDaysRemaining(daysRemaining)
      fixIt = `Recency lapses ${lapseDate} unless you fly another approach before then.`
    } else {
      level = "green"
      fixIt = "Recency is secure — nothing will age out of the window soon."
    }
  }

  return {
    id: "ifr-recency",
    label: "IFR approach recency",
    citation: "CAR 401.05(3.1)",
    level,
    current,
    statusText,
    detail: `${total} instrument approaches in the last 6 months (need ${IFR_REQUIRED_APPROACHES})`,
    fixIt,
    windowStart,
    windowEnd,
    qualifying,
  }
}

interface ExpiryCurrencyOptions {
  id: string
  label: string
  citation: string
  expiry: string
  now: Date
  emptyMessage?: string
}

function computeExpiryCurrencyItem(opts: ExpiryCurrencyOptions): CurrencyItem {
  if (!opts.expiry) {
    return {
      id: opts.id,
      label: opts.label,
      citation: opts.citation,
      level: "yellow",
      current: false,
      statusText: "Not set",
      detail: opts.emptyMessage ?? "No expiry date on file.",
      fixIt: "Add the expiry date in your Profile to track this automatically.",
      windowStart: null,
      windowEnd: null,
      qualifying: [],
    }
  }

  const daysRemaining = daysUntil(opts.expiry, opts.now)
  const current = daysRemaining >= 0
  const level: CurrencyLevel = !current ? "red" : levelForDaysRemaining(daysRemaining)

  return {
    id: opts.id,
    label: opts.label,
    citation: opts.citation,
    level,
    current,
    statusText: current ? "Valid" : "Expired",
    detail: current
      ? `Expires ${opts.expiry} (${daysRemaining} day${daysRemaining === 1 ? "" : "s"} remaining)`
      : `Expired ${opts.expiry} (${Math.abs(daysRemaining)} day${Math.abs(daysRemaining) === 1 ? "" : "s"} ago)`,
    fixIt: current
      ? "No action needed yet — renew before the expiry date to stay current."
      : "Renew immediately — you may not exercise the privileges of this qualification until it's renewed.",
    windowStart: null,
    windowEnd: null,
    qualifying: [],
  }
}

export function computeMedicalCurrency(profile: PilotProfile, now: Date = new Date()): CurrencyItem {
  return computeExpiryCurrencyItem({
    id: "medical",
    label:
      profile.medicalCategory !== "None"
        ? `Medical certificate (${profile.medicalCategory})`
        : "Medical certificate",
    citation: "CAR 404.03 / 404.04",
    expiry: profile.medicalExpiry,
    now,
    emptyMessage: "Add your medical expiry date in Profile to track this automatically.",
  })
}

function latestInstrumentCheck(profile: PilotProfile): Qualification | null {
  const checks = profile.qualifications.filter((q) => q.kind === "instrument-check" && q.completedOn)
  if (checks.length === 0) return null
  return checks.reduce((latest, q) => (q.completedOn > latest.completedOn ? q : latest))
}

// CAR 401.05(3): the 24-month instrument rating flight test / IPC that gates
// exercising instrument privileges at all — separate from, and a prerequisite
// to, the 401.05(3.1) approach-recency item above.
export function computeIfrRenewalCurrency(profile: PilotProfile, now: Date = new Date()): CurrencyItem {
  const check = latestInstrumentCheck(profile)
  return computeExpiryCurrencyItem({
    id: "ifr-renewal",
    label: "IFR renewal (flight test / IPC)",
    citation: "CAR 401.05(3)",
    expiry: check ? addMonths(check.completedOn, 24) : "",
    now,
    emptyMessage: "Add your last instrument rating flight test or IPC date under Profile → Qualifications.",
  })
}

/** Computes every tracked CARs currency/recency item for the dashboard, in
 *  priority order: recency items derived from logged flights first, then
 *  expiry-based items (medical, IFR renewal, qualifications). */
export function computeCarsCurrency(
  flights: Flight[],
  profile: PilotProfile,
  now: Date = new Date(),
): CurrencyItem[] {
  const items: CurrencyItem[] = []

  items.push(
    computeLandingCurrencyItem(flights, now, {
      id: "passenger-day",
      label: "Passenger-carrying — day",
      citation: "CAR 401.05(2)(b)(i)(A)",
      windowDays: 182,
      required: 5,
      unit: "takeoffs & landings",
      count: (f) => f.dayLandings + f.nightLandings,
    }),
  )

  items.push(
    computeLandingCurrencyItem(flights, now, {
      id: "passenger-night",
      label: "Passenger-carrying — night",
      citation: "CAR 401.05(2)(b)(i)(B)",
      windowDays: 182,
      required: 5,
      unit: "night takeoffs & landings",
      count: (f) => f.nightLandings,
    }),
  )

  const latestCheck = latestInstrumentCheck(profile)
  const graceUntil = latestCheck ? addMonths(latestCheck.completedOn, 6) : null
  items.push(computeIfrCurrencyItem(flights, now, graceUntil))
  items.push(computeIfrRenewalCurrency(profile, now))

  items.push(computeMedicalCurrency(profile, now))

  for (const q of profile.qualifications) {
    if (q.kind === "instrument-check") continue // surfaced via the dedicated IFR renewal item above
    if (!q.expiry) continue // no expiry to track — informational only, not a currency risk
    items.push(
      computeExpiryCurrencyItem({
        id: `qual-${q.id}`,
        label: q.name,
        citation: q.citation || "Operator / TC requirement",
        expiry: q.expiry,
        now,
      }),
    )
  }

  return items
}
