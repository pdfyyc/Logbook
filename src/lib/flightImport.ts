import type { FlightDraft } from "../types"
import { strFromU8, unzipSync } from "fflate"
import { normalizeCount, normalizeHours } from "./numericPolicy"

export interface ImportedFlight {
  aircraftTailNumber: string
  draft: FlightDraft
}

export interface FlightImportPreview {
  flights: ImportedFlight[]
  skippedRows: number
  warnings: string[]
}

const aliases: Record<string, string[]> = {
  date: ["date", "flight date"],
  aircraft: ["aircraft", "tail number", "tail", "registration", "reg", "aircraft registration"],
  from: ["from", "departure", "depart"],
  to: ["to", "arrival", "destination"],
  totalTime: ["total time", "total", "flight time", "duration"],
  dayTime: ["day time", "day"],
  pic: ["pic", "pilot in command", "pilot-in-command"],
  sic: ["sic", "copilot", "co-pilot", "second in command"],
  solo: ["solo"],
  dualReceived: ["dual received", "dual", "dual instruction"],
  dualGiven: ["dual given", "instructor time"],
  crossCountry: ["cross country", "cross-country", "xc"],
  night: ["night"],
  actualInstrument: ["actual instrument", "actual inst"],
  simulatedInstrument: ["simulated instrument", "sim instrument", "sim inst", "hood"],
  dayTakeoffs: ["day takeoffs", "day t/o", "takeoffs day"],
  nightTakeoffs: ["night takeoffs", "night t/o", "takeoffs night"],
  simTime: ["sim time", "simulator", "simulator time", "ftd"],
  dayLandings: ["day landings", "day ldg", "landings day"],
  nightLandings: ["night landings", "night ldg", "landings night"],
  approaches: ["approaches", "instrument approaches"],
  holds: ["holds"],
  route: ["route"],
  remarks: ["remarks", "notes", "comments"],
  myRole: ["my role", "role"],
  legalPicName: ["legal pic", "pic name", "pilot in command name"],
  primaryCrewName: ["crew name", "copilot name", "co-pilot name", "student name"],
  primaryCrewRole: ["crew role"],
  instructorName: ["instructor name", "instructor"],
  passengers: ["passengers", "passenger names"],
}

function passengers(value: unknown): string[] {
  const raw = String(value ?? "").trim()
  if (!raw) return []
  try { const parsed = JSON.parse(raw); if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean) } catch { /* plain-text import */ }
  return raw.split(/[;|]/).map((name) => name.trim()).filter(Boolean)
}

function key(value: string) {
  return value.trim().toLowerCase().replace(/[_.]/g, " ").replace(/\s+/g, " ")
}

function readField(row: Record<string, unknown>, name: string): unknown {
  const wanted = aliases[name] ?? [name]
  const match = Object.keys(row).find((column) => wanted.includes(key(column)))
  return match ? row[match] : undefined
}

function number(value: unknown): number {
  return normalizeHours(String(value ?? "").replace(/,/g, "")) ?? 0
}
function count(value: unknown): number { return normalizeCount(String(value ?? "").replace(/,/g, "")) ?? 0 }

function date(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10)
  if (typeof value === "number") {
    // Excel's 1900 date system includes the historical leap-year bug, hence
    // the 1899-12-30 epoch.
    const parsed = new Date(Date.UTC(1899, 11, 30 + value))
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10)
  }
  const raw = String(value ?? "").trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  const parsed = new Date(raw)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10)
}

function parseCsv(text: string): Record<string, unknown>[] {
  const rows: string[][] = [[]]
  let cell = ""
  let quoted = false
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    if (char === '"' && quoted && text[i + 1] === '"') { cell += '"'; i += 1 }
    else if (char === '"') quoted = !quoted
    else if (char === "," && !quoted) { rows.at(-1)!.push(cell); cell = "" }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[i + 1] === "\n") i += 1
      rows.at(-1)!.push(cell); cell = ""; rows.push([])
    } else cell += char
  }
  rows.at(-1)!.push(cell)
  const [headers = [], ...data] = rows.filter((row) => row.some((value) => value.trim()))
  return data.map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])))
}

function cellColumn(reference: string) {
  return [...reference.replace(/\d/g, "")].reduce((value, char) => value * 26 + char.charCodeAt(0) - 64, 0) - 1
}

