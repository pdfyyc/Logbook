import { Pencil, ShieldCheck, Trash2, Award, Plus } from "lucide-react"
import type { Flight, MedicalCategory, PilotProfile, Qualification } from "../types"
import { computeMedicalCurrency, computeIfrRenewalCurrency } from "../lib/calc"
import { Card } from "./ui/Card"
import { Field, Input, Select } from "./ui/Field"
import { Badge } from "./ui/Badge"
import { Button } from "./ui/Button"
import { Avatar } from "./ui/Avatar"
import { LicenseProgress } from "./LicenseProgress"

const medicalCategories: MedicalCategory[] = ["None", "Category 1", "Category 3", "Category 4"]

function badgeTone(level: "green" | "yellow" | "red") {
  return level === "green" ? "success" : level === "yellow" ? "warning" : "danger"
}

interface Props {
  profile: PilotProfile
  flights: Flight[]
  onUpdateProfile: (patch: Partial<Omit<PilotProfile, "qualifications">>) => void
  onAddQualification: () => void
  onEditQualification: (qualification: Qualification) => void
  onDeleteQualification: (id: string) => void
  onAddLicenseGoal: (templateId: string) => void
  onRemoveLicenseGoal: (templateId: string) => void
}

export function ProfileView({
  profile,
  flights,
  onUpdateProfile,
  onAddQualification,
  onEditQualification,
  onDeleteQualification,
  onAddLicenseGoal,
  onRemoveLicenseGoal,
}: Props) {
  const medicalItem = computeMedicalCurrency(profile)
  const ifrRenewalItem = computeIfrRenewalCurrency(profile)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--text)]">Pilot profile</h2>
      </div>

      <Card className="flex items-center gap-4 p-4">
        <Avatar name={profile.pilotName || "Pilot"} size={52} />
        <Field label="Display name" className="flex-1">
          <Input
            value={profile.pilotName}
            onChange={(e) => onUpdateProfile({ pilotName: e.target.value })}
            placeholder="Captain Sarah Chen"
          />
        </Field>
      </Card>

      <Card className="p-4">
        <div className="mb-3 flex items-center gap-2">
          <ShieldCheck size={16} className="text-[var(--accent)]" />
          <h3 className="text-sm font-semibold text-[var(--text)]">Medical certificate</h3>
          <Badge tone={badgeTone(medicalItem.level)}>{medicalItem.statusText}</Badge>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Category">
            <Select
              value={profile.medicalCategory}
              onChange={(e) => onUpdateProfile({ medicalCategory: e.target.value as MedicalCategory })}
            >
              {medicalCategories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Expiry date">
            <Input
              type="date"
              value={profile.medicalExpiry}
              onChange={(e) => onUpdateProfile({ medicalExpiry: e.target.value })}
            />
          </Field>
        </div>
        <p className="mt-2 text-xs text-[var(--text-muted)]">{medicalItem.detail}</p>
      </Card>

      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award size={16} className="text-[var(--accent)]" />
            <h3 className="text-sm font-semibold text-[var(--text)]">Qualifications</h3>
          </div>
          <Button onClick={onAddQualification}>
            <Plus size={15} /> Add qualification
          </Button>
        </div>
        <p className="mb-3 text-xs text-[var(--text-muted)]">
          Everything with a renewal window goes here — PPCs, instructor ratings, endorsements, company OPS-spec
          recurrent training, and your instrument rating flight test / IPC (CAR 401.05(3)).
        </p>

        <div className="mb-2 flex items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-inset)] px-3 py-2">
          <span className="text-sm font-medium text-[var(--text)]">{ifrRenewalItem.label}</span>
          <Badge tone={badgeTone(ifrRenewalItem.level)}>{ifrRenewalItem.statusText}</Badge>
        </div>

        {profile.qualifications.length === 0 ? (
          <p className="py-8 text-center text-sm text-[var(--text-muted)]">
            No qualifications added yet — start with your last instrument check or a rating that's due for renewal.
          </p>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {profile.qualifications.map((q) => (
              <div key={q.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <div className="font-medium text-[var(--text)]">{q.name}</div>
                  <div className="truncate text-xs text-[var(--text-muted)]">
                    {q.kind === "instrument-check"
                      ? q.completedOn
                        ? `Completed ${q.completedOn} · renews ${q.expiry}`
                        : "Completion date not set"
                      : q.expiry
                        ? `Expires ${q.expiry}`
                        : "No expiry tracked"}
                    {q.citation ? ` · ${q.citation}` : ""}
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    onClick={() => onEditQualification(q)}
                    className="rounded-md p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-inset)] hover:text-[var(--text)] cursor-pointer"
                    aria-label="Edit qualification"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => onDeleteQualification(q.id)}
                    className="rounded-md p-1.5 text-[var(--text-muted)] hover:bg-red-500/10 hover:text-red-500 cursor-pointer"
                    aria-label="Delete qualification"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <LicenseProgress
        flights={flights}
        trackedGoals={profile.trackedLicenseGoals}
        onAddGoal={onAddLicenseGoal}
        onRemoveGoal={onRemoveLicenseGoal}
      />
    </div>
  )
}
