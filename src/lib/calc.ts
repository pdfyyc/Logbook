import type {
  Aircraft,
  Flight,
  InstructorClass,
  MedicalPrivilege,
  PilotProfile,
  Qualification,
  QualificationKind,
} from "../types";
import { MEDICAL_PRIVILEGE_LABELS } from "../types";
import { calculateFlightTotals, type FlightTotals } from "./flightTotals";

export type Totals = FlightTotals;

export function computeTotals(flights: Flight[]): Totals {
  return calculateFlightTotals(flights, new Map()).totals;
}

export function formatHours(hours: number): string {
  return hours.toFixed(1);
}

export interface MonthTotals {
  hours: number;
  pic: number;
  landings: number;
}

export function computeMonthTotals(
  flights: Flight[],
  now: Date = new Date(),
): MonthTotals {
  const monthKey = now.toISOString().slice(0, 7);
  const end = new Date(
    Date.UTC(Number(monthKey.slice(0, 4)), Number(monthKey.slice(5, 7)), 0),
  )
    .toISOString()
    .slice(0, 10);
  const totals = calculateFlightTotals(flights, new Map(), {
    preset: "custom",
    start: `${monthKey}-01`,
    end,
  }).totals;
  return {
    hours: totals.totalTime,
    pic: totals.pic,
    landings: totals.dayLandings + totals.nightLandings,
  };
}

// ---------------------------------------------------------------------------
// Currency & Recency Intelligence Engine (CARs-based)
//
// Dates are handled as calendar days (UTC midnight) throughout — precise
// enough for recency planning, not a substitute for verifying the current
// text of the CARs before flight.
// ---------------------------------------------------------------------------

export type CurrencyLevel = "green" | "yellow" | "red";

export interface QualifyingFlight {
  flightId: string;
  date: string;
  note: string;
}

export interface CurrencyItem {
  id: string;
  label: string;
  citation: string;
  level: CurrencyLevel;
  current: boolean;
  statusText: string;
  detail: string;
  fixIt: string;
  windowStart: string | null;
  windowEnd: string | null;
  qualifying: QualifyingFlight[];
  earliestQualifyingDate?: string | null;
  nextChangeDate?: string | null;
  explanation?: string;
}

function toDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function daysAgo(dateIso: string, referenceDate: Date): number {
  const d = new Date(dateIso + "T00:00:00Z");
  const referenceDay = new Date(toDateOnly(referenceDate) + "T00:00:00Z");
  const diffMs = referenceDay.getTime() - d.getTime();
  return diffMs / (1000 * 60 * 60 * 24);
}

function addDays(dateIso: string, days: number): string {
  const d = new Date(dateIso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + Math.round(days));
  return toDateOnly(d);
}

function daysUntil(dateIso: string, now: Date): number {
  const target = new Date(dateIso + "T00:00:00Z");
  return Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function addMonths(dateIso: string, months: number): string {
  const d = new Date(dateIso + "T00:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + months);
  return toDateOnly(d);
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
  let running = total;
  for (const e of ascendingEntries) {
    if (running - e.n < required) return addDays(e.date, windowDays);
    running -= e.n;
  }
  return null;
}

/** Long-lead items (medical, instrument check, recurrent training) can't be
 *  fixed in a week, so they warn earlier than the flight-by-flight ones. */
const LONG_LEAD_WARN = { red: 30, yellow: 90 };
const SHORT_LEAD_WARN = { red: 7, yellow: 30 };
/** The document booklet is a ~10-year clock, so it needs the longest lead of
 *  all — you can be well past useful warning before it feels close. */
const BOOKLET_WARN = { red: 90, yellow: 180 };

/** Per-kind warning leads for qualifications rendered by the generic loop. */
const QUALIFICATION_WARN: Partial<
  Record<QualificationKind, { red: number; yellow: number }>
> = {
  "instructor-rating": LONG_LEAD_WARN,
  "document-booklet": BOOKLET_WARN,
};

function profileExpiryThresholds(profile: PilotProfile) {
  return {
    red: profile.expiryWarningDays?.critical ?? LONG_LEAD_WARN.red,
    yellow: profile.expiryWarningDays?.warning ?? LONG_LEAD_WARN.yellow,
  };
}

function levelForDaysRemaining(
  daysRemaining: number,
  thresholds: { red: number; yellow: number } = SHORT_LEAD_WARN,
): CurrencyLevel {
  if (daysRemaining <= thresholds.red) return "red";
  if (daysRemaining <= thresholds.yellow) return "yellow";
  return "green";
}

/** First day of the `months`-th month following the month containing
 *  `dateIso`. Medical validity runs from month+1; instructor ratings and the
 *  document booklet expire at month+13/25/37/49 and month+121 respectively. */
export function firstOfMonthOffset(dateIso: string, months: number): string {
  const d = new Date(dateIso + "T00:00:00Z");
  return toDateOnly(
    new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1)),
  );
}

