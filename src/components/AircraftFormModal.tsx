import { useMemo, useState } from "react"
import { ChevronDown, ChevronUp, Plane, Search } from "lucide-react"
import type { Aircraft, AircraftCategory, AircraftDraft } from "../types"
import { isDuplicateRegistration, localAircraftLookupProvider, normalizeRegistration } from "../lib/aircraftRegistry"
import { Modal } from "./ui/Modal"
import { Field, Input, Select } from "./ui/Field"
import { Button } from "./ui/Button"

const categories: AircraftCategory[] = ["ASEL", "ASES", "AMEL", "AMES", "Helicopter", "Glider", "Other"]
type Kind = NonNullable<Aircraft["recordKind"]>
const labels: Record<Kind, string> = { aircraft: "Registered aircraft", simulator: "Simulator", ftd: "Flight-training device", historical: "Generic historical aircraft" }
const blank = (kind: Kind = "aircraft"): AircraftDraft => ({ tailNumber: "", makeModel: "", category: kind === "aircraft" ? "ASEL" : "Other", isComplex: false, isHighPerformance: false, isTailwheel: false, isTaa: false, notes: "", recordKind: kind, nickname: "", favourite: false, defaultAircraft: false, icaoType: "", usualRole: "", usualDeparture: "", usualPerson: "", archived: false })

interface Props { initial?: Aircraft; existingAircraft: Aircraft[]; onSave: (draft: AircraftDraft) => Aircraft | void; onClose: () => void; onCreated?: (aircraft: Aircraft) => void }

