# Logbook

A modern, intuitive pilot flight logbook — inspired by [MyFlightbook](https://myflightbook.com), rebuilt as a fast, single-page web app.

Runs entirely in the browser: no account, no server, no tracking. Your flights are stored locally in your browser (`localStorage`), with one-click JSON backup/restore and CSV export.

## Features

- **Dashboard** — total time, PIC, cross-country, night, and instrument hours at a glance, plus FAA-style currency tracking (90-day passenger day/night currency, 6-month instrument currency).
- **Logbook** — searchable, filterable, sortable flight log with quick add/edit/delete.
- **Aircraft** — manage your fleet with tail number, make/model, category/class, and complex/high-performance/tailwheel/TAA flags.
- **Import/export** — full JSON backup and restore, plus CSV export for spreadsheets.
- **Light/dark mode**, responsive layout with a native-style bottom tab bar on mobile.

## Development

```bash
npm install
npm run dev      # start dev server
npm run build    # type-check and build for production
npm run preview  # preview the production build
npm run lint      # oxlint
```

Built with React, TypeScript, Vite, and Tailwind CSS.