const firstOfNextMonth = (dateIso: string) => firstOfMonthOffset(dateIso, 1);

/** Months after the flight-test month at whose first day each instructor
 *  rating class expires. */
export const INSTRUCTOR_RATING_MONTHS: Record<InstructorClass, number> = {
  "4": 13,
  "3": 25,
  "2": 37,
  "1": 49,
};

/** CAR 401.12 — the aviation document booklet normally expires on the first
 *  day of the 121st month. */
export const DOCUMENT_BOOKLET_MONTHS = 121;

/** Single source of truth for the expiry date implied by a qualification's
 *  kind and completion date, so the form and the currency engine can't drift
 *  apart. Returns null when the kind carries no derived expiry (either it
 *  never expires, or the user enters the date by hand). */
export function derivedQualificationExpiry(
  kind: QualificationKind,
  completedOn: string,
  instructorClass?: InstructorClass,
): string | null {
  if (!completedOn) return null;
  switch (kind) {
    case "instrument-check":
    case "recurrent-training":
      return addMonths(completedOn, 24);
    case "instructor-rating":
      return firstOfMonthOffset(
        completedOn,
        INSTRUCTOR_RATING_MONTHS[instructorClass ?? "4"],
      );
    case "document-booklet":
      return firstOfMonthOffset(completedOn, DOCUMENT_BOOKLET_MONTHS);
    case "ppl-issued":
    case "other":
      return null;
  }
}

