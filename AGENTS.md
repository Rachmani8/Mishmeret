# Agent Instructions — Mishmeret

## Next.js Version Warning

This project uses **Next.js 16**, which has breaking changes from earlier versions. APIs, conventions, and file structure may differ from your training data. Before writing any Next.js-specific code, read the relevant guide in `node_modules/next/dist/docs/`. Heed deprecation notices.

---

## Project Overview

Mishmeret is a Hebrew-first PWA for Israeli employees to track shifts and calculate wages. The entire UI is in Hebrew (RTL). There is no backend — all data lives in the browser via **Dexie (IndexedDB)**.

---

## Architecture

### Pages (`app/(app)/`)

| Route | Purpose |
|---|---|
| `/calendar` | Monthly/weekly shift calendar, clock in/out bar, ShiftDrawer |
| `/summary` | Monthly shift list with per-day earnings |
| `/payslip` | Estimated payslip with tax breakdown and validator |
| `/settings` | Job configuration + Shabbat city sync via HebCal |
| `/export` | Excel export (full earnings or hours-only) |

All pages are `"use client"` components. The root (`app/page.tsx`) immediately redirects to `/calendar`.

### Components

- `BottomNav.tsx` — fixed bottom tab bar, 4 tabs
- `ShiftDrawer.tsx` — slide-up drawer used from the calendar to create/edit shifts

### Library (`lib/`)

- `db.ts` — Dexie schema v2. Tables: `jobs`, `shifts`, `shabbatCache`, `appSettings`. Exports `defaultJob()` and `defaultShift()` factory functions.
- `calculations.ts` — All wage and tax logic. Key exports: `calcDayEarnings`, `calcMonthlyPayslip`, `calcIncomeTax`, `calcNationalInsurance`, `calcHealthInsurance`. Also exports Hebrew label/color maps.
- `hebcal.ts` — Fetches and caches Shabbat candle-lighting times from HebCal. Exports `fetchAndCache`, `getAppSettings`, `saveAppSettings`, `ISRAELI_CITIES`.
- `useShabbatTimes.ts` — React hook that reads the Shabbat cache for a given year and returns a `Record<string, number>` (date → minutes from midnight).

---

## Domain Knowledge

### Israeli Labor Law (as implemented)

- **Daily norm**: default 8.6 hours (43h/week ÷ 5 days)
- **Overtime tier 1**: hours 1–2 above norm → `overtime1Multiplier` (default 1.25×)
- **Overtime tier 2**: hour 3+ above norm → `overtime2Multiplier` (default 1.5×)
- **Weekend/Shabbat**: Saturday shifts use `weekendMultiplier` (default 1.5×) on all hours, including overtime tiers stacked on top
- **Friday splits**: if a Friday shift crosses candle-lighting time, hours before are regular and hours after use Shabbat rates — this split is computed in `calcDayEarnings`
- **Commute** (`נסיעות`): flat daily amount, only on work days
- **Tips**: tracked per shift but excluded from gross salary and all tax calculations

### Israeli Tax Calculations (as implemented)

- **National Insurance** (`ביטוח לאומי`): 3.5% up to ₪7,522/month, 12% above
- **Health Insurance** (`ביטוח בריאות`): 3.1% up to ₪7,522/month, 5% above
- **Income Tax**: 6 annual brackets (10%–47%), credit points reduce final tax (default 2.25 points × ₪242 each)
- **Pension** (`פנסיה`): employee deduction (default 6%) and employer contribution (default 6.5%), toggleable per job
- Deductions are calculated on earnings gross (base + overtime + weekend bonus), **not** including commute

---

## Data Model

### `Job`
Holds all wage parameters: `baseHourlyRate`, overtime multipliers, `dailyNormHours`, `weekendMultiplier`, `holidayMultiplier`, commute settings, tax credit points, pension settings.

### `Shift`
One record per calendar day: `date` (ISO `YYYY-MM-DD`), `jobId`, `isWorkDay`, `shiftType` (`morning|afternoon|evening|general`), `clockIn`/`clockOut` (HH:MM), `tips`, `notes`.

---

## Key Conventions

- All pages query Dexie directly — no global state manager
- Clock in/out state for today is persisted in `localStorage` keyed by date (`clockState_YYYY-MM-DD`, `clockIn_YYYY-MM-DD`, `clockOut_YYYY-MM-DD`) and resets on a new day
- Mobile-first layout, max width 430px, bottom nav is 64px tall — sticky bars use `bottom-16` to sit above it
- `shabbatTimes` is an optional parameter throughout calculations; if absent, candle lighting defaults to 19:00
- The project supports multiple jobs; all pages show a job selector when `jobs.length > 1`
