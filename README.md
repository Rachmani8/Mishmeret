# Mishmeret (משמרת)

A Hebrew-first Progressive Web App for Israeli employees to track work shifts and calculate wages according to Israeli labor law.

Built to help Israeli shift workers track hours and validate their payslip against actual Israeli labor law — overtime tiers, Shabbat rates, national insurance, and income tax included.

## Live Demo

[Open App](https://mishmeret.vercel.app/calendar)

## Screenshots

<!-- Add a screenshot of the app here -->

## Features

- **Calendar** — Monthly/weekly shift view with clock in/out bar
- **Monthly Summary** — Per-shift breakdown of hours and gross earnings
- **Estimated Payslip** — Full payslip simulation (base, overtime, Shabbat bonus, commute, pension, national insurance, income tax) with a built-in validator to compare against your actual payslip
- **Settings** — Configure job parameters and sync Shabbat candle-lighting times by city
- **Excel Export** — Export full earnings or hours-only tables to `.xlsx`

## Tech Stack

| Layer | Library |
|---|---|
| Framework | Next.js 16 + React 19, TypeScript |
| Styling | Tailwind CSS v4 |
| Storage | Dexie (IndexedDB — no backend, all data is local) |
| Excel | xlsx |
| Shabbat & Holiday times | HebCal API |

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The root redirects to `/calendar`.

## Project Structure

```
app/
  (app)/
    calendar/page.tsx     # Shift calendar + clock in/out
    summary/page.tsx      # Monthly earnings summary
    payslip/page.tsx      # Estimated payslip + validator
    settings/page.tsx     # Job config + Shabbat city sync
    export/page.tsx       # Excel export
  layout.tsx              # Root layout (fonts, globals)
  (app)/layout.tsx        # App shell (BottomNav, max-width)

components/
  BottomNav.tsx           # Bottom tab navigation
  ShiftDrawer.tsx         # Slide-up drawer for editing shifts

lib/
  db.ts                   # Dexie schema, Job/Shift types, default factories
  calculations.ts         # Wage engine + Israeli tax calculations
  hebcal.ts               # HebCal fetch + Shabbat cache helpers
  useShabbatTimes.ts      # React hook wrapping the Shabbat cache
```

## Build

```bash
npm run build
npm run start
```
