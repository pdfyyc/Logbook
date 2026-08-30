import { Printer } from "lucide-react"
import type { Aircraft, Flight, PilotProfile } from "../types"
import { computeTotals, formatHours } from "../lib/calc"
import { Modal } from "./ui/Modal"
import { Button } from "./ui/Button"

interface Props {
  flights: Flight[]
  aircraftById: Map<string, Aircraft>
  profile: PilotProfile
  onClose: () => void
}

export function ExperienceSummaryModal({ flights, aircraftById, profile, onClose }: Props) {
  const active = flights.filter((f) => !f.voidedAt)
  const totals = computeTotals(active)
  const aeroplane = active.filter((f) => aircraftById.get(f.aircraftId)?.category.startsWith("A"))
  const aeroplaneHours = aeroplane.reduce((sum, f) => sum + Math.max(0, f.totalTime - f.simTime), 0)
  const rows: Array<[string, string]> = [
    ["Active flight entries", String(active.length)],
    ["Voided entries retained", String(flights.length - active.length)],
    ["Total flight time", `${formatHours(totals.totalTime)} h`],
    ["Aeroplane flight time", `${formatHours(aeroplaneHours)} h`],
    ["Pilot-in-command", `${formatHours(totals.pic)} h`],
    ["Co-pilot", `${formatHours(totals.sic)} h`],
    ["Cross-country", `${formatHours(totals.crossCountry)} h`],
    ["Night", `${formatHours(totals.night)} h`],
    ["Actual instrument", `${formatHours(totals.actualInstrument)} h`],
    ["Simulated instrument", `${formatHours(totals.simulatedInstrument)} h`],
    ["Simulator / FTD", `${formatHours(active.reduce((sum, f) => sum + f.simTime, 0))} h`],
    ["Takeoffs and landings", String(totals.dayLandings + totals.nightLandings)],
  ]

  return (
    <Modal
      title="Experience summary"
      onClose={onClose}
      wide
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Close</Button>
          <Button onClick={() => window.print()}><Printer size={15} /> Print / save as PDF</Button>
        </>
      }
    >
      <section className="print:text-black" aria-label="Pilot experience summary">
        <p className="text-sm text-[var(--text-muted)]">{profile.pilotName || "Pilot"} · generated {new Date().toLocaleDateString()}</p>
        <p className="mt-2 text-xs text-[var(--text-muted)]">
          This is an experience summary from active logbook entries. Review against the applicable Canadian Aviation Regulations and include supporting documents before submitting an application.
        </p>
        <dl className="mt-5 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
          {rows.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4 border-b border-[var(--border)] py-2 text-sm">
              <dt className="text-[var(--text-muted)]">{label}</dt>
              <dd className="font-mono font-medium text-[var(--text)]">{value}</dd>
            </div>
          ))}
        </dl>
      </section>
    </Modal>
  )
}
