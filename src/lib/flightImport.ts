import { strFromU8, unzipSync } from "fflate";
import type {
  Aircraft,
  Flight,
  FlightDraft,
  ImportReconciliation,
} from "../types";
import { normalizeRegistration } from "./aircraftRegistry";
import {
  normalizeCount,
  normalizeHours,
  validateFlightNumbers,
} from "./numericPolicy";

export type ImportDateFormat = "iso" | "ymd" | "mdy" | "dmy";
export type ImportDestination =
  keyof FlightDraft | "registration" | "aircraftType" | "sourceFlightId";
export interface ImportColumnDefinition {
  key: ImportDestination;
  label: string;
  required?: boolean;
  constant?: boolean;
}
export interface ImportColumnMapping {
  source: string;
  destination: ImportDestination | "ignore";
  confidence: "confident" | "uncertain" | "ignored";
}
export interface ImportSource {
  filename: string;
  fileType: "csv" | "tsv" | "xlsx";
  detectedFormat: "application-csv" | "generic";
  headers: string[];
  rows: Record<string, string>[];
}
export type AircraftResolution =
  | { mode: "existing"; aircraftId: string }
  | { mode: "aircraft" | "historical" | "simulator" | "ftd" }
  | { mode: "unresolved" };
export interface DuplicateMatch {
  kind: "exact" | "likely" | "repeat";
  source: "existing" | "batch";
  flightId?: string;
  rowNumber?: number;
  detail: string;
}
export interface StagedImportRow {
  rowNumber: number;
  originalValues: Record<string, string>;
  parsed?: FlightDraft;
  originalParsed?: FlightDraft;
  aircraftText: string;
  aircraftType: string;
  sourceFlightId?: string;
  errors: string[];
  warnings: string[];
  excluded: boolean;
  manuallyCorrected: boolean;
  aircraftResolution: AircraftResolution;
  duplicate?: DuplicateMatch;
  duplicateResolution: "skip" | "import";
}
export interface FlightImportWorkspace {
  source: ImportSource;
  mappings: ImportColumnMapping[];
  constants: Partial<Record<ImportDestination, string>>;
  dateFormat: ImportDateFormat;
  rows: StagedImportRow[];
  reconciliation: ImportReconciliation;
}

export const IMPORT_COLUMNS: ImportColumnDefinition[] = [
  { key: "date", label: "Date", required: true, constant: true },
  {
    key: "registration",
    label: "Registration",
    required: true,
    constant: true,
  },
  { key: "aircraftType", label: "Aircraft type", constant: true },
  { key: "from", label: "Departure", constant: true },
  { key: "to", label: "Destination", constant: true },
  { key: "route", label: "Route" },
  { key: "totalTime", label: "Total time", required: true },
  { key: "dayTime", label: "Day" },
  { key: "night", label: "Night" },
  { key: "pic", label: "PIC" },
  { key: "sic", label: "Co-pilot / SIC" },
  { key: "dualReceived", label: "Dual received" },
  { key: "dualGiven", label: "Instructor / dual given" },
  { key: "solo", label: "Solo" },
  { key: "crossCountry", label: "Cross-country" },
  { key: "actualInstrument", label: "Actual instrument" },
  { key: "simulatedInstrument", label: "Simulated instrument / hood" },
  { key: "simTime", label: "Simulator / FTD" },
  { key: "dayTakeoffs", label: "Day takeoffs" },
  { key: "dayLandings", label: "Day landings" },
  { key: "nightTakeoffs", label: "Night takeoffs" },
  { key: "nightLandings", label: "Night landings" },
  { key: "approaches", label: "Approaches" },
  { key: "holds", label: "Holds" },
  { key: "remarks", label: "Remarks" },
  { key: "legalPicName", label: "Legal PIC" },
  { key: "primaryCrewName", label: "Co-pilot / student / other crew" },
  { key: "primaryCrewRole", label: "Primary crew role", constant: true },
  { key: "instructorName", label: "Instructor" },
  { key: "passengers", label: "Passengers" },
  { key: "myRole", label: "User's role", constant: true },
  { key: "sourceAircraftText", label: "Original aircraft text" },
  {
    key: "copilotCreditConfirmed",
    label: "Co-pilot credit confirmed",
    constant: true,
  },
  { key: "sourceFlightId", label: "Source flight ID" },
];

