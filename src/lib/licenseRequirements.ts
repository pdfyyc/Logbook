import type { Aircraft, Flight, PilotProfile } from "../types";

export type RequirementUnit = "hours" | "count";

export interface LicenseRequirementItem {
  id: string;
  label: string;
  required: number;
  unit: RequirementUnit;
  compute: (flights: Flight[], aircraftById?: Map<string, Aircraft>) => number;
  /** Set when the computed value is an approximation of what the flight-log
   *  data model can actually express (see the note on solo/dual splitting
   *  below), rather than a direct sum of a single logged field. */
  approximate?: boolean;
  /** Only count flights on or after the date the PPL was issued. Requires a
   *  "ppl-issued" qualification on file; without one the item can't be
   *  computed and is reported as blocked rather than guessed at. */
  sincePpl?: boolean;
}

export interface LicenseTemplate {
  id: string;
  name: string;
  citation: string;
  sourceTitle: string;
  ruleVersion: string;
  coverageNote?: string;
  /** Requirements the regulation imposes that can't be computed from logged
   *  hours alone — shown to the student as a manual checklist. */
  manualRequirements: string[];
  items: LicenseRequirementItem[];
}

function sum(flights: Flight[], pick: (f: Flight) => number): number {
  return flights.reduce((s, f) => s + pick(f), 0);
}

// The flight log records cross-country, night and instrument time as
// per-flight totals, not split by solo/dual — so "solo cross-country" and
// "dual cross-country" are approximated from flights that are purely one or
// the other (solo>0 & dual=0, or the reverse). A single logged flight that
// mixes solo and dual time (e.g. a supervised solo where the instructor got
// out partway through) won't be attributed correctly — log it as two entries
// to avoid that.
//
// Requirements that need the INTERSECTION of two time buckets within one
// flight (e.g. "5 hours night including 2 hours cross-country") are not
// computed at all — the log can't express how much of a flight was both, and
// an estimate would overstate progress. Those go in manualRequirements.
const whollyDual = (f: Flight) => f.dualReceived > 0 && f.solo === 0;
const whollySolo = (f: Flight) => f.solo > 0 && f.dualReceived === 0;

const soloCrossCountry = (fl: Flight[]) =>
  sum(fl.filter(whollySolo), (f) => f.crossCountry);
const dualCrossCountry = (fl: Flight[]) =>
  sum(fl.filter(whollyDual), (f) => f.crossCountry);
const dualNight = (fl: Flight[]) => sum(fl.filter(whollyDual), (f) => f.night);
const soloNight = (fl: Flight[]) => sum(fl.filter(whollySolo), (f) => f.night);
const soloNightLandings = (fl: Flight[]) =>
  sum(fl.filter(whollySolo), (f) => f.nightLandings);
const picCrossCountry = (fl: Flight[]) =>
  sum(
    fl.filter((f) => f.pic > 0),
    (f) => f.crossCountry,
  );

const instrumentTime = (f: Flight) =>
  f.actualInstrument + f.simulatedInstrument;

/** `simTime` is entered as a subset of the entry's total time. It is removed
 * here so an FTD/simulator entry cannot inflate an ATPL flight-time figure.
 * This is deliberately conservative until simulator/device details are
 * modelled separately. */
const aircraftFlightTime = (f: Flight) => Math.max(0, f.totalTime - f.simTime);
const isAeroplane = (f: Flight, aircraftById?: Map<string, Aircraft>) =>
  Boolean(
    aircraftById?.get(f.aircraftId)?.category.startsWith("A") &&
    !["simulator", "ftd"].includes(
      aircraftById?.get(f.aircraftId)?.recordKind ?? "aircraft",
    ),
  );

// Standards allow a portion of instrument time as "instrument ground time",
// but the log doesn't separate instrument ground time from the generic
// sim/FTD field, so these count in-aircraft instrument time (actual + hood)
// only. A student relying on ground time should confirm it separately.
const dualInstrument = (fl: Flight[]) =>
  sum(
    fl.filter((f) => f.dualReceived > 0),
    instrumentTime,
  );
const allInstrument = (fl: Flight[]) => sum(fl, instrumentTime);

const MAX_SIM_HOURS_TOWARD_PPL_TOTAL = 5;