function ageOn(dateOfBirth: string, onIso: string): number {
  const dob = new Date(dateOfBirth + "T00:00:00Z");
  const on = new Date(onIso + "T00:00:00Z");
  let age = on.getUTCFullYear() - dob.getUTCFullYear();
  const beforeBirthday =
    on.getUTCMonth() < dob.getUTCMonth() ||
    (on.getUTCMonth() === dob.getUTCMonth() &&
      on.getUTCDate() < dob.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

/** Standard 421 medical validity table, by privilege exercised and age at
 *  examination. */
export function medicalValidityMonths(
  privilege: MedicalPrivilege,
  ageAtExam: number,
): number {
  switch (privilege) {
    case "ulp":
    case "spp":
      return 60;
    case "ppl":
    case "rpp":
      return ageAtExam >= 40 ? 24 : 60;
    case "cpl-atpl":
      return ageAtExam >= 60 ? 6 : 12;
    case "cpl-atpl-single-pilot-pax":
      return ageAtExam >= 40 ? 6 : 12;
  }
}

export interface MedicalValidity {
  expiry: string;
  months: number;
  ageAtExam: number;
  validFrom: string;
}

/** Computes the medical's valid-to date from the exam date, the pilot's age
 *  at examination and the privilege exercised. Returns null when the profile
 *  is missing the exam date or date of birth. */
export function computeMedicalValidity(
  profile: PilotProfile,
): MedicalValidity | null {
  if (!profile.medicalExamDate || !profile.dateOfBirth) return null;
  const ageAtExam = ageOn(profile.dateOfBirth, profile.medicalExamDate);
  const months = medicalValidityMonths(profile.medicalPrivilege, ageAtExam);
  const validFrom = firstOfNextMonth(profile.medicalExamDate);
  return { expiry: addMonths(validFrom, months), months, ageAtExam, validFrom };
}

interface LandingCurrencyOptions {
  id: string;
  label: string;
  citation: string;
  windowDays: number;
  required: number;
  unit: string;
  count: (f: Flight) => number;
}

function computeLandingCurrencyItem(
  flights: Flight[],
  now: Date,
  opts: LandingCurrencyOptions,
): CurrencyItem {
  const inWindow = flights
    .map((f) => ({ f, age: daysAgo(f.date, now), n: opts.count(f) }))
    .filter((x) => x.n > 0 && x.age >= 0 && x.age <= opts.windowDays)
    .sort((a, b) => a.f.date.localeCompare(b.f.date));

  const total = inWindow.reduce((s, x) => s + x.n, 0);
  const current = total >= opts.required;
  const windowStart = addDays(toDateOnly(now), -opts.windowDays);
  const windowEnd = toDateOnly(now);
  const months = Math.round(opts.windowDays / 30.44);

  const qualifying: QualifyingFlight[] = inWindow.map((x) => ({
    flightId: x.f.id,
    date: x.f.date,
    note: `${x.n} ${opts.unit}`,
  }));

  let level: CurrencyLevel;
  let statusText: string;
  let fixIt: string;

  if (!current) {
    level = "red";
    statusText = "Not current";
    const shortfall = opts.required - total;
    fixIt = `Fly ${shortfall} more ${opts.unit} to restore currency.`;
  } else {
    const lapseDate = findLapseDate(
      inWindow.map((x) => ({ date: x.f.date, n: x.n })),
      total,
      opts.required,
      opts.windowDays,
    );
    statusText = "Current";
    if (lapseDate) {
      const daysRemaining = daysUntil(lapseDate, now);
      level = levelForDaysRemaining(daysRemaining);
      if (level !== "green") statusText = "Due soon";
      fixIt = `Currency lapses ${lapseDate} unless you log another ${opts.unit} before then.`;
    } else {
      level = "green";
      fixIt = "Currency is secure — nothing will age out of the window soon.";
    }
  }

  return {
    id: opts.id,
    label: opts.label,
    citation: opts.citation,
    level,
    current,
    statusText,
    detail: current
      ? `${total} of ${opts.required} required ${opts.unit} completed in the last ${months} months.`
      : `${total} of ${opts.required} required ${opts.unit} completed in the last ${months} months; ${opts.required - total} remaining.`,
    fixIt,
    windowStart,
    windowEnd,
    qualifying,
    earliestQualifyingDate: inWindow[0]?.f.date ?? null,
    nextChangeDate: current
      ? findLapseDate(
          inWindow.map((x) => ({ date: x.f.date, n: x.n })),
          total,
          opts.required,
          opts.windowDays,
        )
      : null,
    explanation: `Counts completed takeoff/landing pairs recorded in the same aircraft category and class inside the displayed rolling window.`,
  };
}

const IFR_WINDOW_DAYS = 182;
const IFR_REQUIRED_APPROACHES = 6;

// CAR 401.05(3.1): 6 instrument approaches within the preceding 6 months —
// no holding procedure or navaid-tracking requirement exists in the CARs
// (that language is the FAA's 14 CFR 61.57(c), not this regulation). This
// subsection only applies starting the 7th month after the pilot's last
// instrument rating flight test / IPC under 401.05(3) — `graceUntil`, when
// provided, is that cutoff date (completedOn + 6 months) from the most
// recent "instrument-check" qualification on file.
function computeIfrCurrencyItem(
  flights: Flight[],
  now: Date,
  graceUntil: string | null,
): CurrencyItem {
  if (graceUntil) {
    const daysRemaining = daysUntil(graceUntil, now);
    if (daysRemaining > 0) {
      const level = levelForDaysRemaining(daysRemaining);
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
      };
    }
  }

  const inWindow = flights
    .map((f) => ({ f, age: daysAgo(f.date, now), n: f.approaches }))
    .filter((x) => x.n > 0 && x.age >= 0 && x.age <= IFR_WINDOW_DAYS)
    .sort((a, b) => a.f.date.localeCompare(b.f.date));

  const total = inWindow.reduce((s, x) => s + x.n, 0);
  const current = total >= IFR_REQUIRED_APPROACHES;

  const windowStart = addDays(toDateOnly(now), -IFR_WINDOW_DAYS);
  const windowEnd = toDateOnly(now);

  const qualifying: QualifyingFlight[] = inWindow.map((x) => ({
    flightId: x.f.id,
    date: x.f.date,
    note: `${x.n} approach${x.n === 1 ? "" : "es"}`,
  }));

  let level: CurrencyLevel;
  let statusText: string;
  let fixIt: string;

  if (!current) {
    level = "red";
    statusText = "Not current";
    const shortfall = IFR_REQUIRED_APPROACHES - total;
    fixIt = `Fly ${shortfall} more instrument approach${shortfall === 1 ? "" : "es"} to restore IFR recency.`;
  } else {
    const lapseDate = findLapseDate(
      inWindow.map((x) => ({ date: x.f.date, n: x.n })),
      total,
      IFR_REQUIRED_APPROACHES,
      IFR_WINDOW_DAYS,
    );
    statusText = "Current";
    if (lapseDate) {
      const daysRemaining = daysUntil(lapseDate, now);
      level = levelForDaysRemaining(daysRemaining);
      if (level !== "green") statusText = "Due soon";
      fixIt = `Recency lapses ${lapseDate} unless you fly another approach before then.`;
    } else {
      level = "green";
      fixIt = "Recency is secure — nothing will age out of the window soon.";
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
    earliestQualifyingDate: inWindow[0]?.f.date ?? null,
    nextChangeDate: current
      ? findLapseDate(
          inWindow.map((x) => ({ date: x.f.date, n: x.n })),
          total,
          IFR_REQUIRED_APPROACHES,
          IFR_WINDOW_DAYS,
        )
      : null,
    explanation:
      "Counts logged instrument approaches in the six-month rolling window. Holds are not required by CAR 401.05(3.1).",
  };
}

interface ExpiryCurrencyOptions {
  id: string;
  label: string;
  citation: string;
  expiry: string;
  now: Date;
  emptyMessage?: string;
  emptyFixIt?: string;
  thresholds?: { red: number; yellow: number };
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
      fixIt:
        opts.emptyFixIt ??
        "Add the expiry date in your Profile to track this automatically.",
      windowStart: null,
      windowEnd: null,
      qualifying: [],
    };
  }

  const daysRemaining = daysUntil(opts.expiry, opts.now);
  const current = daysRemaining >= 0;
  const level: CurrencyLevel = !current
    ? "red"
    : levelForDaysRemaining(daysRemaining, opts.thresholds);

  return {
    id: opts.id,
    label: opts.label,
    citation: opts.citation,
    level,
    current,
    statusText: current
      ? level === "green"
        ? "Valid"
        : "Due soon"
      : "Expired",
    detail: current
      ? `Expires ${opts.expiry} (${daysRemaining} day${daysRemaining === 1 ? "" : "s"} remaining)`
      : `Expired ${opts.expiry} (${Math.abs(daysRemaining)} day${Math.abs(daysRemaining) === 1 ? "" : "s"} ago)`,
    fixIt: current
      ? "No action needed yet — renew before the expiry date to stay current."
      : "Renew immediately — you may not exercise the privileges of this qualification until it's renewed.",
    windowStart: null,
    windowEnd: null,
    qualifying: [],
    nextChangeDate: opts.expiry || null,
    explanation:
      "Uses the entered official expiry when present; otherwise uses the centralized calculated date.",
  };
}

