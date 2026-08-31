export type AircraftCategory =
  "ASEL" | "ASES" | "AMEL" | "AMES" | "Helicopter" | "Glider" | "Other";

export interface Aircraft {
  id: string;
  tailNumber: string;
  makeModel: string;
  category: AircraftCategory;
  isComplex: boolean;
  isHighPerformance: boolean;
  isTailwheel: boolean;
  isTaa: boolean;
  notes: string;
  recordKind?: "aircraft" | "simulator" | "ftd" | "historical";
  nickname?: string;
  favourite?: boolean;
  defaultAircraft?: boolean;
  icaoType?: string;
  usualRole?: "PIC" | "SIC" | "Dual received" | "Instructor" | "";
  usualDeparture?: string;
  usualPerson?: string;
  archived?: boolean;
}

export interface Flight {
  id: string;
  date: string; // ISO yyyy-mm-dd
  aircraftId: string;
  from: string;
  to: string;
  route: string;
  totalTime: number;
  dayTime?: number;
  pic: number;
  sic: number;
  solo: number;
  dualReceived: number;
  dualGiven: number;
  crossCountry: number;
  night: number;
  actualInstrument: number;
  simulatedInstrument: number;
  dayTakeoffs?: number;
  nightTakeoffs?: number;
  dayLandings: number;
  nightLandings: number;
  approaches: number;
  holds: number;
  simTime: number;
  remarks: string;
  sourceAircraftText?: string;
  /** The pilot's capacity for this flight. This never determines credited
   * time by itself; the numeric logging fields remain authoritative. */
  myRole?:
    | "pic"
    | "copilot"
    | "student"
    | "instructor"
    | "solo-student"
    | "observer"
    | "";
  legalPicName?: string;
  primaryCrewName?: string;
  primaryCrewRole?: "copilot" | "student" | "safety-pilot" | "other-crew" | "";
  instructorName?: string;
  passengers?: string[];
  copilotCreditConfirmed?: boolean;
  importProvenance?: FlightImportProvenance;
  /** A void preserves the original entry for audit purposes but excludes it
   * from all totals, recency, and licence-progress calculations. */
  voidedAt?: string;
  voidReason?: string;
  amendments?: FlightAmendment[];
}

export interface FlightImportProvenance {
  batchId: string;
  sourceRow: number;
  sourceFlightId?: string;
  originalValues: Record<string, string>;
  warnings: string[];
  manuallyCorrected: boolean;
}

export interface ImportReconciliation {
  source: Record<string, number | null>;
  imported: Record<string, number>;
  differences: Record<string, number | null>;
  confirmedMismatch: boolean;
}

export interface ImportBatch {
  id: string;
  sourceFilename: string;
  fileType: "csv" | "tsv" | "xlsx";
  importedAt: string;
  detectedFormat: "application-csv" | "generic";
  originalColumns: string[];
  rowCount: number;
  acceptedRows: number;
  rejectedRows: number;
  skippedRows: number;
  duplicateRows: number;
  warningCount: number;
  flightIds: string[];
  reconciliation: ImportReconciliation;
}

export interface ImportMappingTemplate {
  id: string;
  name: string;
  headers: string[];
  mapping: Record<string, string>;
  constants: Record<string, string>;
  dateFormat: "iso" | "ymd" | "mdy" | "dmy";
}

/** Retained before every change to an active record. The snapshot deliberately
 * excludes audit metadata so amendment history cannot recursively grow. */
export type FlightSnapshot = Omit<
  Flight,
  "id" | "voidedAt" | "voidReason" | "amendments"
>;

export interface FlightAmendment {
  amendedAt: string;
  reason: string;
  previous: FlightSnapshot;
}

export type FlightDraft = FlightSnapshot;
export type AircraftDraft = Omit<Aircraft, "id">;

export type MedicalCategory =
  "Category 1" | "Category 3" | "Category 4" | "None";

/** The privilege being exercised, which (with age) sets how long a medical
 *  certificate stays valid — Standard 421 medical validity table. */
