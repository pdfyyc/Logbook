// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { strToU8, zipSync } from "fflate";
import type { Aircraft, Flight } from "../types";
import {
  applicationFixtureFlight,
  genericImportCsv,
} from "../test-fixtures/import-phase3";
import { flightsToCsv, rejectedRowsToCsv } from "./csv";
import {
  buildImportWorkspace,
  parseImportDate,
  parseImportHours,
  parseXlsxBytes,
  readImportFile,
  reconcileImport,
  suggestMappings,
} from "./flightImport";

const aircraft = [
  {
    id: "fixture-aircraft",
    tailNumber: "C-FXYZ",
    makeModel: "Test Aircraft",
    category: "ASEL",
    recordKind: "aircraft",
    isComplex: false,
    isHighPerformance: false,
    isTailwheel: false,
    isTaa: false,
    notes: "",
  },
] as Aircraft[];
const flight = applicationFixtureFlight as unknown as Flight;
const source = (
  rows: Record<string, string>[],
  headers = Object.keys(rows[0] ?? {}),
) => ({
  filename: "generic.csv",
  fileType: "csv" as const,
  detectedFormat: "generic" as const,
  headers,
  rows,
});

describe("Phase 3 staged import", () => {
  it("round trips every supported field from the application portable CSV", async () => {
    const csv = flightsToCsv([flight], aircraft);
    const parsed = await readImportFile(
      new File([csv], "logbook-portable.csv", { type: "text/csv" }),
    );
    expect(parsed.detectedFormat).toBe("application-csv");
    const workspace = buildImportWorkspace(
      parsed,
      suggestMappings(parsed.headers),
      "iso",
      [],
      aircraft,
    );
    expect(workspace.rows[0].parsed).toMatchObject({
      date: flight.date,
      route: "DCT",
      totalTime: 1.5,
      dayTime: 1.2,
      pic: 1.5,
      dualGiven: 1.5,
      primaryCrewRole: "student",
      passengers: ["Sample Passenger"],
      sourceAircraftText: "c fxyz",
    });
    expect(workspace.rows[0].sourceFlightId).toBe("fixture-flight");
  });
  it("maps a generic CSV and requires a chosen format for ambiguous dates", async () => {
    const parsed = await readImportFile(
      new File([genericImportCsv], "generic.csv"),
    );
    const mappings = suggestMappings(parsed.headers);
    const safe = buildImportWorkspace(parsed, mappings, "iso", [], aircraft);
    expect(safe.rows[0].parsed?.totalTime).toBe(1.5);
    expect(safe.rows[1].errors.join(" ")).toMatch(/ambiguous/i);
    const mdy = buildImportWorkspace(parsed, mappings, "mdy", [], aircraft);
    expect(mdy.rows[1].parsed?.date).toBe("2026-03-04");
  });
  it("parses decimal and HH:MM hours without accepting invalid clocks", () => {
    expect(parseImportHours("1.4").value).toBe(1.4);
    expect(parseImportHours("1:30")).toMatchObject({ value: 1.5 });
    expect(parseImportHours("1:75").value).toBeNull();
    expect(parseImportDate("03/04/2026", "iso").error).toMatch(/ambiguous/i);
  });
  it("parses a sanitized XLSX first worksheet", () => {
    const xml = `<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Date</t></is></c><c r="B1" t="inlineStr"><is><t>Aircraft</t></is></c><c r="C1" t="inlineStr"><is><t>Total Time</t></is></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>2026-08-01</t></is></c><c r="B2" t="inlineStr"><is><t>C-FXYZ</t></is></c><c r="C2"><v>1.2</v></c></row></sheetData></worksheet>`;
    const bytes = zipSync({ "xl/worksheets/sheet1.xml": strToU8(xml) });
    expect(parseXlsxBytes(bytes).rows[0]).toEqual({
      Date: "2026-08-01",
      Aircraft: "C-FXYZ",
      "Total Time": "1.2",
    });
  });
  it("normalizes registration variants but leaves unknown and simulator rows unresolved", () => {
    const rows: Record<string, string>[] = [
      {
        Date: "2026-08-01",
        Aircraft: " c fxyz ",
        "Total Time": "1",
        "Sim Time": "",
      },
      {
        Date: "2026-08-02",
        Aircraft: "SIM-TEST",
        "Total Time": "1",
        "Sim Time": "1",
      },
      {
        Date: "2026-08-03",
        Aircraft: "FTD-TEST",
        "Total Time": "2",
        "Sim Time": "2",
      },
    ];
    const input = source(rows, Object.keys(rows[1]));
    const mappings = suggestMappings(input.headers);
    expect(
      mappings.find((item) => item.source === "Sim Time")?.destination,
    ).toBe("simTime");
    const workspace = buildImportWorkspace(
      input,
      mappings,
      "iso",
      [],
      aircraft,
    );
    expect(workspace.rows[0].aircraftResolution).toEqual({
      mode: "existing",
      aircraftId: "fixture-aircraft",
    });
    expect(workspace.rows[1].parsed?.simTime).toBe(1);
    expect(workspace.rows[1].aircraftResolution.mode).toBe("unresolved");
    expect(workspace.rows[1].warnings.join(" ")).toMatch(/simulator|FTD/i);
    expect(workspace.rows[2].parsed?.simTime).toBe(2);
    expect(workspace.rows[2].aircraftResolution.mode).toBe("unresolved");
    expect(workspace.rows[2].warnings.join(" ")).toMatch(/simulator|FTD/i);
  });
  it("detects exact and likely duplicates against live and staged rows", () => {
    const rows = [
      {
        Date: flight.date,
        Aircraft: "C-FXYZ",
        From: flight.from,
        To: flight.to,
        Route: flight.route,
        "Total Time": "1.5",
        Role: "instructor",
        "Crew Name": "Training Student",
      },
      {
        Date: flight.date,
        Aircraft: "C-FXYZ",
        From: flight.from,
        To: flight.to,
        Route: "VIA OTHER",
        "Total Time": "1.5",
        Role: "pic",
        "Crew Name": "",
      },
      {
        Date: flight.date,
        Aircraft: "C-FXYZ",
        From: flight.from,
        To: flight.to,
        Route: "VIA TEST",
        "Total Time": "1.5",
        Role: "instructor",
        "Crew Name": "Training Student",
      },
      {
        Date: flight.date,
        Aircraft: "C-FXYZ",
        From: flight.from,
        To: flight.to,
        Route: "VIA TEST",
        "Total Time": "1.5",
        Role: "instructor",
        "Crew Name": "Training Student",
      },
    ];
    const input = source(rows);
    const workspace = buildImportWorkspace(
      input,
      suggestMappings(input.headers),
      "iso",
      [flight],
      aircraft,
    );
    expect(workspace.rows[0].duplicate?.kind).toBe("exact");
    expect(workspace.rows[1].duplicate?.kind).toBe("repeat");
    expect(workspace.rows[2].duplicate?.kind).toBe("likely");
    expect(workspace.rows[3].duplicate).toMatchObject({
      kind: "exact",
      source: "batch",
      rowNumber: 4,
    });
    workspace.rows[1].duplicateResolution = "import";
    expect(workspace.rows[1].duplicateResolution).toBe("import");
  });
  it("keeps invalid and partially mapped rows visible and reports them safely", () => {
    const rows = [
      {
        Date: "bad",
        Aircraft: "C-FXYZ",
        "Total Time": "-1",
        Remarks: "=HYPERLINK(TEST)",
      },
    ];
    const input = source(rows);
    const workspace = buildImportWorkspace(
      input,
      suggestMappings(input.headers),
      "iso",
      [],
      aircraft,
    );
    expect(workspace.rows).toHaveLength(1);
    expect(workspace.rows[0].errors.length).toBeGreaterThan(0);
    const report = rejectedRowsToCsv(workspace.rows);
    expect(report).not.toMatch(/\n[^,]*,[^,]*,=HYPERLINK/);
    expect(report).toContain("rejected");
  });
  it("reconciles source and ready totals and handles a large fixture", () => {
    const rows = Array.from({ length: 1000 }, (_, index) => ({
      Date: `2026-07-${String((index % 28) + 1).padStart(2, "0")}`,
      Aircraft: "C-FXYZ",
      From: "CEN4",
      To: "CYBW",
      "Total Time": "1",
    }));
    const input = source(rows);
    const workspace = buildImportWorkspace(
      input,
      suggestMappings(input.headers),
      "iso",
      [],
      aircraft,
    );
    expect(workspace.rows).toHaveLength(1000);
    expect(workspace.reconciliation.source.totalTime).toBe(1000);
    expect(workspace.reconciliation.imported.totalTime).toBe(28);
    workspace.rows.forEach((row) => {
      if (row.duplicate) row.duplicateResolution = "import";
    });
    expect(reconcileImport(workspace.rows).imported.totalTime).toBe(1000);
  });
});
