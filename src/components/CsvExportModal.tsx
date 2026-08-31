import { useMemo, useState } from "react";
import type { Aircraft, Flight, ImportBatch } from "../types";
import { downloadTextFile, flightsToCsv } from "../lib/csv";
import { Modal } from "./ui/Modal";
import { Button } from "./ui/Button";
import { Field, Input, Select } from "./ui/Field";

interface Props {
  flights: Flight[];
  filteredFlights: Flight[];
  aircraft: Aircraft[];
  batches: ImportBatch[];
  onClose: () => void;
}
export function CsvExportModal({
  flights,
  filteredFlights,
  aircraft,
  batches,
  onClose,
}: Props) {
  const [scope, setScope] = useState("active");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [aircraftId, setAircraftId] = useState("");
  const [role, setRole] = useState("");
  const [batchId, setBatchId] = useState("");
  const selected = useMemo(() => {
    const base =
      scope === "filtered"
        ? filteredFlights
        : flights.filter((f) => scope === "all" || !f.voidedAt);
    return base.filter(
      (f) =>
        (!from || f.date >= from) &&
        (!to || f.date <= to) &&
        (!aircraftId || f.aircraftId === aircraftId) &&
        (!role || (f.myRole ?? "") === role) &&
        (!batchId || f.importProvenance?.batchId === batchId),
    );
  }, [scope, filteredFlights, flights, from, to, aircraftId, role, batchId]);
  return (
    <Modal
      title="Export portable CSV"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!selected.length}
            onClick={() => {
              downloadTextFile(
                "logbook-portable.csv",
                flightsToCsv(selected, aircraft),
                "text/csv",
              );
              onClose();
            }}
          >
            Export {selected.length} flights
          </Button>
        </>
      }
    >
      <p className="text-xs text-[var(--text-muted)]">
        CSV is for portability and review. JSON remains the complete local
        backup, including nested amendment history and all application settings.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label="Scope">
          <Select value={scope} onChange={(e) => setScope(e.target.value)}>
            <option value="active">All active flights</option>
            <option value="all">Active and voided flights</option>
            <option value="filtered">Current filtered results</option>
          </Select>
        </Field>
        <Field label="Aircraft">
          <Select
            value={aircraftId}
            onChange={(e) => setAircraftId(e.target.value)}
          >
            <option value="">All aircraft</option>
            {aircraft.map((item) => (
              <option key={item.id} value={item.id}>
                {item.tailNumber}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="From date">
          <Input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </Field>
        <Field label="To date">
          <Input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </Field>
        <Field label="Role">
          <Select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="">All roles</option>
            {[
              "pic",
              "copilot",
              "student",
              "instructor",
              "solo-student",
              "observer",
            ].map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Import batch">
          <Select value={batchId} onChange={(e) => setBatchId(e.target.value)}>
            <option value="">All batches</option>
            {batches.map((item) => (
              <option key={item.id} value={item.id}>
                {item.sourceFilename} · {item.importedAt.slice(0, 10)}
              </option>
            ))}
          </Select>
        </Field>
      </div>
    </Modal>
  );
}
