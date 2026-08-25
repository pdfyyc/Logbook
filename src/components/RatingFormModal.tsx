import { useState } from "react"
import type { Rating, RatingDraft } from "../types"
import { Modal } from "./ui/Modal"
import { Field, Input } from "./ui/Field"
import { Button } from "./ui/Button"

const blank: RatingDraft = {
  name: "",
  expiry: "",
  citation: "",
  notes: "",
}

interface Props {
  initial?: Rating
  onSave: (draft: RatingDraft) => void
  onClose: () => void
}

export function RatingFormModal({ initial, onSave, onClose }: Props) {
  const [draft, setDraft] = useState<RatingDraft>(initial ?? blank)

  function set<K extends keyof RatingDraft>(key: K, value: RatingDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }))
  }

  const canSave = draft.name.trim().length > 0

  return (
    <Modal
      title={initial ? "Edit rating / endorsement" : "Add rating / endorsement"}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!canSave}
            onClick={() => {
              onSave(draft)
              onClose()
            }}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Name">
          <Input
            value={draft.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="e.g. PPC — PA-28, Flight Instructor Rating, Tailwheel"
            autoFocus
          />
        </Field>
        <Field label="Expiry date (leave blank if it doesn't expire)">
          <Input
            type="date"
            value={draft.expiry}
            onChange={(e) => set("expiry", e.target.value)}
          />
        </Field>
        <Field label="Regulation / requirement (optional)">
          <Input
            value={draft.citation}
            onChange={(e) => set("citation", e.target.value)}
            placeholder="e.g. CAR 401.05(1), or company OPS spec"
          />
        </Field>
        <Field label="Notes">
          <Input
            value={draft.notes}
            onChange={(e) => set("notes", e.target.value)}
            placeholder="Optional"
          />
        </Field>
      </div>
    </Modal>
  )
}
