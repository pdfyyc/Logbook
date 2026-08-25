import { useEffect, useMemo, useState } from "react"
import type { Aircraft, AircraftDraft, Flight, FlightDraft, PilotProfile, Rating, RatingDraft } from "../types"
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

  function updateProfile(patch: Partial<Omit<PilotProfile, "ratings">>) {
    setProfile((prev) => ({ ...prev, ...patch }))
  }

  function addRating(draft: RatingDraft): Rating {
    const created: Rating = { ...draft, id: newId() }
    setProfile((prev) => ({ ...prev, ratings: [...prev.ratings, created] }))
    return created
  }

  function updateRating(id: string, draft: RatingDraft) {
    setProfile((prev) => ({
      ...prev,
      ratings: prev.ratings.map((r) => (r.id === id ? { ...draft, id } : r)),
    }))
  }

  function deleteRating(id: string) {
    setProfile((prev) => ({ ...prev, ratings: prev.ratings.filter((r) => r.id !== id) }))
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
    addRating,
    updateRating,
    deleteRating,
  }
}

export type LogbookStore = ReturnType<typeof useLogbook>
