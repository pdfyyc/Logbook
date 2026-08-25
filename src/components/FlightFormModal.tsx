import { useState } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"
import type { Aircraft, Flight, FlightDraft } from "../types"
import { Modal } from "./ui/Modal"
import { Field, Input, Select } from "./ui/Field"
import { Button } from "./ui/Button"

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function blankDraft(defaultAircraftId: string): FlightDraft {
  return {
    date: todayIso(),
    aircraftId: defaultAircraftId,
    from: "",
    to: "",
    route: "",
    totalTime: 0,
    pic: 0,
    sic: 0,
    solo: 0,
    dualReceived: 0,
    dualGiven: 0,
    crossCountry: 0,
    night: 0,
    actualInstrument: 0,
    simulatedInstrument: 0,
    dayLandings: 1,
    nightLandings: 0,
    approaches: 0,
    holds: 0,
    simTime: 0,
    remarks: "",
  }
}

const numericFields: { key: keyof FlightDraft; label: string }[] = [
  { key: "pic", label: "PIC" },
  { key: "sic", label: "SIC" },
  { key: "solo", label: "Solo" },
  { key: "dualReceived", label: "Dual received" },
  { key: "dualGiven", label: "Dual given" },
  { key: "crossCountry", label: "Cross-country" },
  { key: "night", label: "Night" },
  { key: "actualInstrument", label: "Actual instrument" },
  { key: "simulatedInstrument", label: "Sim. instrument" },
  { key: "simTime", label: "Sim / FTD time" },
]

const landingFields: { key: keyof FlightDraft; label: string }[] = [
  { key: "dayLandings", label: "Day landings" },
  { key: "nightLandings", label: "Night landings" },
  { key: "approaches", label: "Approaches" },
  { key: "holds", label: "Holds / tracking" },
]

interface Props {
  aircraft: Aircraft[]
  initial?: Flight
  onSave: (draft: FlightDraft) => void
  onClose: () => void
  onAddAircraft: () => void
}

export function FlightFormModal({ aircraft, initial, onSave, onClose, onAddAircraft }: Props) {
  const [draft, setDraft] = useState<FlightDraft>(
    initial ?? blankDraft(aircraft[0]?.id ?? ""),
  )
  const [expanded, setExpanded] = useState(Boolean(initial))

  function set<K extends keyof FlightDraft>(key: K, value: FlightDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }))
  }

  function setNumber(key: keyof FlightDraft, raw: string) {
    const value = raw === "" ? 0 : Number(raw)
    if (!Number.isNaN(value)) set(key, value as never)
  }

  const canSave = draft.date && draft.aircraftId && draft.totalTime > 0

  return (
    <Modal
      title={initial ? "Edit flight" : "Add flight"}
      onClose={onClose}
      wide
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!canSave} onClick={() => canSave && (onSave(draft), onClose())}>
            Save flight
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label="Date">
          <Input
            type="date"
            value={draft.date}
            onChange={(e) => set("date", e.target.value)}
          />
        </Field>
        <Field label="Aircraft" className="col-span-2 sm:col-span-1">
          {aircraft.length === 0 ? (
            <Button variant="secondary" onClick={onAddAircraft} type="button">
              Add an aircraft first
            </Button>
          ) : (
            <Select
              value={draft.aircraftId}
              onChange={(e) => set("aircraftId", e.target.value)}
            >
              {aircraft.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.tailNumber} · {a.makeModel}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="From">
          <Input
            value={draft.from}
            onChange={(e) => set("from", e.target.value.toUpperCase())}
            placeholder="KPDX"
          />
        </Field>
        <Field label="To">
          <Input
            value={draft.to}
            onChange={(e) => set("to", e.target.value.toUpperCase())}
            placeholder="KHIO"
          />
        </Field>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <Field label="Route (optional)">
          <Input
            value={draft.route}
            onChange={(e) => set("route", e.target.value)}
            placeholder="Direct, or via..."
          />
        </Field>
        <Field label="Total time (hrs)">
          <Input
            type="number"
            step="0.1"
            min="0"
            value={draft.totalTime || ""}
            onChange={(e) => setNumber("totalTime", e.target.value)}
            placeholder="1.3"
          />
        </Field>
      </div>

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="mt-4 flex items-center gap-1 text-xs font-medium text-[var(--accent)] cursor-pointer"
      >
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        {expanded ? "Hide" : "Show"} time breakdown & landings
      </button>

      {expanded && (
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {numericFields.map(({ key, label }) => (
              <Field key={key} label={label}>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  value={(draft[key] as number) || ""}
                  onChange={(e) => setNumber(key, e.target.value)}
                  placeholder="0"
                />
              </Field>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {landingFields.map(({ key, label }) => (
              <Field key={key} label={label}>
                <Input
                  type="number"
                  step="1"
                  min="0"
                  value={(draft[key] as number) || ""}
                  onChange={(e) => setNumber(key, e.target.value)}
                  placeholder="0"
                />
              </Field>
            ))}
          </div>
        </div>
      )}

      <Field label="Remarks" className="mt-3">
        <Input
          value={draft.remarks}
          onChange={(e) => set("remarks", e.target.value)}
          placeholder="Optional notes about this flight"
        />
      </Field>
    </Modal>
  )
}