export function computeMedicalCurrency(
  profile: PilotProfile,
  now: Date = new Date(),
): CurrencyItem {
  const computed = computeMedicalValidity(profile);
  // A manually entered valid-to date always wins: the certificate itself, and
  // any shorter period the Minister endorses on it, control over the table.
  const expiry = profile.medicalExpiry || computed?.expiry || "";

  const item = computeExpiryCurrencyItem({
    id: "medical",
    label:
      profile.medicalCategory !== "None"
        ? `Medical certificate (${profile.medicalCategory})`
        : "Medical certificate",
    citation: "CAR 404.03 / 404.04",
    expiry,
    now,
    thresholds: profileExpiryThresholds(profile),
    emptyMessage: "No valid-to date on file.",
    emptyFixIt:
      "Add your date of birth and medical exam date in Profile to calculate it, or enter the valid-to date printed on the certificate.",
  });

  if (!expiry || profile.medicalExpiry || !computed) return item;
  return {
    ...item,
    detail: `${item.detail} — ${computed.months} months for ${MEDICAL_PRIVILEGE_LABELS[profile.medicalPrivilege]} at age ${computed.ageAtExam}, from ${computed.validFrom}`,
  };
}

/** CAR 401.05(1): must have acted as PIC or co-pilot within the previous five
 *  years. Simulator-based Part VII recurrent programs can also satisfy this,
 *  which the log can't see — noted in the fix-it text rather than assumed. */
