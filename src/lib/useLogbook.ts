import { useEffect, useMemo, useRef, useState } from "react";
import type {
  Aircraft,
  AircraftDraft,
  Flight,
  FlightDraft,
  PilotProfile,
  Qualification,
  QualificationDraft,
  ImportBatch,
  ImportMappingTemplate,
} from "../types";
import {
  commitImportDocument,
  isExternalRevision,
  loadLogbookDocument,
  persistLogbookDocument,
  ROOT_DOCUMENT_KEY,
} from "./storage";
import type { LogbookDocument } from "./dataModel";
import { newId } from "./id";
import type { FlightImportWorkspace } from "./flightImport";
import {
  isDuplicateRegistration,
  normalizeRegistration,
} from "./aircraftRegistry";

export type ImportResolution =
  | { mode: "existing"; aircraftId: string }
  | { mode: "aircraft" | "historical" | "simulator" | "ftd" };

export function useLogbook() {
  const [loaded] = useState(() => loadLogbookDocument());
  const [aircraft, setAircraft] = useState<Aircraft[]>(
    loaded.document.aircraft,
  );
  const [flights, setFlights] = useState<Flight[]>(loaded.document.flights);
  const [profile, setProfile] = useState<PilotProfile>(loaded.document.profile);
  const [uncertainties, setUncertainties] = useState(
    loaded.document.uncertainties,
  );
  const [importBatches, setImportBatches] = useState(
    loaded.document.importBatches,
  );
  const [importTemplates, setImportTemplates] = useState(
    loaded.document.importTemplates,
  );
  const documentRef = useRef(loaded.document);
  const revisionRef = useRef(loaded.document.revision);
  const [storageWarning, setStorageWarning] = useState(loaded.warning ?? "");
  const [multiTabConflict, setMultiTabConflict] = useState(false);
  const writesBlocked = Boolean(
    (loaded.warning && !loaded.recoveredFrom) || multiTabConflict,
  );

  /* oxlint-disable react/set-state-in-effect */
  useEffect(() => {
    if (writesBlocked) return;
    try {
      const saved = persistLogbookDocument({
        ...documentRef.current,
        aircraft,
        flights,
        profile,
        importBatches,
        importTemplates,
        revision: revisionRef.current,
      });
      documentRef.current = saved;
      revisionRef.current = saved.revision;
      setStorageWarning("");
    } catch (error) {
      setStorageWarning(
        error instanceof Error ? error.message : "Logbook save failed.",
      );
    }
  }, [
    aircraft,
    flights,
    profile,
    importBatches,
    importTemplates,
    writesBlocked,
  ]);
  /* oxlint-enable react/set-state-in-effect */

  useEffect(() => {
    const listener = (event: StorageEvent) => {
      if (event.key === ROOT_DOCUMENT_KEY && event.newValue) {
        try {
          const incoming = JSON.parse(event.newValue) as { revision?: string };
          if (isExternalRevision(revisionRef.current, incoming.revision))
            setMultiTabConflict(true);
        } catch {
          setStorageWarning(
            "Another tab wrote unreadable logbook data. This tab stopped automatic conflict resolution.",
          );
        }
      }
    };
    window.addEventListener("storage", listener);
    return () => window.removeEventListener("storage", listener);
  }, []);
  useEffect(() => {
    const listener = (event: Event) => {
      const document = (event as CustomEvent<LogbookDocument>).detail;
      if (document) {
        documentRef.current = document;
        revisionRef.current = document.revision;
      }
    };
    window.addEventListener("logbook-document-written", listener);
    return () =>
      window.removeEventListener("logbook-document-written", listener);
  }, []);

  const aircraftById = useMemo(
    () => new Map(aircraft.map((a) => [a.id, a])),
    [aircraft],
  );

  function addAircraft(draft: AircraftDraft): Aircraft {
    const isRegistered = !draft.recordKind || draft.recordKind === "aircraft";
    const tailNumber = isRegistered
      ? normalizeRegistration(draft.tailNumber)
      : draft.tailNumber.trim();
    if (isRegistered && isDuplicateRegistration(aircraft, tailNumber))
      throw new Error("An aircraft with this registration already exists.");
    const created: Aircraft = { ...draft, tailNumber, id: newId() };
    setAircraft((prev) => [
      ...prev.map((a) =>
        draft.defaultAircraft ? { ...a, defaultAircraft: false } : a,
      ),
      created,
    ]);
    return created;
  }

  function updateAircraft(id: string, draft: AircraftDraft) {
    const isRegistered = !draft.recordKind || draft.recordKind === "aircraft";
    const tailNumber = isRegistered
      ? normalizeRegistration(draft.tailNumber)
      : draft.tailNumber.trim();
    if (isRegistered && isDuplicateRegistration(aircraft, tailNumber, id))
      throw new Error("An aircraft with this registration already exists.");
    setAircraft((prev) =>
      prev.map((a) =>
        a.id === id
          ? { ...draft, tailNumber, id }
          : draft.defaultAircraft
            ? { ...a, defaultAircraft: false }
            : a,
      ),
    );
  }

  function deleteAircraft(id: string) {
    setAircraft((prev) =>
      prev.map((a) =>
        a.id === id
          ? { ...a, archived: true, defaultAircraft: false, favourite: false }
          : a,
      ),
    );
  }

  function addFlight(draft: FlightDraft): Flight {
    const created: Flight = { ...draft, id: newId() };
    setFlights((prev) => [...prev, created]);
    return created;
  }

  function updateFlight(id: string, draft: FlightDraft, reason: string) {
    setFlights((prev) =>
      prev.map((f) => {
        if (f.id !== id || f.voidedAt) return f;
        const {
          id: _id,
          voidedAt: _voidedAt,
          voidReason: _voidReason,
          amendments: _amendments,
          ...previous
        } = f;
        return {
          ...draft,
          id,
          amendments: [
            ...(f.amendments ?? []),
            {
              amendedAt: new Date().toISOString(),
              reason: reason.trim(),
              previous,
            },
          ],
        };
      }),
    );
  }

  function voidFlight(id: string, reason: string) {
    setFlights((prev) =>
      prev.map((f) =>
        f.id === id && !f.voidedAt
          ? {
              ...f,
              voidedAt: new Date().toISOString(),
              voidReason: reason.trim(),
            }
          : f,
      ),
    );
  }

  function replaceAll(
    nextAircraft: Aircraft[],
    nextFlights: Flight[],
    nextProfile?: PilotProfile,
  ) {
    setAircraft(nextAircraft);
    setFlights(nextFlights);
    if (nextProfile) setProfile(nextProfile);
  }

  function updateProfile(patch: Partial<Omit<PilotProfile, "qualifications">>) {
    setProfile((prev) => ({ ...prev, ...patch }));
  }

  function addQualification(draft: QualificationDraft): Qualification {
    const created: Qualification = { ...draft, id: newId() };
    setProfile((prev) => ({
      ...prev,
      qualifications: [...prev.qualifications, created],
    }));
    return created;
  }

  function updateQualification(id: string, draft: QualificationDraft) {
    setProfile((prev) => ({
      ...prev,
      qualifications: prev.qualifications.map((q) =>
        q.id === id ? { ...draft, id } : q,
      ),
    }));
  }

  function deleteQualification(id: string) {
    setProfile((prev) => ({
      ...prev,
      qualifications: prev.qualifications.filter((q) => q.id !== id),
    }));
  }

  function addLicenseGoal(templateId: string) {
    setProfile((prev) =>
      prev.trackedLicenseGoals.includes(templateId)
        ? prev
        : {
            ...prev,
            trackedLicenseGoals: [...prev.trackedLicenseGoals, templateId],
          },
    );
  }

  function applyDocument(document: LogbookDocument) {
    documentRef.current = document;
    revisionRef.current = document.revision;
    setAircraft(document.aircraft);
    setFlights(document.flights);
    setProfile(document.profile);
    setUncertainties(document.uncertainties);
    setImportBatches(document.importBatches);
    setImportTemplates(document.importTemplates);
    setMultiTabConflict(false);
  }

  function commitImport(
    workspace: FlightImportWorkspace,
    confirmedMismatch: boolean,
  ): ImportBatch {
    const batchId = newId();
    const additions: Aircraft[] = [];
    const created: Flight[] = [];
    const resolved = new Map<string, string>();
    for (const row of workspace.rows) {
      if (
        !row.parsed ||
        row.errors.length ||
        row.excluded ||
        (row.duplicate && row.duplicateResolution === "skip")
      )
        continue;
      const key = `${normalizeRegistration(row.aircraftText)}|${row.aircraftResolution.mode}`;
      let aircraftId =
        row.aircraftResolution.mode === "existing"
          ? row.aircraftResolution.aircraftId
          : resolved.get(key);
      if (
        !aircraftId &&
        row.aircraftResolution.mode !== "unresolved" &&
        row.aircraftResolution.mode !== "existing"
      ) {
        aircraftId = newId();
        const kind: "aircraft" | "historical" | "simulator" | "ftd" =
          row.aircraftResolution.mode;
        additions.push({
          id: aircraftId,
          tailNumber:
            kind === "aircraft"
              ? normalizeRegistration(row.aircraftText)
              : row.aircraftText.trim() || `Historical ${row.rowNumber}`,
          makeModel: row.aircraftType || "Imported record — review",
          category: "Other",
          recordKind: kind,
          isComplex: false,
          isHighPerformance: false,
          isTailwheel: false,
          isTaa: false,
          notes: `Created from import batch ${batchId}; pilot confirmation required.`,
        });
        resolved.set(key, aircraftId);
      }
      if (!aircraftId) continue;
      created.push({
        ...row.parsed,
        id: newId(),
        aircraftId,
        importProvenance: {
          batchId,
          sourceRow: row.rowNumber,
          sourceFlightId: row.sourceFlightId,
          originalValues: row.originalValues,
          warnings: row.warnings,
          manuallyCorrected: row.manuallyCorrected,
        },
      });
    }
    const rejectedRows = workspace.rows.filter(
      (row) => row.errors.length > 0,
    ).length;
    const skippedRows = workspace.rows.filter(
      (row) =>
        row.errors.length === 0 &&
        (row.excluded ||
          (row.duplicate && row.duplicateResolution === "skip") ||
          row.aircraftResolution.mode === "unresolved"),
    ).length;
    const reconciliation = { ...workspace.reconciliation, confirmedMismatch };
    const batch: ImportBatch = {
      id: batchId,
      sourceFilename: workspace.source.filename,
      fileType: workspace.source.fileType,
      importedAt: new Date().toISOString(),
      detectedFormat: workspace.source.detectedFormat,
      originalColumns: workspace.source.headers,
      rowCount: workspace.rows.length,
      acceptedRows: created.length,
      rejectedRows,
      skippedRows,
      duplicateRows: workspace.rows.filter((row) => Boolean(row.duplicate))
        .length,
      warningCount: workspace.rows.reduce(
        (total, row) => total + row.warnings.length,
        0,
      ),
      flightIds: created.map((flight) => flight.id),
      reconciliation,
    };
    const candidate: LogbookDocument = {
      ...documentRef.current,
      aircraft: [...aircraft, ...additions],
      flights: [...flights, ...created],
      importBatches: [...importBatches, batch],
      importTemplates,
    };
    const saved = commitImportDocument(
      candidate,
      revisionRef.current,
      localStorage,
      (document) => {
        const savedRows = document.flights.filter(
          (flight) => flight.importProvenance?.batchId === batchId,
        );
        const savedAircraftIds = new Set(
          document.aircraft.map((item) => item.id),
        );
        const missingAircraft = savedRows.filter(
          (flight) => !savedAircraftIds.has(flight.aircraftId),
        );
        const totals: Record<string, number> = {
          rows: savedRows.length,
          totalTime: 0,
          pic: 0,
          sic: 0,
          dualReceived: 0,
          dualGiven: 0,
          crossCountry: 0,
          night: 0,
          instrument: 0,
          simTime: 0,
        };
        savedRows.forEach((flight) => {
          totals.totalTime += flight.totalTime;
          totals.pic += flight.pic;
          totals.sic += flight.sic;
          totals.dualReceived += flight.dualReceived;
          totals.dualGiven += flight.dualGiven;
          totals.crossCountry += flight.crossCountry;
          totals.night += flight.night;
          totals.instrument +=
            flight.actualInstrument + flight.simulatedInstrument;
          totals.simTime += flight.simTime;
        });
        return [
          ...(missingAircraft.length
            ? [
                `${missingAircraft.length} saved flights reference missing aircraft.`,
              ]
            : []),
          ...Object.entries(workspace.reconciliation.imported)
            .filter(
              ([key, value]) =>
                Math.abs(Number((totals[key] ?? 0).toFixed(1)) - value) > 0.001,
            )
            .map(([key]) => `${key} differs after save.`),
        ];
      },
    );
    applyDocument(saved);
    return batch;
  }

  function saveImportTemplate(template: ImportMappingTemplate) {
    setImportTemplates((current) => [
      ...current.filter(
        (item) => item.id !== template.id && item.name !== template.name,
      ),
      template,
    ]);
  }

  function removeLicenseGoal(templateId: string) {
    setProfile((prev) => ({
      ...prev,
      trackedLicenseGoals: prev.trackedLicenseGoals.filter(
        (id) => id !== templateId,
      ),
    }));
  }

  return {
    aircraft,
    flights,
    profile,
    uncertainties,
    importBatches,
    importTemplates,
    aircraftById,
    addAircraft,
    updateAircraft,
    deleteAircraft,
    addFlight,
    updateFlight,
    voidFlight,
    replaceAll,
    applyDocument,
    storageWarning,
    multiTabConflict,
    updateProfile,
    addQualification,
    updateQualification,
    deleteQualification,
    addLicenseGoal,
    removeLicenseGoal,
    commitImport,
    saveImportTemplate,
  };
}

export type LogbookStore = ReturnType<typeof useLogbook>;
