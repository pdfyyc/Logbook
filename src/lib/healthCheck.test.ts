import { describe, expect, it } from "vitest";
import type { Aircraft, Flight } from "../types";
import { checkLogbookHealth } from "./healthCheck";

const flight = {
  id: "f",
  date: "2026-08-30",
  aircraftId: "a",
  from: "CEN4",
  to: "CYBW",
  route: "",
  totalTime: 1.4,
  pic: 1.4,
  sic: 0,
  solo: 0,
  dualReceived: 0,
  dualGiven: 1.4,
  crossCountry: 0,
  night: 0,
  actualInstrument: 0,
  simulatedInstrument: 0,
  dayLandings: 1,
  nightLandings: 0,
  approaches: 0,
  holds: 0,
  simTime: 0,
  remarks: "",
} as Flight;
const aircraft = {
  id: "a",
  tailNumber: "C-FXYZ",
  makeModel: "Test aircraft",
  recordKind: "aircraft",
} as Aircraft;

describe("logbook health role-time checks", () => {
  it("does not add overlapping PIC and instructor time", () =>
    expect(checkLogbookHealth([flight], new Map([["a", aircraft]]))).toEqual(
      [],
    ));
  it("flags an individual credited category over total", () =>
    expect(
      checkLogbookHealth(
        [{ ...flight, pic: 1.5 }],
        new Map([["a", aircraft]]),
      ).some((issue) => issue.id.startsWith("role-pic-total")),
    ).toBe(true));
  it("flags dual received and dual given together", () =>
    expect(
      checkLogbookHealth(
        [{ ...flight, dualReceived: 1 }],
        new Map([["a", aircraft]]),
      ).some((issue) => issue.id.startsWith("dual-conflict")),
    ).toBe(true));
  it("uses severity and emits one people issue for duplicate contradictory names", () => {
    const issues = checkLogbookHealth(
      [
        {
          ...flight,
          legalPicName: "Test Pilot",
          passengers: [" test pilot ", ""],
        },
      ],
      new Map([["a", aircraft]]),
    );
    expect(
      issues.filter((issue) => issue.id.startsWith("people-")),
    ).toHaveLength(1);
    expect(issues.find((issue) => issue.id.startsWith("people-"))?.level).toBe(
      "warning",
    );
  });
  it("surfaces migration uncertainty against the affected flight", () => {
    const issues = checkLogbookHealth([flight], new Map([["a", aircraft]]), [
      { path: "flights[0].dayTime", reason: "Inferred for test." },
    ]);
    expect(issues).toContainEqual(
      expect.objectContaining({
        id: "migration-f",
        level: "uncertainty",
        flightIds: ["f"],
      }),
    );
  });
  it("flags suspicious duration, night, instrument, and orphaned provenance without mutation", () => {
    const source = {
      ...flight,
      totalTime: 25,
      night: 26,
      actualInstrument: 27,
      importProvenance: {
        batchId: "missing",
        sourceRow: 2,
        originalValues: {},
        warnings: [],
        manuallyCorrected: false,
      },
    };
    const before = structuredClone(source);
    const issues = checkLogbookHealth(
      [source],
      new Map([["a", aircraft]]),
      [],
      new Set(),
    );
    expect(issues.map((issue) => issue.id)).toEqual(
      expect.arrayContaining([
        "large-duration-f",
        "night-total-f",
        "instrument-total-f",
        "orphan-import-f",
      ]),
    );
    expect(source).toEqual(before);
  });
  it("identifies historical aircraft informationally", () => {
    const historical = { ...aircraft, recordKind: "historical" as const };
    expect(
      checkLogbookHealth([flight], new Map([["a", historical]])),
    ).toContainEqual(
      expect.objectContaining({
        id: "historical-aircraft-f",
        level: "informational",
      }),
    );
  });
});
