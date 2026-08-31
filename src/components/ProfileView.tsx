import { Pencil, ShieldCheck, Trash2, Award, Plus } from "lucide-react";
import type {
  Aircraft,
  Flight,
  MedicalCategory,
  MedicalPrivilege,
  PilotProfile,
  Qualification,
} from "../types";
import { MEDICAL_PRIVILEGE_LABELS } from "../types";
import {
  computeMedicalCurrency,
  computeIfrRenewalCurrency,
  computeMedicalValidity,
} from "../lib/calc";
import { Card } from "./ui/Card";
import { Field, Input, Select } from "./ui/Field";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";
import { Avatar } from "./ui/Avatar";
import { LicenseProgress } from "./LicenseProgress";

const medicalCategories: MedicalCategory[] = [
  "None",
  "Category 1",
  "Category 3",
  "Category 4",
];

function badgeTone(level: "green" | "yellow" | "red") {
  return level === "green"
    ? "success"
    : level === "yellow"
      ? "warning"
      : "danger";
}

/** One-line status under a qualification's name, worded for its kind. */
function qualificationSummary(q: Qualification): string {
  switch (q.kind) {
    case "ppl-issued":
      return q.completedOn
        ? `Issued ${q.completedOn} · doesn't expire`
        : "Issue date not set";
    case "instrument-check":
      return q.completedOn
        ? `Completed ${q.completedOn} · renews ${q.expiry}`
        : "Completion date not set";
    case "recurrent-training":
      return q.completedOn
        ? `Completed ${q.completedOn} · next due ${q.expiry}`
        : "Completion date not set";
    case "instructor-rating":
      return q.completedOn
        ? `Class ${q.instructorClass ?? "4"} · flight test ${q.completedOn} · valid to ${q.expiry}`
        : "Flight test date not set";
    case "document-booklet":
      return q.completedOn
        ? `Issued ${q.completedOn} · expires ${q.expiry}`
        : "Issue date not set";
    case "other":
      return q.expiry ? `Expires ${q.expiry}` : "No expiry tracked";
  }
}

interface Props {
  profile: PilotProfile;
  flights: Flight[];
  aircraftById: Map<string, Aircraft>;
  onUpdateProfile: (
    patch: Partial<Omit<PilotProfile, "qualifications">>,
  ) => void;
  onAddQualification: () => void;
  onEditQualification: (qualification: Qualification) => void;
  onDeleteQualification: (id: string) => void;
  onAddLicenseGoal: (templateId: string) => void;
  onRemoveLicenseGoal: (templateId: string) => void;
}

