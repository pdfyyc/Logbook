import type { Aircraft, Flight } from "../types"

const COLUMNS: (keyof Flight)[] = [
  "date",
  "from",
  "to",
  "route",
  "totalTime",
  "dayTime",
  "pic",
  "sic",
  "solo",
  "dualReceived",
  "dualGiven",
  "crossCountry",
  "night",
  "actualInstrument",
  "simulatedInstrument",
  "dayTakeoffs",
  "nightTakeoffs",
  "dayLandings",
  "nightLandings",
  "approaches",
  "holds",
  "simTime",
  "voidedAt",
  "voidReason",
  "sourceAircraftText",
  "myRole",
  "legalPicName",
  "primaryCrewName",
  "primaryCrewRole",
  "instructorName",
  "passengers",
  "copilotCreditConfirmed",
  "remarks",
]

function csvEscape(value: unknown): string {
  if (value === undefined) return ""
  const raw = Array.isArray(value) ? JSON.stringify(value) : String(value)
  const s = typeof value === "string" && /^[=+\-@]/.test(raw) ? `'${raw}` : raw
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export function flightsToCsv(flights: Flight[], aircraft: Aircraft[]): string {
  const byId = new Map(aircraft.map((a) => [a.id, a]))
  const header = ["aircraft", ...COLUMNS].join(",")
  const rows = flights
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((f) => {
      const tail = byId.get(f.aircraftId)?.tailNumber ?? "?"
      const cells = [tail, ...COLUMNS.map((c) => f[c])]
      return cells.map(csvEscape).join(",")
    })
  return [header, ...rows].join("\n")
}

export function downloadTextFile(filename: string, contents: string, mime: string) {
  const blob = new Blob([contents], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