const aliases: Record<ImportDestination, string[]> = {
  date: ["date", "flight date"],
  registration: [
    "aircraft",
    "tail number",
    "tail",
    "registration",
    "reg",
    "aircraft registration",
  ],
  aircraftType: ["aircraft type", "type", "make model", "make/model"],
  from: ["from", "departure", "depart"],
  to: ["to", "arrival", "destination"],
  route: ["route"],
  totalTime: ["total time", "total", "flight time", "duration"],
  dayTime: ["day time", "day"],
  night: ["night"],
  pic: ["pic", "pilot in command", "pilot-in-command"],
  sic: ["sic", "copilot", "co-pilot", "second in command"],
  solo: ["solo"],
  dualReceived: ["dual received", "dual", "dual instruction"],
  dualGiven: ["dual given", "instructor time"],
  crossCountry: ["cross country", "cross-country", "xc"],
  actualInstrument: ["actual instrument", "actual inst"],
  simulatedInstrument: [
    "simulated instrument",
    "sim instrument",
    "sim inst",
    "hood",
  ],
  simTime: ["sim time", "simulator", "simulator time", "ftd"],
  dayTakeoffs: ["day takeoffs", "day t/o", "takeoffs day"],
  nightTakeoffs: ["night takeoffs", "night t/o", "takeoffs night"],
  dayLandings: ["day landings", "day ldg", "landings day"],
  nightLandings: ["night landings", "night ldg", "landings night"],
  approaches: ["approaches", "instrument approaches"],
  holds: ["holds"],
  remarks: ["remarks", "notes", "comments"],
  myRole: ["my role", "role"],
  legalPicName: ["legal pic", "pic name", "pilot in command name"],
  primaryCrewName: [
    "crew name",
    "copilot name",
    "co-pilot name",
    "student name",
  ],
  primaryCrewRole: ["crew role", "primary crew role"],
  instructorName: ["instructor name", "instructor"],
  passengers: ["passengers", "passenger names"],
  sourceAircraftText: ["source aircraft text", "original aircraft text"],
  copilotCreditConfirmed: [
    "copilot credit confirmed",
    "co-pilot credit confirmed",
  ],
  sourceFlightId: ["flight id", "stable flight id", "id"],
  aircraftId: ["aircraft id"],
  importProvenance: ["import provenance"],
};

const hourFields = new Set<ImportDestination>([
  "totalTime",
  "dayTime",
  "pic",
  "sic",
  "solo",
  "dualReceived",
  "dualGiven",
  "crossCountry",
  "night",
  "actualInstrument",
  "simulatedInstrument",
  "simTime",
]);
const countFields = new Set<ImportDestination>([
  "dayTakeoffs",
  "nightTakeoffs",
  "dayLandings",
  "nightLandings",
  "approaches",
  "holds",
]);
const cleanKey = (value: string) =>
  value
    .trim()
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .replace(/[_.]/g, " ")
    .replace(/\s+/g, " ");
const sourceValue = (
  row: Record<string, string>,
  mappings: ImportColumnMapping[],
  constants: Partial<Record<ImportDestination, string>>,
  destination: ImportDestination,
) => {
  const mapped = mappings.find((item) => item.destination === destination);
  return mapped ? (row[mapped.source] ?? "") : (constants[destination] ?? "");
};

