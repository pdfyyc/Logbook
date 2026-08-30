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
import { VoidFlightModal } from "./components/VoidFlightModal"
import { ExperienceSummaryModal } from "./components/ExperienceSummaryModal"
import { FlightImportModal } from "./components/FlightImportModal"
import { RestoreBackupModal } from "./components/RestoreBackupModal"
import { previewFlightImport, type FlightImportPreview } from "./lib/flightImport"
import { Button } from "./components/ui/Button"
import { useLogbook } from "./lib/useLogbook"
import { loadTheme, saveTheme, exportData, restoreLogbookDocument } from "./lib/storage"
import { migrateBackup, type LogbookDocument } from "./lib/dataModel"
import { downloadTextFile } from "./lib/csv"
import type { Aircraft, Flight, FlightDraft, Qualification } from "./types"

export default function App() {
  const store = useLogbook()
  const [tab, setTab] = useState<Tab>("dashboard")
  const [theme, setTheme] = useState<"light" | "dark">(() => loadTheme())

  const [flightModal, setFlightModal] = useState<null | { editing?: Flight; draft?: FlightDraft; reviewSuggestion?: string }>(null)
  const [aircraftModal, setAircraftModal] = useState<null | { editing?: Aircraft; resumeFlightDraft?: FlightDraft }>(null)
  const [qualificationModal, setQualificationModal] = useState<null | { editing?: Qualification }>(null)
  const [voidFlight, setVoidFlight] = useState<Flight | null>(null)
  const [experienceSummaryOpen, setExperienceSummaryOpen] = useState(false)
  const [flightImportPreview, setFlightImportPreview] = useState<FlightImportPreview | null>(null)
  const [restorePreview, setRestorePreview] = useState<{ document: LogbookDocument; source: unknown } | null>(null)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    saveTheme(theme)
  }, [theme])

  function importJson(file: File) {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed: unknown = JSON.parse(String(reader.result))
        setRestorePreview({ document: migrateBackup(parsed), source: parsed })
      } catch (error) {
        window.alert(error instanceof Error ? error.message : "Could not read that backup.")
      }
    }
    reader.readAsText(file)
  }

  async function importFlightFile(file: File) {
    try { setFlightImportPreview(await previewFlightImport(file)) }
    catch (error) { window.alert(error instanceof Error ? error.message : "Could not read that file.") }
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
        {(store.storageWarning || store.multiTabConflict) && <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm"><span><strong>Local data safety warning:</strong> {store.storageWarning || "This logbook changed in another tab. Saving is paused to prevent overwriting newer data."}</span><Button variant="secondary" onClick={() => window.location.reload()}>Reload validated data</Button></div>}
        {tab === "dashboard" && (
          <Dashboard
            flights={store.flights}
            aircraftById={store.aircraftById}
            profile={store.profile}
            onAddFlight={() => setFlightModal({})}
            onViewAllFlights={() => setTab("logbook")}
            onEditFlight={(flight, reviewSuggestion) => setFlightModal({ editing: flight, reviewSuggestion })}
          />
        )}

        {tab === "logbook" && (
          <LogbookView
            flights={store.flights}
            aircraft={store.aircraft}
            aircraftById={store.aircraftById}
            onAdd={() => setFlightModal({})}
            onEdit={(f) => setFlightModal({ editing: f })}
            onVoid={(flight) => setVoidFlight(flight)}
            onExperienceSummary={() => setExperienceSummaryOpen(true)}
            onImportFile={importFlightFile}
            onImportJson={importJson}
          />
        )}

        {tab === "aircraft" && (
          <AircraftView
            aircraft={store.aircraft}
            flights={store.flights}
            onAdd={() => setAircraftModal({})}
            onEdit={(a) => setAircraftModal({ editing: a })}
            onDelete={(id) => { if (window.confirm("Archive this aircraft? Historical flights will remain connected.")) store.deleteAircraft(id) }}
          />
        )}

        {tab === "profile" && (
          <ProfileView
            profile={store.profile}
            flights={store.flights}
            aircraftById={store.aircraftById}
            onUpdateProfile={store.updateProfile}
            onAddQualification={() => setQualificationModal({})}
            onEditQualification={(q) => setQualificationModal({ editing: q })}
            onDeleteQualification={(id) => {
              if (window.confirm("Delete this qualification?")) store.deleteQualification(id)
            }}
            onAddLicenseGoal={store.addLicenseGoal}
            onRemoveLicenseGoal={store.removeLicenseGoal}
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
          flights={store.flights}
          profile={store.profile}
          initial={flightModal.editing}
          initialDraft={flightModal.draft}
          reviewSuggestion={flightModal.reviewSuggestion}
          recentAircraftIds={[...new Set(store.flights.filter((f) => !f.voidedAt).sort((a, b) => b.date.localeCompare(a.date)).map((f) => f.aircraftId))].slice(0, 5)}
          onClose={() => setFlightModal(null)}
          onAddAircraft={(draft) => {
            setFlightModal(null)
            setAircraftModal({ resumeFlightDraft: draft })
          }}
          onSave={(draft, amendmentReason) => {
            if (flightModal.editing) store.updateFlight(flightModal.editing.id, draft, amendmentReason ?? "")
            else store.addFlight(draft)
          }}
        />
      )}

      {aircraftModal && (
        <AircraftFormModal
          initial={aircraftModal.editing}
          existingAircraft={store.aircraft}
          onClose={() => { const resume = aircraftModal.resumeFlightDraft; setAircraftModal(null); if (resume) setFlightModal({ draft: resume }) }}
          onCreated={(aircraft) => { if (aircraftModal.resumeFlightDraft) setFlightModal({ draft: { ...aircraftModal.resumeFlightDraft, aircraftId: aircraft.id } }) }}
          onSave={(draft) => {
            if (aircraftModal.editing) { store.updateAircraft(aircraftModal.editing.id, draft); return }
            return store.addAircraft(draft)
          }}
        />
      )}

      {voidFlight && (
        <VoidFlightModal
          flight={voidFlight}
          onClose={() => setVoidFlight(null)}
          onSave={(reason) => {
            store.voidFlight(voidFlight.id, reason)
            setVoidFlight(null)
          }}
        />
      )}

      {experienceSummaryOpen && (
        <ExperienceSummaryModal
          flights={store.flights}
          aircraftById={store.aircraftById}
          profile={store.profile}
          onClose={() => setExperienceSummaryOpen(false)}
        />
      )}

      {flightImportPreview && <FlightImportModal preview={flightImportPreview} aircraft={store.aircraft} onClose={() => setFlightImportPreview(null)} onImport={(resolutions) => { store.importFlights(flightImportPreview.flights, resolutions); setFlightImportPreview(null) }} />}
      {restorePreview && <RestoreBackupModal document={restorePreview.document} currentBackup={JSON.stringify(exportData(store.aircraft, store.flights, store.profile), null, 2)} onCancel={() => setRestorePreview(null)} onRestore={() => { try { const restored = restoreLogbookDocument(restorePreview.source); store.applyDocument(restored.document); setRestorePreview(null) } catch (error) { window.alert(error instanceof Error ? error.message : "Restore failed and was rolled back.") } }} />}

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