// 421.26(4)(a): of the 45 hours, at most 5 may be flown on an approved
// simulator or flight training device. The flight form requires a total time
// on every entry, so sim/FTD hours are assumed to be included in totalTime;
// this subtracts back off any sim time beyond the 5-hour allowance rather
// than adding it in (which would double-count).
function creditedTotalTime(flights: Flight[]): number {
  const total = sum(flights, (f) => f.totalTime);
  const simExcess = Math.max(
    0,
    sum(flights, (f) => f.simTime) - MAX_SIM_HOURS_TOWARD_PPL_TOTAL,
  );
  return Math.max(0, total - simExcess);
}

const hrs = (
  id: string,
  label: string,
  required: number,
  compute: (fl: Flight[], aircraftById?: Map<string, Aircraft>) => number,
  opts: { approximate?: boolean; sincePpl?: boolean } = {},
): LicenseRequirementItem => ({
  id,
  label,
  required,
  unit: "hours",
  compute,
  ...opts,
});

// ---------------------------------------------------------------------------
// Templates. Every figure below was read from the Transport Canada Standard
// 421 text supplied by the user and cross-checked against the raw regulation
// wording, not recalled from memory. Standards are amended periodically —
// confirm against the current published text before a licensing action.
// ---------------------------------------------------------------------------

export const RECREATIONAL_PERMIT: LicenseTemplate = {
  id: "rpp-aeroplane",
  name: "Recreational Pilot Permit — Aeroplane",
  citation: "CARs Standard 421.22(4)",
  sourceTitle: "Recreational Pilot Permit — Aeroplane experience",
  ruleVersion: "Transport Canada Standard 421, reviewed 2026-08-31",
  manualRequirements: [
    "All 25 hours must be flown under the direction and supervision of the holder of a Flight Instructor Rating — Aeroplane, in aeroplanes operating with a Certificate of Airworthiness — 421.22(4)(a).",
  ],
  items: [
    hrs("total", "Total flight training time", 25, (fl) =>
      sum(fl, (f) => f.totalTime),
    ),
    hrs("dual", "Dual instruction time", 15, (fl) =>
      sum(fl, (f) => f.dualReceived),
    ),
    hrs("dual-xc", "Cross-country dual instruction", 2, dualCrossCountry, {
      approximate: true,
    }),
    hrs("solo", "Solo flight time", 5, (fl) => sum(fl, (f) => f.solo)),
  ],
};

export const PPL_AEROPLANE: LicenseTemplate = {
  id: "ppl-aeroplane",
  name: "Private Pilot Licence — Aeroplane",
  citation: "CARs Standard 421.26(4)",
  sourceTitle: "Private Pilot Licence — Aeroplane experience",
  ruleVersion: "Transport Canada Standard 421, reviewed 2026-08-31",
  manualRequirements: [
    "One solo cross-country flight of at least 150 nautical miles, including 2 full-stop landings at points other than the point of departure — 421.26(4)(b)(ii). The log doesn't record distances, so tick this off yourself.",
    "All 45 hours must be flown under the direction and supervision of the holder of a Flight Instructor Rating — Aeroplane — 421.26(4)(a).",
  ],
  items: [
    hrs("total", "Total flight training time", 45, creditedTotalTime, {
      approximate: true,
    }),
    hrs("dual", "Dual instruction time", 17, (fl) =>
      sum(fl, (f) => f.dualReceived),
    ),
    hrs("solo", "Solo flight time", 12, (fl) => sum(fl, (f) => f.solo)),
    hrs("dual-xc", "Cross-country dual instruction", 3, dualCrossCountry, {
      approximate: true,
    }),
    hrs("dual-instrument", "Instrument time (within dual)", 5, dualInstrument, {
      approximate: true,
    }),
    hrs("solo-xc", "Solo cross-country time", 5, soloCrossCountry, {
      approximate: true,
    }),
  ],
};