export function AircraftFormModal({ initial, existingAircraft, onSave, onClose, onCreated }: Props) {
  const [step, setStep] = useState(initial ? 2 : 1)
  const [kind, setKind] = useState<Kind>(initial?.recordKind ?? "aircraft")
  const [query, setQuery] = useState(initial?.tailNumber ?? "")
  const [draft, setDraft] = useState<AircraftDraft>(initial ?? blank())
  const [advanced, setAdvanced] = useState(Boolean(initial))
  const [loading, setLoading] = useState(false)
  const [lookup, setLookup] = useState<"idle" | "suggested" | "none" | "failed">("idle")
  const [error, setError] = useState("")
  const duplicate = useMemo(() => kind === "aircraft" ? existingAircraft.find((a) => a.id !== initial?.id && normalizeRegistration(a.tailNumber) === normalizeRegistration(query)) : undefined, [existingAircraft, initial?.id, kind, query])
  function set<K extends keyof AircraftDraft>(field: K, value: AircraftDraft[K]) { setDraft((current) => ({ ...current, [field]: value })) }
  async function review() {
    setError(""); const normalized = normalizeRegistration(query)
    if (kind === "aircraft" && !normalized) return setError("Enter an aircraft registration.")
    if (duplicate) return setError(`${duplicate.tailNumber} already exists.`)
    setLoading(true)
    try { const suggestion = await localAircraftLookupProvider.lookup(query); setDraft((current) => ({ ...current, recordKind: kind, tailNumber: kind === "aircraft" ? normalized : query.trim() || labels[kind], makeModel: suggestion?.makeModel ?? current.makeModel, category: suggestion?.category ?? (kind === "aircraft" ? current.category : "Other"), icaoType: suggestion?.icaoType ?? current.icaoType })); setLookup(suggestion ? "suggested" : "none"); setStep(2) }
    catch { setLookup("failed"); setStep(2) } finally { setLoading(false) }
  }
  function save() {
    setError("")
    if (kind === "aircraft" && !normalizeRegistration(draft.tailNumber)) return setError("Registration is required for an aircraft.")
    if (kind === "aircraft" && isDuplicateRegistration(existingAircraft, draft.tailNumber, initial?.id)) return setError("This registration already exists.")
    try { const result = onSave({ ...draft, recordKind: kind, tailNumber: kind === "aircraft" ? normalizeRegistration(draft.tailNumber) : draft.tailNumber.trim() }); onClose(); if (result) onCreated?.(result) } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save this record.") }
  }
  return <Modal title={initial ? "Edit aircraft" : `Add aircraft · Step ${step} of 3`} onClose={onClose} wide footer={<><Button variant="secondary" onClick={step === 2 && !initial ? () => setStep(1) : onClose}>{step === 2 && !initial ? "Back" : "Cancel"}</Button>{step === 1 ? <Button disabled={loading || Boolean(duplicate)} onClick={review}>{loading ? "Searching…" : "Review details"}</Button> : <Button onClick={save}>{initial ? "Save changes" : "Add and select"}</Button>}</>}>
    {step === 1 ? <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{(Object.keys(labels) as Kind[]).map((value) => <button key={value} type="button" onClick={() => { setKind(value); setDraft(blank(value)); setError("") }} className={`rounded-xl border p-3 text-left text-xs ${kind === value ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--text)]" : "border-[var(--border)] text-[var(--text-muted)]"}`}><Plane size={16} className="mb-2"/>{labels[value]}</button>)}</div>
      <Field label={kind === "aircraft" ? "Registration or aircraft type" : "Record name or device type"}><div className="relative"><Search size={15} className="absolute left-2.5 top-2.5 text-[var(--text-muted)]"/><Input autoFocus value={query} onChange={(e) => { setQuery(e.target.value); setError("") }} className="pl-8" placeholder={kind === "aircraft" ? "C-GSPB" : "Redbird FMX"}/></div></Field>
      {kind === "aircraft" && query && <p className="text-xs text-[var(--text-muted)]">Normalized: <strong>{normalizeRegistration(query)}</strong></p>}
      {duplicate && <p className="rounded-lg bg-amber-500/10 p-2 text-xs text-amber-500">Likely duplicate: {duplicate.tailNumber} · {duplicate.makeModel || "details not set"}</p>}{error && <p className="text-xs text-red-500">{error}</p>}
    </div> : <div className="space-y-4">
      {lookup === "suggested" && <p className="rounded-lg bg-amber-500/10 p-2 text-xs text-amber-500">Local type suggestion only. Pilot confirmation is required.</p>}{lookup === "none" && <p className="rounded-lg bg-[var(--bg-inset)] p-2 text-xs text-[var(--text-muted)]">No local suggestion found. Confirm the details manually.</p>}{lookup === "failed" && <p className="text-xs text-red-500">Suggestion lookup failed. Manual entry remains available.</p>}
      <div className="grid grid-cols-2 gap-3"><Field label={kind === "aircraft" ? "Registration" : "Record name"}><Input value={draft.tailNumber} onChange={(e) => set("tailNumber", e.target.value)}/></Field><Field label="Record type"><Input value={labels[kind]} disabled/></Field><Field label="Manufacturer / model" className="col-span-2"><Input value={draft.makeModel} onChange={(e) => set("makeModel", e.target.value)} placeholder="Diamond DA40"/></Field><Field label="Category"><Select value={draft.category} onChange={(e) => set("category", e.target.value as AircraftCategory)}>{categories.map((c) => <option key={c}>{c}</option>)}</Select></Field><Field label="ICAO type"><Input value={draft.icaoType ?? ""} onChange={(e) => set("icaoType", e.target.value.toUpperCase())}/></Field></div>
      <button type="button" onClick={() => setAdvanced((v) => !v)} className="flex items-center gap-1 text-xs font-medium text-[var(--accent)]">{advanced ? <ChevronUp size={14}/> : <ChevronDown size={14}/>} Advanced & personal defaults</button>
      {advanced && <div className="grid grid-cols-2 gap-3 rounded-xl border border-[var(--border)] p-3"><Field label="Nickname"><Input value={draft.nickname ?? ""} onChange={(e) => set("nickname", e.target.value)}/></Field><Field label="Usual role"><Select value={draft.usualRole ?? ""} onChange={(e) => set("usualRole", e.target.value as AircraftDraft["usualRole"])}><option value="">None</option><option>PIC</option><option>SIC</option><option>Dual received</option><option>Instructor</option></Select></Field><Field label="Usual departure"><Input value={draft.usualDeparture ?? ""} onChange={(e) => set("usualDeparture", e.target.value.toUpperCase())}/></Field><Field label="Frequent person"><Input value={draft.usualPerson ?? ""} onChange={(e) => set("usualPerson", e.target.value)}/></Field>{existingAircraft.some((a) => a.id !== initial?.id && a.makeModel && a.makeModel.toLowerCase() === draft.makeModel.toLowerCase()) && <Field label="Copy logging defaults" className="col-span-2"><Select defaultValue="" onChange={(e) => { const source = existingAircraft.find((a) => a.id === e.target.value); if (source) setDraft((current) => ({ ...current, favourite: source.favourite, usualRole: source.usualRole, usualDeparture: source.usualDeparture, usualPerson: source.usualPerson })) }}><option value="">Choose same-type aircraft…</option>{existingAircraft.filter((a) => a.id !== initial?.id && a.makeModel.toLowerCase() === draft.makeModel.toLowerCase()).map((a) => <option key={a.id} value={a.id}>Copy from {a.tailNumber}</option>)}</Select></Field>}<label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(draft.favourite)} onChange={(e) => set("favourite", e.target.checked)}/> Favourite</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(draft.defaultAircraft)} onChange={(e) => set("defaultAircraft", e.target.checked)}/> Default aircraft</label></div>}{error && <p className="text-xs text-red-500">{error}</p>}
    </div>}
  </Modal>
}
