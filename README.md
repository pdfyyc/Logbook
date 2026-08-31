# Logbook

A pilot logbook for Canadian GA flying that goes beyond digitized paper: it tells you, in real time, whether you're legally current — and exactly what to fly to fix it before you aren't.

Runs entirely in the browser: no account, no server. Your flights are stored locally in your browser (`localStorage`), with one-click JSON backup/restore and CSV export.

## Features

- **Local weather, nearest GFA area & airport briefing** — on open, the dashboard asks for your browser location once and uses it for: current conditions for wherever you are, the nearest of NAV CANADA's 7 GFA graphical areas (with one-tap links to their official viewer for Clouds & Weather / Icing-Turb-Freezing level — the charts aren't embedded, since NAV CANADA doesn't publish a public API for them), and a raw METAR/TAF panel for the nearest airport (source: NOAA's Aviation Weather Center, which covers Canadian ICAO stations too) with VFR/MVFR/IFR/LIFR flight-category coloring — the airport can be overridden to any ICAO code, independent of location. None of this is a substitute for your official CARs pre-flight briefing (wxbrief.ca or an FSS briefer) — it's situational awareness only, and the region/nearest-airport matches are approximate GPS lookups, not authoritative. Falls back gracefully (with a retry) if location access is off or a service is unreachable. This is the one part of the app that talks to the network — no account or persistent tracking involved, but it's not fully offline like the rest of the app.
- **Currency & recency engine** — CARs-cited, traffic-light status recalculated on every logged flight: passenger-carrying day/night recency (CAR 401.05(2)(b)(i)) **scoped per aircraft category**, since the rule requires the takeoffs and landings to be in the same category and class — landings are never pooled across the fleet; five-year PIC/co-pilot recency (401.05(1)); 24-month recurrent training (401.05(2)(a)); and instrument recency. Each item shows the exact regulation, a predictive "lapses on [date]" or "fly N more to restore" action, and an expandable, auditable list of the flights counted toward it. Instrument recency correctly models both halves of CAR 401.05(3)/(3.1): the 24-month instrument rating flight test / IPC that gates exercising instrument privileges at all, and the 6-approaches-in-6-months rule that only applies starting the 7th month after that check — including the grace period in between, where you're automatically current on approaches regardless of count. (No holding-procedure or navaid-tracking requirement exists in the CARs, despite the original spec citing one — that was FAA 14 CFR 61.57(c) language, confirmed against the actual regulation text and corrected.)
- **Pilot profile & qualifications** — medical certificate validity **computed from the Standard 421 table** (date of birth, exam date and privilege exercised: 60 months under 40 / 24 at 40+ for PPL and RPP, 60 for ULP and SPP, 12 for CPL-ATPL dropping to 6 at 60+ or for single-pilot passenger ops at 40+), measured from the first day of the month following the exam — with a manual valid-to override, because the certificate and any Minister-endorsed shorter period always control. Plus a general qualifications list for anything with a renewal window, where several kinds derive their own expiry from a single completion date: the instrument rating flight test / IPC (24-month renewal plus the 6-month approach grace period), recurrent training (24 months), **flight instructor ratings** (first day of the 13th / 25th / 37th / 49th month following the flight-test month for Class 4 / 3 / 2 / 1) and the **aviation document booklet** (first day of the 121st month, CAR 401.12). Freeform entries — PPCs, endorsements, company OPS-spec renewals — take a hand-entered expiry. Warning leads are matched to how long each takes to fix: 7/30 days for flight-by-flight recency, 30/90 for medicals and checks, 90/180 for the booklet's ten-year clock.
- **Licence & rating progress (for students)** — track cumulative progress toward a permit, licence or rating's minimum aeronautical experience, computed live from logged flights with a progress bar per requirement. Five aeroplane templates, each read from the Transport Canada Standard 421 text and cross-checked against the raw regulation wording: **Recreational Pilot Permit** (421.22(4)), **Private Pilot Licence** (421.26(4)), **Night Rating** (421.42(1)(a)), **Commercial Pilot Licence** (421.30(4)) and **Instrument Rating** (421.46(2)(b)). The engine models the awkward parts rather than glossing over them: the PPL's 5-hour simulator cap (excess is deducted, not added), and the CPL's "after the PPL" commercial training block, which is scoped by the PPL issue date recorded under Qualifications — until that date is on file those rows report as un-computable instead of quietly counting pre-PPL hours. Requirements that can't be derived from logged data at all — distance-based cross-countries, or anything needing the overlap of two time buckets within one flight, like "5 hours night including 2 hours cross-country" — are surfaced as a per-licence manual checklist rather than estimated. Standards get amended, so confirm against the current published text before a licensing action. Aeroplane only; helicopter, glider and balloon requirements differ and aren't modelled.
- **Dashboard** — total time, PIC, cross-country, night, and instrument hours at a glance.
- **Logbook** — searchable, filterable, sortable flight log with quick add/edit/delete.
- **Aircraft** — manage your fleet with tail number, make/model, category/class, and complex/high-performance/tailwheel/TAA flags.
- **Import/export** — full JSON backup and restore, plus CSV export for spreadsheets.

