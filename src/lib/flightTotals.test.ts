import { describe, expect, it } from "vitest";
import type { Aircraft, Flight } from "../types";
import {
  calculateFlightTotals,
  computeMonthlyFlying,
  resolveDateRange,
} from "./flightTotals";

const aircraft: Aircraft[] = [
  {
    id: "se",
    tailNumber: "C-FSEA",
    makeModel: "C172",
    category: "ASEL",
    recordKind: "aircraft",
    isComplex: false,
    isHighPerformance: false,
    isTailwheel: false,
    isTaa: false,
    notes: "",
  },
  {
    id: "me",
    tailNumber: "C-FMEL",
    makeModel: "PA44",
    category: "AMEL",
    recordKind: "aircraft",
    isComplex: false,
    isHighPerformance: false,
    isTailwheel: false,
    isTaa: false,
    notes: "",
  },
  {
    id: "sim",
    tailNumber: "FTD-1",
    makeModel: "Generic FTD",
    category: "Other",
    recordKind: "ftd",
    isComplex: false,
    isHighPerformance: false,
    isTailwheel: false,
    isTaa: false,
    notes: "",
  },
];
const map = new Map(aircraft.map((item) => [item.id, item]));
function flight(id: string, values: Partial<Flight> = {}): Flight {
  return {
    id,
    date: "2026-06-15",
    aircraftId: "se",
    from: "CEN4",
    to: "CYBW",
    route: "",
    totalTime: 2,
    dayTime: 1.5,
    pic: 1,
    sic: 0.5,
    solo: 0,
    dualReceived: 0.5,
    dualGiven: 0.2,
    crossCountry: 1.2,
    night: 0.5,
    actualInstrument: 0.2,
    simulatedInstrument: 0.3,
    dayTakeoffs: 2,
    nightTakeoffs: 1,
    dayLandings: 2,
    nightLandings: 1,
    approaches: 1,
    holds: 1,
    simTime: 0,
    remarks: "",
    ...values,
  };
}

describe("authoritative flight totals", () => {
  it("returns zero totals for an empty logbook", () =>
    expect(calculateFlightTotals([], map).totals).toMatchObject({
      flights: 0,
      totalTime: 0,
      instrument: 0,
    }));
  it("sums every supported field for one flight", () =>
    expect(calculateFlightTotals([flight("one")], map).totals).toMatchObject({
      flights: 1,
      totalTime: 2,
      pic: 1,
      sic: 0.5,
      dualReceived: 0.5,
      dualGiven: 0.2,
      crossCountry: 1.2,
      day: 1.5,
      night: 0.5,
      instrument: 0.5,
      actualInstrument: 0.2,
      simulatedInstrument: 0.3,
      approaches: 1,
      holds: 1,
      dayTakeoffs: 2,
      nightLandings: 1,
    }));
  it("separates single-engine, multi-engine, and simulator/FTD experience", () => {
    const result = calculateFlightTotals(
      [
        flight("se"),
        flight("me", { aircraftId: "me", totalTime: 3 }),
        flight("sim", { aircraftId: "sim", totalTime: 1, simTime: 1 }),
      ],
      map,
    );
    expect(
      result.byCategory.map((group) => [group.key, group.totals.totalTime]),
    ).toEqual(
      expect.arrayContaining([
        ["single-engine-aeroplane", 2],
        ["multi-engine-aeroplane", 3],
        ["simulator-ftd", 1],
      ]),
    );
  });
  it("identifies unresolved relationships instead of inferring a category", () => {
    const result = calculateFlightTotals(
      [
        flight("unknown", {
          aircraftId: "missing",
          sourceAircraftText: "C-UNKNOWN",
        }),
      ],
      map,
    );
    expect(result.unknownFlightIds).toEqual(["unknown"]);
  });
  it("excludes voided flights without mutating records", () => {
    const source = flight("void", { voidedAt: "2026-06-16T00:00:00Z" });
    const before = structuredClone(source);
    expect(calculateFlightTotals([source], map).totals.flights).toBe(0);
    expect(source).toEqual(before);
  });
  it("supports inclusive arbitrary and built-in date ranges", () => {
    const flights = [
      flight("a", { date: "2026-01-01" }),
      flight("b", { date: "2026-12-31" }),
      flight("c", { date: "2025-12-31" }),
    ];
    expect(
      calculateFlightTotals(flights, map, {
        preset: "current-year",
        referenceDate: "2026-08-31",
      }).totals.flights,
    ).toBe(2);
    expect(
      calculateFlightTotals(flights, map, {
        preset: "custom",
        start: "2026-01-01",
        end: "2026-01-01",
      }).flightIds,
    ).toEqual(["a"]);
    expect(
      resolveDateRange({ preset: "30-days", referenceDate: "2026-08-31" })
        .start,
    ).toBe("2026-08-02");
  });
  it("uses the same totals for monthly reporting", () => {
    const flights = [
      flight("a"),
      flight("b", { aircraftId: "me", date: "2026-06-20", totalTime: 3 }),
    ];
    const authoritative = calculateFlightTotals(flights, map).totals;
    const monthly = computeMonthlyFlying(flights, map);
    expect(monthly[0].totals.totalTime).toBe(authoritative.totalTime);
    expect(monthly[0].multiEngine).toBe(3);
  });
  it("groups by aircraft type and registration with contributing IDs", () => {
    const result = calculateFlightTotals([flight("a"), flight("b")], map);
    expect(result.byType[0]).toMatchObject({
      label: "C172",
      flightIds: ["a", "b"],
    });
    expect(result.byRegistration[0].label).toBe("C-FSEA");
  });
  it("calculates 10,000 synthetic flights deterministically", () => {
    const flights = Array.from({ length: 10_000 }, (_, index) =>
      flight(String(index), {
        date: `2026-06-${String((index % 28) + 1).padStart(2, "0")}`,
        totalTime: 1,
      }),
    );
    const started = performance.now();
    const result = calculateFlightTotals(flights, map);
    expect(result.totals).toMatchObject({ flights: 10_000, totalTime: 10_000 });
    expect(performance.now() - started).toBeLessThan(3000);
  });
});
