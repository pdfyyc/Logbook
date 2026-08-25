import { useEffect, useState } from "react"
import { Download } from "lucide-react"
import { Nav, type Tab } from "./components/Nav"
import { Dashboard } from "./components/Dashboard"
import { LogbookView } from "./components/LogbookView"
import { AircraftView } from "./components/AircraftView"
import { ProfileView } from "./components/ProfileView"
import { FlightFormModal } from "./components/FlightFormModal"
import { AircraftFormModal } from "./components/AircraftFormModal"
import { QualificationFormModal } from "./components/QualificationFormModal"
import { Button } from "./components/ui/Button"
import { useLogbook } from "./lib/useLogbook"
import { loadTheme, saveTheme, exportData, isLogbookExport } from "./lib/storage"
import { downloadTextFile } from "./lib/csv"
import type { Aircraft, Flight, Qualification } from "./types"

export default function App() {
  const store = useLogbook()
  const [tab, setTab] = useState<Tab>("dashboard")
  const [theme, setTheme] = useState<"light" | "dark">(() => loadTheme())

  const [flightModal, setFlightModal] = useState<null | { editing?: Flight }>(null)
  const [aircraftModal, setAircraftModal] = useState<null | { editing?: Aircraft }>(null)
  const [qualificationModal, setQualificationModal] = useState<null | { editing?: Qualification }>(null)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    saveTheme(theme)
  }, [theme])

  function importJson(file: File) {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result))
        if (!isLogbookExport(parsed)) throw new Error("Invalid file")
        store.replaceAll(parsed.aircraft, parsed.flights, parsed.profile)
      } catch {
        window.alert("Could not read that file — expected a Logbook JSON export.")
      }
    }
    reader.readAsText(file)
  }

  return (
    <div className="min-h-full">
      <Nav
        active={tab}
        onChange={setTab}
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
      />

      <main className="mx-auto max-w-6xl px-4 py-6 pb-20 sm:px-6 sm:pb-6">
        {tab === "dashboard" && (
          <Dashboard
            flights={store.flights}
            aircraftById={store.aircraftById}
            profile={store.profile}
            onAddFlight={() => setFlightModal({})}
            onViewAllFlights={() => setTab("logbook")}
          />
        )}

        {tab === "logbook" && (
          <LogbookView
            flights={store.flights}
            aircraft={store.aircraft}
            aircraftById={store.aircraftById}
            onAdd={() => setFlightModal({})}
            onEdit={(f) => setFlightModal({ editing: f })}
            onDelete={(id) => {
              if (window.confirm("Delete this flight? This cannot be undone.")) {
                store.deleteFlight(id)
              }
            }}
            onImportJson={importJson}
          />
        )}

        {tab === "aircraft" && (
          <AircraftView
            aircraft={store.aircraft}
            flights={store.flights}
            onAdd={() => setAircraftModal({})}
            onEdit={(a) => setAircraftModal({ editing: a })}
            onDelete={(id) => {
              const inUse = store.flights.some((f) => f.aircraftId === id)
              if (inUse) {
                window.alert("Can't delete an aircraft that has logged flights.")
                return
              }
              if (window.confirm("Delete this aircraft?")) store.deleteAircraft(id)
            }}
          />
        )}

        {tab === "profile" && (
          <ProfileView
            profile={store.profile}
            onUpdateProfile={store.updateProfile}
            onAddQualification={() => setQualificationModal({})}
            onEditQualification={(q) => setQualificationModal({ editing: q })}
            onDeleteQualification={(id) => {
              if (window.confirm("Delete this qualification?")) store.deleteQualification(id)
            }}
          />
        )}

        <div className="mt-10 flex justify-center">
          <Button
            variant="ghost"
            onClick={() =>
              downloadTextFile(
                "logbook-backup.json",
                JSON.stringify(exportData(store.aircraft, store.flights, store.profile), null, 2),
                "application/json",
              )
            }
          >
            <Download size={14} /> Export full backup (JSON)
          </Button>
        </div>
      </main>

      {flightModal && (
        <FlightFormModal
          aircraft={store.aircraft}
          initial={flightModal.editing}
          onClose={() => setFlightModal(null)}
          onAddAircraft={() => {
            setFlightModal(null)
            setAircraftModal({})
          }}
          onSave={(draft) => {
            if (flightModal.editing) store.updateFlight(flightModal.editing.id, draft)
            else store.addFlight(draft)
          }}
        />
      )}

      {aircraftModal && (
        <AircraftFormModal
          initial={aircraftModal.editing}
          onClose={() => setAircraftModal(null)}
          onSave={(draft) => {
            if (aircraftModal.editing) store.updateAircraft(aircraftModal.editing.id, draft)
            else store.addAircraft(draft)
          }}
        />
      )}

      {qualificationModal && (
        <QualificationFormModal
          initial={qualificationModal.editing}
          onClose={() => setQualificationModal(null)}
          onSave={(draft) => {
            if (qualificationModal.editing) store.updateQualification(qualificationModal.editing.id, draft)
            else store.addQualification(draft)
          }}
        />
      )}
    </div>
  )
}