export function ProfileView({
  profile,
  flights,
  aircraftById,
  onUpdateProfile,
  onAddQualification,
  onEditQualification,
  onDeleteQualification,
  onAddLicenseGoal,
  onRemoveLicenseGoal,
}: Props) {
  const medicalItem = computeMedicalCurrency(profile);
  const ifrRenewalItem = computeIfrRenewalCurrency(profile);
  const computedMedical = computeMedicalValidity(profile);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--text)]">
          Pilot profile
        </h2>
      </div>

      <Card className="flex items-center gap-4 p-4">
        <Avatar name={profile.pilotName || "Pilot"} size={52} />
        <Field label="Display name" className="flex-1">
          <Input
            value={profile.pilotName}
            onChange={(e) => onUpdateProfile({ pilotName: e.target.value })}
            placeholder="Pilot name"
          />
        </Field>
      </Card>

      <Card className="p-4">
        <h3 className="mb-3 text-sm font-semibold">Flight-entry defaults</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Home airport">
            <Input
              value={profile.homeAirport ?? ""}
              onChange={(e) =>
                onUpdateProfile({ homeAirport: e.target.value.toUpperCase() })
              }
              placeholder="CEN4"
            />
          </Field>
          <Field label="Default role">
            <Select
              value={profile.defaultRole ?? ""}
              onChange={(e) =>
                onUpdateProfile({
                  defaultRole: e.target.value as PilotProfile["defaultRole"],
                })
              }
            >
              <option value="">Ask each flight</option>
              <option value="pic">PIC</option>
              <option value="copilot">Co-pilot</option>
              <option value="student">Student</option>
              <option value="instructor">Instructor</option>
              <option value="solo-student">Solo student</option>
              <option value="observer">Other / observer</option>
            </Select>
          </Field>
          <Field label="Frequently used instructor">
            <Input
              value={profile.frequentInstructor ?? ""}
              onChange={(e) =>
                onUpdateProfile({ frequentInstructor: e.target.value })
              }
              placeholder="Instructor name"
            />
          </Field>
          <Field label="Frequently used students">
            <Input
              value={(profile.frequentStudents ?? []).join(", ")}
              onChange={(e) =>
                onUpdateProfile({
                  frequentStudents: e.target.value
                    .split(",")
                    .map((name) => name.trim())
                    .filter(Boolean),
                })
              }
              placeholder="Student names"
            />
          </Field>
        </div>
      </Card>

      <Card className="p-4">
        <div className="mb-3 flex items-center gap-2">
          <ShieldCheck size={16} className="text-[var(--accent)]" />
          <h3 className="text-sm font-semibold text-[var(--text)]">
            Medical certificate
          </h3>
          <Badge tone={badgeTone(medicalItem.level)}>
            {medicalItem.statusText}
          </Badge>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Category">
            <Select
              value={profile.medicalCategory}
              onChange={(e) =>
                onUpdateProfile({
                  medicalCategory: e.target.value as MedicalCategory,
                })
              }
            >
              {medicalCategories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Privilege being exercised">
            <Select
              value={profile.medicalPrivilege}
              onChange={(e) =>
                onUpdateProfile({
                  medicalPrivilege: e.target.value as MedicalPrivilege,
                })
              }
            >
              {(
                Object.keys(MEDICAL_PRIVILEGE_LABELS) as MedicalPrivilege[]
              ).map((p) => (
                <option key={p} value={p}>
                  {MEDICAL_PRIVILEGE_LABELS[p]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Date of birth">
            <Input
              type="date"
              value={profile.dateOfBirth}
              onChange={(e) => onUpdateProfile({ dateOfBirth: e.target.value })}
            />
          </Field>
          <Field label="Medical exam date">
            <Input
              type="date"
              value={profile.medicalExamDate}
              onChange={(e) =>
                onUpdateProfile({ medicalExamDate: e.target.value })
              }
            />
          </Field>
          <Field
            label="Valid-to date (overrides the calculation)"
            className="sm:col-span-2"
          >
            <Input
              type="date"
              value={profile.medicalExpiry}
              onChange={(e) =>
                onUpdateProfile({ medicalExpiry: e.target.value })
              }
              placeholder={computedMedical?.expiry ?? ""}
            />
          </Field>
          <Field label="Expiry warning (days)">
            <Input
              type="number"
              min={1}
              max={365}
              value={profile.expiryWarningDays?.warning ?? 90}
              onChange={(e) =>
                onUpdateProfile({
                  expiryWarningDays: {
                    warning: Math.max(1, Number(e.target.value) || 90),
                    critical: profile.expiryWarningDays?.critical ?? 30,
                  },
                })
              }
            />
          </Field>
          <Field label="Urgent warning (days)">
            <Input
              type="number"
              min={0}
              max={365}
              value={profile.expiryWarningDays?.critical ?? 30}
              onChange={(e) =>
                onUpdateProfile({
                  expiryWarningDays: {
                    warning: profile.expiryWarningDays?.warning ?? 90,
                    critical: Math.max(0, Number(e.target.value) || 0),
                  },
                })
              }
            />
          </Field>
        </div>
        <p className="mt-2 text-xs text-[var(--text-muted)]">
          {medicalItem.detail}
        </p>
        {computedMedical && !profile.medicalExpiry && (
          <p className="mt-1 text-[10px] text-[var(--text-muted)]">
            Calculated from the Standard 421 validity table. Always enter the
            valid-to date printed on the certificate if it differs — a
            Minister-endorsed shorter period or any limitation controls.
          </p>
        )}
        {computedMedical &&
          profile.medicalExpiry &&
          profile.medicalExpiry !== computedMedical.expiry && (
            <p className="mt-1 text-[10px] text-amber-500">
              Using your entered date. The table would give{" "}
              {computedMedical.expiry}.
            </p>
          )}
        {computedMedical &&
          computedMedical.ageAtExam >= 40 &&
          computedMedical.ageAtExam < 60 &&
          profile.medicalPrivilege === "cpl-atpl" && (
            <div className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-[var(--text)]">
              <p>
                <strong>Age 40–59:</strong> the displayed 12-month period
                applies to CPL/ATPL hire-or-reward privileges when you are not
                conducting a single-pilot operation with passengers. That
                operating case is limited to 6 months under CAR 404.04(6.2).
              </p>
              <Button
                className="mt-2"
                variant="secondary"
                onClick={() =>
                  onUpdateProfile({
                    medicalPrivilege: "cpl-atpl-single-pilot-pax",
                  })
                }
              >
                Use single-pilot passenger operations (6 months)
              </Button>
            </div>
          )}
        {computedMedical &&
          profile.medicalPrivilege === "cpl-atpl-single-pilot-pax" &&
          computedMedical.ageAtExam >= 40 && (
            <p className="mt-2 text-xs text-[var(--text-muted)]">
              Six-month validity applies because single-pilot passenger
              operations are selected. CAR 404.04(6.2).
            </p>
          )}
      </Card>

      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award size={16} className="text-[var(--accent)]" />
            <h3 className="text-sm font-semibold text-[var(--text)]">
              Qualifications
            </h3>
          </div>
          <Button onClick={onAddQualification}>
            <Plus size={15} /> Add qualification
          </Button>
        </div>
        <p className="mb-3 text-xs text-[var(--text-muted)]">
          Everything with a renewal window goes here — PPCs, instructor ratings,
          endorsements, company OPS-spec recurrent training, and your instrument
          rating flight test / IPC (CAR 401.05(3)).
        </p>

        <div className="mb-2 flex items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-inset)] px-3 py-2">
          <span className="text-sm font-medium text-[var(--text)]">
            {ifrRenewalItem.label}
          </span>
          <Badge tone={badgeTone(ifrRenewalItem.level)}>
            {ifrRenewalItem.statusText}
          </Badge>
        </div>

        {profile.qualifications.length === 0 ? (
          <p className="py-8 text-center text-sm text-[var(--text-muted)]">
            No qualifications added yet — start with your last instrument check
            or a rating that's due for renewal.
          </p>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {profile.qualifications.map((q) => (
              <div
                key={q.id}
                className="flex items-center justify-between gap-3 py-2.5 text-sm"
              >
                <div className="min-w-0">
                  <div className="font-medium text-[var(--text)]">{q.name}</div>
                  <div className="truncate text-xs text-[var(--text-muted)]">
                    {qualificationSummary(q)}
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
        profile={profile}
        aircraftById={aircraftById}
        trackedGoals={profile.trackedLicenseGoals}
        onAddGoal={onAddLicenseGoal}
        onRemoveGoal={onRemoveLicenseGoal}
      />
    </div>
  );
}