export const NIGHT_RATING: LicenseTemplate = {
  id: "night-rating",
  name: "Night Rating — Aeroplane",
  citation: "CARs Standard 421.42(1)(a)",
  sourceTitle: "Night Rating — Aeroplane requirements",
  ruleVersion: "Transport Canada Standard 421, reviewed 2026-08-31",
  manualRequirements: [
    "Of the 5 hours dual night, at least 2 hours must be cross-country — 421.42(1)(a)(i)(A). The log can't tell how much of a flight was both night and cross-country, so confirm this yourself.",
    "The 10 hours dual instrument time must be in addition to the 10 hours night flight time — 421.42(1)(a)(iii). A flight counted toward one shouldn't be counted toward the other.",
    "Up to 5 of the 10 dual instrument hours may be instrument ground time — 421.42(1)(a)(iii). The log doesn't separate instrument ground time, so it isn't counted here.",
    "A qualifying flight within the 12 months preceding application, under a TC Inspector or a person qualified per 425.21(4) — 421.42(1)(b).",
  ],
  items: [
    hrs("total", "Total pilot flight time", 20, (fl) =>
      sum(fl, (f) => f.totalTime),
    ),
    hrs("night", "Night flight time", 10, (fl) => sum(fl, (f) => f.night)),
    hrs("night-dual", "Dual night flight time", 5, dualNight, {
      approximate: true,
    }),
    hrs("night-solo", "Solo night flight time", 5, soloNight, {
      approximate: true,
    }),
    {
      id: "night-solo-landings",
      label: "Solo night takeoffs / circuits / landings",
      required: 10,
      unit: "count",
      compute: soloNightLandings,
      approximate: true,
    },
    hrs("dual-instrument", "Dual instrument time", 10, dualInstrument, {
      approximate: true,
    }),
  ],
};

export const CPL_AEROPLANE: LicenseTemplate = {
  id: "cpl-aeroplane",
  name: "Commercial Pilot Licence — Aeroplane",
  citation: "CARs Standard 421.30(4)",
  sourceTitle: "Commercial Pilot Licence — Aeroplane experience",
  ruleVersion: "Transport Canada Standard 421, reviewed 2026-08-31",
  manualRequirements: [
    "A solo cross-country of at least 300 nautical miles total, with full-stop landings at 3 different aerodromes other than the departure point, one of which is at least 250 NM straight-line from departure (150 NM if flown on the island of Newfoundland) — 421.30(4)(a)(ii)(B)(I). The log doesn't record distances.",
    "Of the 5 hours dual night, at least 2 hours must be cross-country — 421.30(4)(a)(ii)(A)(I). The log can't tell how much of a flight was both.",
    "Of the 20 hours instrument in commercial training, at most 10 may be on an approved simulator or synthetic flight training device — 421.30(4)(a)(ii)(A)(III).",
    "The 20 instrument hours must be in addition to the night and cross-country experience — 421.30(4)(a)(ii)(A)(III).",
    "A licence may be issued restricted to daylight flying if the night requirements are incomplete, but the total dual and solo requirements must still be met — 421.30(6).",
  ],
  items: [
    hrs("total", "Total flight time in aeroplanes", 200, (fl) =>
      sum(fl, (f) => f.totalTime),
    ),
    hrs("pic", "Pilot-in-command time", 100, (fl) => sum(fl, (f) => f.pic)),
    hrs("pic-xc", "Cross-country PIC time", 20, picCrossCountry, {
      approximate: true,
    }),
    hrs(
      "post-ppl-dual",
      "Dual instruction (after PPL)",
      35,
      (fl) => sum(fl, (f) => f.dualReceived),
      {
        sincePpl: true,
      },
    ),
    hrs("post-ppl-dual-night", "Dual night (after PPL)", 5, dualNight, {
      sincePpl: true,
      approximate: true,
    }),
    hrs(
      "post-ppl-dual-xc",
      "Dual cross-country (after PPL)",
      5,
      dualCrossCountry,
      {
        sincePpl: true,
        approximate: true,
      },
    ),
    hrs(
      "post-ppl-instrument",
      "Instrument time (after PPL)",
      20,
      dualInstrument,
      {
        sincePpl: true,
        approximate: true,
      },
    ),
    hrs(
      "post-ppl-solo",
      "Solo flight time (after PPL)",
      30,
      (fl) => sum(fl, (f) => f.solo),
      {
        sincePpl: true,
      },
    ),
    hrs("post-ppl-solo-night", "Solo night (after PPL)", 5, soloNight, {
      sincePpl: true,
      approximate: true,
    }),
  ],
};