export function suggestMappings(headers: string[]): ImportColumnMapping[] {
  const used = new Set<string>();
  return headers.map((source) => {
    const normalized = cleanKey(source);
    const matches = IMPORT_COLUMNS.filter(
      (column) =>
        aliases[column.key].includes(normalized) && !used.has(column.key),
    );
    if (matches.length !== 1)
      return {
        source,
        destination: "ignore",
        confidence: matches.length ? "uncertain" : "ignored",
      };
    used.add(matches[0].key);
    const confident =
      normalized === cleanKey(matches[0].label) ||
      normalized === cleanKey(matches[0].key);
    return {
      source,
      destination: matches[0].key,
      confidence: confident ? "confident" : "uncertain",
    };
  });
}

function parseDelimited(
  text: string,
  delimiter: "," | "\t",
): { headers: string[]; rows: Record<string, string>[] } {
  const matrix: string[][] = [[]];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '"' && quoted && text[i + 1] === '"') {
      cell += '"';
      i += 1;
    } else if (char === '"') quoted = !quoted;
    else if (char === delimiter && !quoted) {
      matrix.at(-1)!.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      matrix.at(-1)!.push(cell);
      cell = "";
      matrix.push([]);
    } else cell += char;
  }
  matrix.at(-1)!.push(cell);
  const [headers = [], ...data] = matrix.filter((row) =>
    row.some((value) => value.trim()),
  );
  return {
    headers,
    rows: data.map((row) =>
      Object.fromEntries(
        headers.map((header, index) => [header, row[index] ?? ""]),
      ),
    ),
  };
}

const cellColumn = (reference: string) =>
  [...reference.replace(/\d/g, "")].reduce(
    (value, char) => value * 26 + char.charCodeAt(0) - 64,
    0,
  ) - 1;
export function parseXlsxBytes(bytes: Uint8Array): {
  headers: string[];
  rows: Record<string, string>[];
} {
  const files = Object.fromEntries(
    Object.entries(unzipSync(bytes)).map(([name, data]) => [
      name,
      strFromU8(data),
    ]),
  );
  const parser = new DOMParser();
  const shared = files["xl/sharedStrings.xml"]
    ? [
        ...parser
          .parseFromString(files["xl/sharedStrings.xml"], "application/xml")
          .querySelectorAll("si"),
      ].map((node) => node.textContent ?? "")
    : [];
  const sheetPath = Object.keys(files).find((path) =>
    /^xl\/worksheets\/sheet\d+\.xml$/.test(path),
  );
  if (!sheetPath) throw new Error("No worksheet was found in this .xlsx file.");
  const matrix = [
    ...parser
      .parseFromString(files[sheetPath], "application/xml")
      .querySelectorAll("sheetData > row"),
  ].map((row) => {
    const cells: string[] = [];
    row.querySelectorAll("c").forEach((cell) => {
      const index = cellColumn(cell.getAttribute("r") ?? "A1");
      const raw =
        cell.querySelector("v")?.textContent ??
        cell.querySelector("t")?.textContent ??
        "";
      cells[index] =
        cell.getAttribute("t") === "s" ? (shared[Number(raw)] ?? "") : raw;
    });
    return cells;
  });
  const [headers = [], ...data] = matrix;
  return {
    headers,
    rows: data.map((row) =>
      Object.fromEntries(
        headers.map((header, index) => [header, row[index] ?? ""]),
      ),
    ),
  };
}

export async function readImportFile(file: File): Promise<ImportSource> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".xls"))
    throw new Error("Legacy .xls is not supported. Save it as .xlsx first.");
  const fileType = name.endsWith(".xlsx")
    ? "xlsx"
    : name.endsWith(".tsv")
      ? "tsv"
      : "csv";
  const table =
    fileType === "xlsx"
      ? parseXlsxBytes(new Uint8Array(await file.arrayBuffer()))
      : parseDelimited(await file.text(), fileType === "tsv" ? "\t" : ",");
  if (!table.headers.length) throw new Error("The file has no header row.");
  const normalized = table.headers.map(cleanKey);
  return {
    filename: file.name,
    fileType,
    detectedFormat:
      normalized.includes("flight id") &&
      normalized.includes("source aircraft text")
        ? "application-csv"
        : "generic",
    ...table,
  };
}