function parseXlsx(bytes: Uint8Array): Record<string, unknown>[] {
  // xlsx is a ZIP of XML files. This intentionally supports the common first
  // worksheet path while keeping the app dependency small and auditable.
  const files = Object.fromEntries(Object.entries(unzipSync(bytes)).map(([name, data]) => [name, strFromU8(data)]))
  const parser = new DOMParser()
  const shared = files["xl/sharedStrings.xml"]
    ? [...parser.parseFromString(files["xl/sharedStrings.xml"], "application/xml").querySelectorAll("si")].map((node) => node.textContent ?? "")
    : []
  const sheetPath = Object.keys(files).find((path) => /^xl\/worksheets\/sheet\d+\.xml$/.test(path))
  if (!sheetPath) throw new Error("No worksheet was found in this .xlsx file.")
  const sheet = parser.parseFromString(files[sheetPath], "application/xml")
  const matrix = [...sheet.querySelectorAll("sheetData > row")].map((row) => {
    const cells: string[] = []
    row.querySelectorAll("c").forEach((cell) => {
      const index = cellColumn(cell.getAttribute("r") ?? "A1")
      const raw = cell.querySelector("v")?.textContent ?? cell.querySelector("t")?.textContent ?? ""
      cells[index] = cell.getAttribute("t") === "s" ? (shared[Number(raw)] ?? "") : raw
    })
    return cells
  })
  const [headers = [], ...data] = matrix
  return data.map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])))
}

export async function previewFlightImport(file: File): Promise<FlightImportPreview> {
  const lowerName = file.name.toLowerCase()
  if (lowerName.endsWith(".xls")) throw new Error("Legacy .xls files are not supported securely. Open the file in Excel and save it as .xlsx, then import it.")
  const rows = lowerName.endsWith(".xlsx")
    ? parseXlsx(new Uint8Array(await file.arrayBuffer()))
    : parseCsv(await file.text())
  const flights: ImportedFlight[] = []
  let skippedRows = 0
  const warnings: string[] = []

  rows.forEach((row, index) => {
    const invalidHours = ["totalTime", "pic", "sic", "solo", "dualReceived", "dualGiven", "crossCountry", "night", "actualInstrument", "simulatedInstrument", "simTime"].filter((field) => { const raw = readField(row, field); return String(raw ?? "").trim() !== "" && normalizeHours(String(raw).replace(/,/g, "")) === null })
    const invalidCounts = ["dayTakeoffs", "nightTakeoffs", "dayLandings", "nightLandings", "approaches", "holds"].filter((field) => { const raw = readField(row, field); return String(raw ?? "").trim() !== "" && normalizeCount(String(raw).replace(/,/g, "")) === null })
    if (invalidHours.length || invalidCounts.length) { skippedRows += 1; warnings.push(`Row ${index + 2}: invalid numeric value in ${[...invalidHours, ...invalidCounts].join(", ")}; row was not imported.`); return }
    const flightDate = date(readField(row, "date"))
    const totalTime = number(readField(row, "totalTime"))
    if (!flightDate || totalTime <= 0) {
      skippedRows += 1
      return
    }
    const tail = String(readField(row, "aircraft") ?? "").trim().toUpperCase() || "IMPORTED-UNKNOWN"
    if (tail === "IMPORTED-UNKNOWN") warnings.push(`Row ${index + 2}: no aircraft registration; imported as IMPORTED-UNKNOWN.`)
    flights.push({
      aircraftTailNumber: tail,
      draft: {
        date: flightDate,
        aircraftId: "",
        from: String(readField(row, "from") ?? "").trim().toUpperCase(),
        to: String(readField(row, "to") ?? "").trim().toUpperCase(),
        route: String(readField(row, "route") ?? "").trim(),
        totalTime,
        dayTime: number(readField(row, "dayTime")) || Math.max(0, totalTime - number(readField(row, "night"))),
        pic: number(readField(row, "pic")), sic: number(readField(row, "sic")), solo: number(readField(row, "solo")),
        dualReceived: number(readField(row, "dualReceived")), dualGiven: number(readField(row, "dualGiven")),
        crossCountry: number(readField(row, "crossCountry")), night: number(readField(row, "night")),
        actualInstrument: number(readField(row, "actualInstrument")), simulatedInstrument: number(readField(row, "simulatedInstrument")),
        dayTakeoffs: count(readField(row, "dayTakeoffs")), nightTakeoffs: count(readField(row, "nightTakeoffs")),
        dayLandings: count(readField(row, "dayLandings")), nightLandings: count(readField(row, "nightLandings")),
        approaches: count(readField(row, "approaches")), holds: count(readField(row, "holds")), simTime: number(readField(row, "simTime")),
        remarks: String(readField(row, "remarks") ?? "").trim(),
        sourceAircraftText: String(readField(row, "aircraft") ?? "").trim(),
        myRole: String(readField(row, "myRole") ?? "") as FlightDraft["myRole"],
        legalPicName: String(readField(row, "legalPicName") ?? "").trim(),
        primaryCrewName: String(readField(row, "primaryCrewName") ?? "").trim(),
        primaryCrewRole: String(readField(row, "primaryCrewRole") ?? "") as FlightDraft["primaryCrewRole"],
        instructorName: String(readField(row, "instructorName") ?? "").trim(),
        passengers: passengers(readField(row, "passengers")),
      },
    })
  })
  if (flights.length === 0) throw new Error("No rows with both a date and positive total time were found.")
  return { flights, skippedRows, warnings }
}