export const INSTRUMENT_RATING: LicenseTemplate = {
  id: "instrument-rating",
  name: "Instrument Rating — Aeroplane (Groups 1–3)",
  citation: "CARs Standard 421.46(2)(b)",
  sourceTitle: "Instrument Rating — Groups 1–3 experience",
  ruleVersion: "Transport Canada Standard 421, reviewed 2026-08-31",
  manualRequirements: [
    "Of the 50 hours cross-country PIC, at least 10 must be in the appropriate category — 421.46(2)(b)(i).",
    "Of the 40 hours instrument time, at most 20 may be instrument ground time — 421.46(2)(b)(ii). The log doesn't separate instrument ground time, so it isn't counted here.",
    "Within the 40 hours: 5 hours dual instrument from the holder of a flight instructor rating, 5 hours in aeroplanes, and 15 hours dual instrument from a qualified person per 425.21(9) — 421.46(2)(b)(ii)(A)–(C). These sit inside the 40-hour total and may overlap, so they aren't tracked as separate blocks.",
    "One dual cross-country in simulated or actual IMC of at least 100 nautical miles, on an IFR flight plan, including an instrument approach to minima at two different locations — 421.46(2)(b)(ii)(D).",
  ],
  items: [
    hrs("xc-pic", "Cross-country PIC time", 50, picCrossCountry, {
      approximate: true,
    }),
    hrs("instrument", "Instrument time", 40, allInstrument, {
      approximate: true,
    }),
  ],
};

/**
 * Current Standard 421.34(4) is intentionally kept narrow here: only the
 * minimum flight-time thresholds that this log can substantiate are computed.
 * The licence, medical, examinations, and skill prerequisites need document
 * evidence and are presented as review items rather than guessed at.
 */
export const ATPL_AEROPLANE: LicenseTemplate = {
  id: "atpl-aeroplane",
  name: "Airline Transport Pilot Licence — Aeroplane",
  citation: "CARs Standard 421.34(4)",
  sourceTitle: "Airline Transport Pilot Licence — Aeroplane experience",
  ruleVersion:
    "Transport Canada Standard 421, effective amendment noted 2025-12-17; reviewed 2026-08-31",
  coverageNote:
    "Partial automated coverage only. The computed checks below do not establish ATPL eligibility; every manual item must also be verified against authoritative records.",
  manualRequirements: [
    "Hold a Commercial Pilot Licence — Aeroplane that is not restricted to daylight flying — 421.34(4).",
    "Hold a valid Category 1 Medical Certificate — 421.34(2).",
    "Provide evidence of SAMRA, SARON and INRAT knowledge requirements — 421.34(3).",
    "Provide current multi-engine, two-crew IFR skill evidence (or an accepted PPC/PCC/LOE/MV) — 421.34(5).",
    "Verify at least 250 hours pilot-in-command in aeroplanes, with no more than 100 hours credited as pilot-in-command under supervision. Within that requirement, verify at least 100 hours cross-country, including at least 25 hours by night — 421.34(4)(a). The log cannot prove the overlap or distinguish PICUS.",
    "Verify 100 hours night as pilot-in-command or co-pilot, including at least 30 hours acquired in aeroplanes — 421.34(4)(b). Separate role and night totals do not prove their overlap within mixed-role flights.",
    "Verify the additional cross-country requirement: 100 hours as pilot-in-command, 200 hours as co-pilot, or an accepted combination — 421.34(4)(c). The stored buckets do not prove the required role/cross-country overlap.",
    "Verify 75 hours instrument flight time, with no more than 25 hours in approved instrument ground trainers and no more than 35 hours in helicopters; ground-trainer time cannot count toward the 1,500-hour total — 421.34(4)(d). The log does not distinguish every permitted source well enough to prove these limits.",
    "Review the official standard and supporting records before applying. This screen is a readiness aid, not an application determination.",
  ],
  items: [
    hrs("total-flight", "Creditable flight time", 1500, (fl) =>
      sum(fl, aircraftFlightTime),
    ),
    hrs("aeroplane-flight", "Aeroplane flight time", 900, (fl, aircraftById) =>
      sum(
        fl.filter((f) => isAeroplane(f, aircraftById)),
        aircraftFlightTime,
      ),
    ),
  ],
};

