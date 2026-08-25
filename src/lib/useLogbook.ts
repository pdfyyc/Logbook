import { useEffect, useMemo, useState } from "react"
import type {
  Aircraft,
  AircraftDraft,
  Flight,
  FlightDraft,
  PilotProfile,
  Qualification,
  QualificationDraft,
} from "../types"
import { loadAircraft, loadFlights, loadProfile, saveAircraft, saveFlights, saveProfile } from "./storage"
import { newId } from "./id"

export function useLogbook() {
  const [aircraft, setAircraft] = useState<Aircraft[]>(() => loadAircraft())
  const [flights, setFlights] = useState<Flight[]>(() => loadFlights())
  const [profile, setProfile] = useState<PilotProfile>(() => loadProfile())

  useEffect(() => saveAircraft(aircraft), [aircraft])
  useEffect(() => saveFlights(flights), [flights])
  useEffect(() => saveProfile(profile), [profile])

  const aircraftById = useMemo(() => new Map(aircraft.map((a) => [a.id, a])), [aircraft])

  function addAircraft(draft: AircraftDraft): Aircraft {
    const created: Aircraft = { ...draft, id: newId() }
    setAircraft((prev) => [...prev, created])
    return created
  }

  function updateAircraft(id: string, draft: AircraftDraft) {
    setAircraft((prev) => prev.map((a) => (a.id === id ? { ...draft, id } : a)))
  }

  function deleteAircraft(id: string) {
    setAircraft((prev) => prev.filter((a) => a.id !== id))
  }

  function addFlight(draft: FlightDraft): Flight {
    const created: Flight = { ...draft, id: newId() }
    setFlights((prev) => [...prev, created])
    return created
  }

  function updateFlight(id: string, draft: FlightDraft) {
    setFlights((prev) => prev.map((f) => (f.id === id ? { ...draft, id } : f)))
  }

  function deleteFlight(id: string) {
    setFlights((prev) => prev.filter((f) => f.id !== id))
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

  return {
    aircraft,
    flights,
    profile,
    aircraftById,
    addAircraft,
    updateAircraft,
    deleteAircraft,
    addFlight,
    updateFlight,
    deleteFlight,
    replaceAll,
    updateProfile,
    addQualification,
    updateQualification,
    deleteQualification,
  }
}

export type LogbookStore = ReturnType<typeof useLogbook>
