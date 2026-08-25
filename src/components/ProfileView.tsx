import { Pencil, ShieldCheck, Trash2, UserCircle2, Plus } from "lucide-react"
import type { MedicalCategory, PilotProfile, Rating } from "../types"
import { computeMedicalCurrency } from "../lib/calc"
import { Card } from "./ui/Card"
import { Field, Input, Select } from "./ui/Field"
import { Badge } from "./ui/Badge"
import { Button } from "./ui/Button"

const medicalCategories: MedicalCategory[] = ["None", "Category 1", "Category 3", "Category 4"]

interface Props {
  profile: PilotProfile
  onUpdateProfile: (patch: Partial<Omit<PilotProfile, "ratings">>) => void
  onAddRating: () => void
  onEditRating: (rating: Rating) => void
  onDeleteRating: (id: string) => void
}

export function ProfileView({ profile, onUpdateProfile, onAddRating, onEditRating, onDeleteRating }: Props) {
  const medicalItem = computeMedicalCurrency(profile)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--text)]">Pilot profile</h2>
      </div>

      <Card className="p-4">
        <div className="mb-3 flex items-center gap-2">
          <ShieldCheck size={16} className="text-[var(--accent)]" />
          <h3 className="text-sm font-semibold text-[var(--text)]">Medical certificate</h3>
          {medicalItem && (
            <Badge tone={medicalItem.level === "green" ? "success" : medicalItem.level === "yellow" ? "warning" : "danger"}>
              {medicalItem.statusText}
            </Badge>
          )}
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
        {medicalItem && <p className="mt-2 text-xs text-[var(--text-muted)]">{medicalItem.detail}</p>}
      </Card>

      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserCircle2 size={16} className="text-[var(--accent)]" />
            <h3 className="text-sm font-semibold text-[var(--text)]">Ratings & endorsements</h3>
          </div>
          <Button onClick={onAddRating}>
            <Plus size={15} /> Add rating
          </Button>
        </div>

        {profile.ratings.length === 0 ? (
          <p className="py-8 text-center text-sm text-[var(--text-muted)]">
            Track PPCs, instructor ratings, and endorsements with renewal windows here.
          </p>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {profile.ratings.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <div className="font-medium text-[var(--text)]">{r.name}</div>
                  <div className="truncate text-xs text-[var(--text-muted)]">
                    {r.expiry ? `Expires ${r.expiry}` : "No expiry tracked"}
                    {r.citation ? ` · ${r.citation}` : ""}
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    onClick={() => onEditRating(r)}
                    className="rounded-md p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-inset)] hover:text-[var(--text)] cursor-pointer"
                    aria-label="Edit rating"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => onDeleteRating(r.id)}
                    className="rounded-md p-1.5 text-[var(--text-muted)] hover:bg-red-500/10 hover:text-red-500 cursor-pointer"
                    aria-label="Delete rating"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