export type MedicalPrivilege =
  "ppl" | "rpp" | "ulp" | "spp" | "cpl-atpl" | "cpl-atpl-single-pilot-pax";

export const MEDICAL_PRIVILEGE_LABELS: Record<MedicalPrivilege, string> = {
  ppl: "Private Pilot Licence",
  rpp: "Recreational Pilot Permit",
  ulp: "Ultra-light Pilot Permit",
  spp: "Student Pilot Permit",
  "cpl-atpl": "CPL / ATPL — for hire or reward",
  "cpl-atpl-single-pilot-pax": "CPL / ATPL — single-pilot passenger operations",
};

// Two kinds are recognized by the engines rather than just tracked for an
// expiry date:
//   "instrument-check" — CAR 401.05(3)'s 24-month instrument rating flight
//     test / IPC, whose completion date also starts the 6-month grace period
//     before 401.05(3.1)'s 6-approach rule applies.
//   "ppl-issued" — the date the Private Pilot Licence was issued, which
//     scopes the CPL's "after the PPL" commercial training requirements
//     (Standard 421.30(4)(a)(ii)). Carries no expiry.
//   "recurrent-training" — CAR 401.05(2)(a)'s accepted recurrent training
//     program, due every 24 months from the completion date.
//   "instructor-rating" — an aeroplane flight instructor rating, expiring on
//     the first day of the 13th/25th/37th/49th month following the
//     flight-test month for Class 4/3/2/1 respectively.
//   "document-booklet" — the aviation document booklet, normally expiring on
//     the first day of the 121st month under CAR 401.12.
// Everything else ("other") is a freeform qualification: a PPC, an instructor
// rating, an endorsement, a company OPS-spec renewal — tracked for its
// expiry, but not otherwise understood by the engines.
export type QualificationKind =
  | "instrument-check"
  | "ppl-issued"
  | "recurrent-training"
  | "instructor-rating"
  | "document-booklet"
  | "other";

/** Flight instructor rating class — sets how long the rating stays valid. */
export type InstructorClass = "1" | "2" | "3" | "4";

export interface Qualification {
  id: string;
  kind: QualificationKind;
  name: string;
  /** ISO date the check/training was completed. Only meaningful for
   *  "instrument-check", where it drives the auto-computed expiry. */
  completedOn: string;
  expiry: string; // ISO date, "" = no expiry tracked
  citation: string;
  notes: string;
  /** Only meaningful for "instructor-rating", where it drives the expiry. */
  instructorClass?: InstructorClass;
}

export type QualificationDraft = Omit<Qualification, "id">;

export interface PilotProfile {
  pilotName: string;
  homeAirport?: string;
  defaultRole?: Flight["myRole"];
  frequentInstructor?: string;
  frequentStudents?: string[];
  dateOfBirth: string; // ISO date, "" = not set
  medicalCategory: MedicalCategory;
  /** Date of the medical examination or declaration. Validity is measured
   *  from the first day of the month following this date. */
  medicalExamDate: string; // ISO date, "" = not set
  medicalPrivilege: MedicalPrivilege;
  /** Overrides the computed expiry. The certificate itself — and any shorter
   *  period the Minister endorses on it — always controls, so a manually
   *  entered valid-to date wins over the computed one. */
  medicalExpiry: string; // ISO date, "" = use the computed date
  expiryWarningDays?: { warning: number; critical: number };
  qualifications: Qualification[];
  /** IDs of licence/rating templates (see lib/licenseRequirements.ts) whose
   *  progress-toward-completion the student wants tracked. */
  trackedLicenseGoals: string[];
}

export const defaultPilotProfile: PilotProfile = {
  pilotName: "",
  homeAirport: "",
  defaultRole: "",
  frequentInstructor: "",
  frequentStudents: [],
  dateOfBirth: "",
  medicalCategory: "None",
  medicalExamDate: "",
  medicalPrivilege: "ppl",
  medicalExpiry: "",
  expiryWarningDays: { warning: 90, critical: 30 },
  qualifications: [],
  trackedLicenseGoals: [],
};
