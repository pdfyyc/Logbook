import { useState } from "react"
import type { Qualification, QualificationDraft, QualificationKind } from "../types"
import { Modal } from "./ui/Modal"
import { Field, Input, Select } from "./ui/Field"
import { Button } from "./ui/Button"

function blankFor(kind: QualificationKind): QualificationDraft {
  if (kind === "instrument-check") {
    return {
      kind,
      name: "Instrument rating flight test / IPC",
      completedOn: "",
      expiry: "",
      citation: "CAR 401.05(3)",
      notes: "",
    }
  }
  if (kind === "ppl-issued") {
    return {
      kind,
      name: "Private Pilot Licence — issued",
      completedOn: "",
      expiry: "",
      citation: "CARs Standard 421.26",
      notes: "",
    }
  }
  return { kind, name: "", completedOn: "", expiry: "", citation: "", notes: "" }
}

function addMonths(dateIso: string, months: number): string {
  const d = new Date(dateIso + "T00:00:00")
  d.setMonth(d.getMonth() + months)
  return d.toISOString().slice(0, 10)
}

interface Props {
  initial?: Qualification
  onSave: (draft: QualificationDraft) => void
  onClose: () => void
}

export function QualificationFormModal({ initial, onSave, onClose }: Props) {
  const [draft, setDraft] = useState<QualificationDraft>(initial ?? blankFor("other"))

  function set<K extends keyof QualificationDraft>(key: K, value: QualificationDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }))
  }

  function setKind(kind: QualificationKind) {
    setDraft(blankFor(kind))
  }

  const isCheck = draft.kind === "instrument-check"
  const isPpl = draft.kind === "ppl-issued"
  const usesCompletionDate = isCheck || isPpl
  const computedExpiry = isCheck && draft.completedOn ? addMonths(draft.completedOn, 24) : ""
  const canSave = draft.name.trim().length > 0 && (!usesCompletionDate || draft.completedOn.length > 0)

  return (
    <Modal
      title={initial ? "Edit qualification" : "Add qualification"}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!canSave}
            onClick={() => {
              onSave({ ...draft, expiry: isCheck ? computedExpiry : draft.expiry })
              onClose()
            }}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Type">
          <Select value={draft.kind} onChange={(e) => setKind(e.target.value as QualificationKind)}>
            <option value="other">Rating / endorsement / recurrent training</option>
            <option value="instrument-check">Instrument rating flight test / IPC (CAR 401.05(3))</option>
            <option value="ppl-issued">Private Pilot Licence issued (scopes CPL progress)</option>
          </Select>
        </Field>

        <Field label="Name">
          <Input
            value={draft.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="e.g. PPC — PA-28, Flight Instructor Rating, Tailwheel"
            autoFocus
          />
        </Field>

        {usesCompletionDate ? (
          <>
            <Field label={isPpl ? "Date licence issued" : "Date completed"}>
              <Input type="date" value={draft.completedOn} onChange={(e) => set("completedOn", e.target.value)} />
            </Field>
            {computedExpiry && (
              <p className="text-xs text-[var(--text-muted)]">
                Renewal due {computedExpiry} (24 months later, per CAR 401.05(3)) — also starts the 6-month grace
                period before the CAR 401.05(3.1) approach-recency rule applies.
              </p>
            )}
            {isPpl && (
              <p className="text-xs text-[var(--text-muted)]">
                Doesn't expire. Used to work out which flights count toward the CPL's "after the PPL" commercial
                training requirements (Standard 421.30(4)(a)(ii)).
              </p>
            )}
          </>
        ) : (
          <Field label="Expiry date (leave blank if it doesn't expire)">
            <Input type="date" value={draft.expiry} onChange={(e) => set("expiry", e.target.value)} />
          </Field>
        )}

        <Field label="Regulation / requirement (optional)">
          <Input
            value={draft.citation}
            onChange={(e) => set("citation", e.target.value)}
            placeholder="e.g. CAR 401.05(1), or company OPS spec"
            disabled={usesCompletionDate}
          />
        </Field>
        <Field label="Notes">
          <Input value={draft.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Optional" />
        </Field>
      </div>
    </Modal>
  )
}
