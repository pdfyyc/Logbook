import { useEffect, useMemo, useRef, useState } from "react"
import type {
  Aircraft,
  AircraftDraft,
  Flight,
  FlightDraft,
  PilotProfile,
  Qualification,
  QualificationDraft,
} from "../types"
import { isExternalRevision, loadLogbookDocument, persistLogbookDocument, ROOT_DOCUMENT_KEY } from "./storage"
import type { LogbookDocument } from "./dataModel"
import { newId } from "./id"
import type { ImportedFlight } from "./flightImport"
import { isDuplicateRegistration, normalizeRegistration } from "./aircraftRegistry"

export type ImportResolution = { mode: "existing"; aircraftId: string } | { mode: "aircraft" | "historical" | "simulator" | "ftd" }

export function useLogbook() {
  const [loaded] = useState(() => loadLogbookDocument())
  const [aircraft, setAircraft] = useState<Aircraft[]>(loaded.document.aircraft)
  const [flights, setFlights] = useState<Flight[]>(loaded.document.flights)
  const [profile, setProfile] = useState<PilotProfile>(loaded.document.profile)
  const [uncertainties, setUncertainties] = useState(loaded.document.uncertainties)
  const documentRef = useRef(loaded.document)
  const revisionRef = useRef(loaded.document.revision)
  const [storageWarning, setStorageWarning] = useState(loaded.warning ?? "")
  const [multiTabConflict, setMultiTabConflict] = useState(false)
  const writesBlocked = Boolean((loaded.warning && !loaded.recoveredFrom) || multiTabConflict)

  /* oxlint-disable react/set-state-in-effect */
  useEffect(() => {
    if (writesBlocked) return
    try { const saved = persistLogbookDocument({ ...documentRef.current, aircraft, flights, profile, revision: revisionRef.current }); documentRef.current = saved; revisionRef.current = saved.revision; setStorageWarning("") }
    catch (error) { setStorageWarning(error instanceof Error ? error.message : "Logbook save failed.") }
  }, [aircraft, flights, profile, writesBlocked])
  /* oxlint-enable react/set-state-in-effect */

  useEffect(() => {
    const listener = (event: StorageEvent) => { if (event.key === ROOT_DOCUMENT_KEY && event.newValue) { try { const incoming = JSON.parse(event.newValue) as { revision?: string }; if (isExternalRevision(revisionRef.current, incoming.revision)) setMultiTabConflict(true) } catch { setStorageWarning("Another tab wrote unreadable logbook data. This tab stopped automatic conflict resolution.") } } }
    window.addEventListener("storage", listener); return () => window.removeEventListener("storage", listener)
  }, [])
  useEffect(() => { const listener = (event: Event) => { const document = (event as CustomEvent<LogbookDocument>).detail; if (document) { documentRef.current = document; revisionRef.current = document.revision } }; window.addEventListener("logbook-document-written", listener); return () => window.removeEventListener("logbook-document-written", listener) }, [])

  const aircraftById = useMemo(() => new Map(aircraft.map((a) => [a.id, a])), [aircraft])

  function addAircraft(draft: AircraftDraft): Aircraft {
    const isRegistered = !draft.recordKind || draft.recordKind === "aircraft"
    const tailNumber = isRegistered ? normalizeRegistration(draft.tailNumber) : draft.tailNumber.trim()
    if (isRegistered && isDuplicateRegistration(aircraft, tailNumber)) throw new Error("An aircraft with this registration already exists.")
    const created: Aircraft = { ...draft, tailNumber, id: newId() }
    setAircraft((prev) => [...prev.map((a) => draft.defaultAircraft ? { ...a, defaultAircraft: false } : a), created])
    return created
  }

  function updateAircraft(id: string, draft: AircraftDraft) {
    const isRegistered = !draft.recordKind || draft.recordKind === "aircraft"
    const tailNumber = isRegistered ? normalizeRegistration(draft.tailNumber) : draft.tailNumber.trim()
    if (isRegistered && isDuplicateRegistration(aircraft, tailNumber, id)) throw new Error("An aircraft with this registration already exists.")
    setAircraft((prev) => prev.map((a) => a.id === id ? { ...draft, tailNumber, id } : draft.defaultAircraft ? { ...a, defaultAircraft: false } : a))
  }

  function deleteAircraft(id: string) {
    setAircraft((prev) => prev.map((a) => a.id === id ? { ...a, archived: true, defaultAircraft: false, favourite: false } : a))
  }

  function addFlight(draft: FlightDraft): Flight {
    const created: Flight = { ...draft, id: newId() }
    setFlights((prev) => [...prev, created])
    return created
  }

  function updateFlight(id: string, draft: FlightDraft, reason: string) {
    setFlights((prev) =>
      prev.map((f) => {
        if (f.id !== id || f.voidedAt) return f
        const { id: _id, voidedAt: _voidedAt, voidReason: _voidReason, amendments: _amendments, ...previous } = f
        return {
          ...draft,
          id,
          amendments: [
            ...(f.amendments ?? []),
            { amendedAt: new Date().toISOString(), reason: reason.trim(), previous },
          ],
        }
      }),
    )
  }

  function voidFlight(id: string, reason: string) {
    setFlights((prev) =>
      prev.map((f) =>
        f.id === id && !f.voidedAt
          ? { ...f, voidedAt: new Date().toISOString(), voidReason: reason.trim() }
          : f,
      ),
    )
  }

  function replaceAll(nextAircraft: Aircraft[], nextFlights: Flight[], nextProfile?: PilotProfile) {
    setAircraft(nextAircraft)
    setFlights(nextFlights)
    if (nextProfile) setProfile(nextProfile)
  }

  function updateProfile(patch: Partial<Omit<PilotProfile, "qualifications">>) {
    setProfile((prev) => ({ ...prev, ...patch }))
  }

  function addQualification(draft: QualificationDraft): Qualification {
    const created: Qualification = { ...draft, id: newId() }
    setProfile((prev) => ({ ...prev, qualifications: [...prev.qualifications, created] }))
    return created
  }

  function updateQualification(id: string, draft: QualificationDraft) {
    setProfile((prev) => ({
      ...prev,
      qualifications: prev.qualifications.map((q) => (q.id === id ? { ...draft, id } : q)),
    }))
  }

  function deleteQualification(id: string) {
    setProfile((prev) => ({ ...prev, qualifications: prev.qualifications.filter((q) => q.id !== id) }))
  }

  function addLicenseGoal(templateId: string) {
    setProfile((prev) =>
      prev.trackedLicenseGoals.includes(templateId)
        ? prev
        : { ...prev, trackedLicenseGoals: [...prev.trackedLicenseGoals, templateId] },
    )
  }

  function applyDocument(document: LogbookDocument) { documentRef.current = document; revisionRef.current = document.revision; setAircraft(document.aircraft); setFlights(document.flights); setProfile(document.profile); setUncertainties(document.uncertainties); setMultiTabConflict(false) }

  function importFlights(imported: ImportedFlight[], resolutions: Record<string, ImportResolution>) {
    const existingByTail = new Map(aircraft.map((a) => [normalizeRegistration(a.tailNumber), a.id]))
    const additions: Aircraft[] = []
    for (const entry of imported) {
      const normalized = normalizeRegistration(entry.aircraftTailNumber)
      const resolution = resolutions[normalized]
      if (!resolution || resolution.mode === "existing" || existingByTail.has(normalized)) { if (resolution?.mode === "existing") existingByTail.set(normalized, resolution.aircraftId); continue }
      const created: Aircraft = { id: newId(), tailNumber: normalized || "Historical aircraft", makeModel: "Imported aircraft — review", category: "Other", recordKind: resolution.mode, isComplex: false, isHighPerformance: false, isTailwheel: false, isTaa: false, notes: "Created from confirmed import review. Original aircraft text remains on each flight." }
      additions.push(created)
      existingByTail.set(normalized, created.id)
    }
    setAircraft((prev) => [...prev, ...additions])
    setFlights((prev) => [...prev, ...imported.map((entry) => ({ ...entry.draft, id: newId(), aircraftId: existingByTail.get(normalizeRegistration(entry.aircraftTailNumber)) ?? "" })).filter((flight) => flight.aircraftId)])
  }

  function removeLicenseGoal(templateId: string) {
    setProfile((prev) => ({
      ...prev,
      trackedLicenseGoals: prev.trackedLicenseGoals.filter((id) => id !== templateId),
    }))
  }

  return {
    aircraft,
    flights,
    profile,
    uncertainties,
    aircraftById,
    addAircraft,
    updateAircraft,
    deleteAircraft,
    addFlight,
    updateFlight,
    voidFlight,
    replaceAll,
    applyDocument,
    storageWarning,
    multiTabConflict,
    updateProfile,
    addQualification,
    updateQualification,
    deleteQualification,
    addLicenseGoal,
    removeLicenseGoal,
    importFlights,
  }
}

export type LogbookStore = ReturnType<typeof useLogbook>