export function computeFiveYearRecency(
  flights: Flight[],
  now: Date = new Date(),
): CurrencyItem {
  const WINDOW_DAYS = 365 * 5;
  const qualifying = flights
    .filter(
      (f) =>
        (f.pic > 0 || f.sic > 0) &&
        daysAgo(f.date, now) >= 0 &&
        daysAgo(f.date, now) <= WINDOW_DAYS,
    )
    .sort((a, b) => b.date.localeCompare(a.date));

  const mostRecent = qualifying[0];
  const current = Boolean(mostRecent);
  const lapseDate = mostRecent ? addDays(mostRecent.date, WINDOW_DAYS) : null;
  const daysRemaining = lapseDate ? daysUntil(lapseDate, now) : 0;

  return {
    id: "five-year-recency",
    label: "Acted as PIC or co-pilot (5 years)",
    citation: "CAR 401.05(1)",
    level: current
      ? levelForDaysRemaining(daysRemaining, LONG_LEAD_WARN)
      : "red",
    current,
    statusText: current ? "Current" : "Not current",
    detail: mostRecent
      ? `Most recent PIC or co-pilot flight ${mostRecent.date} — lapses ${lapseDate}`
      : "No PIC or co-pilot time logged in the last 5 years.",
    fixIt: current
      ? "No action needed — any PIC or co-pilot flight resets the 5-year window."
      : "Fly as PIC or co-pilot, or complete an approved Part VII recurrent program in an eligible Level C/D simulator. Otherwise a flight review, logbook certification and written exam are required.",
    windowStart: addDays(toDateOnly(now), -WINDOW_DAYS),
    windowEnd: toDateOnly(now),
    qualifying: mostRecent
      ? [
          {
            flightId: mostRecent.id,
            date: mostRecent.date,
            note: "most recent PIC/co-pilot flight",
          },
        ]
      : [],
  };
}

/** CAR 401.05(2)(a): an accepted recurrent training program within the
 *  previous 24 months, from a "recurrent-training" qualification. */
export function computeRecurrentTrainingCurrency(
  profile: PilotProfile,
  now: Date = new Date(),
): CurrencyItem {
  const latest = profile.qualifications
    .filter((q) => q.kind === "recurrent-training" && q.completedOn)
    .map((q) => q.completedOn)
    .sort()
    .pop();

  return computeExpiryCurrencyItem({
    id: "recurrent-training",
    label: "Recurrent training (24 months)",
    citation: "CAR 401.05(2)(a)",
    expiry: latest ? addMonths(latest, 24) : "",
    now,
    thresholds: profileExpiryThresholds(profile),
    emptyMessage: "No recurrent training completion date on file.",
    emptyFixIt:
      "Add your last recurrent training completion date under Profile → Qualifications.",
  });
}

function latestInstrumentCheck(profile: PilotProfile): Qualification | null {
  const checks = profile.qualifications.filter(
    (q) => q.kind === "instrument-check" && q.completedOn,
  );
  if (checks.length === 0) return null;
  return checks.reduce((latest, q) =>
    q.completedOn > latest.completedOn ? q : latest,
  );
}

// CAR 401.05(3): the 24-month instrument rating flight test / IPC that gates
// exercising instrument privileges at all — separate from, and a prerequisite
// to, the 401.05(3.1) approach-recency item above.
export function computeIfrRenewalCurrency(
  profile: PilotProfile,
  now: Date = new Date(),
): CurrencyItem {
  const check = latestInstrumentCheck(profile);
  return computeExpiryCurrencyItem({
    id: "ifr-renewal",
    label: "IFR renewal (flight test / IPC)",
    citation: "CAR 401.05(3)",
    expiry: check ? addMonths(check.completedOn, 24) : "",
    now,
    thresholds: profileExpiryThresholds(profile),
    emptyMessage: "No instrument flight test or IPC date on file.",
    emptyFixIt:
      "Add your last instrument rating flight test or IPC date under Profile → Qualifications.",
  });
}

const PASSENGER_WINDOW_DAYS = 182;
/** Categories flown within this window get their own passenger-recency rows —
 *  wide enough to keep a recently-lapsed category visible, narrow enough not
 *  to clutter the dashboard with types the pilot has moved on from. */
const CATEGORY_RELEVANCE_DAYS = 365;

/** CAR 401.05(2)(b) requires the takeoffs and landings to be in the same
 *  category and class of aircraft, so landings can't be pooled across the
 *  fleet — a single-engine landing does nothing for multi-engine passenger
 *  recency. This emits a day and a night row per category actually flown. */
