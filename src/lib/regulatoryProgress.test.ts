import { describe, expect, it } from "vitest";
import type { Aircraft, Flight } from "../types";
import { defaultPilotProfile } from "../types";
import {
  ATPL_AEROPLANE,
  CPL_AEROPLANE,
  INSTRUMENT_RATING,
  MULTI_ENGINE_RATING,
  NIGHT_RATING,
  PPL_AEROPLANE,
  computeLicenseProgress,
} from "./licenseRequirements";

const aircraft = {
  id: "a",
  tailNumber: "C-FTEST",
  makeModel: "PA44",
  category: "AMEL",
  recordKind: "aircraft",
} as Aircraft;
const map = new Map([[aircraft.id, aircraft]]);
function flight(values: Partial<Flight> = {}): Flight {
  return {
    id: crypto.randomUUID(),
    date: "2026-06-01",
    aircraftId: "a",
    from: "CEN4",
    to: "CYBW",
    route: "",
    totalTime: 0,
    pic: 0,
    sic: 0,
    solo: 0,
    dualReceived: 0,
    dualGiven: 0,
    crossCountry: 0,
    night: 0,
    actualInstrument: 0,
    simulatedInstrument: 0,
    dayLandings: 0,
    nightLandings: 0,
    approaches: 0,
    holds: 0,
    simTime: 0,
    remarks: "",
    ...values,
  };
}

describe("Canadian regulatory progress configuration", () => {
  for (const template of [
    PPL_AEROPLANE,
    NIGHT_RATING,
    CPL_AEROPLANE,
    INSTRUMENT_RATING,
    ATPL_AEROPLANE,
  ]) {
    it(`${template.id} does not mark requirements complete with no qualifying time`, () => {
      const progress = computeLicenseProgress(
        template,
        [],
        defaultPilotProfile,
        map,
      );
      expect(progress.items.every((item) => !item.met)).toBe(true);
      expect(template.citation).toMatch(/421\./);
      expect(template.ruleVersion).toContain("reviewed");
    });
  }
  it("marks a directly computable threshold complete exactly at the threshold", () => {
    const progress = computeLicenseProgress(
      PPL_AEROPLANE,
      [
        flight({ totalTime: 45, dualReceived: 17, actualInstrument: 5 }),
        flight({ totalTime: 12, solo: 12, crossCountry: 5 }),
      ],
      defaultPilotProfile,
      map,
    );
    expect(progress.items.find((item) => item.id === "dual")?.met).toBe(true);
    expect(progress.items.find((item) => item.id === "solo")?.remaining).toBe(
      0,
    );
  });
  it("does not count voided records", () =>
    expect(
      computeLicenseProgress(
        PPL_AEROPLANE,
        [flight({ totalTime: 100, voidedAt: "2026-06-02" })],
        defaultPilotProfile,
        map,
      ).items.find((item) => item.id === "total")?.have,
    ).toBe(0));
  it("blocks post-PPL CPL requirements when the issue date is missing", () =>
    expect(
      computeLicenseProgress(
        CPL_AEROPLANE,
        [flight({ dualReceived: 100 })],
        defaultPilotProfile,
        map,
      ).items.find((item) => item.id === "post-ppl-dual")?.blockedReason,
    ).toMatch(/PPL issue date/));
  it("keeps the Canadian multi-engine rating manual-only", () => {
    const progress = computeLicenseProgress(
      MULTI_ENGINE_RATING,
      [flight({ totalTime: 500 })],
      defaultPilotProfile,
      map,
    );
    expect(progress.items).toHaveLength(0);
    expect(progress.template.manualRequirements.join(" ")).toMatch(
      /flight test|no minimum flight-time/i,
    );
  });
});
