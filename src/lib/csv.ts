import type { Aircraft, Flight } from "../types";
import type { StagedImportRow } from "./flightImport";

export function csvEscape(value: unknown): string {
  if (value === undefined || value === null) return "";
  const raw = typeof value === "object" ? JSON.stringify(value) : String(value);
  const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export const PORTABLE_CSV_COLUMNS = [
  "flightId",
  "aircraftId",
  "aircraft",
  "aircraftType",
  "aircraftRecordKind",
  "sourceAircraftText",
  "date",
  "from",
  "to",
  "route",
  "totalTime",
  "dayTime",
  "night",
  "pic",
  "sic",
  "solo",
  "dualReceived",
  "dualGiven",
  "crossCountry",
  "actualInstrument",
  "simulatedInstrument",
  "simTime",
  "dayTakeoffs",
  "dayLandings",
  "nightTakeoffs",
  "nightLandings",
  "approaches",
  "holds",
  "myRole",
  "legalPicName",
  "primaryCrewName",
  "primaryCrewRole",
  "instructorName",
  "passengers",
  "copilotCreditConfirmed",
  "remarks",
  "status",
  "voidedAt",
  "voidReason",
  "amendmentCount",
  "importBatchId",
  "importSourceRow",
  "importSourceFlightId",
  "importWarnings",
  "importManuallyCorrected",
  "importOriginalValues",
] as const;

export function flightsToCsv(flights: Flight[], aircraft: Aircraft[]): string {
  const byId = new Map(aircraft.map((item) => [item.id, item]));
  const rows = flights
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((flight) => {
      const ac = byId.get(flight.aircraftId);
      const values: Record<string, unknown> = {
        flightId: flight.id,
        aircraftId: flight.aircraftId,
        aircraft: ac?.tailNumber ?? "",
        aircraftType: ac?.makeModel ?? "",
        aircraftRecordKind: ac?.recordKind ?? "aircraft",
        sourceAircraftText: flight.sourceAircraftText,
        date: flight.date,
        from: flight.from,
        to: flight.to,
        route: flight.route,
        totalTime: flight.totalTime,
        dayTime: flight.dayTime,
        night: flight.night,
        pic: flight.pic,
        sic: flight.sic,
        solo: flight.solo,
        dualReceived: flight.dualReceived,
        dualGiven: flight.dualGiven,
        crossCountry: flight.crossCountry,
        actualInstrument: flight.actualInstrument,
        simulatedInstrument: flight.simulatedInstrument,
        simTime: flight.simTime,
        dayTakeoffs: flight.dayTakeoffs,
        dayLandings: flight.dayLandings,
        nightTakeoffs: flight.nightTakeoffs,
        nightLandings: flight.nightLandings,
        approaches: flight.approaches,
        holds: flight.holds,
        myRole: flight.myRole,
        legalPicName: flight.legalPicName,
        primaryCrewName: flight.primaryCrewName,
        primaryCrewRole: flight.primaryCrewRole,
        instructorName: flight.instructorName,
        passengers: flight.passengers,
        copilotCreditConfirmed: flight.copilotCreditConfirmed,
        remarks: flight.remarks,
        status: flight.voidedAt ? "voided" : "active",
        voidedAt: flight.voidedAt,
        voidReason: flight.voidReason,
        amendmentCount: flight.amendments?.length ?? 0,
        importBatchId: flight.importProvenance?.batchId,
        importSourceRow: flight.importProvenance?.sourceRow,
        importSourceFlightId: flight.importProvenance?.sourceFlightId,
        importWarnings: flight.importProvenance?.warnings,
        importManuallyCorrected: flight.importProvenance?.manuallyCorrected,
        importOriginalValues: flight.importProvenance?.originalValues,
      };
      return PORTABLE_CSV_COLUMNS.map((column) =>
        csvEscape(values[column]),
      ).join(",");
    });
  return [PORTABLE_CSV_COLUMNS.join(","), ...rows].join("\n");
}

export function rejectedRowsToCsv(rows: StagedImportRow[]): string {
  const header = [
    "sourceRow",
    "status",
    "originalValues",
    "parsedValues",
    "errors",
    "warnings",
    "suggestedCorrection",
  ];
  const rejected = rows.filter(
    (row) =>
      row.errors.length ||
      row.excluded ||
      row.aircraftResolution.mode === "unresolved" ||
      (row.duplicate && row.duplicateResolution === "skip"),
  );
  const lines = rejected.map((row) =>
    [
      row.rowNumber,
      rowStatus(row),
      row.originalValues,
      row.parsed ?? "",
      row.errors,
      row.warnings,
      suggestion(row),
    ]
      .map(csvEscape)
      .join(","),
  );
  return [header.join(","), ...lines].join("\n");
}
function rowStatus(row: StagedImportRow) {
  if (row.errors.length) return "rejected";
  if (row.excluded) return "excluded";
  if (row.aircraftResolution.mode === "unresolved")
    return "aircraft unresolved";
  if (row.duplicate && row.duplicateResolution === "skip")
    return "duplicate skipped";
  return "warning";
}
function suggestion(row: StagedImportRow) {
  if (row.errors.length)
    return "Correct the listed values and stage the row again.";
  if (row.aircraftResolution.mode === "unresolved")
    return "Choose an existing, new, historical, simulator, or FTD record.";
  if (row.duplicate)
    return "Confirm whether to keep the existing entry or import a legitimate repeat.";
  return "Review the staged row.";
}

export function downloadTextFile(
  filename: string,
  contents: string,
  mime: string,
) {
  const blob = new Blob([contents], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
