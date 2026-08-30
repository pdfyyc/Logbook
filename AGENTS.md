# Working on this repo

A Canadian GA pilot logbook. Runs entirely in the browser — React + TypeScript
+ Vite + Tailwind, no backend, state in `localStorage`.

```bash
npm install
npm run dev      # dev server
npm run build    # tsc -b && vite build — must pass
npm run lint     # oxlint — must pass clean
```

There are no automated tests. Changes to the currency or licence-progress
engines have been verified by driving the real app in a browser (Playwright)
and asserting the numbers on screen. Do the same rather than trusting that the
arithmetic looks right.

## The one rule that matters

**This app makes legal-compliance claims to pilots.** A wrong number here can
tell someone they may carry passengers when they may not. Two consequences:

1. **Never write a regulatory figure from memory.** Every hour requirement,
   validity period and citation in this codebase was read from the actual
   Transport Canada text and cross-checked against the raw regulation wording.
   If you cannot verify a number against a real source, do not add it — say so
   instead.
2. **When in doubt, understate currency.** An estimate that might overstate
   progress is worse than no estimate. Prefer reporting a requirement as
   un-computable over guessing at it.

This is not hypothetical. The original spec for this app claimed IFR recency
required "6 approaches, holding, and interception/tracking of navaids." That is
FAA 14 CFR 61.57(c) language. The actual rule, CAR 401.05(3.1), is **6
approaches, no holds**. It shipped wrong and was only caught when the user
supplied the real text.

## Deliberate decisions that look like bugs

Do not "fix" these without understanding why they are this way.

- **No holding requirement in IFR recency.** See above. It is not an omission.
- **Passenger recency is computed per aircraft category, never pooled.**
  CAR 401.05(2)(b) requires the takeoffs and landings to be in the same
  category and class. Pooling them across the fleet made single-engine landings
  count toward multi-engine currency. `computePassengerRecencyItems` emits one
  row per category flown; keep it that way.
- **Some requirements are deliberately not computed.** Anything needing the
  overlap of two time buckets within a single flight — "5 hours night
  including 2 hours cross-country" — cannot be derived, because the log stores
  night and cross-country as separate per-flight totals. Any estimate would be
  an upper bound, i.e. it would overstate progress. These live in each
  template's `manualRequirements` checklist. Do not replace them with a
  calculation.
- **Solo/dual splits are approximations, and marked as such.** Cross-country
  and instrument time are attributed by looking at flights that are *wholly*
  solo or *wholly* dual. Items using this carry `approximate: true` and render
  with a `*` and a footnote.
- **A manually entered medical valid-to date overrides the computed one.** The
  certificate, and any shorter period the Minister endorses on it, always
  control over the validity table.
- **CPL "after the PPL" rows report as un-computable without a PPL issue
  date**, rather than counting all logged hours. Counting pre-PPL time toward
  the 65-hour commercial block would overstate progress.

## Where things live

| Path | What |
| --- | --- |
| `src/lib/calc.ts` | Currency & recency engine. All CARs rules. |
| `src/lib/licenseRequirements.ts` | Standard 421 licence/rating templates. |
| `src/lib/derivedQualificationExpiry` (in `calc.ts`) | Single source of truth for expiry implied by a qualification's kind + date. The form must not compute its own. |
| `src/lib/weather.ts`, `metar.ts`, `gfaRegions.ts`, `airports.ts` | The only network-touching code. |
| `src/types.ts` | Data model. `QualificationKind` drives engine behaviour. |

## Network features

The weather/GFA/METAR widgets are the only part that leaves the browser
(Open-Meteo, BigDataCloud, NOAA Aviation Weather Center). Everything else is
offline.

- `metar.ts` parses defensively across several plausible field names because
  the NOAA response schema could not be verified from the development
  environment. **It has never been tested against the live service.** If you
  can reach `aviationweather.gov`, verify the real response shape and tighten
  it.
- NAV CANADA publishes no public API for GFA charts, so the app links out to
  their official viewer rather than embedding or scraping. Do not hardcode a
  guessed chart URL.
- Nothing here substitutes for an official CARs pre-flight briefing
  (wxbrief.ca or an FSS briefer), and the UI says so.

## Scope

Aeroplane only. Helicopter, glider and balloon requirements differ and are not
modelled. Written examination validity is intentionally not tracked — it only
constrains the application window and stops mattering once a licence is issued.
