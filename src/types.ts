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
