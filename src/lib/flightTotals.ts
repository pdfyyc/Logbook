import type { Aircraft, Flight } from "../types";
import { deriveDayTime } from "./numericPolicy";

export type DateRangePreset =
  | "all"
  | "current-year"
  | "previous-year"
  | "30-days"
  | "90-days"
  | "6-months"
  | "12-months"
  | "24-months"
  | "custom";
export interface DateRange {
  start: string | null;
  end: string | null;
  label: string;
}
export interface TotalsQuery {
  preset?: DateRangePreset;
  start?: string;
  end?: string;
  referenceDate?: string;
}

export interface FlightTotals {
  flights: number;
  totalTime: number;
  pic: number;
  sic: number;
  solo: number;
  dualReceived: number;
  dualGiven: number;
  crossCountry: number;
  day: number;
  night: number;
  instrument: number;
  actualInstrument: number;
  simulatedInstrument: number;
  simTime: number;
  approaches: number;
  holds: number;
  dayTakeoffs: number;
  nightTakeoffs: number;
  dayLandings: number;
  nightLandings: number;
}

export type ExperienceCategory =
  | "single-engine-aeroplane"
  | "multi-engine-aeroplane"
  | "simulator-ftd"
  | "unknown-unresolved"
  | "other";
export interface TotalsGroup {
  key: string;
  label: string;
  totals: FlightTotals;
  flightIds: string[];
  mostRecentDate: string | null;
}
export interface FlightTotalsResult {
  range: DateRange;
  totals: FlightTotals;
  flightIds: string[];
  byCategory: TotalsGroup[];
  byType: TotalsGroup[];
  byRegistration: TotalsGroup[];
  unknownFlightIds: string[];
}

export interface MonthlyFlyingRow {
  month: string;
  totals: FlightTotals;
  multiEngine: number;
  flightIds: string[];
}

export const EMPTY_TOTALS: FlightTotals = {
  flights: 0,
  totalTime: 0,
  pic: 0,
  sic: 0,
  solo: 0,
  dualReceived: 0,
  dualGiven: 0,
  crossCountry: 0,
  day: 0,
  night: 0,
  instrument: 0,
  actualInstrument: 0,
  simulatedInstrument: 0,
  simTime: 0,
  approaches: 0,
  holds: 0,
  dayTakeoffs: 0,
  nightTakeoffs: 0,
  dayLandings: 0,
  nightLandings: 0,
};

const iso = (date: Date) => date.toISOString().slice(0, 10);
const utcDate = (value: string) => new Date(`${value}T00:00:00Z`);
function addDays(value: string, days: number) {
  const date = utcDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return iso(date);
}
function addMonths(value: string, months: number) {
  const date = utcDate(value);
  date.setUTCMonth(date.getUTCMonth() + months);
  return iso(date);
}

export function resolveDateRange(query: TotalsQuery = {}): DateRange {
  const preset = query.preset ?? "all";
  const reference = query.referenceDate ?? iso(new Date());
  const year = reference.slice(0, 4);
  if (preset === "all") return { start: null, end: null, label: "All time" };
  if (preset === "current-year")
    return {
      start: `${year}-01-01`,
      end: `${year}-12-31`,
      label: `Calendar year ${year}`,
    };
  if (preset === "previous-year") {
    const previous = String(Number(year) - 1);
    return {
      start: `${previous}-01-01`,
      end: `${previous}-12-31`,
      label: `Calendar year ${previous}`,
    };
  }
  if (preset === "custom")
    return {
      start: query.start || null,
      end: query.end || null,
      label: "Custom range",
    };
  const settings: Record<
    Exclude<
      DateRangePreset,
      "all" | "current-year" | "previous-year" | "custom"
    >,
    [string, string]
  > = {
    "30-days": [addDays(reference, -29), "Last 30 days"],
    "90-days": [addDays(reference, -89), "Last 90 days"],
    "6-months": [addMonths(reference, -6), "Last 6 months"],
    "12-months": [addMonths(reference, -12), "Last 12 months"],
    "24-months": [addMonths(reference, -24), "Last 24 months"],
  };
  const [start, label] = settings[preset];
  return { start, end: reference, label };
}

export function isFlightInRange(flight: Flight, range: DateRange) {
  return (
    !flight.voidedAt &&
    /^\d{4}-\d{2}-\d{2}$/.test(flight.date) &&
    (!range.start || flight.date >= range.start) &&
    (!range.end || flight.date <= range.end)
  );
}

