import type {
  Aircraft,
  Flight,
  FlightDraft,
  ImportBatch,
  ImportMappingTemplate,
  PilotProfile,
} from "../types";
import type { WeatherSnapshot } from "./weather";
import {
  migrateBackup,
  migrateLegacy,
  ROOT_SCHEMA_VERSION,
  validateDocument,
  type LogbookDocument,
} from "./dataModel";

const AIRCRAFT_KEY = "logbook:aircraft";
const FLIGHTS_KEY = "logbook:flights";
const THEME_KEY = "logbook:theme";
const PROFILE_KEY = "logbook:profile";
const WEATHER_KEY = "logbook:weather";
const METAR_ICAO_KEY = "logbook:metarIcao";
export const ROOT_DOCUMENT_KEY = "logbook:document";
export const LAST_GOOD_KEY = "logbook:lastGood";
export const JOURNAL_KEY = "logbook:journal";
export const IMPORT_RECOVERY_KEY = "logbook:importRecovery";

function read<T>(key: string, fallback: T, storage: Storage = localStorage): T {
  try {
    const raw = storage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage unavailable (private mode, quota) — fail silently, in-memory state still works
  }
}

export interface LoadLogbookResult {
  document: LogbookDocument;
  warning?: string;
  recoveredFrom?: "last-good" | "journal" | "legacy";
}
export function isExternalRevision(current: string, incoming: unknown) {
  return (
    typeof incoming === "string" && incoming.length > 0 && incoming !== current
  );
}

export function loadLogbookDocument(
  storage: Storage = localStorage,
): LoadLogbookResult {
  const rootRaw = storage.getItem(ROOT_DOCUMENT_KEY);
  if (rootRaw) {
    try {
      const document = migrateBackup(JSON.parse(rootRaw));
      return { document };
    } catch {
      for (const [key, source] of [
        [LAST_GOOD_KEY, "last-good"],
        [JOURNAL_KEY, "journal"],
      ] as const) {
        const raw = storage.getItem(key);
        if (!raw) continue;
        try {
          const document = migrateBackup(JSON.parse(raw));
          return {
            document,
            warning: `The main logbook data was unreadable. A validated ${source} recovery copy was loaded instead.`,
            recoveredFrom: source,
          };
        } catch {
          /* try next generation */
        }
      }
      return {
        document: migrateLegacy([], [], {}),
        warning: `Logbook data is corrupt and no valid recovery generation was found. The corrupt value was preserved under ${ROOT_DOCUMENT_KEY}; do not overwrite it.`,
        recoveredFrom: undefined,
      };
    }
  }
  const document = migrateLegacy(
    read<Aircraft[]>(AIRCRAFT_KEY, [], storage),
    read<Flight[]>(FLIGHTS_KEY, [], storage),
    read<Partial<PilotProfile>>(PROFILE_KEY, {}, storage),
    read<never>("logbook:flightDraft", undefined as never, storage),
  );
  return { document, recoveredFrom: "legacy" };
}

export function persistLogbookDocument(
  document: LogbookDocument,
  storage: Storage = localStorage,
): LogbookDocument {
  const next: LogbookDocument = {
    ...document,
    schemaVersion: ROOT_SCHEMA_VERSION,
    savedAt: new Date().toISOString(),
    revision: crypto.randomUUID(),
  };
  const validation = validateDocument(next);
  if (!validation.valid) throw new Error(validation.errors.join(" "));
  const serialized = JSON.stringify(next);
  const previous = storage.getItem(ROOT_DOCUMENT_KEY);
  try {
    storage.setItem(JOURNAL_KEY, serialized);
    storage.setItem(ROOT_DOCUMENT_KEY, serialized);
    const verified = storage.getItem(ROOT_DOCUMENT_KEY);
    if (!verified || !validateDocument(JSON.parse(verified)).valid)
      throw new Error("The saved logbook could not be verified.");
    storage.setItem(LAST_GOOD_KEY, serialized);
    storage.removeItem(JOURNAL_KEY);
    return next;
  } catch (error) {
    try {
      if (previous === null) storage.removeItem(ROOT_DOCUMENT_KEY);
      else storage.setItem(ROOT_DOCUMENT_KEY, previous);
    } catch {
      /* preserve original error */
    }
    throw new Error(
      error instanceof DOMException && error.name === "QuotaExceededError"
        ? "Browser storage is full. Download a recovery backup before adding more data."
        : `Logbook save failed and was rolled back: ${error instanceof Error ? error.message : "unknown storage error"}`,
    );
  }
}

