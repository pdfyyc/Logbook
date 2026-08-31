import { useEffect, useMemo, useReducer, useRef, useState } from "react"
import { ChevronDown, ChevronUp, Plus, Search } from "lucide-react"
import type { Aircraft, Flight, FlightDraft, PilotProfile } from "../types"
import { flightWarnings, suggestedDeparture } from "../lib/flightEntry"
import { createFlightEntryState, flightEntryReducer } from "../lib/flightEntryState"
import { validateFlightNumbers } from "../lib/numericPolicy"
import { loadFlightDraftMetadata, saveFlightDraftMetadata } from "../lib/storage"
import { normalizeFlightPeople, peopleConflicts, recentAirportSuggestions, recentRouteShortcuts } from "../lib/flightEntryUx"
import { Modal } from "./ui/Modal"
import { Field, Input, Select } from "./ui/Field"
import { Button } from "./ui/Button"

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function blankDraft(defaultAircraftId: string, departure = "", role: FlightDraft["myRole"] = ""): FlightDraft {
  return {
    date: todayIso(),
    aircraftId: defaultAircraftId,
    from: departure,
    to: "",
    route: "",
    totalTime: 0,
    dayTime: 0,
    pic: 0,
    sic: 0,
    solo: 0,
    dualReceived: 0,
    dualGiven: 0,
    crossCountry: 0,
    night: 0,
    actualInstrument: 0,
    simulatedInstrument: 0,
    dayTakeoffs: 1,
    nightTakeoffs: 0,
    dayLandings: 1,
    nightLandings: 0,
    approaches: 0,
    holds: 0,
    simTime: 0,
    remarks: "",
    myRole: role,
    legalPicName: "",
    primaryCrewName: "",
    primaryCrewRole: "",
    instructorName: "",
    passengers: [],
    copilotCreditConfirmed: false,
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
  { key: "dayTakeoffs", label: "Day takeoffs" },
  { key: "dayLandings", label: "Day landings" },
  { key: "nightTakeoffs", label: "Night takeoffs" },
  { key: "nightLandings", label: "Night landings" },
  { key: "approaches", label: "Approaches" },
  { key: "holds", label: "Holds" },
]

interface Props {
  aircraft: Aircraft[]
  flights: Flight[]
  profile: PilotProfile
  initial?: Flight
  initialDraft?: FlightDraft
  reviewSuggestion?: string
  mode?: "create" | "edit" | "duplicate"
  recentAircraftIds?: string[]
  onSave: (draft: FlightDraft, amendmentReason?: string) => void
  onClose: () => void
  onAddAircraft: (draft: FlightDraft) => void
}

export function FlightFormModal({ aircraft, flights, profile, initial, initialDraft, reviewSuggestion, mode = initial ? "edit" : initialDraft ? "duplicate" : "create", recentAircraftIds = [], onSave, onClose, onAddAircraft }: Props) {
  const activeAircraft = aircraft.filter((a) => !a.archived)
  const recentAircraft = recentAircraftIds.map((id) => activeAircraft.find((a) => a.id === id)).find(Boolean)
  const preferred = activeAircraft.find((a) => a.defaultAircraft) ?? recentAircraft ?? activeAircraft[0]
  const initialDeparture = suggestedDeparture(flights, aircraft, profile.homeAirport)
  const freshDraft = blankDraft(preferred?.id ?? "", initialDeparture, profile.defaultRole)
  if (["pic", "instructor", "solo-student"].includes(profile.defaultRole ?? "")) freshDraft.legalPicName = profile.pilotName
  if (profile.defaultRole === "instructor") { freshDraft.primaryCrewName = profile.frequentStudents?.[0] ?? ""; freshDraft.primaryCrewRole = "student"; freshDraft.instructorName = profile.pilotName }
  if (profile.defaultRole === "student") { freshDraft.primaryCrewName = profile.pilotName; freshDraft.primaryCrewRole = "student"; freshDraft.instructorName = profile.frequentInstructor ?? ""; freshDraft.legalPicName = profile.frequentInstructor ?? "" }
  const recovered = useMemo(() => { try { return mode === "create" && !initialDraft ? loadFlightDraftMetadata() : undefined } catch { return undefined } }, [initialDraft, mode])
  const [draftDecisionPending, setDraftDecisionPending] = useState(Boolean(recovered?.value?.date))
  const startingDraft = initial ?? initialDraft ?? freshDraft
  const [entry, dispatch] = useReducer(flightEntryReducer, createFlightEntryState(startingDraft, Boolean(initial)))
  const draft = entry.draft
  const setDraft = (updater: FlightDraft | ((current: FlightDraft) => FlightDraft)) => dispatch({ type: "replace", draft: typeof updater === "function" ? updater(draft) : updater, preserveModes: true })
  const [aircraftQuery, setAircraftQuery] = useState("")
  const recentRank = (id: string) => { const rank = recentAircraftIds.indexOf(id); return rank < 0 ? Number.MAX_SAFE_INTEGER : rank }
  const [expanded, setExpanded] = useState(Boolean(initial))
  const [morePeople, setMorePeople] = useState(Boolean(initial && ((initial.passengers?.length ?? 0) > 0 || initial.primaryCrewRole === "safety-pilot" || initial.primaryCrewRole === "other-crew")))
  const [amendmentReason, setAmendmentReason] = useState("")
  const [attemptedSave, setAttemptedSave] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const submitLock = useRef(false)
  const recentPeople = flights
    .flatMap((flight) => [flight.legalPicName, flight.primaryCrewName, flight.instructorName, ...(flight.passengers ?? [])])
    .map((name) => name?.trim()).filter((name): name is string => Boolean(name))
    .reduce<string[]>((names, name) => names.some((saved) => saved.localeCompare(name, undefined, { sensitivity: "base" }) === 0) ? names : [...names, name], [])
    .slice(-20).reverse()

  function set<K extends keyof FlightDraft>(key: K, value: FlightDraft[K]) {
    dispatch({ type: "field", key, value })
  }

  function setNumber(key: keyof FlightDraft, raw: string) {
    dispatch({ type: "number", key, value: raw, count: ["dayTakeoffs", "nightTakeoffs", "dayLandings", "nightLandings", "approaches", "holds"].includes(String(key)) })
  }

  function setRole(role: NonNullable<FlightDraft["myRole"]>) {
    dispatch({ type: "role", role })
    if (!draft.legalPicName) dispatch({ type: "field", key: "legalPicName", value: (role === "pic" || role === "instructor" || role === "solo-student") ? profile.pilotName : role === "student" ? profile.frequentInstructor ?? "" : "" })
    if (!draft.primaryCrewRole) dispatch({ type: "field", key: "primaryCrewRole", value: role === "student" || role === "instructor" ? "student" : role === "copilot" ? "copilot" : "" })
    if (!draft.instructorName) dispatch({ type: "field", key: "instructorName", value: role === "instructor" ? profile.pilotName : role === "student" ? profile.frequentInstructor ?? "" : "" })
    if (!draft.primaryCrewName) dispatch({ type: "field", key: "primaryCrewName", value: role === "instructor" ? profile.frequentStudents?.[0] ?? "" : role === "student" || role === "copilot" ? profile.pilotName : "" })
  }

  function setPassenger(index: number, value: string) {
    setDraft((current) => ({ ...current, passengers: (current.passengers ?? []).map((name, i) => i === index ? value : name) }))
  }

  const selectedAircraft = aircraft.find((item) => item.id === draft.aircraftId)
  const warnings = [...flightWarnings(draft, selectedAircraft), ...validateFlightNumbers(draft), ...peopleConflicts(draft)]
  const fieldErrors = {
    date: !draft.date ? "Enter the flight date." : "",
    aircraftId: !draft.aircraftId ? "Choose an aircraft, simulator, FTD, or historical record." : "",
    from: !draft.from.trim() ? "Enter the departure." : "",
    to: !draft.to.trim() ? "Enter the destination." : "",
    totalTime: draft.totalTime <= 0 ? "Enter a total time greater than zero." : "",
    amendment: initial && !amendmentReason.trim() ? "Explain why this saved entry is being changed." : "",
  }
  const canSave = warnings.length === 0 && !Object.values(fieldErrors).some(Boolean)
  const possibleDuplicate = flights.find((flight) => flight.id !== initial?.id && !flight.voidedAt && flight.date === draft.date && flight.aircraftId === draft.aircraftId && flight.from.trim().toUpperCase() === draft.from.trim().toUpperCase() && flight.to.trim().toUpperCase() === draft.to.trim().toUpperCase() && Math.abs(flight.totalTime - draft.totalTime) < 0.001 && (flight.myRole ?? "") === (draft.myRole ?? "") && (flight.primaryCrewName ?? "").trim().toLowerCase() === (draft.primaryCrewName ?? "").trim().toLowerCase())
  function confirmDuplicate() { return !possibleDuplicate || window.confirm(`Possible duplicate: ${possibleDuplicate.date} ${possibleDuplicate.from} to ${possibleDuplicate.to}, ${possibleDuplicate.totalTime.toFixed(1)} hours.\n\nChoose Cancel to return and edit, or OK to save anyway.`) }
  const airports = useMemo(() => recentAirportSuggestions(flights, profile.homeAirport), [flights, profile.homeAirport])
  const routes = useMemo(() => recentRouteShortcuts(flights), [flights])
  const lastAircraftFlight = flights.filter((flight) => !flight.voidedAt && !["simulator", "ftd"].includes(aircraft.find((item) => item.id === flight.aircraftId)?.recordKind ?? "aircraft")).sort((a, b) => b.date.localeCompare(a.date))[0]

  useEffect(() => {
    if (!initial && !draftDecisionPending) saveFlightDraftMetadata(draft)
  }, [draft, initial, draftDecisionPending])

  function focusFirstInvalid() {
    requestAnimationFrame(() => {
      const target = document.querySelector<HTMLInputElement>('[aria-invalid="true"]')
      target?.focus()
    })
  }

  function submit(closeAfter: boolean) {
    setAttemptedSave(true)
    if (!canSave) { focusFirstInvalid(); return }
    if (submitLock.current || !confirmDuplicate()) return
    submitLock.current = true; setSubmitting(true)
    try {
      const normalized = normalizeFlightPeople(draft)
      onSave(normalized, amendmentReason)
      saveFlightDraftMetadata()
      if (closeAfter) onClose()
      else {
        dispatch({ type: "replace", draft: blankDraft(draft.aircraftId, draft.to, draft.myRole) })
        setAttemptedSave(false); submitLock.current = false; setSubmitting(false)
      }
    } catch (error) {
      submitLock.current = false; setSubmitting(false)
      window.alert(error instanceof Error ? error.message : "The flight could not be saved.")
    }
  }

  return (
    <Modal
      title={mode === "edit" ? "Edit flight" : mode === "duplicate" ? "Duplicate flight" : "Add flight"}
      onClose={onClose}
      wide
      footer={
        <>
          {!initial && <Button variant="ghost" onClick={() => { if (window.confirm("Discard this unfinished flight draft?")) { saveFlightDraftMetadata(); dispatch({ type: "replace", draft: freshDraft }); setDraftDecisionPending(false) } }}>Discard draft</Button>}
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          {!initial && <Button variant="secondary" disabled={submitting || draftDecisionPending} onClick={() => submit(false)}>Save and add another</Button>}
          <Button disabled={submitting || draftDecisionPending} onClick={() => submit(true)}>
            {submitting ? "Saving…" : mode === "edit" ? "Save amendment" : mode === "duplicate" ? "Save duplicate" : "Save flight"}
          </Button>
        </>
      }
    >
      {draftDecisionPending && recovered && <div className="mb-4 rounded-xl border border-[var(--accent)] bg-[var(--accent-soft)] p-3 text-sm"><strong>Recoverable unfinished flight found</strong><p className="mt-1 text-xs text-[var(--text-muted)]">Saved {recovered.updatedAt ? new Date(recovered.updatedAt).toLocaleString() : "from an earlier version"}. Resume it or deliberately discard it before entering a new flight.</p><div className="mt-3 flex flex-wrap gap-2"><Button type="button" onClick={() => { dispatch({ type: "replace", draft: { ...freshDraft, ...recovered.value } }); setDraftDecisionPending(false) }}>Resume draft</Button><Button type="button" variant="secondary" onClick={() => { saveFlightDraftMetadata(); dispatch({ type: "replace", draft: freshDraft }); setDraftDecisionPending(false) }}>Discard saved draft</Button></div></div>}
      {mode === "duplicate" && <div className="mb-3 rounded-lg border border-[var(--accent)]/40 bg-[var(--accent-soft)] p-3 text-xs"><strong>New entry from an existing flight.</strong> Review the new date and all carried-forward operational details. Amendment history and record identity were not copied.</div>}
      {reviewSuggestion && <div className="mb-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs"><strong>Suggested change:</strong> {reviewSuggestion}</div>}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label="Date" error={attemptedSave ? fieldErrors.date : ""}>
          <Input
            type="date"
            value={draft.date}
            aria-invalid={attemptedSave && Boolean(fieldErrors.date)}
            onChange={(e) => set("date", e.target.value)}
          />
        </Field>
        <Field label="Aircraft" error={attemptedSave ? fieldErrors.aircraftId : ""} className="col-span-2 sm:col-span-1">
          {activeAircraft.length === 0 ? (
            <Button variant="secondary" onClick={() => onAddAircraft(draft)} type="button">
              Add an aircraft first
            </Button>
          ) : (
            <div className="space-y-1.5">
              <div className="relative"><Search size={14} className="absolute left-2.5 top-3 text-[var(--text-muted)]"/><Input aria-invalid={attemptedSave && Boolean(fieldErrors.aircraftId)} value={aircraftQuery} onChange={(e) => setAircraftQuery(e.target.value)} placeholder={activeAircraft.find((a) => a.id === draft.aircraftId)?.tailNumber || "Search registration or type"} className="pl-8"/></div>
              <div className="max-h-36 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--bg)] p-1">
                {activeAircraft.filter((a) => [a.tailNumber, a.nickname, a.makeModel, a.icaoType].some((value) => value?.toLowerCase().includes(aircraftQuery.toLowerCase()))).sort((a, b) => Number(Boolean(b.favourite)) - Number(Boolean(a.favourite)) || recentRank(a.id) - recentRank(b.id)).map((a) => <button type="button" key={a.id} onClick={() => { dispatch({ type: "field", key: "aircraftId", value: a.id }); dispatch({ type: "aircraft-kind", kind: a.recordKind ?? "aircraft" }); setAircraftQuery("") }} className={`flex min-h-10 w-full items-center justify-between gap-2 rounded-md px-2 py-2 text-left text-xs ${draft.aircraftId === a.id ? "bg-[var(--accent-soft)] text-[var(--text)]" : "text-[var(--text-muted)] hover:bg-[var(--bg-inset)]"}`}><span className="min-w-0"><strong>{a.favourite ? "★ " : ""}{a.nickname || a.tailNumber}</strong><span className="block truncate">{a.tailNumber} · {a.makeModel}{a.icaoType ? ` · ${a.icaoType}` : ""}</span></span><span className="shrink-0 uppercase">{a.recordKind && a.recordKind !== "aircraft" ? a.recordKind : "active"}</span></button>)}
                <button type="button" onClick={() => onAddAircraft(draft)} className="flex w-full items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-[var(--accent)]"><Plus size={13}/> Add new aircraft</button>
              </div>
            </div>
          )}
        </Field>
        <Field label="From" error={attemptedSave ? fieldErrors.from : ""}>
          <Input
            list="recent-airports"
            value={draft.from}
            aria-invalid={attemptedSave && Boolean(fieldErrors.from)}
            onChange={(e) => set("from", e.target.value.toUpperCase())}
            placeholder="KPDX"
          />
        </Field>
        <Field label="To" error={attemptedSave ? fieldErrors.to : ""}>
          <Input
            list="recent-airports"
            value={draft.to}
            aria-invalid={attemptedSave && Boolean(fieldErrors.to)}
            onChange={(e) => set("to", e.target.value.toUpperCase())}
            placeholder="KHIO"
          />
        </Field>
      </div>

      {selectedAircraft && <div className="mt-2 rounded-lg bg-[var(--bg-inset)] px-3 py-2 text-xs text-[var(--text-muted)]"><strong className="text-[var(--text)]">Selected:</strong> {selectedAircraft.tailNumber} · {selectedAircraft.makeModel}{selectedAircraft.icaoType ? ` · ${selectedAircraft.icaoType}` : ""} {selectedAircraft.recordKind === "historical" ? "— preserved historical record" : "— local aircraft record"}</div>}
      {selectedAircraft?.recordKind === "historical" && <Field label="Original aircraft text" className="mt-2"><Input value={draft.sourceAircraftText ?? ""} onChange={(e) => set("sourceAircraftText", e.target.value)} placeholder="Registration or type exactly as shown in the source logbook"/></Field>}

      <div className="mt-3 grid grid-cols-2 gap-3">
        <datalist id="recent-airports">{airports.map((airport) => <option key={airport} value={airport}/>)}</datalist>
        <Field label="Route (optional)">
          <Input
            value={draft.route}
            onChange={(e) => set("route", e.target.value)}
            placeholder="Direct, or via..."
          />
        </Field>
        <Field label="Total time (hrs)" error={attemptedSave ? fieldErrors.totalTime : ""}>
          <Input
            type="number"
            step="0.1"
            min="0"
            value={draft.totalTime || ""}
            aria-invalid={attemptedSave && Boolean(fieldErrors.totalTime)}
            onChange={(e) => dispatch({ type: "total", value: e.target.value, device: ["simulator", "ftd"].includes(selectedAircraft?.recordKind ?? "") })}
            placeholder="1.3"
          />
        </Field>
      </div>

      <div className="mt-2 flex flex-wrap gap-1">{lastAircraftFlight && <Button type="button" variant="ghost" onClick={() => setDraft((current) => ({ ...current, from: lastAircraftFlight.to.trim().toUpperCase(), to: lastAircraftFlight.from.trim().toUpperCase(), route: lastAircraftFlight.route }))}>Reverse last route</Button>}{profile.homeAirport && <Button type="button" variant="ghost" onClick={() => set("to", profile.homeAirport!.trim().toUpperCase())}>Home airport</Button>}{airports.slice(0, 4).map((airport) => <Button key={airport} type="button" variant="ghost" onClick={() => set("to", airport)}>{airport}</Button>)}</div>
      {routes.length > 0 && <div className="mt-2"><p className="text-xs font-medium text-[var(--text-muted)]">Recent routes</p><div className="mt-1 flex flex-wrap gap-1">{routes.map((route) => <Button key={route.key} type="button" variant="secondary" onClick={() => setDraft((current) => ({ ...current, from: route.from, to: route.to, route: route.route }))}>{route.from} → {route.to}{route.uses > 1 ? ` · ${route.uses}×` : ""}</Button>)}</div></div>}
      {draft.totalTime > 0 && <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-[var(--bg-inset)] px-3 py-2 text-xs"><strong>{draft.totalTime.toFixed(1)} total</strong>{draft.pic > 0 && <span>{draft.pic.toFixed(1)} PIC</span>}{draft.sic > 0 && <span>{draft.sic.toFixed(1)} co-pilot</span>}{draft.dualReceived > 0 && <span>{draft.dualReceived.toFixed(1)} dual received</span>}{draft.dualGiven > 0 && <span>{draft.dualGiven.toFixed(1)} instructor</span>}<span>{(draft.dayTime ?? Math.max(0, draft.totalTime - draft.night)).toFixed(1)} day</span><button type="button" className="ml-auto text-[var(--accent)]" onClick={() => dispatch({ type: "reset-times" })}>Reset to suggested times</button></div>}

      <section className="mt-4 space-y-3 rounded-xl border border-[var(--border)] p-3">
        <div><h3 className="text-sm font-semibold">My role</h3><p className="text-xs text-[var(--text-muted)]">Your role and the people onboard do not automatically change credited flight time.</p></div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {([ ["pic", "PIC"], ["copilot", "Co-pilot"], ["student", "Student"], ["instructor", "Instructor"], ["solo-student", "Solo student"], ["observer", "Other / observer"] ] as const).map(([value, label]) => <button key={value} type="button" onClick={() => setRole(value)} className={`min-h-11 rounded-lg border px-3 py-2 text-sm ${draft.myRole === value ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--border)]"}`}>{label}</button>)}
        </div>
        {draft.myRole === "copilot" && <label className="flex items-start gap-2 rounded-lg bg-amber-500/10 p-2 text-xs"><input className="mt-0.5" type="checkbox" checked={Boolean(draft.copilotCreditConfirmed)} onChange={(e) => set("copilotCreditConfirmed", e.target.checked)}/><span>I confirm this aircraft and operation permit the co-pilot time to be credited. Occupying the other pilot seat alone is not sufficient.</span></label>}

        <h3 className="pt-1 text-sm font-semibold">People onboard</h3>
        <datalist id="recent-flight-people">{recentPeople.map((name) => <option key={name} value={name}/>)}</datalist>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {(draft.myRole === "instructor" || draft.myRole === "student" || draft.myRole === "copilot") && <Field label="Pilot-in-command"><Input list="recent-flight-people" value={draft.legalPicName ?? ""} onChange={(e) => set("legalPicName", e.target.value)} placeholder={profile.pilotName || "Name"}/></Field>}
          {(draft.myRole === "instructor" || draft.myRole === "pic") && <Field label={draft.myRole === "instructor" ? "Student" : "Co-pilot or student (optional)"}>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto]"><Input list="recent-flight-people" value={draft.primaryCrewName ?? ""} onChange={(e) => set("primaryCrewName", e.target.value)} placeholder="Name"/><Select aria-label="Crew role" value={draft.primaryCrewRole ?? ""} onChange={(e) => set("primaryCrewRole", e.target.value as NonNullable<FlightDraft["primaryCrewRole"]>)}><option value="">Role</option><option value="copilot">Co-pilot</option><option value="student">Student</option><option value="safety-pilot">Safety pilot</option><option value="other-crew">Other crew</option></Select></div>
          </Field>}
          {draft.myRole === "student" && <Field label="Instructor"><Input list="recent-flight-people" value={draft.instructorName ?? ""} onChange={(e) => { set("instructorName", e.target.value); if (!draft.legalPicName) set("legalPicName", e.target.value) }} placeholder="Instructor name"/></Field>}
        </div>
        <Button type="button" variant="ghost" onClick={() => setMorePeople((value) => !value)}><Plus size={14}/> Add another person</Button>
        {morePeople && <div className="space-y-2">
          {(draft.passengers ?? []).map((passenger, index) => <div key={index} className="flex min-w-0 flex-wrap gap-2"><Input className="min-w-40 flex-1" aria-label={`Passenger ${index + 1}`} list="recent-flight-people" value={passenger} onChange={(e) => setPassenger(index, e.target.value)} placeholder={`Passenger ${index + 1}`}/><Button type="button" variant="ghost" onClick={() => set("passengers", (draft.passengers ?? []).filter((_, i) => i !== index))}>Remove</Button></div>)}
          <Button type="button" variant="secondary" onClick={() => set("passengers", [...(draft.passengers ?? []), ""])}><Plus size={14}/> Add passenger</Button>
        </div>}
      </section>

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="mt-4 flex items-center gap-1 text-xs font-medium text-[var(--accent)] cursor-pointer"
      >
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        {expanded ? "Hide" : "Review"} time breakdown
      </button>

      {expanded && (
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Field label="Day"><Input type="number" step="0.1" min="0" value={draft.dayTime || ""} onChange={(e) => setNumber("dayTime", e.target.value)} placeholder="0"/></Field>
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
      {initial && (
        <Field label="Reason for amendment" error={attemptedSave ? fieldErrors.amendment : ""} className="mt-3">
          <Input
            value={amendmentReason}
            aria-invalid={attemptedSave && Boolean(fieldErrors.amendment)}
            onChange={(e) => setAmendmentReason(e.target.value)}
            placeholder="e.g. Corrected PIC time from original entry"
          />
        </Field>
      )}

      {warnings.length > 0 && <div className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-600"><strong>Before saving:</strong><ul className="mt-1 list-disc pl-4">{warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></div>}
    </Modal>
  )
}
