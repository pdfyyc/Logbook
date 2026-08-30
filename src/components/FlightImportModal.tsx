import { useMemo, useState } from "react"
import type { Aircraft } from "../types"
import type { FlightImportPreview } from "../lib/flightImport"
import type { ImportResolution } from "../lib/useLogbook"
import { normalizeRegistration } from "../lib/aircraftRegistry"
import { Modal } from "./ui/Modal"
import { Button } from "./ui/Button"
import { Select } from "./ui/Field"

interface Props { preview: FlightImportPreview; aircraft: Aircraft[]; onClose: () => void; onImport: (resolutions: Record<string, ImportResolution>) => void }

export function FlightImportModal({ preview, aircraft, onClose, onImport }: Props) {
  const groups = useMemo(() => {
    const grouped = new Map<string, number>()
    preview.flights.forEach((flight) => { const registration = normalizeRegistration(flight.aircraftTailNumber); grouped.set(registration, (grouped.get(registration) ?? 0) + 1) })
    return [...grouped.entries()]
  }, [preview.flights])
  const [resolutions, setResolutions] = useState<Record<string, ImportResolution>>(() => Object.fromEntries(groups.map(([registration]) => {
    const match = aircraft.find((a) => normalizeRegistration(a.tailNumber) === registration)
    return [registration, match ? { mode: "existing", aircraftId: match.id } : { mode: "historical" }]
  })))
  function change(registration: string, value: string) {
    if (value.startsWith("existing:")) setResolutions((current) => ({ ...current, [registration]: { mode: "existing", aircraftId: value.slice(9) } }))
    else setResolutions((current) => ({ ...current, [registration]: { mode: value as "aircraft" | "historical" | "simulator" | "ftd" } }))
  }
  return <Modal title="Review imported aircraft" onClose={onClose} wide footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={() => onImport(resolutions)}>Import {preview.flights.length} flights</Button></>}>
    <p className="text-sm text-[var(--text-muted)]">Registrations are normalized and grouped below. Confirm how each source value should be represented before any aircraft or flights are added.</p>
    <div className="mt-4 space-y-2">{groups.map(([registration, count]) => <div key={registration} className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-lg border border-[var(--border)] p-3"><div><p className="text-sm font-medium text-[var(--text)]">{registration || "Unknown registration"}</p><p className="text-xs text-[var(--text-muted)]">{count} flight{count === 1 ? "" : "s"} · original text retained</p></div><Select value={resolutions[registration]?.mode === "existing" ? `existing:${(resolutions[registration] as { aircraftId: string }).aircraftId}` : resolutions[registration]?.mode} onChange={(e) => change(registration, e.target.value)} className="w-52"><option value="aircraft">Add registered aircraft</option><option value="historical">Generic historical aircraft</option><option value="simulator">Simulator</option><option value="ftd">Flight-training device</option>{aircraft.filter((a) => !a.archived).map((a) => <option key={a.id} value={`existing:${a.id}`}>Match {a.tailNumber}</option>)}</Select></div>)}</div>
    {preview.skippedRows > 0 && <p className="mt-3 text-xs text-amber-500">{preview.skippedRows} invalid rows will be skipped; details are listed below.</p>}
    {preview.warnings.length > 0 && <ul className="mt-2 max-h-32 list-disc overflow-y-auto pl-5 text-xs text-amber-500">{preview.warnings.map((warning, index) => <li key={`${index}-${warning}`}>{warning}</li>)}</ul>}
  </Modal>
}
