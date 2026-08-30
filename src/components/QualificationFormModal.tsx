import { useState } from "react"
import type { InstructorClass, Qualification, QualificationDraft, QualificationKind } from "../types"
import { derivedQualificationExpiry } from "../lib/calc"
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
  if (kind === "recurrent-training") {
    return {
      kind,
      name: "Recurrent training program",
      completedOn: "",
      expiry: "",
      citation: "CAR 401.05(2)(a)",
      notes: "",
    }
  }
  if (kind === "instructor-rating") {
    return {
      kind,
      name: "Flight Instructor Rating — Aeroplane",
      completedOn: "",
      expiry: "",
      citation: "CARs Standard 421.72",
      notes: "",
      instructorClass: "4",
    }
  }
  if (kind === "document-booklet") {
    return {
      kind,
      name: "Aviation document booklet",
      completedOn: "",
      expiry: "",
      citation: "CAR 401.12",
      notes: "",
    }
  }
  return { kind, name: "", completedOn: "", expiry: "", citation: "", notes: "" }
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
  const isRecurrent = draft.kind === "recurrent-training"
  const isInstructor = draft.kind === "instructor-rating"
  const isBooklet = draft.kind === "document-booklet"
  const usesCompletionDate = isCheck || isPpl || isRecurrent || isInstructor || isBooklet
  const computedExpiry =
    derivedQualificationExpiry(draft.kind, draft.completedOn, draft.instructorClass) ?? ""
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
              // Kinds with a derived expiry always store the computed date;
              // the rest keep whatever the user typed.
              onSave({ ...draft, expiry: computedExpiry || draft.expiry })
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
            <option value="recurrent-training">Recurrent training program (CAR 401.05(2)(a))</option>
            <option value="instructor-rating">Flight instructor rating (Standard 421.72)</option>
            <option value="document-booklet">Aviation document booklet (CAR 401.12)</option>
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
            <Field
              label={
                isPpl
                  ? "Date licence issued"
                  : isBooklet
                    ? "Date booklet issued"
                    : isInstructor
                      ? "Flight test date"
                      : "Date completed"
              }
            >
              <Input type="date" value={draft.completedOn} onChange={(e) => set("completedOn", e.target.value)} />
            </Field>
            {computedExpiry && isCheck && (
              <p className="text-xs text-[var(--text-muted)]">
                Renewal due {computedExpiry} (24 months later, per CAR 401.05(3)) — also starts the 6-month grace
                period before the CAR 401.05(3.1) approach-recency rule applies.
              </p>
            )}
            {computedExpiry && isRecurrent && (
              <p className="text-xs text-[var(--text-muted)]">
                Next due {computedExpiry} (24 months later, per CAR 401.05(2)(a)).
              </p>
            )}
            {isInstructor && (
              <Field label="Class">
                <Select
                  value={draft.instructorClass ?? "4"}
                  onChange={(e) => set("instructorClass", e.target.value as InstructorClass)}
                >
                  <option value="4">Class 4</option>
                  <option value="3">Class 3</option>
                  <option value="2">Class 2</option>
                  <option value="1">Class 1</option>
                </Select>
              </Field>
            )}
            {computedExpiry && isInstructor && (
              <p className="text-xs text-[var(--text-muted)]">
                Valid to {computedExpiry} — the first day of the{" "}
                {{ "4": "13th", "3": "25th", "2": "37th", "1": "49th" }[draft.instructorClass ?? "4"]} month
                following the flight-test month.
              </p>
            )}
            {computedExpiry && isBooklet && (
              <p className="text-xs text-[var(--text-muted)]">
                Normally valid to {computedExpiry} — the first day of the 121st month, per CAR 401.12. Renew the
                booklet before it expires.
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
