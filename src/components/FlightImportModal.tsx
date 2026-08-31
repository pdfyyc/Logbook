import { useMemo, useState } from "react";
import type {
  Aircraft,
  Flight,
  FlightDraft,
  ImportMappingTemplate,
} from "../types";
import {
  buildImportWorkspace,
  IMPORT_COLUMNS,
  reconcileImport,
  type AircraftResolution,
  type FlightImportWorkspace,
  type ImportDateFormat,
  type ImportDestination,
  type StagedImportRow,
} from "../lib/flightImport";
import { newId } from "../lib/id";
import { validateFlightNumbers } from "../lib/numericPolicy";
import { rejectedRowsToCsv, downloadTextFile } from "../lib/csv";
import { Modal } from "./ui/Modal";
import { Button } from "./ui/Button";
import { Field, Input, Select } from "./ui/Field";

interface Props {
  initial: FlightImportWorkspace;
  aircraft: Aircraft[];
  flights: Flight[];
  templates: ImportMappingTemplate[];
  onSaveTemplate: (template: ImportMappingTemplate) => void;
  onClose: () => void;
  onImport: (
    workspace: FlightImportWorkspace,
    confirmedMismatch: boolean,
  ) => void;
}
type Stage = "mapping" | "review" | "reconcile";
const measures = [
  ["rows", "Rows"],
  ["totalTime", "Total time"],
  ["pic", "PIC"],
  ["sic", "Co-pilot"],
  ["dualReceived", "Dual received"],
  ["dualGiven", "Instructor"],
  ["crossCountry", "Cross-country"],
  ["night", "Night"],
  ["instrument", "Instrument"],
  ["simTime", "Simulator"],
] as const;
const required = IMPORT_COLUMNS.filter((column) => column.required);
function rowStatus(row: StagedImportRow) {
  if (row.excluded) return "Excluded";
  if (row.errors.length) return "Error";
  if (row.aircraftResolution.mode === "unresolved") return "Aircraft needed";
  if (row.duplicate && row.duplicateResolution === "skip")
    return `${row.duplicate.kind} duplicate`;
  if (row.warnings.length || row.duplicate) return "Warning";
  return "Ready";
}
function editedErrors(draft: FlightDraft) {
  const errors = validateFlightNumbers(draft);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date))
    errors.push("A valid ISO date is required.");
  if (!draft.from.trim() || !draft.to.trim())
    errors.push("Departure and destination are required.");
  return [...new Set(errors)];
}

