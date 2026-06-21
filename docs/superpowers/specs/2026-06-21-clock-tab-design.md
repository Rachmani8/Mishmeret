# Clock Tab — Design Spec
**Date:** 2026-06-21  
**Status:** Approved

---

## Overview

Add a dedicated "שעון" (Clock) tab as the rightmost tab in the bottom navigation. This tab owns the clock-in / clock-out feature. The clock-in bar is removed entirely from the Calendar tab, keeping the calendar focused on shift browsing.

---

## Changes Summary

| File | Change |
|---|---|
| `app/(app)/clock/page.tsx` | **New** — clock-in/out page |
| `components/BottomNav.tsx` | Add clock tab (last in array = rightmost) |
| `app/(app)/calendar/page.tsx` | Remove clock bar, clock state, and related logic |

---

## Clock Page (`/clock`)

### State machine

Four states, identical semantics to the existing calendar clock bar:

```
idle → clocked-in → clocked-out → reviewed → clocked-in (double shift)
```

All state is persisted to `localStorage` using the same keys as today:
- `clockState_YYYY-MM-DD`
- `clockIn_YYYY-MM-DD`
- `clockOut_YYYY-MM-DD`
- `clockShiftId_YYYY-MM-DD`
- `firstClockShiftId_YYYY-MM-DD`

Shift records are written to Dexie (`db.shifts`) exactly as before.

### Layout

Full-screen page, vertically centred content, light background (#ffffff), Heebo font — matching the rest of the app.

```
[ Job selector chips ]   ← only shown when jobs.length > 1

      ┌─────────────┐
      │   HH:MM     │   ← large circle, animated ring border
      │  (or timer) │
      └─────────────┘

  [ status badge / text ]

      [ primary button ]
```

### Circle states

| App state | Circle content | Ring style | Ring color |
|---|---|---|---|
| Idle | Current time (HH:MM) | Soft breathing pulse, 3 s loop | Blue (`#3B82F6`) |
| Clocked-in | Elapsed HH:MM:SS, counting up every second | Rotating arc, 4 s loop | Green (`#10B981`) |
| Clocked-out | Shift duration HH:MM | Static | Gray (`#D1D5DB`) |
| Reviewed | Shift duration HH:MM | Static + green checkmark overlay | Green (`#10B981`) |

### Status text

| State | Text |
|---|---|
| Idle | "אין משמרת פעילה" |
| Clocked-in | "● משמרת פעילה — כניסה HH:MM" (green dot) |
| Clocked-out | "כניסה HH:MM ← יציאה HH:MM" |
| Reviewed (single) | Job name + "HH:MM ← HH:MM" |
| Reviewed (double) | Two shift summaries stacked |

### Buttons

| State | Button | Color |
|---|---|---|
| Idle | "התחל משמרת ▶" | Green |
| Clocked-in | "סיום משמרת ■" | Red |
| Clocked-out | "ווידוא יום" (opens ShiftDrawer) | Amber |
| Reviewed | "כניסה למשמרת נוספת ▶" | Green |
| Reviewed | Edit icon buttons (one per shift) | Orange (existing style) |

### ShiftDrawer

The clock page imports `ShiftDrawer` directly. Tapping "ווידוא יום" or the edit icon sets `selectedDate = todayStr` and optionally `drawerShiftId`. The `onSave` callback updates `clockState` to `"reviewed"` exactly as the calendar does today.

### Data loading

On mount: load jobs from Dexie. On each clock action and after drawer save/delete: reload today's shifts from Dexie to keep `shiftMap` current.

### Invalid-state guard

Same `useEffect` as today's calendar: if `clockShiftId` no longer exists in DB (shift deleted externally), reset to `"idle"`.

---

## BottomNav

Add one entry at the **end** of the `tabs` array (renders rightmost in LTR flex):

```tsx
{
  href: "/clock",
  label: "שעון",
  icon: <SVG clock face>   // circle with hands, matching existing icon style (strokeWidth 1.8)
}
```

Total: 6 tabs. At 430 px max-width each tab is ~71 px — acceptable.

---

## Calendar Page — Removals

### State to remove
- `clockState`, `todayClockIn`, `todayClockOut`
- `clockShiftId`, `firstClockShiftId`
- `clockJob`, `drawerShiftId`

### Logic to remove
- `handleClockIn`, `handleClockOut` functions
- `useEffect` that validates clockShiftId against DB
- Clock-state sync inside `handleSave` (the `clocked-out → reviewed` transition)
- Clock-tracking inside `handleDelete` (the shift-promotion / idle-reset logic)

### JSX to remove
- Entire "Clock In / Out Bar" `<div>` (currently `sticky bottom-16 z-20`)

### What stays
- `ShiftDrawer` (calendar still needs it for editing past shifts)
- `handleSave` and `handleDelete` simplified to only refresh `shifts` state
- All calendar grid logic untouched

---

## Constraints

- No new state manager — clock page is self-contained
- No navigation required for ShiftDrawer — it mounts inside the clock page
- localStorage key format unchanged — no migration needed
- Calendar tab becomes purely a calendar

---

## Out of scope

- Push notifications or background timers
- A clock widget on other pages
- Night shift / cross-midnight clock logic (tracked separately)