/** Standard 421.38(3) specifies a flight-test skill requirement, not a
 * minimum flight-hour threshold. It is therefore deliberately manual-only. */
export const MULTI_ENGINE_RATING: LicenseTemplate = {
  id: "multi-engine-rating",
  name: "Multi-Engine Class Rating — Aeroplane",
  citation: "CARs Standard 421.38(3)",
  sourceTitle: "Multi-engine class rating skill requirement",
  ruleVersion: "Transport Canada Standard 421, reviewed 2026-08-31",
  manualRequirements: [
    "Manual verification required: successfully complete the multi-engine class rating flight test as pilot-in-command of a multi-engine aeroplane under Standard 428, Schedule 7 — 421.38(3)(a). The standard sets no minimum flight-time amount for the initial Canadian rating, so logged hours cannot prove completion.",
  ],
  items: [],
};

export const LICENSE_TEMPLATES: LicenseTemplate[] = [
  RECREATIONAL_PERMIT,
  PPL_AEROPLANE,
  NIGHT_RATING,
  MULTI_ENGINE_RATING,
  CPL_AEROPLANE,
  INSTRUMENT_RATING,
  ATPL_AEROPLANE,
];

export function getLicenseTemplate(id: string): LicenseTemplate | undefined {
  return LICENSE_TEMPLATES.find((t) => t.id === id);
}

export interface RequirementProgress {
  id: string;
  label: string;
  have: number;
  required: number;
  unit: RequirementUnit;
  met: boolean;
  pct: number;
  approximate: boolean;
  /** Set when the item couldn't be computed — currently only when it needs a
   *  PPL issue date that isn't on file. */
  blockedReason?: string;
  remaining: number;
  explanation: string;
  contributingFlightIds: string[];
}

export interface LicenseProgress {
  template: LicenseTemplate;
  items: RequirementProgress[];
  metCount: number;
  totalCount: number;
}

/** The date the pilot's PPL was issued, from a "ppl-issued" qualification —
 *  used to scope the CPL's post-PPL commercial training requirements. */
export function pplIssueDate(profile: PilotProfile): string | null {
  const issued = profile.qualifications
    .filter((q) => q.kind === "ppl-issued" && q.completedOn)
    .map((q) => q.completedOn)
    .sort();
  return issued[0] ?? null;
}

export function computeLicenseProgress(
  template: LicenseTemplate,
  flights: Flight[],
  profile: PilotProfile,
  aircraftById?: Map<string, Aircraft>,
): LicenseProgress {
  // Voided entries remain visible in the logbook but cannot count toward a
  // licence or rating requirement.
  flights = flights.filter((f) => !f.voidedAt);
  const pplDate = pplIssueDate(profile);

  const items: RequirementProgress[] = template.items.map((item) => {
    if (item.sincePpl && !pplDate) {
      return {
        id: item.id,
        label: item.label,
        have: 0,
        required: item.required,
        unit: item.unit,
        met: false,
        pct: 0,
        approximate: Boolean(item.approximate),
        blockedReason:
          "Add your PPL issue date under Qualifications to track this",
        remaining: item.required,
        explanation:
          "Manual verification required until the PPL issue date is recorded.",
        contributingFlightIds: [],
      };
    }

    const scoped =
      item.sincePpl && pplDate
        ? flights.filter((f) => f.date >= pplDate)
        : flights;
    const have = item.compute(scoped, aircraftById);
    const met = have >= item.required;
    const pct =
      item.required > 0
        ? Math.min(100, Math.round((have / item.required) * 100))
        : 100;
    const contributingFlightIds = scoped
      .filter((flight) => item.compute([flight], aircraftById) > 0)
      .map((flight) => flight.id);
    return {
      id: item.id,
      label: item.label,
      have,
      required: item.required,
      unit: item.unit,
      met,
      pct,
      approximate: Boolean(item.approximate),
      remaining: Math.max(0, item.required - have),
      explanation: `Counts ${contributingFlightIds.length} active saved flight${contributingFlightIds.length === 1 ? "" : "s"}${item.sincePpl ? " on or after the recorded PPL issue date" : ""}.`,
      contributingFlightIds,
    };
  });

  return {
    template,
    items,
    metCount: items.filter((i) => i.met).length,
    totalCount: items.length,
  };
}