export function parseImportDate(
  value: string,
  format: ImportDateFormat,
): { value: string | null; warning?: string; error?: string } {
  const raw = value.trim();
  if (/^\d{5}(?:\.\d+)?$/.test(raw)) {
    const serial = Number(raw);
    const parsed = new Date(Date.UTC(1899, 11, 30 + Math.floor(serial)));
    return Number.isNaN(parsed.getTime())
      ? { value: null, error: "Invalid Excel date serial." }
      : {
          value: parsed.toISOString().slice(0, 10),
          warning: `Converted Excel date serial ${raw}.`,
        };
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const date = new Date(`${raw}T00:00:00Z`);
    return Number.isNaN(date.getTime()) ||
      date.toISOString().slice(0, 10) !== raw
      ? { value: null, error: "Invalid calendar date." }
      : { value: raw };
  }
  const match = raw.match(/^(\d{1,4})[/-](\d{1,2})[/-](\d{1,4})$/);
  if (!match)
    return {
      value: null,
      error:
        "Unsupported date; use ISO or choose a recognized regional format.",
    };
  if (format === "iso")
    return {
      value: null,
      error: "Ambiguous regional date; choose MDY, DMY, or YMD before import.",
    };
  const numbers = match.slice(1).map(Number);
  let year: number;
  let month: number;
  let day: number;
  if (format === "ymd") [year, month, day] = numbers;
  else if (format === "mdy") [month, day, year] = numbers;
  else [day, month, year] = numbers;
  if (year < 100)
    return { value: null, error: "Two-digit years are not supported." };
  const result = `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
  const parsed = new Date(`${result}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== result
    ? { value: null, error: "Invalid calendar date." }
    : {
        value: result,
        warning: `Converted ${raw} as ${format.toUpperCase()} to ${result}.`,
      };
}

export function parseImportHours(value: string): {
  value: number | null;
  warning?: string;
} {
  const raw = value.trim().replace(/,/g, "");
  if (!raw) return { value: 0 };
  const clock = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (clock) {
    const minutes = Number(clock[1]) * 60 + Number(clock[2]);
    if (Number(clock[2]) > 59) return { value: null };
    const converted = normalizeHours(minutes / 60);
    return {
      value: converted,
      warning:
        converted === null
          ? undefined
          : `Converted ${raw} to ${converted.toFixed(1)} decimal hours.`,
    };
  }
  return { value: normalizeHours(raw) };
}

function passengers(value: string): string[] {
  if (!value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
  } catch {
    /* plain source */
  }
  return value
    .split(/[;|]/)
    .map((item) => item.trim())
    .filter(Boolean);
}
const role = (value: string): FlightDraft["myRole"] =>
  [
    "pic",
    "copilot",
    "student",
    "instructor",
    "solo-student",
    "observer",
    "",
  ].includes(value.trim().toLowerCase())
    ? (value.trim().toLowerCase() as FlightDraft["myRole"])
    : "";
const crewRole = (value: string): FlightDraft["primaryCrewRole"] =>
  ["copilot", "student", "safety-pilot", "other-crew", ""].includes(
    value.trim().toLowerCase(),
  )
    ? (value.trim().toLowerCase() as FlightDraft["primaryCrewRole"])
    : "";

function parseRow(
  row: Record<string, string>,
  mappings: ImportColumnMapping[],
  constants: Partial<Record<ImportDestination, string>>,
  dateFormat: ImportDateFormat,
): Omit<
  StagedImportRow,
  | "rowNumber"
  | "originalValues"
  | "excluded"
  | "manuallyCorrected"
  | "aircraftResolution"
  | "duplicate"
  | "duplicateResolution"
> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const parsedDate = parseImportDate(
    sourceValue(row, mappings, constants, "date"),
    dateFormat,
  );
  if (parsedDate.error) errors.push(parsedDate.error);
  if (parsedDate.warning) warnings.push(parsedDate.warning);
  const values: Record<string, number> = {};
  for (const field of hourFields) {
    const result = parseImportHours(
      sourceValue(row, mappings, constants, field),
    );
    if (result.value === null)
      errors.push(`${field} is invalid or outside the permitted range.`);
    else values[field] = result.value;
    if (result.warning) warnings.push(`${field}: ${result.warning}`);
  }
  for (const field of countFields) {
    const raw = sourceValue(row, mappings, constants, field).trim();
    const value = normalizeCount(raw);
    if (value === null)
      errors.push(`${field} must be a non-negative whole number.`);
    else values[field] = value;
  }
  const total = values.totalTime ?? 0;
  if (total <= 0) errors.push("Total time must be greater than zero.");
  const night = values.night ?? 0;
  const dayRaw = sourceValue(row, mappings, constants, "dayTime").trim();
  const day = dayRaw
    ? (values.dayTime ?? 0)
    : Math.max(0, Number((total - night).toFixed(1)));
  if (!dayRaw)
    warnings.push(
      "Day time was derived as total minus night; confirm this interpretation.",
    );
  const aircraftText = sourceValue(
    row,
    mappings,
    constants,
    "registration",
  ).trim();
  if (!aircraftText)
    errors.push("Aircraft registration or historical identifier is required.");
  const rawRole = sourceValue(row, mappings, constants, "myRole");
  const rawCrewRole = sourceValue(row, mappings, constants, "primaryCrewRole");
  const draft: FlightDraft = {
    date: parsedDate.value ?? "",
    aircraftId: "",
    from: sourceValue(row, mappings, constants, "from").trim(),
    to: sourceValue(row, mappings, constants, "to").trim(),
    route: sourceValue(row, mappings, constants, "route").trim(),
    totalTime: total,
    dayTime: day,
    pic: values.pic ?? 0,
    sic: values.sic ?? 0,
    solo: values.solo ?? 0,
    dualReceived: values.dualReceived ?? 0,
    dualGiven: values.dualGiven ?? 0,
    crossCountry: values.crossCountry ?? 0,
    night,
    actualInstrument: values.actualInstrument ?? 0,
    simulatedInstrument: values.simulatedInstrument ?? 0,
    simTime: values.simTime ?? 0,
    dayTakeoffs: values.dayTakeoffs ?? 0,
    nightTakeoffs: values.nightTakeoffs ?? 0,
    dayLandings: values.dayLandings ?? 0,
    nightLandings: values.nightLandings ?? 0,
    approaches: values.approaches ?? 0,
    holds: values.holds ?? 0,
    remarks: sourceValue(row, mappings, constants, "remarks").trim(),
    sourceAircraftText:
      sourceValue(row, mappings, constants, "sourceAircraftText").trim() ||
      aircraftText,
    myRole: role(rawRole),
    legalPicName: sourceValue(row, mappings, constants, "legalPicName").trim(),
    primaryCrewName: sourceValue(
      row,
      mappings,
      constants,
      "primaryCrewName",
    ).trim(),
    primaryCrewRole: crewRole(rawCrewRole),
    instructorName: sourceValue(
      row,
      mappings,
      constants,
      "instructorName",
    ).trim(),
    passengers: passengers(sourceValue(row, mappings, constants, "passengers")),
    copilotCreditConfirmed: /^(true|yes|1)$/i.test(
      sourceValue(row, mappings, constants, "copilotCreditConfirmed"),
    ),
  };
  if (!draft.from || !draft.to)
    errors.push(
      "Departure and destination are required; use preserved historical text when necessary.",
    );
  if (rawRole.trim() && !draft.myRole)
    warnings.push(
      `User role '${rawRole}' was not recognized and was left unset.`,
    );
  if (rawCrewRole.trim() && !draft.primaryCrewRole)
    warnings.push(
      `Crew role '${rawCrewRole}' was not recognized and was left unset.`,
    );
  errors.push(...validateFlightNumbers(draft));
  if (draft.simTime > 0)
    warnings.push(
      "Simulator time is present; explicitly confirm simulator or FTD classification rather than treating the identifier as an aircraft registration.",
    );
  return {
    parsed: draft,
    originalParsed: { ...draft },
    aircraftText,
    aircraftType: sourceValue(row, mappings, constants, "aircraftType").trim(),
    sourceFlightId:
      sourceValue(row, mappings, constants, "sourceFlightId").trim() ||
      undefined,
    errors: [...new Set(errors)],
    warnings: [...new Set(warnings)],
  };
}

