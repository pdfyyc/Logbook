import { describe, expect, it } from "vitest";
import type { Aircraft, Flight } from "../types";
import { defaultPilotProfile } from "../types";
import {
  computeCarsCurrency,
  computeIfrRenewalCurrency,
  computeMedicalCurrency,
} from "./calc";

const aircraft = {
  id: "a",
  tailNumber: "C-FTEST",
  makeModel: "C172",
  category: "ASEL",
  recordKind: "aircraft",
} as Aircraft;
const map = new Map([[aircraft.id, aircraft]]);
function flight(values: Partial<Flight> = {}): Flight {
  return {
    id: "f",
    date: "2026-03-02",
    aircraftId: "a",
    from: "CEN4",
    to: "CYBW",
    route: "",
    totalTime: 1,
    pic: 1,
    sic: 0,
    solo: 0,
    dualReceived: 0,
    dualGiven: 0,
    crossCountry: 0,
    night: 0,
    actualInstrument: 0,
    simulatedInstrument: 0,
    dayTakeoffs: 5,
    nightTakeoffs: 0,
    dayLandings: 5,
    nightLandings: 0,
    approaches: 0,
    holds: 0,
    simTime: 0,
    remarks: "",
    ...values,
  };
}

describe("deterministic recency and expiry boundaries", () => {
  it("keeps a qualifying passenger event on the window boundary and removes it after", () => {
    const current = computeCarsCurrency(
      [flight()],
      defaultPilotProfile,
      map,
      new Date("2026-08-31T12:00:00Z"),
    ).find((item) => item.id === "passenger-day-asel")!;
    const expired = computeCarsCurrency(
      [flight()],
      defaultPilotProfile,
      map,
      new Date("2026-09-01T12:00:00Z"),
    ).find((item) => item.id === "passenger-day-asel")!;
    expect(current).toMatchObject({
      current: true,
      earliestQualifyingDate: "2026-03-02",
    });
    expect(expired.current).toBe(false);
  });
  it("distinguishes due-soon and expired official medical dates", () => {
    const profile = {
      ...defaultPilotProfile,
      medicalCategory: "Category 1" as const,
      medicalExpiry: "2026-08-31",
    };
    expect(
      computeMedicalCurrency(profile, new Date("2026-08-31T12:00:00Z"))
        .statusText,
    ).toBe("Due soon");
    expect(
      computeMedicalCurrency(profile, new Date("2026-09-01T12:00:00Z"))
        .statusText,
    ).toBe("Expired");
  });
  it("tracks the centralized IFR renewal boundary from an injected date", () => {
    const profile = {
      ...defaultPilotProfile,
      qualifications: [
        {
          id: "q",
          kind: "instrument-check" as const,
          name: "IPC",
          completedOn: "2024-08-31",
          expiry: "",
          citation: "CAR 401.05(3)",
          notes: "",
        },
      ],
    };
    expect(
      computeIfrRenewalCurrency(profile, new Date("2026-08-31T12:00:00Z"))
        .current,
    ).toBe(true);
    expect(
      computeIfrRenewalCurrency(profile, new Date("2026-09-01T12:00:00Z"))
        .current,
    ).toBe(false);
  });
  it("does not use a future-dated flight for current recency", () => {
    const item = computeCarsCurrency(
      [flight({ date: "2026-09-01" })],
      defaultPilotProfile,
      map,
      new Date("2026-08-31T12:00:00Z"),
    ).find((entry) => entry.id === "passenger-day")!;
    expect(item.current).toBe(false);
    expect(item.qualifying).toHaveLength(0);
  });
});