export function addFlightToTotals(
  target: FlightTotals,
  flight: Flight,
): FlightTotals {
  target.flights += 1;
  target.totalTime += flight.totalTime;
  target.pic += flight.pic;
  target.sic += flight.sic;
  target.solo += flight.solo;
  target.dualReceived += flight.dualReceived;
  target.dualGiven += flight.dualGiven;
  target.crossCountry += flight.crossCountry;
  target.night += flight.night;
  target.day +=
    flight.dayTime ??
    deriveDayTime(flight.totalTime, flight.night, flight.simTime);
  target.actualInstrument += flight.actualInstrument;
  target.simulatedInstrument += flight.simulatedInstrument;
  target.instrument += flight.actualInstrument + flight.simulatedInstrument;
  target.simTime += flight.simTime;
  target.approaches += flight.approaches;
  target.holds += flight.holds;
  target.dayTakeoffs += flight.dayTakeoffs ?? flight.dayLandings;
  target.nightTakeoffs += flight.nightTakeoffs ?? flight.nightLandings;
  target.dayLandings += flight.dayLandings;
  target.nightLandings += flight.nightLandings;
  return target;
}

function categoryFor(aircraft?: Aircraft): [ExperienceCategory, string] {
  if (!aircraft) return ["unknown-unresolved", "Unknown / unresolved"];
  if (aircraft.recordKind === "simulator" || aircraft.recordKind === "ftd")
    return ["simulator-ftd", "Simulator / FTD"];
  if (aircraft.recordKind === "historical" || aircraft.category === "Other")
    return ["unknown-unresolved", "Unknown / unresolved"];
  if (aircraft.category === "ASEL" || aircraft.category === "ASES")
    return ["single-engine-aeroplane", "Single-engine aeroplane"];
  if (aircraft.category === "AMEL" || aircraft.category === "AMES")
    return ["multi-engine-aeroplane", "Multi-engine aeroplane"];
  return ["other", aircraft.category];
}

function groupFlights(
  flights: Flight[],
  keyFor: (flight: Flight) => [string, string],
): TotalsGroup[] {
  const groups = new Map<string, TotalsGroup>();
  for (const flight of flights) {
    const [key, label] = keyFor(flight);
    const group = groups.get(key) ?? {
      key,
      label,
      totals: { ...EMPTY_TOTALS },
      flightIds: [],
      mostRecentDate: null,
    };
    addFlightToTotals(group.totals, flight);
    group.flightIds.push(flight.id);
    if (!group.mostRecentDate || flight.date > group.mostRecentDate)
      group.mostRecentDate = flight.date;
    groups.set(key, group);
  }
  return [...groups.values()].sort(
    (a, b) =>
      b.totals.totalTime - a.totals.totalTime || a.label.localeCompare(b.label),
  );
}

export function calculateFlightTotals(
  flights: Flight[],
  aircraftById: Map<string, Aircraft>,
  query: TotalsQuery = {},
): FlightTotalsResult {
  const range = resolveDateRange(query);
  const active = flights.filter((flight) => isFlightInRange(flight, range));
  const totals = active.reduce(addFlightToTotals, { ...EMPTY_TOTALS });
  const byCategory = groupFlights(active, (flight) =>
    categoryFor(aircraftById.get(flight.aircraftId)),
  );
  const byType = groupFlights(active, (flight) => {
    const aircraft = aircraftById.get(flight.aircraftId);
    return aircraft
      ? [
          aircraft.makeModel || "Type not recorded",
          aircraft.makeModel || "Type not recorded",
        ]
      : ["unknown", "Unknown / unresolved"];
  });
  const byRegistration = groupFlights(active, (flight) => {
    const aircraft = aircraftById.get(flight.aircraftId);
    return aircraft
      ? [aircraft.id, aircraft.tailNumber || "Registration not recorded"]
      : [
          `missing:${flight.aircraftId}`,
          flight.sourceAircraftText || "Unknown / unresolved",
        ];
  });
  const unknown = new Set(
    byCategory.find((group) => group.key === "unknown-unresolved")?.flightIds ??
      [],
  );
  return {
    range,
    totals,
    flightIds: active.map((flight) => flight.id),
    byCategory,
    byType,
    byRegistration,
    unknownFlightIds: [...unknown],
  };
}

export function computeMonthlyFlying(
  flights: Flight[],
  aircraftById: Map<string, Aircraft>,
  query: TotalsQuery = {},
): MonthlyFlyingRow[] {
  const range = resolveDateRange(query);
  const active = flights.filter((flight) => isFlightInRange(flight, range));
  const rows = new Map<string, MonthlyFlyingRow>();
  for (const flight of active) {
    const month = flight.date.slice(0, 7);
    const row = rows.get(month) ?? {
      month,
      totals: { ...EMPTY_TOTALS },
      multiEngine: 0,
      flightIds: [],
    };
    addFlightToTotals(row.totals, flight);
    if (
      categoryFor(aircraftById.get(flight.aircraftId))[0] ===
      "multi-engine-aeroplane"
    )
      row.multiEngine += flight.totalTime;
    row.flightIds.push(flight.id);
    rows.set(month, row);
  }
  return [...rows.values()].sort((a, b) => b.month.localeCompare(a.month));
}