const duplicateKeys = (draft: FlightDraft, aircraftText: string) => ({
  exact: [
    draft.date,
    normalizeRegistration(aircraftText),
    draft.from.trim().toUpperCase(),
    draft.to.trim().toUpperCase(),
    draft.route.trim().toLowerCase(),
    draft.totalTime.toFixed(1),
    draft.myRole ?? "",
    draft.primaryCrewName?.trim().toLowerCase() ?? "",
  ].join("|"),
  likely: [
    draft.date,
    normalizeRegistration(aircraftText),
    draft.from.trim().toUpperCase(),
    draft.to.trim().toUpperCase(),
    draft.totalTime.toFixed(1),
  ].join("|"),
});
export function buildImportWorkspace(
  source: ImportSource,
  mappings: ImportColumnMapping[],
  dateFormat: ImportDateFormat,
  existingFlights: Flight[],
  aircraft: Aircraft[],
  constants: Partial<Record<ImportDestination, string>> = {},
): FlightImportWorkspace {
  const aircraftById = new Map(aircraft.map((item) => [item.id, item]));
  const existingExact = new Map<string, Flight>();
  const existingLikely = new Map<string, Flight[]>();
  existingFlights
    .filter((f) => !f.voidedAt)
    .forEach((f) => {
      const text =
        aircraftById.get(f.aircraftId)?.tailNumber ??
        f.sourceAircraftText ??
        "";
      const keys = duplicateKeys(f, text);
      existingExact.set(keys.exact, f);
      existingLikely.set(keys.likely, [
        ...(existingLikely.get(keys.likely) ?? []),
        f,
      ]);
    });
  const batchExact = new Map<string, StagedImportRow>();
  const batchLikely = new Map<string, StagedImportRow[]>();
  const rows = source.rows.map((originalValues, index): StagedImportRow => {
    const parsed = parseRow(originalValues, mappings, constants, dateFormat);
    const normalized = normalizeRegistration(parsed.aircraftText);
    const match = aircraft.find(
      (item) => normalizeRegistration(item.tailNumber) === normalized,
    );
    const resolution: AircraftResolution = match
      ? { mode: "existing", aircraftId: match.id }
      : { mode: "unresolved" };
    const staged: StagedImportRow = {
      rowNumber: index + 2,
      originalValues: { ...originalValues },
      ...parsed,
      excluded: false,
      manuallyCorrected: false,
      aircraftResolution: resolution,
      duplicateResolution: "skip",
    };
    if (parsed.parsed) {
      const keys = duplicateKeys(parsed.parsed, parsed.aircraftText);
      const sourceIdentity = parsed.sourceFlightId
        ? existingFlights.find(
            (f) =>
              f.id === parsed.sourceFlightId ||
              f.importProvenance?.sourceFlightId === parsed.sourceFlightId,
          )
        : undefined;
      const exact =
        sourceIdentity ??
        existingExact.get(keys.exact) ??
        batchExact.get(keys.exact);
      const likely =
        existingLikely.get(keys.likely)?.[0] ??
        batchLikely.get(keys.likely)?.[0];
      if (exact)
        staged.duplicate = {
          kind: "exact",
          source: "id" in exact ? "existing" : "batch",
          flightId: "id" in exact ? exact.id : undefined,
          rowNumber: "rowNumber" in exact ? exact.rowNumber : undefined,
          detail: sourceIdentity
            ? "The stable source identity already exists."
            : "All primary identity fields match.",
        };
      else if (likely) {
        const likelyDraft = "rowNumber" in likely ? likely.parsed! : likely;
        const sameRoute =
          likelyDraft.route.trim().toLowerCase() ===
          parsed.parsed.route.trim().toLowerCase();
        const sameRole = likelyDraft.myRole === parsed.parsed.myRole;
        staged.duplicate = {
          kind: sameRoute || sameRole ? "likely" : "repeat",
          source: "id" in likely ? "existing" : "batch",
          flightId: "id" in likely ? likely.id : undefined,
          rowNumber: "rowNumber" in likely ? likely.rowNumber : undefined,
          detail:
            sameRoute || sameRole
              ? "Date, aircraft, endpoints, and total time match; review the differing fields."
              : "Core timing matches but route and role differ; this may be a legitimate repeated flight.",
        };
      }
      batchExact.set(keys.exact, staged);
      batchLikely.set(keys.likely, [
        ...(batchLikely.get(keys.likely) ?? []),
        staged,
      ]);
    }
    return staged;
  });
  return {
    ...({ source, mappings, constants, dateFormat, rows } as Omit<
      FlightImportWorkspace,
      "reconciliation"
    >),
    reconciliation: reconcileImport(rows),
  };
}

