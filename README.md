# Logbook

A pilot logbook for Canadian GA flying that goes beyond digitized paper: it tells you, in real time, whether you're legally current — and exactly what to fly to fix it before you aren't.

Runs entirely in the browser: no account, no server. Your flights are stored locally in your browser (`localStorage`), with one-click JSON backup/restore and CSV export.

## Features

- **Local weather, nearest GFA area & airport briefing** — on open, the dashboard asks for your browser location once and uses it for: current conditions for wherever you are, the nearest of NAV CANADA's 7 GFA graphical areas (with one-tap links to their official viewer for Clouds & Weather / Icing-Turb-Freezing level — the charts aren't embedded, since NAV CANADA doesn't publish a public API for them), and a raw METAR/TAF panel for the nearest airport (source: NOAA's Aviation Weather Center, which covers Canadian ICAO stations too) with VFR/MVFR/IFR/LIFR flight-category coloring — the airport can be overridden to any ICAO code, independent of location. None of this is a substitute for your official CARs pre-flight briefing (wxbrief.ca or an FSS briefer) — it's situational awareness only, and the region/nearest-airport matches are approximate GPS lookups, not authoritative. Falls back gracefully (with a retry) if location access is off or a service is unreachable. This is the one part of the app that talks to the network — no account or persistent tracking involved, but it's not fully offline like the rest of the app.
- **Currency & recency engine** — CARs-cited, traffic-light status for passenger-carrying day/night recency (CAR 401.05(2)(b)(i)) and instrument recency, recalculated on every logged flight from a rolling 6-month window. Each item shows the exact regulation, a predictive "lapses on [date]" or "fly N more to restore" action, and an expandable, auditable list of the flights counted toward it. Instrument recency correctly models both halves of CAR 401.05(3)/(3.1): the 24-month instrument rating flight test / IPC that gates exercising instrument privileges at all, and the 6-approaches-in-6-months rule that only applies starting the 7th month after that check — including the grace period in between, where you're automatically current on approaches regardless of count. (No holding-procedure or navaid-tracking requirement exists in the CARs, despite the original spec citing one — that was FAA 14 CFR 61.57(c) language, confirmed against the actual regulation text and corrected.)
- **Pilot profile & qualifications** — medical certificate expiry and category, plus a general qualifications list for anything with a renewal window: PPCs, instructor ratings, endorsements, company OPS-spec recurrent training, and your instrument rating flight test / IPC (enter the completion date and the 24-month renewal and 6-month grace period are computed automatically) — all with the same traffic-light treatment as the rest of the currency engine.
- **Dashboard** — total time, PIC, cross-country, night, and instrument hours at a glance.
- **Logbook** — searchable, filterable, sortable flight log with quick add/edit/delete.
- **Aircraft** — manage your fleet with tail number, make/model, category/class, and complex/high-performance/tailwheel/TAA flags.
- **Import/export** — full JSON backup and restore, plus CSV export for spreadsheets.
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
