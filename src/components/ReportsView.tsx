import { useMemo, useState } from "react";
import { BarChart3, Printer, Search } from "lucide-react";
import type { Aircraft, Flight, PilotProfile } from "../types";
import {
  calculateFlightTotals,
  computeMonthlyFlying,
  type DateRangePreset,
  type TotalsGroup,
} from "../lib/flightTotals";
import { formatHours } from "../lib/calc";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";

interface Props {
  flights: Flight[];
  aircraft: Aircraft[];
  profile: PilotProfile;
  onReviewFlight: (flight: Flight, suggestion?: string) => void;
}
const RANGE_OPTIONS: Array<[DateRangePreset, string]> = [
  ["all", "All time"],
  ["current-year", "Current calendar year"],
  ["previous-year", "Previous calendar year"],
  ["30-days", "Last 30 days"],
  ["90-days", "Last 90 days"],
  ["6-months", "Last 6 months"],
  ["12-months", "Last 12 months"],
  ["24-months", "Last 24 months"],
  ["custom", "Custom range"],
];

export function ReportsView({
  flights,
  aircraft,
  profile,
  onReviewFlight,
}: Props) {
  const [preset, setPreset] = useState<DateRangePreset>("all");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const aircraftById = useMemo(
    () => new Map(aircraft.map((item) => [item.id, item])),
    [aircraft],
  );
  const report = useMemo(
    () => calculateFlightTotals(flights, aircraftById, { preset, start, end }),
    [flights, aircraftById, preset, start, end],
  );
  const months = useMemo(
    () => computeMonthlyFlying(flights, aircraftById, { preset, start, end }),
    [flights, aircraftById, preset, start, end],
  );
  const flightById = useMemo(() => new Map(flights.map((flight) => [flight.id, flight])), [flights]);
  const reportFlightIds = useMemo(() => new Set(report.flightIds), [report.flightIds]);
  const selected = selectedIds
    .map((id) => flightById.get(id))
    .filter((flight): flight is Flight => Boolean(flight));
  const t = report.totals;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Reports</h1>
          <p className="text-sm text-[var(--text-muted)]">
            Every figure is calculated from active saved flight records by the
            same totals engine.
          </p>
        </div>
        <Button onClick={() => window.print()}>
          <Printer size={15} /> Print logbook / save PDF
        </Button>
      </div>
      <Card className="p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm">
            Date range
            <select
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-inset)] p-2"
              value={preset}
              onChange={(event) =>
                setPreset(event.target.value as DateRangePreset)
              }
            >
              {RANGE_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          {preset === "custom" && (
            <>
              <label className="text-sm">
                From
                <input
                  type="date"
                  className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-inset)] p-2"
                  value={start}
                  onChange={(event) => setStart(event.target.value)}
                />
              </label>
              <label className="text-sm">
                To
                <input
                  type="date"
                  className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-inset)] p-2"
                  value={end}
                  onChange={(event) => setEnd(event.target.value)}
                />
              </label>
            </>
          )}
        </div>
        <p className="mt-2 text-xs text-[var(--text-muted)]">
          {report.range.label}
          {report.range.start || report.range.end
            ? ` · ${report.range.start ?? "Beginning"} → ${report.range.end ?? "Present"}`
            : ""}
        </p>
      </Card>
      <section aria-labelledby="summary-heading">
        <h2 id="summary-heading" className="mb-2 text-base font-semibold">
          Flight time summary
        </h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {[
            ["Flights", String(t.flights)],
            ["Total", `${formatHours(t.totalTime)}h`],
            ["PIC", `${formatHours(t.pic)}h`],
            ["Co-pilot", `${formatHours(t.sic)}h`],
            ["Dual", `${formatHours(t.dualReceived)}h`],
            ["Instructor", `${formatHours(t.dualGiven)}h`],
            ["Cross-country", `${formatHours(t.crossCountry)}h`],
            ["Day", `${formatHours(t.day)}h`],
            ["Night", `${formatHours(t.night)}h`],
            ["Instrument", `${formatHours(t.instrument)}h`],
            ["Simulator / FTD", `${formatHours(t.simTime)}h`],
            ["Approaches", String(t.approaches)],
          ].map(([label, value]) => (
            <Card key={label} className="p-3">
              <div className="text-xs text-[var(--text-muted)]">{label}</div>
              <div className="mt-1 font-mono text-lg font-semibold">
                {value}
              </div>
            </Card>
          ))}
        </div>
      </section>
      <GroupReport
        title="Aircraft category"
        groups={report.byCategory}
        onInspect={setSelectedIds}
      />
      <GroupReport
        title="Aircraft experience"
        groups={report.byRegistration}
        secondaryGroups={report.byType}
        onInspect={setSelectedIds}
      />
      <section>
        <h2 className="mb-2 text-base font-semibold">Monthly flying</h2>
        <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr>
                {[
                  "Month",
                  "Flights",
                  "Total",
                  "PIC",
                  "Multi-engine",
                  "Instrument",
                  "Cross-country",
                ].map((label) => (
                  <th key={label} className="px-3 py-2 text-left">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {months.map((row) => (
                <tr key={row.month} className="border-t border-[var(--border)]">
                  <td className="px-3 py-2">{row.month}</td>
                  <td className="px-3 py-2">{row.totals.flights}</td>
                  <td className="px-3 py-2">
                    {formatHours(row.totals.totalTime)}
                  </td>
                  <td className="px-3 py-2">{formatHours(row.totals.pic)}</td>
                  <td className="px-3 py-2">{formatHours(row.multiEngine)}</td>
                  <td className="px-3 py-2">
                    {formatHours(row.totals.instrument)}
                  </td>
                  <td className="px-3 py-2">
                    {formatHours(row.totals.crossCountry)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="print-logbook">
        <div className="mb-3 flex justify-between border-b border-black pb-2 text-black">
          <div>
            <h2 className="text-lg font-bold">Personal Pilot Logbook</h2>
            <p>
              {profile.pilotName || "Pilot"} · {report.range.label}
            </p>
          </div>
          <p className="text-right text-xs">
            Generated {new Date().toLocaleDateString()}
            <br />
            Verify against original records and applicable CARs.
          </p>
        </div>
        <table className="w-full border-collapse text-[9px] text-black">
          <thead>
            <tr>
              {[
                "Date",
                "Aircraft",
                "Route",
                "Total",
                "PIC",
                "Co-pilot",
                "Dual",
                "Instr",
                "XC",
                "Night",
                "Inst",
                "T/O",
                "Ldg",
                "Remarks",
              ].map((label) => (
                <th key={label} className="border border-black p-1">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {flights
            .filter((flight) => reportFlightIds.has(flight.id))
              .sort((a, b) => a.date.localeCompare(b.date))
              .map((flight) => (
                <tr key={flight.id}>
                  <td className="border border-black p-1">{flight.date}</td>
                  <td className="border border-black p-1">
                    {aircraftById.get(flight.aircraftId)?.tailNumber ??
                      flight.sourceAircraftText ??
                      "Unknown"}
                  </td>
                  <td className="border border-black p-1">
                    {flight.from}–{flight.to}
                  </td>
                  {[
                    flight.totalTime,
                    flight.pic,
                    flight.sic,
                    flight.dualReceived,
                    flight.dualGiven,
                    flight.crossCountry,
                    flight.night,
                    flight.actualInstrument + flight.simulatedInstrument,
                    (flight.dayTakeoffs ?? flight.dayLandings) +
                      (flight.nightTakeoffs ?? flight.nightLandings),
                    flight.dayLandings + flight.nightLandings,
                  ].map((value, index) => (
                    <td
                      key={index}
                      className="border border-black p-1 text-right"
                    >
                      {value || ""}
                    </td>
                  ))}
                  <td className="max-w-48 border border-black p-1">
                    {flight.remarks}
                  </td>
                </tr>
              ))}
          </tbody>
          <tfoot>
            <tr>
              <th className="border border-black p-1 text-left" colSpan={3}>
                Cumulative totals
              </th>
              <th className="border border-black p-1">
                {formatHours(t.totalTime)}
              </th>
              <th className="border border-black p-1">{formatHours(t.pic)}</th>
              <th className="border border-black p-1">{formatHours(t.sic)}</th>
              <th className="border border-black p-1">
                {formatHours(t.dualReceived)}
              </th>
              <th className="border border-black p-1">
                {formatHours(t.dualGiven)}
              </th>
              <th className="border border-black p-1">
                {formatHours(t.crossCountry)}
              </th>
              <th className="border border-black p-1">
                {formatHours(t.night)}
              </th>
              <th className="border border-black p-1">
                {formatHours(t.instrument)}
              </th>
              <th className="border border-black p-1" colSpan={3}></th>
            </tr>
          </tfoot>
        </table>
        <div className="mt-8 grid grid-cols-2 gap-12 text-sm text-black">
          <div className="border-t border-black pt-1">Pilot signature</div>
          <div className="border-t border-black pt-1">
            Certification / date, when required
          </div>
        </div>
      </section>
      {selected.length > 0 && (
        <Card className="p-4" role="region" aria-label="Contributing flights">
          <div className="mb-2 flex justify-between">
            <h2 className="font-semibold">
              Contributing flights ({selected.length})
            </h2>
            <button
              onClick={() => setSelectedIds([])}
              className="text-sm text-[var(--accent)]"
            >
              Close
            </button>
          </div>
          <div className="max-h-72 space-y-2 overflow-auto">
            {selected.map((flight) => (
              <button
                key={flight.id}
                className="flex w-full justify-between rounded border border-[var(--border)] p-2 text-left text-sm"
                onClick={() =>
                  onReviewFlight(
                    flight,
                    "Review a flight contributing to this report figure.",
                  )
                }
              >
                <span>
                  {flight.date} ·{" "}
                  {aircraftById.get(flight.aircraftId)?.tailNumber ?? "Unknown"}{" "}
                  · {flight.from} → {flight.to}
                </span>
                <span>{formatHours(flight.totalTime)}h</span>
              </button>
            ))}
          </div>
        </Card>
      )}
      <p className="text-xs text-[var(--text-muted)]">
        Reports are planning and record-review aids. They do not replace
        official Transport Canada requirements, records, or interpretations.
      </p>
    </div>
  );
}

function GroupReport({
  title,
  groups,
  secondaryGroups = [],
  onInspect,
}: {
  title: string;
  groups: TotalsGroup[];
  secondaryGroups?: TotalsGroup[];
  onInspect: (ids: string[]) => void;
}) {
  const all =
    title === "Aircraft experience"
      ? [
          ...groups,
          ...secondaryGroups.map((group) => ({
            ...group,
            key: `type:${group.key}`,
            label: `Type: ${group.label}`,
          })),
        ]
      : groups;
  return (
    <section>
      <h2 className="mb-2 text-base font-semibold">{title}</h2>
      <div className="grid gap-2 md:grid-cols-2">
        {all.map((group) => (
          <Card
            key={group.key}
            className="flex items-center justify-between gap-3 p-3"
          >
            <div>
              <div className="font-medium">{group.label}</div>
              <div className="text-xs text-[var(--text-muted)]">
                {group.totals.flights} flights · PIC{" "}
                {formatHours(group.totals.pic)}h · latest{" "}
                {group.mostRecentDate ?? "—"}
              </div>
            </div>
            <button
              className="flex items-center gap-1 text-sm font-medium text-[var(--accent)]"
              onClick={() => onInspect(group.flightIds)}
            >
              <Search size={13} />
              {formatHours(group.totals.totalTime)}h
            </button>
          </Card>
        ))}
      </div>
      {all.length === 0 && (
        <Card className="p-5 text-sm text-[var(--text-muted)]">
          <BarChart3 className="mb-2" />
          No qualifying flights in this range.
        </Card>
      )}
    </section>
  );
}
