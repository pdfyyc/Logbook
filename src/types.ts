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

// Two kinds are recognized by the engines rather than just tracked for an
// expiry date:
//   "instrument-check" — CAR 401.05(3)'s 24-month instrument rating flight
//     test / IPC, whose completion date also starts the 6-month grace period
//     before 401.05(3.1)'s 6-approach rule applies.
//   "ppl-issued" — the date the Private Pilot Licence was issued, which
//     scopes the CPL's "after the PPL" commercial training requirements
//     (Standard 421.30(4)(a)(ii)). Carries no expiry.
// Everything else ("other") is a freeform qualification: a PPC, an instructor
// rating, an endorsement, a company OPS-spec renewal — tracked for its
// expiry, but not otherwise understood by the engines.
export type QualificationKind = "instrument-check" | "ppl-issued" | "other"

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
  medicalCategory: MedicalCategory
  medicalExpiry: string // ISO date, "" = not set
  qualifications: Qualification[]
  /** IDs of licence/rating templates (see lib/licenseRequirements.ts) whose
   *  progress-toward-completion the student wants tracked. */
  trackedLicenseGoals: string[]
}

export const defaultPilotProfile: PilotProfile = {
  pilotName: "",
  medicalCategory: "None",
  medicalExpiry: "",
  qualifications: [],
  trackedLicenseGoals: [],
}