export function FlightImportModal({
  initial,
  aircraft,
  flights,
  templates,
  onSaveTemplate,
  onClose,
  onImport,
}: Props) {
  const [workspace, setWorkspace] = useState(initial);
  const [stage, setStage] = useState<Stage>("mapping");
  const [filter, setFilter] = useState("all");
  const [templateName, setTemplateName] = useState("");
  const [commitError, setCommitError] = useState("");
  const missing = required.filter(
    (column) =>
      !workspace.mappings.some((item) => item.destination === column.key) &&
      !workspace.constants[column.key]?.trim(),
  );
  const visibleRows = useMemo(
    () =>
      workspace.rows.filter(
        (row) =>
          filter === "all" ||
          (filter === "error" && row.errors.length) ||
          (filter === "warning" && !row.errors.length && row.warnings.length) ||
          (filter === "duplicate" && row.duplicate) ||
          (filter === "ready" && rowStatus(row) === "Ready"),
      ),
    [workspace.rows, filter],
  );
  const readyCount = workspace.rows.filter(
    (row) =>
      row.parsed &&
      !row.errors.length &&
      !row.excluded &&
      row.aircraftResolution.mode !== "unresolved" &&
      (!row.duplicate || row.duplicateResolution === "import"),
  ).length;
  const mismatch = Object.values(workspace.reconciliation.differences).some(
    (value) => value !== null && Math.abs(value) > 0.001,
  );
  function rebuild(
    next: Partial<
      Pick<FlightImportWorkspace, "mappings" | "constants" | "dateFormat">
    >,
  ) {
    const settings = {
      mappings: next.mappings ?? workspace.mappings,
      constants: next.constants ?? workspace.constants,
      dateFormat: next.dateFormat ?? workspace.dateFormat,
    };
    setWorkspace(
      buildImportWorkspace(
        workspace.source,
        settings.mappings,
        settings.dateFormat,
        flights,
        aircraft,
        settings.constants,
      ),
    );
  }
  function updateRow(
    rowNumber: number,
    updater: (row: StagedImportRow) => StagedImportRow,
  ) {
    setWorkspace((current) => {
      const rows = current.rows.map((row) =>
        row.rowNumber === rowNumber ? updater(row) : row,
      );
      return { ...current, rows, reconciliation: reconcileImport(rows) };
    });
  }
  function editDraft(row: StagedImportRow, patch: Partial<FlightDraft>) {
    if (!row.parsed) return;
    const parsed = { ...row.parsed, ...patch };
    updateRow(row.rowNumber, (current) => ({
      ...current,
      parsed,
      errors: editedErrors(parsed),
      manuallyCorrected: true,
    }));
  }
  function applyTemplate(id: string) {
    const template = templates.find((item) => item.id === id);
    if (!template) return;
    const mappings = workspace.source.headers.map((source) => ({
      source,
      destination: (template.mapping[source] ?? "ignore") as
        ImportDestination | "ignore",
      confidence: "confident" as const,
    }));
    rebuild({
      mappings,
      constants: template.constants as Partial<
        Record<ImportDestination, string>
      >,
      dateFormat: template.dateFormat,
    });
  }
  const footer = (
    <div className="flex w-full flex-wrap items-center justify-end gap-2">
      <Button variant="ghost" onClick={onClose}>
        Cancel import
      </Button>
      {stage !== "mapping" && (
        <Button
          variant="secondary"
          onClick={() => setStage(stage === "reconcile" ? "review" : "mapping")}
        >
          Back
        </Button>
      )}
      {stage === "mapping" && (
        <Button
          disabled={missing.length > 0}
          onClick={() => setStage("review")}
        >
          Review rows
        </Button>
      )}
      {stage === "review" && (
        <Button
          disabled={readyCount === 0}
          onClick={() => setStage("reconcile")}
        >
          Reconcile {readyCount} ready rows
        </Button>
      )}
      {stage === "reconcile" && (
        <Button
          disabled={readyCount === 0}
          onClick={() => {
            try {
              onImport(workspace, mismatch);
            } catch (error) {
              setCommitError(
                error instanceof Error ? error.message : "Import failed.",
              );
            }
          }}
        >
          Confirm and import
        </Button>
      )}
    </div>
  );
  return (
    <Modal
      title={`Import ${workspace.source.filename} — ${stage}`}
      onClose={onClose}
      wide
      footer={footer}
    >
      <div className="mb-4 grid grid-cols-3 gap-2 text-center text-xs">
        {(["mapping", "review", "reconcile"] as Stage[]).map((item, index) => (
          <div
            key={item}
            className={`rounded-lg border p-2 ${stage === item ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--border)]"}`}
          >
            {index + 1}. {item}
          </div>
        ))}
      </div>
      <p className="text-xs text-[var(--text-muted)]">
        Detected{" "}
        <strong>
          {workspace.source.detectedFormat === "application-csv"
            ? "this application's portable CSV"
            : `generic ${workspace.source.fileType.toUpperCase()}`}
        </strong>
        . Live data remains unchanged until the final transaction.
      </p>
      {stage === "mapping" && (
        <MappingStage
          workspace={workspace}
          templates={templates}
          missing={missing.map((item) => item.label)}
          templateName={templateName}
          setTemplateName={setTemplateName}
          rebuild={rebuild}
          applyTemplate={applyTemplate}
          saveTemplate={() =>
            onSaveTemplate({
              id: newId(),
              name: templateName.trim(),
              headers: workspace.source.headers,
              mapping: Object.fromEntries(
                workspace.mappings.map((item) => [
                  item.source,
                  item.destination,
                ]),
              ),
              constants: Object.fromEntries(
                Object.entries(workspace.constants).filter(
                  ([, value]) => value !== undefined,
                ),
              ) as Record<string, string>,
              dateFormat: workspace.dateFormat,
            })
          }
        />
      )}
      {stage === "review" && (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-auto"
            >
              <option value="all">All rows</option>
              <option value="error">Errors</option>
              <option value="warning">Warnings</option>
              <option value="duplicate">Duplicates</option>
              <option value="ready">Ready</option>
            </Select>
            <span className="text-xs text-[var(--text-muted)]">
              {readyCount} ready · {workspace.rows.length - readyCount} require
              review or will be skipped
            </span>
            <Button
              className="ml-auto"
              variant="secondary"
              onClick={() =>
                downloadTextFile(
                  "rejected-import-rows.csv",
                  rejectedRowsToCsv(workspace.rows),
                  "text/csv",
                )
              }
            >
              Rejected-row report
            </Button>
          </div>
          <div className="space-y-2">
            {visibleRows.map((row) => (
              <RowReview
                key={row.rowNumber}
                row={row}
                aircraft={aircraft}
                update={(updater) => updateRow(row.rowNumber, updater)}
                edit={(patch) => editDraft(row, patch)}
              />
            ))}
          </div>
        </div>
      )}
      {stage === "reconcile" && (
        <div className="mt-4 space-y-4">
          <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr>
                  <th className="p-2 text-left">Measure</th>
                  <th className="p-2 text-right">Source parsed</th>
                  <th className="p-2 text-right">Ready</th>
                  <th className="p-2 text-right">Difference</th>
                </tr>
              </thead>
              <tbody>
                {measures.map(([key, label]) => (
                  <tr key={key} className="border-t border-[var(--border)]">
                    <td className="p-2">{label}</td>
                    <td className="p-2 text-right">
                      {workspace.reconciliation.source[key] ?? "Unavailable"}
                    </td>
                    <td className="p-2 text-right">
                      {workspace.reconciliation.imported[key]}
                    </td>
                    <td className="p-2 text-right">
                      {workspace.reconciliation.differences[key] ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {mismatch && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs">
              <strong>Explicit confirmation:</strong> ready totals differ
              because rows are rejected, unresolved, excluded, or skipped as
              duplicates. Confirming records this acknowledgement.
            </div>
          )}
          <p className="text-xs text-[var(--text-muted)]">
            The complete batch is revision-checked, atomically written, reread,
            verified, and fully rolled back on failure.
          </p>
          {commitError && (
            <p
              role="alert"
              className="rounded-lg bg-red-500/10 p-3 text-sm text-red-500"
            >
              {commitError}
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}

function MappingStage({
  workspace,
  templates,
  missing,
  templateName,
  setTemplateName,
  rebuild,
  applyTemplate,
  saveTemplate,
}: {
  workspace: FlightImportWorkspace;
  templates: ImportMappingTemplate[];
  missing: string[];
  templateName: string;
  setTemplateName: (value: string) => void;
  rebuild: (
    next: Partial<
      Pick<FlightImportWorkspace, "mappings" | "constants" | "dateFormat">
    >,
  ) => void;
  applyTemplate: (id: string) => void;
  saveTemplate: () => void;
}) {
  return (
    <div className="mt-4 space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Date interpretation">
          <Select
            value={workspace.dateFormat}
            onChange={(e) =>
              rebuild({ dateFormat: e.target.value as ImportDateFormat })
            }
          >
            <option value="iso">ISO only (safest)</option>
            <option value="mdy">MM/DD/YYYY</option>
            <option value="dmy">DD/MM/YYYY</option>
            <option value="ymd">YYYY/MM/DD</option>
          </Select>
        </Field>
        <Field label="Load template">
          <Select
            defaultValue=""
            onChange={(e) => applyTemplate(e.target.value)}
          >
            <option value="">Choose saved template</option>
            {templates.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Save mapping">
          <div className="flex gap-2">
            <Input
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="Template name"
            />
            <Button disabled={!templateName.trim()} onClick={saveTemplate}>
              Save
            </Button>
          </div>
        </Field>
      </div>
      {missing.length > 0 && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-xs">
          <strong>Required mappings missing:</strong> {missing.join(", ")}
        </div>
      )}
      <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
        <table className="w-full min-w-[620px] text-sm">
          <thead>
            <tr>
              <th className="p-2 text-left">Source</th>
              <th className="p-2 text-left">Sample</th>
              <th className="p-2 text-left">Destination</th>
              <th className="p-2 text-left">Confidence</th>
            </tr>
          </thead>
          <tbody>
            {workspace.mappings.map((mapping) => (
              <tr
                key={mapping.source}
                className="border-t border-[var(--border)]"
              >
                <td className="p-2 font-medium">{mapping.source}</td>
                <td className="max-w-40 truncate p-2 text-[var(--text-muted)]">
                  {workspace.source.rows[0]?.[mapping.source] ?? ""}
                </td>
                <td className="p-2">
                  <Select
                    value={mapping.destination}
                    onChange={(e) =>
                      rebuild({
                        mappings: workspace.mappings.map((item) =>
                          item.source === mapping.source
                            ? {
                                ...item,
                                destination: e.target.value as
                                  ImportDestination | "ignore",
                                confidence:
                                  e.target.value === "ignore"
                                    ? "ignored"
                                    : "confident",
                              }
                            : item,
                        ),
                      })
                    }
                  >
                    <option value="ignore">Ignore</option>
                    {IMPORT_COLUMNS.map((column) => (
                      <option key={column.key} value={column.key}>
                        {column.label}
                      </option>
                    ))}
                  </Select>
                </td>
                <td className="p-2 capitalize">{mapping.confidence}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <details className="rounded-lg border border-[var(--border)] p-3">
        <summary className="cursor-pointer text-sm font-medium">
          Constant/default values
        </summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {IMPORT_COLUMNS.filter((column) => column.constant).map((column) => (
            <Field key={column.key} label={column.label}>
              <Input
                value={workspace.constants[column.key] ?? ""}
                onChange={(e) =>
                  rebuild({
                    constants: {
                      ...workspace.constants,
                      [column.key]: e.target.value,
                    },
                  })
                }
                placeholder="Used only if unmapped"
              />
            </Field>
          ))}
        </div>
      </details>
    </div>
  );
}

function RowReview({
  row,
  aircraft,
  update,
  edit,
}: {
  row: StagedImportRow;
  aircraft: Aircraft[];
  update: (updater: (row: StagedImportRow) => StagedImportRow) => void;
  edit: (patch: Partial<FlightDraft>) => void;
}) {
  return (
    <details className="rounded-lg border border-[var(--border)] p-3">
      <summary className="cursor-pointer list-none">
        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
          <input
            aria-label={`Exclude row ${row.rowNumber}`}
            type="checkbox"
            checked={row.excluded}
            onChange={(e) =>
              update((current) => ({ ...current, excluded: e.target.checked }))
            }
          />
          <div className="min-w-0">
            <strong>Row {row.rowNumber}</strong> ·{" "}
            {row.parsed?.date || "No date"} ·{" "}
            {row.aircraftText || "No aircraft"} · {row.parsed?.from || "?"} →{" "}
            {row.parsed?.to || "?"} · {row.parsed?.totalTime ?? 0}h
            <p className="truncate text-xs text-[var(--text-muted)]">
              {row.parsed?.myRole || "No role"} · PIC {row.parsed?.pic ?? 0},
              SIC {row.parsed?.sic ?? 0}, dual {row.parsed?.dualReceived ?? 0},
              instructor {row.parsed?.dualGiven ?? 0}
            </p>
          </div>
          <span
            className={
              row.errors.length
                ? "text-red-500"
                : rowStatus(row) === "Ready"
                  ? "text-emerald-500"
                  : "text-amber-500"
            }
          >
            {rowStatus(row)}
          </span>
        </div>
      </summary>
      <div className="mt-3 space-y-3 border-t border-[var(--border)] pt-3">
        {(row.errors.length > 0 || row.warnings.length > 0) && (
          <ul className="list-disc pl-5 text-xs">
            {row.errors.map((item) => (
              <li key={item} className="text-red-500">
                {item}
              </li>
            ))}
            {row.warnings.map((item) => (
              <li key={item} className="text-amber-500">
                {item}
              </li>
            ))}
          </ul>
        )}
        {row.parsed && (
          <div className="grid gap-2 sm:grid-cols-6">
            <Field label="Date">
              <Input
                value={row.parsed.date}
                onChange={(e) => edit({ date: e.target.value })}
              />
            </Field>
            <Field label="From">
              <Input
                value={row.parsed.from}
                onChange={(e) => edit({ from: e.target.value })}
              />
            </Field>
            <Field label="To">
              <Input
                value={row.parsed.to}
                onChange={(e) => edit({ to: e.target.value })}
              />
            </Field>
            <Field label="Route">
              <Input
                value={row.parsed.route}
                onChange={(e) => edit({ route: e.target.value })}
              />
            </Field>
            <Field label="Total">
              <Input
                type="number"
                value={row.parsed.totalTime}
                onChange={(e) => edit({ totalTime: Number(e.target.value) })}
              />
            </Field>
            <Field label="Role">
              <Select
                value={row.parsed.myRole ?? ""}
                onChange={(e) =>
                  edit({ myRole: e.target.value as FlightDraft["myRole"] })
                }
              >
                <option value="">Not set</option>
                <option value="pic">PIC</option>
                <option value="copilot">Co-pilot</option>
                <option value="student">Student</option>
                <option value="instructor">Instructor</option>
                <option value="solo-student">Solo student</option>
                <option value="observer">Observer</option>
              </Select>
            </Field>
          </div>
        )}
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="Aircraft resolution">
            <Select
              value={
                row.aircraftResolution.mode === "existing"
                  ? `existing:${row.aircraftResolution.aircraftId}`
                  : row.aircraftResolution.mode
              }
              onChange={(e) => {
                const value = e.target.value;
                const resolution: AircraftResolution = value.startsWith(
                  "existing:",
                )
                  ? { mode: "existing", aircraftId: value.slice(9) }
                  : {
                      mode: value as
                        | "unresolved"
                        | "aircraft"
                        | "historical"
                        | "simulator"
                        | "ftd",
                    };
                update((current) => ({
                  ...current,
                  aircraftResolution: resolution,
                }));
              }}
            >
              <option value="unresolved">Choose resolution…</option>
              {aircraft
                .filter((item) => !item.archived)
                .map((item) => (
                  <option key={item.id} value={`existing:${item.id}`}>
                    Use {item.tailNumber} · {item.makeModel}
                  </option>
                ))}
              <option value="aircraft">Create registered aircraft</option>
              <option value="historical">Create historical/unknown</option>
              <option value="simulator">Create simulator</option>
              <option value="ftd">Create FTD</option>
            </Select>
          </Field>
          {row.duplicate && (
            <Field
              label={`${row.duplicate.kind} duplicate — ${row.duplicate.source}`}
            >
              <Select
                value={row.duplicateResolution}
                onChange={(e) =>
                  update((current) => ({
                    ...current,
                    duplicateResolution: e.target.value as "skip" | "import",
                  }))
                }
              >
                <option value="skip">Skip / keep existing</option>
                <option value="import">
                  Import anyway — legitimate repeat
                </option>
              </Select>
            </Field>
          )}
        </div>
        {row.manuallyCorrected && (
          <Button
            variant="ghost"
            onClick={() =>
              update((current) => ({
                ...current,
                parsed: current.originalParsed
                  ? { ...current.originalParsed }
                  : current.parsed,
                errors: current.originalParsed
                  ? editedErrors(current.originalParsed)
                  : current.errors,
                manuallyCorrected: false,
              }))
            }
          >
            Restore parsed values
          </Button>
        )}
        <details>
          <summary className="cursor-pointer text-xs text-[var(--accent)]">
            View original source values
          </summary>
          <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-[var(--bg-inset)] p-2 text-xs">
            {JSON.stringify(row.originalValues, null, 2)}
          </pre>
        </details>
      </div>
    </details>
  );
}
