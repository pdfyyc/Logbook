# Logbook

A pilot logbook for Canadian GA flying that goes beyond digitized paper: it tells you, in real time, whether you're legally current — and exactly what to fly to fix it before you aren't.

Runs entirely in the browser: no account, no server. Your flights are stored locally in your browser (`localStorage`), with one-click JSON backup/restore and CSV export.

## Features

- **Local weather & nearest GFA area** — on open, the dashboard asks for your browser location once and uses it for two things: current conditions for wherever you are (no airport code needed), and the nearest of NAV CANADA's 7 GFA graphical areas, with one-tap links to their official GFA viewer for Clouds & Weather / Icing-Turb-Freezing level. The GFA charts themselves aren't embedded — NAV CANADA doesn't publish a public API for that, so this app links out to the real charts on their site rather than scraping or guessing at one; the region match is an approximate GPS lookup, not an authoritative boundary. Falls back gracefully (with a retry) if location access is off or a service is unreachable. This is the one part of the app that talks to the network: your coordinates go to [Open-Meteo](https://open-meteo.com) (conditions) and [BigDataCloud](https://www.bigdatacloud.com) (place name) to answer that one request — no account or tracking involved, but it's not fully offline like the rest of the app.
- **Currency & recency engine** — CARs-cited, traffic-light status for passenger-carrying day/night recency (CAR 401.05(2)) and IFR recency (CAR 401.05(3)), recalculated on every logged flight from a rolling 6-month window. Each item shows the exact regulation, a predictive "lapses on [date]" or "fly N more to restore" action, and an expandable, auditable list of the flights counted toward it.
- **Pilot profile** — medical certificate expiry and category, plus ratings/endorsements (PPCs, instructor ratings, company OPS-spec renewals) with their own expiry tracking and the same traffic-light treatment.
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
