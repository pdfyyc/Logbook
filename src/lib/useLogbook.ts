import { useEffect, useMemo, useState } from "react"
import type { Aircraft, AircraftDraft, Flight, FlightDraft } from "../types"
import { loadAircraft, loadFlights, saveAircraft, saveFlights } from "./storage"
import { newId } from "./id"

export function useLogbook() {
  const [aircraft, setAircraft] = useState<Aircraft[]>(() => loadAircraft())
  const [flights, setFlights] = useState<Flight[]>(() => loadFlights())

  useEffect(() => saveAircraft(aircraft), [aircraft])
  useEffect(() => saveFlights(flights), [flights])

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

  function replaceAll(nextAircraft: Aircraft[], nextFlights: Flight[]) {
    setAircraft(nextAircraft)
    setFlights(nextFlights)
  }

  return {
    aircraft,
    flights,
    aircraftById,
    addAircraft,
    updateAircraft,
    deleteAircraft,
    addFlight,
    updateFlight,
    deleteFlight,
    replaceAll,
  }
}

export type LogbookStore = ReturnType<typeof useLogbook>
