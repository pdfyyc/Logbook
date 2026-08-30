export type AircraftCategory =
  | "ASEL"
  | "ASES"
  | "AMEL"
  | "AMES"
  | "Helicopter"
  | "Glider"
  | "Other"

export interface Aircraft {
  id: string
  tailNumber: string
  makeModel: string
  category: AircraftCategory
  isComplex: boolean
  isHighPerformance: boolean
  isTailwheel: boolean
  isTaa: boolean
  notes: string
}

export interface Flight {
  id: string
  date: string // ISO yyyy-mm-dd
  aircraftId: string
  from: string
  to: string
  route: string
  totalTime: number
  pic: number
  sic: number
  solo: number
  dualReceived: number
  dualGiven: number
  crossCountry: number
  night: number
  actualInstrument: number
  simulatedInstrument: number
  dayLandings: number
  nightLandings: number
  approaches: number
  holds: number
  simTime: number
  remarks: string
}

export type FlightDraft = Omit<Flight, "id">
export type AircraftDraft = Omit<Aircraft, "id">

export type MedicalCategory = "Category 1" | "Category 3" | "Category 4" | "None"

/** The privilege being exercised, which (with age) sets how long a medical
 *  certificate stays valid — Standard 421 medical validity table. */
export type MedicalPrivilege =
  | "ppl"
  | "rpp"
  | "ulp"
  | "spp"
  | "cpl-atpl"
  | "cpl-atpl-single-pilot-pax"

export const MEDICAL_PRIVILEGE_LABELS: Record<MedicalPrivilege, string> = {
  ppl: "Private Pilot Licence",
  rpp: "Recreational Pilot Permit",
  ulp: "Ultra-light Pilot Permit",
  spp: "Student Pilot Permit",
  "cpl-atpl": "CPL / ATPL — for hire or reward",
  "cpl-atpl-single-pilot-pax": "CPL / ATPL — single-pilot passenger operations",
}

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
// Everything else ("other") is a freeform qualification: a PPC, an instructor
// rating, an endorsement, a company OPS-spec renewal — tracked for its
// expiry, but not otherwise understood by the engines.
export type QualificationKind = "instrument-check" | "ppl-issued" | "recurrent-training" | "other"

export interface Qualification {
  id: string
  kind: QualificationKind
  name: string
  /** ISO date the check/training was completed. Only meaningful for
   *  "instrument-check", where it drives the auto-computed expiry. */
  completedOn: string
  expiry: string // ISO date, "" = no expiry tracked
  citation: string
  notes: string
}

export type QualificationDraft = Omit<Qualification, "id">

export interface PilotProfile {
  pilotName: string
  dateOfBirth: string // ISO date, "" = not set
  medicalCategory: MedicalCategory
  /** Date of the medical examination or declaration. Validity is measured
   *  from the first day of the month following this date. */
  medicalExamDate: string // ISO date, "" = not set
  medicalPrivilege: MedicalPrivilege
  /** Overrides the computed expiry. The certificate itself — and any shorter
   *  period the Minister endorses on it — always controls, so a manually
   *  entered valid-to date wins over the computed one. */
  medicalExpiry: string // ISO date, "" = use the computed date
  qualifications: Qualification[]
  /** IDs of licence/rating templates (see lib/licenseRequirements.ts) whose
   *  progress-toward-completion the student wants tracked. */
  trackedLicenseGoals: string[]
}

export const defaultPilotProfile: PilotProfile = {
  pilotName: "",
  dateOfBirth: "",
  medicalCategory: "None",
  medicalExamDate: "",
  medicalPrivilege: "ppl",
  medicalExpiry: "",
  qualifications: [],
  trackedLicenseGoals: [],
}
