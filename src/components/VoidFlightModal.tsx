import { useState } from "react"
import type { Flight } from "../types"
import { Modal } from "./ui/Modal"
import { Field, Input } from "./ui/Field"
import { Button } from "./ui/Button"

interface Props {
  flight: Flight
  onClose: () => void
  onSave: (reason: string) => void
}

export function VoidFlightModal({ flight, onClose, onSave }: Props) {
  const [reason, setReason] = useState("")
  return (
    <Modal
      title="Void flight entry"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button disabled={!reason.trim()} onClick={() => onSave(reason)}>Void entry</Button>
        </>
      }
    >
      <p className="text-sm text-[var(--text-muted)]">
        This keeps the original {flight.date} entry in the logbook with a line through it. It will no longer count toward totals, currency, or licence progress.
      </p>
      <Field label="Reason for correction" className="mt-4">
        <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Duplicate entry; corrected entry added" autoFocus />
      </Field>
    </Modal>
  )
}