## Aircraft data providers

The Add Aircraft UI depends on the `AircraftLookupProvider` contract in
`src/lib/aircraftRegistry.ts`. The current provider is local-only and returns a
small aircraft-type suggestion that is always labelled as requiring pilot
confirmation. A future authoritative provider can implement `lookup(query)`
without changing the modal.

Shared school aircraft use the separate `SharedAircraftProvider` contract.
There is deliberately no mock WingRoster connection: a future adapter must
obtain authenticated, organization-scoped aircraft from the real service and
return them through `listSharedAircraft()`. Personal nicknames/defaults remain
on the local pilot-aircraft relationship and must not mutate shared records.

## Portable import and export

The application uses root document schema version 3. Version 1 and 2 documents
are migrated without changing existing aircraft, flights, profile data, drafts,
or migration uncertainties. Version 3 adds only configurable expiry-warning
thresholds, defaulting to 90 and 30 days.

The portable CSV export is a one-row-per-flight review/interchange format. It
includes stable flight and aircraft identifiers, aircraft/source text, all
supported time and operation fields, role and people fields, void status,
amendment count, and import provenance. Nested amendment snapshots and other
application state remain authoritative only in the JSON backup.

The importer verifies the application's current portable CSV header and also
provides an explicit generic CSV/TSV/XLSX column mapper. MyFlightbook and
ForeFlight profiles are deliberately deferred until sanitized exports with a
known product/export version can be tested; the UI does not advertise guessed
compatibility.

## Regulatory intelligence and reports

The Reports workspace uses `src/lib/flightTotals.ts` as the authoritative,
read-only totals layer. It supports all-time, calendar-year, rolling, and custom
ranges; role, aircraft-category, aircraft-type, registration, and monthly
summaries; contributing-flight drill-down; and an original landscape print
layout. Unknown or historical aircraft remain explicitly unresolved rather than
being inferred from registration text.

Licence and rating progress rules live in `src/lib/licenseRequirements.ts`,
separate from React. Each profile carries a concise Transport Canada Standard
reference and review date. Requirements the stored fields cannot prove remain
manual verification items. The initial Canadian Multi-Engine Class Rating is
manual-only because Standard 421.38(3) specifies a flight test but no minimum
flight-hour threshold.

Currency and expiry calculations remain centralized in `src/lib/calc.ts`. An
entered official medical or qualification expiry controls over a calculated
date. These planning tools do not replace current Transport Canada requirements,
official records, or regulatory interpretation.

- **Light/dark mode**, responsive layout with a native-style bottom tab bar on mobile.

Currency calculations are for flight planning only — always verify against the current text of the CARs before exercising any privilege.

## Development

```bash
npm install
npm run dev      # start dev server
npm run build    # type-check and build for production
npm run preview  # preview the production build
npm run lint      # oxlint
```

Built with React, TypeScript, Vite, and Tailwind CSS.