export function restoreLogbookDocument(
  candidate: unknown,
  storage: Storage = localStorage,
): { document: LogbookDocument; recoveryBackup: string } {
  const migrated = migrateBackup(candidate);
  const validation = validateDocument(migrated);
  if (!validation.valid) throw new Error(validation.errors.join(" "));
  const current = loadLogbookDocument(storage).document;
  const recoveryBackup = JSON.stringify(current, null, 2);
  const restored = persistLogbookDocument(migrated, storage);
  return { document: restored, recoveryBackup };
}

export function commitImportDocument(
  candidate: LogbookDocument,
  expectedRevision: string,
  storage: Storage = localStorage,
  verifyImport?: (document: LogbookDocument) => string[],
): LogbookDocument {
  const live = loadLogbookDocument(storage).document;
  if (live.revision !== expectedRevision)
    throw new Error(
      "The logbook changed after import review began. Reload and review the import again.",
    );
  const validation = validateDocument(candidate);
  if (!validation.valid)
    throw new Error(`Import validation failed: ${validation.errors.join(" ")}`);
  const recovery = JSON.stringify(live);
  storage.setItem(IMPORT_RECOVERY_KEY, recovery);
  try {
    const saved = persistLogbookDocument(
      { ...candidate, revision: live.revision },
      storage,
    );
    const verified = loadLogbookDocument(storage).document;
    if (
      verified.revision !== saved.revision ||
      verified.flights.length !== saved.flights.length ||
      verified.importBatches.length !== saved.importBatches.length
    )
      throw new Error("Saved import did not verify against the staged result.");
    const verificationErrors = verifyImport?.(verified) ?? [];
    if (verificationErrors.length)
      throw new Error(
        `Saved import reconciliation failed: ${verificationErrors.join(" ")}`,
      );
    return verified;
  } catch (error) {
    try {
      storage.setItem(ROOT_DOCUMENT_KEY, recovery);
      storage.setItem(LAST_GOOD_KEY, recovery);
      storage.removeItem(JOURNAL_KEY);
    } catch {
      /* retain original error */
    }
    throw new Error(
      `Import failed and the complete pre-import logbook was restored: ${error instanceof Error ? error.message : "unknown error"}`,
    );
  }
}

export function loadFlightDraftMetadata():
  LogbookDocument["draft"] | undefined {
  const documentDraft = loadLogbookDocument().document.draft;
  if (documentDraft) return documentDraft;
  const legacy = read<FlightDraft | undefined>(
    "logbook:flightDraft",
    undefined,
  );
  return legacy ? { value: legacy, updatedAt: "" } : undefined;
}
export function saveFlightDraftMetadata(draft?: FlightDraft) {
  const current = loadLogbookDocument().document;
  const saved = persistLogbookDocument({
    ...current,
    draft: draft
      ? { value: draft, updatedAt: new Date().toISOString() }
      : undefined,
  });
  window.dispatchEvent(
    new CustomEvent("logbook-document-written", { detail: saved }),
  );
}

export function loadTheme(): "light" | "dark" {
  return read<"light" | "dark">(THEME_KEY, "dark");
}

export function saveTheme(theme: "light" | "dark") {
  write(THEME_KEY, theme);
}

export function loadWeatherCache(): WeatherSnapshot | null {
  return read<WeatherSnapshot | null>(WEATHER_KEY, null);
}

export function saveWeatherCache(snapshot: WeatherSnapshot) {
  write(WEATHER_KEY, snapshot);
}

/** A user-chosen ICAO override for the airport briefing widget — null means
 *  "follow the nearest-detected airport" rather than a fixed choice. */
export function loadMetarIcaoOverride(): string | null {
  return read<string | null>(METAR_ICAO_KEY, null);
}

export function saveMetarIcaoOverride(icao: string | null) {
  write(METAR_ICAO_KEY, icao);
}

export interface LogbookExport {
  version: 1 | 2 | 3;
  exportedAt: string;
  aircraft: Aircraft[];
  flights: Flight[];
  profile?: PilotProfile;
}

export function exportData(
  aircraft: Aircraft[],
  flights: Flight[],
  profile: PilotProfile,
  importBatches: ImportBatch[] = [],
  importTemplates: ImportMappingTemplate[] = [],
): LogbookDocument {
  return {
    ...migrateLegacy(aircraft, flights, profile),
    importBatches,
    importTemplates,
  };
}

export function isLogbookExport(value: unknown): value is LogbookExport {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return Array.isArray(v.aircraft) && Array.isArray(v.flights);
}
