import { useState } from "react"
import type { Aircraft, AircraftCategory, AircraftDraft } from "../types"
import { Modal } from "./ui/Modal"
import { Field, Input, Select } from "./ui/Field"
import { Button } from "./ui/Button"

const categories: AircraftCategory[] = [
  "ASEL",
  "ASES",
  "AMEL",
  "AMES",
  "Helicopter",
  "Glider",
  "Other",
]

const blank: AircraftDraft = {
  tailNumber: "",
  makeModel: "",
  category: "ASEL",
  isComplex: false,
  isHighPerformance: false,
  isTailwheel: false,
  isTaa: false,
  notes: "",
}

interface Props {
  initial?: Aircraft
  onSave: (draft: AircraftDraft) => void
  onClose: () => void
}

export function AircraftFormModal({ initial, onSave, onClose }: Props) {
  const [draft, setDraft] = useState<AircraftDraft>(initial ?? blank)

  function set<K extends keyof AircraftDraft>(key: K, value: AircraftDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }))
  }

  const canSave = draft.tailNumber.trim().length > 0

  return (
    <Modal
      title={initial ? "Edit aircraft" : "Add aircraft"}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!canSave}
            onClick={() => {
              onSave({ ...draft, tailNumber: draft.tailNumber.toUpperCase() })
              onClose()
            }}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Tail number">
          <Input
            value={draft.tailNumber}
            onChange={(e) => set("tailNumber", e.target.value)}
            placeholder="N12345"
            autoFocus
          />
        </Field>
        <Field label="Category">
          <Select
            value={draft.category}
            onChange={(e) => set("category", e.target.value as AircraftCategory)}
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Make & model" className="col-span-2">
          <Input
            value={draft.makeModel}
            onChange={(e) => set("makeModel", e.target.value)}
            placeholder="Cessna 172S"
          />
        </Field>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(
          [
            ["isComplex", "Complex"],
            ["isHighPerformance", "High perf."],
            ["isTailwheel", "Tailwheel"],
            ["isTaa", "TAA"],
          ] as const
        ).map(([key, label]) => (
          <label
            key={key}
            className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-sm text-[var(--text)]"
          >
            <input
              type="checkbox"
              checked={draft[key]}
              onChange={(e) => set(key, e.target.checked)}
              className="accent-[var(--accent)]"
            />
            {label}
          </label>
        ))}
      </div>

      <Field label="Notes" className="mt-3">
        <Input
          value={draft.notes}
          onChange={(e) => set("notes", e.target.value)}
          placeholder="Optional"
        />
      </Field>
    </Modal>
  )
}
