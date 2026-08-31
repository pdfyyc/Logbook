import type { Aircraft, Flight } from "../types";
import type { MigrationUncertainty } from "./dataModel";
import { normalizeRegistration } from "./aircraftRegistry";
import { peopleConflicts } from "./flightEntryUx";
import { validateFlightNumbers } from "./numericPolicy";

export type HealthIssueLevel =
  "informational" | "warning" | "error" | "uncertainty";
export interface LogbookHealthIssue {
  id: string;
  level: HealthIssueLevel;
  title: string;
  detail: string;
  flightIds: string[];
  suggestion: string;
}

const dateValid = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
const identity = (flight: Flight, aircraft?: Aircraft) =>
  `${flight.date || "Undated entry"} · ${aircraft?.tailNumber || flight.sourceAircraftText || "unknown aircraft"} · ${flight.from || "?"} → ${flight.to || "?"}`;
const nameKey = (value = "") =>
  value.trim().replace(/\s+/g, " ").toLocaleLowerCase();

/** Deterministic review flags only. This never changes records or authoritative totals. */
export function checkLogbookHealth(
  flights: Flight[],
  aircraftById: Map<string, Aircraft>,
  uncertainties: MigrationUncertainty[] = [],
  importBatchIds?: Set<string>,
): LogbookHealthIssue[] {
  const issues: LogbookHealthIssue[] = [];
  const seenIds = new Set<string>();
  const duplicateGroups = new Map<string, Flight[]>();
  const add = (issue: LogbookHealthIssue) => {
    if (!seenIds.has(issue.id)) {
      seenIds.add(issue.id);
      issues.push(issue);
    }
  };
  const today = new Date().toISOString().slice(0, 10);
  flights.forEach((flight, index) => {
    if (flight.voidedAt) return;
    const aircraft = aircraftById.get(flight.aircraftId);
    const label = identity(flight, aircraft);
    if (!dateValid(flight.date))
      add({
        id: `date-${flight.id}`,
        level: "error",
        title: "Invalid or unparseable flight date",
        detail: `${label}. This entry cannot be placed reliably in date-based totals or recency windows.`,
        flightIds: [flight.id],
        suggestion: "Review this entry and enter a valid calendar date.",
      });
    else if (flight.date > today)
      add({
        id: `future-date-${flight.id}`,
        level: "warning",
        title: "Future-dated flight",
        detail: `${label}. The date is later than today.`,
        flightIds: [flight.id],
        suggestion: "Review whether this future date was intentional.",
      });
    if (!aircraft)
      add({
        id: `missing-aircraft-${flight.id}`,
        level: "error",
        title: "Missing aircraft reference",
        detail: `${label}. The linked aircraft record cannot be found.`,
        flightIds: [flight.id],
        suggestion:
          "Choose the correct preserved aircraft or historical record before relying on this entry.",
      });
    else {
      const actualAircraft =
        !aircraft.recordKind || aircraft.recordKind === "aircraft";
      if (!aircraft.makeModel?.trim())
        add({
          id: `aircraft-type-${flight.id}`,
          level: "warning",
          title: "Aircraft type is missing",
          detail: `${label}. The linked record has no aircraft type or model.`,
          flightIds: [flight.id],
          suggestion: "Review the aircraft record and confirm its type.",
        });
      if (actualAircraft && !normalizeRegistration(aircraft.tailNumber ?? ""))
        add({
          id: `registration-${flight.id}`,
          level: "warning",
          title: "Aircraft registration is missing",
          detail: `${label}. A registered-aircraft entry has no usable registration.`,
          flightIds: [flight.id],
          suggestion:
            "Review the aircraft record or use a historical record when the registration is genuinely unknown.",
        });
      if (aircraft.recordKind === "historical")
        add({
          id: `historical-aircraft-${flight.id}`,
          level: "informational",
          title: "Historical or unresolved aircraft",
          detail: `${label}. This entry is intentionally connected to a historical aircraft record and is excluded from authoritative category assumptions.`,
          flightIds: [flight.id],
          suggestion:
            "Confirm the preserved aircraft text; link a verified aircraft only when evidence is available.",
        });
    }
    if (!flight.from.trim() || !flight.to.trim())
      add({
        id: `route-endpoint-${flight.id}`,
        level: "error",
        title: "Departure or destination is missing",
        detail: `${label}. One or both route endpoints are blank.`,
        flightIds: [flight.id],
        suggestion:
          "Enter both departure and destination, using preserved historical text where necessary.",
      });
    const numeric = validateFlightNumbers(flight);
    if (numeric.length) {
      const role = numeric
        .find((message) =>
          /^(pic|sic|dualReceived|dualGiven) cannot exceed/.test(message),
        )
        ?.split(" ")[0];
      const roleId =
        role === "sic"
          ? "sic"
          : role === "dualReceived"
            ? "dual-received"
            : role === "dualGiven"
              ? "dual-given"
              : "pic";
      add({
        id: role ? `role-${roleId}-total-${flight.id}` : `numeric-${flight.id}`,
        level: "error",
        title: "Flight time or count values need review",
        detail: `${label}. ${numeric.join(" ")}`,
        flightIds: [flight.id],
        suggestion:
          "Correct the time or operation counts before using this entry in totals.",
      });
    }
    if (
      (flight.dayTakeoffs ?? 0) + (flight.nightTakeoffs ?? 0) > 0 &&
      flight.dayLandings + flight.nightLandings === 0
    )
      add({
        id: `movement-${flight.id}`,
        level: "warning",
        title: "Takeoffs are recorded without a landing",
        detail: `${label}. This can be legitimate, but deserves review.`,
        flightIds: [flight.id],
        suggestion:
          "Confirm the movement counts; do not change them if this was intentional.",
      });
    if (
      flight.approaches > 0 &&
      flight.actualInstrument + flight.simulatedInstrument === 0
    )
      add({
        id: `instrument-${flight.id}`,
        level: "warning",
        title: "Approaches recorded without instrument time",
        detail: `${label}. Approaches are present while both instrument-time fields are zero.`,
        flightIds: [flight.id],
        suggestion:
          "Review the approach count and instrument time; either value may be correct for the operation.",
      });
    if (flight.dualReceived > 0 && flight.dualGiven > 0)
      add({
        id: `dual-conflict-${flight.id}`,
        level: "warning",
        title: "Dual received and instructor time both entered",
        detail: `${label}. Both categories are present for one pilot entry.`,
        flightIds: [flight.id],
        suggestion:
          "Review whether you were receiving or providing instruction.",
      });
    if (flight.totalTime > 24)
      add({
        id: `large-duration-${flight.id}`,
        level: "warning",
        title: "Suspiciously large flight duration",
        detail: `${label}. ${flight.totalTime.toFixed(1)} hours is unusually large for one flight entry.`,
        flightIds: [flight.id],
        suggestion: "Confirm this is not a decimal or cumulative-total entry.",
      });
    if (flight.night > flight.totalTime + 0.001)
      add({
        id: `night-total-${flight.id}`,
        level: "error",
        title: "Night time exceeds total time",
        detail: `${label}. Night time cannot exceed the applicable flight total.`,
        flightIds: [flight.id],
        suggestion:
          "Correct the total or night field using the original record.",
      });
    if (
      flight.actualInstrument + flight.simulatedInstrument >
      flight.totalTime + flight.simTime + 0.001
    )
      add({
        id: `instrument-total-${flight.id}`,
        level: "error",
        title: "Instrument time exceeds flight/device time",
        detail: `${label}. Instrument totals exceed the available flight and simulator/FTD time.`,
        flightIds: [flight.id],
        suggestion:
          "Review instrument and simulator fields against the original record.",
      });
    if (
      flight.importProvenance &&
      importBatchIds &&
      !importBatchIds.has(flight.importProvenance.batchId)
    )
      add({
        id: `orphan-import-${flight.id}`,
        level: "warning",
        title: "Orphaned import provenance",
        detail: `${label}. The flight refers to an import batch that is no longer present.`,
        flightIds: [flight.id],
        suggestion:
          "Preserve the flight and restore the matching JSON backup or document the missing batch before relying on import reconciliation.",
      });
    const rawPeople = [
      flight.legalPicName,
      flight.primaryCrewName,
      flight.instructorName,
      ...(flight.passengers ?? []),
    ];
    const nonempty = rawPeople.filter((value): value is string =>
      Boolean(value?.trim()),
    );
    const malformed =
      (flight.passengers ?? []).some((value) => !value.trim()) ||
      new Set(nonempty.map(nameKey)).size !== nonempty.length ||
      peopleConflicts(flight).length > 0;
    if (malformed)
      add({
        id: `people-${flight.id}`,
        level: "warning",
        title: "People or passenger roles need review",
        detail: `${label}. A blank, duplicate, or contradictory person entry was detected.`,
        flightIds: [flight.id],
        suggestion:
          "Review names and make sure each person appears in the correct crew or passenger role.",
      });
    const key = [
      flight.date,
      flight.aircraftId,
      flight.from.trim().toUpperCase(),
      flight.to.trim().toUpperCase(),
      Number.isFinite(flight.totalTime)
        ? flight.totalTime.toFixed(1)
        : String(flight.totalTime),
      flight.myRole ?? "",
    ].join("|");
    duplicateGroups.set(key, [...(duplicateGroups.get(key) ?? []), flight]);
    const migration = uncertainties.filter((item) =>
      item.path.startsWith(`flights[${index}].`),
    );
    if (migration.length)
      add({
        id: `migration-${flight.id}`,
        level: "uncertainty",
        title: "Legacy values were inferred",
        detail: `${label}. ${migration.map((item) => item.reason).join(" ")}`,
        flightIds: [flight.id],
        suggestion:
          "Compare this entry with the source logbook and amend it only if you can confirm the original values.",
      });
  });
  for (const group of duplicateGroups.values())
    if (group.length > 1) {
      const first = group[0];
      add({
        id: `duplicate-${group
          .map((flight) => flight.id)
          .sort()
          .join("-")}`,
        level: "warning",
        title: "Possible duplicate flights",
        detail: `${group.length} active entries share the same date, aircraft, route, total time, and logged role: ${identity(first, aircraftById.get(first.aircraftId))}.`,
        flightIds: group.map((flight) => flight.id),
        suggestion:
          "Review each entry and void only an accidental duplicate; repeated legitimate flights can remain.",
      });
    }
  return issues;
}