const measures = [
  ["rows", null],
  ["totalTime", "totalTime"],
  ["pic", "pic"],
  ["sic", "sic"],
  ["dualReceived", "dualReceived"],
  ["dualGiven", "dualGiven"],
  ["crossCountry", "crossCountry"],
  ["night", "night"],
  ["instrument", null],
  ["simTime", "simTime"],
] as const;
export function reconcileImport(rows: StagedImportRow[]): ImportReconciliation {
  const source: Record<string, number | null> = {};
  const imported: Record<string, number> = {};
  const differences: Record<string, number | null> = {};
  for (const [label, field] of measures) {
    const all = rows.filter((r) => r.parsed);
    const ready = rows.filter(
      (r) =>
        r.parsed &&
        !r.errors.length &&
        !r.excluded &&
        (!r.duplicate || r.duplicateResolution === "import") &&
        r.aircraftResolution.mode !== "unresolved",
    );
    const sum = (items: StagedImportRow[]) =>
      label === "rows"
        ? items.length
        : Number(
            items
              .reduce(
                (n, r) =>
                  n +
                  (label === "instrument"
                    ? r.parsed!.actualInstrument + r.parsed!.simulatedInstrument
                    : Number(r.parsed![field as keyof FlightDraft] ?? 0)),
                0,
              )
              .toFixed(1),
          );
    source[label] = all.length ? sum(all) : null;
    imported[label] = sum(ready);
    differences[label] =
      source[label] === null
        ? null
        : Number((imported[label] - source[label]!).toFixed(1));
  }
  return { source, imported, differences, confirmedMismatch: false };
}
export function restageWorkspace(
  workspace: FlightImportWorkspace,
  existingFlights: Flight[],
  aircraft: Aircraft[],
): FlightImportWorkspace {
  return buildImportWorkspace(
    workspace.source,
    workspace.mappings,
    workspace.dateFormat,
    existingFlights,
    aircraft,
    workspace.constants,
  );
}
export async function previewFlightImport(
  file: File,
  existingFlights: Flight[] = [],
  aircraft: Aircraft[] = [],
): Promise<FlightImportWorkspace> {
  const source = await readImportFile(file);
  const mappings = suggestMappings(source.headers);
  return buildImportWorkspace(
    source,
    mappings,
    "iso",
    existingFlights,
    aircraft,
  );
}