function computePassengerRecencyItems(
  flights: Flight[],
  aircraftById: Map<string, Aircraft>,
  now: Date,
): CurrencyItem[] {
  const categoryOf = (f: Flight) =>
    aircraftById.get(f.aircraftId)?.category ?? "Unknown aircraft";

  const recentCategories = [
    ...new Set(
      flights
        .filter((f) => {
          const age = daysAgo(f.date, now);
          return (
            age >= 0 &&
            age <= CATEGORY_RELEVANCE_DAYS &&
            f.dayLandings + f.nightLandings > 0
          );
        })
        .map(categoryOf),
    ),
  ].sort();

  // Nothing flown recently — fall back to one un-scoped pair so the dashboard
  // still states the requirement rather than showing nothing at all.
  const categories = recentCategories.length > 0 ? recentCategories : [null];

  return categories.flatMap((category) => {
    const scoped =
      category === null
        ? flights
        : flights.filter((f) => categoryOf(f) === category);
    const suffix = category === null ? "" : ` — ${category}`;
    const idSuffix =
      category === null
        ? ""
        : `-${category.toLowerCase().replace(/\s+/g, "-")}`;

    return [
      computeLandingCurrencyItem(scoped, now, {
        id: `passenger-day${idSuffix}`,
        label: `Passenger-carrying — day${suffix}`,
        citation: "CAR 401.05(2)(b)(i)(A)",
        windowDays: PASSENGER_WINDOW_DAYS,
        required: 5,
        unit: "completed takeoff/landing pairs",
        count: (f) =>
          Math.min(
            (f.dayTakeoffs ?? f.dayLandings) +
              (f.nightTakeoffs ?? f.nightLandings),
            f.dayLandings + f.nightLandings,
          ),
      }),
      computeLandingCurrencyItem(scoped, now, {
        id: `passenger-night${idSuffix}`,
        label: `Passenger-carrying — night${suffix}`,
        citation: "CAR 401.05(2)(b)(i)(B)",
        windowDays: PASSENGER_WINDOW_DAYS,
        required: 5,
        unit: "completed night takeoff/landing pairs",
        count: (f) =>
          Math.min(f.nightTakeoffs ?? f.nightLandings, f.nightLandings),
      }),
    ];
  });
}

/** Computes every tracked CARs currency/recency item for the dashboard, in
 *  priority order: recency items derived from logged flights first, then
 *  expiry-based items (medical, IFR renewal, qualifications). */
export function computeCarsCurrency(
  flights: Flight[],
  profile: PilotProfile,
  aircraftById: Map<string, Aircraft> = new Map(),
  now: Date = new Date(),
): CurrencyItem[] {
  // A void is retained for the legal record, but must never contribute toward
  // a currency or recency claim.
  flights = flights.filter((f) => {
    if (f.voidedAt) return false;
    const kind = aircraftById.get(f.aircraftId)?.recordKind ?? "aircraft";
    // Simulator/FTD credit depends on approval and exercise details that the
    // current local model cannot substantiate, so currency is understated.
    return kind !== "simulator" && kind !== "ftd";
  });
  const items: CurrencyItem[] = [];

  items.push(...computePassengerRecencyItems(flights, aircraftById, now));

  const latestCheck = latestInstrumentCheck(profile);
  const graceUntil = latestCheck ? addMonths(latestCheck.completedOn, 6) : null;
  items.push(computeIfrCurrencyItem(flights, now, graceUntil));
  items.push(computeIfrRenewalCurrency(profile, now));

  items.push(computeFiveYearRecency(flights, now));
  items.push(computeRecurrentTrainingCurrency(profile, now));
  items.push(computeMedicalCurrency(profile, now));

  for (const q of profile.qualifications) {
    // Kinds with their own dedicated currency items above, or that carry no
    // expiry at all, aren't repeated here.
    if (
      q.kind === "instrument-check" ||
      q.kind === "recurrent-training" ||
      q.kind === "ppl-issued"
    )
      continue;
    if (!q.expiry) continue; // no expiry to track — informational only, not a currency risk
    items.push(
      computeExpiryCurrencyItem({
        id: `qual-${q.id}`,
        label: q.name,
        citation: q.citation || "Operator / TC requirement",
        expiry: q.expiry,
        now,
        thresholds:
          q.kind === "document-booklet"
            ? QUALIFICATION_WARN[q.kind]
            : profileExpiryThresholds(profile),
      }),
    );
  }

  return items;
}
