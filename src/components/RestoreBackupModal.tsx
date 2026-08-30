import type { LogbookDocument } from "../lib/dataModel"
import { Button } from "./ui/Button"
import { Modal } from "./ui/Modal"

interface Props { document: LogbookDocument; currentBackup: string; onCancel: () => void; onRestore: () => void }
export function RestoreBackupModal({ document: backup, currentBackup, onCancel, onRestore }: Props) {
  const amended = backup.flights.filter((flight) => (flight.amendments?.length ?? 0) > 0).length
  const voided = backup.flights.filter((flight) => flight.voidedAt).length
  const keys = new Map<string, number>(); backup.flights.forEach((flight) => { const key = [flight.date, flight.aircraftId, flight.from, flight.to, flight.totalTime].join("|"); keys.set(key, (keys.get(key) ?? 0) + 1) })
  const duplicates = [...keys.values()].filter((count) => count > 1).reduce((sum, count) => sum + count, 0)
  function downloadRecovery() { const blob = new Blob([currentBackup], { type: "application/json" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = `logbook-recovery-${new Date().toISOString().replace(/[:.]/g, "-")}.json`; link.click(); URL.revokeObjectURL(url) }
  return <Modal title="Review backup restoration" onClose={onCancel} wide footer={<><Button variant="secondary" onClick={onCancel}>Cancel</Button><Button variant="secondary" onClick={downloadRecovery}>Download current recovery backup</Button><Button onClick={onRestore}>Replace current logbook</Button></>}>
    <p className="text-sm text-[var(--text-muted)]">Nothing has changed yet. Restoring replaces the current local logbook; merging is deliberately unavailable.</p>
    <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3"><div><dt className="text-xs text-[var(--text-muted)]">Schema</dt><dd>{backup.schemaVersion}</dd></div><div><dt className="text-xs text-[var(--text-muted)]">Exported/saved</dt><dd>{backup.savedAt}</dd></div><div><dt className="text-xs text-[var(--text-muted)]">Flights</dt><dd>{backup.flights.length}</dd></div><div><dt className="text-xs text-[var(--text-muted)]">Aircraft</dt><dd>{backup.aircraft.length}</dd></div><div><dt className="text-xs text-[var(--text-muted)]">Qualifications</dt><dd>{backup.profile.qualifications.length}</dd></div><div><dt className="text-xs text-[var(--text-muted)]">Amended / voided</dt><dd>{amended} / {voided}</dd></div></dl>
    {(duplicates > 0 || backup.uncertainties.length > 0) && <div className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs"><strong>Review warnings</strong><ul className="mt-1 list-disc pl-4">{duplicates > 0 && <li>{duplicates} flights participate in possible duplicate groups.</li>}{backup.uncertainties.map((item) => <li key={item.path}>{item.path}: {item.reason}</li>)}</ul></div>}
    <p className="mt-4 text-xs text-[var(--text-muted)]"><strong>Will be replaced:</strong> flights, aircraft, profile, qualifications, defaults and draft metadata. A validated last-known-good generation is retained automatically.</p>
  </Modal>
}
