# Combined Calendar + List View

**Date:** 2026-07-23

## What we're building

Merge the calendar tab and summary tab into one tab. The page keeps the monthly calendar grid as the default view, and adds a list view showing all days of the month. A toggle (icon-only pill, same style as the current חודשי/שבועי switcher) switches between the two views.

## Toggle

- Replaces the current חודשי/שבועי pill toggle on the calendar page
- Left button: calendar grid icon (active by default)
- Right button: list icon
- Same visual style: `#162038` pill background, `#3B7FF5` active button, icon-only (no text)
- The summary tab is removed from the bottom nav

## Calendar view

- Identical to the current monthly calendar — no changes
- Weekly view is removed entirely

## List view

- Shows every day of the month, from 1 to end-of-month
- Each day is a full-width rounded card (`#162038` bg, `0.5px` border, `border-radius: 10px`) — same visual language as the calendar day squares
- Card layout: `[date column] | [divider] | [shift info] [total]`
  - Date column: day number (1–31) on top, day letter abbreviation (א׳ etc.) below — Shabbat = orange, holiday = purple; today's date/letter stay default white/gray (today is indicated by the card border only)
  - Divider: `0.5px rgba(255,255,255,0.08)` vertical line
  - Shift info (middle):
    - Job name (e.g. "מסעדה ראשית") — muted, small
    - Time range: `08:00 — 16:30`
    - Total hours: e.g. `8.5 שע׳`
    - Tips: e.g. `טיפים: ₪40` in teal (`#2DD4BF`) — omitted if zero
  - Total pay (no tips): always blue (`#3B7FF5`), regardless of Shabbat/holiday
  - Days with no shift: show "אין משמרת" in muted text, no total column
- Today gets `1.5px solid #3B7FF5` border and `#1a2540` background
- Shabbat rows get `rgba(255,107,44,0.2)` border tint
- Tapping any row opens the ShiftDrawer for that specific shift (same behavior as tapping a day in the calendar)
- The calendar cards and list cards are functionally equivalent — both open the ShiftDrawer

## Multi-shift days

- If a day has 2+ shifts, they share one card
- Each shift is its own block inside the card, separated by a dashed line (`border-top: 1px dashed rgba(255,255,255,0.15)`)
- The separator only appears between shifts — never for single-shift days
- Each shift block shows its own job name, time range, hours, tips, and total
- The date column (number + letter) spans the full card height, centered vertically

## Job name coloring

- Job names in the list view use the same color assigned to that job in the calendar (the `JOB_COLORS` array from `settings/page.tsx`)
- This applies in both single-shift and multi-shift cards

## Navigation

- Month navigation (prev/next arrows + month label) stays in place, works for both views
- Bottom nav: summary tab removed; calendar tab remains

## Data

- List view reads from the same `shifts` and `jobs` Dexie queries already used by the calendar page
- Wage calculation per day uses the existing `calcDayEarnings` function
- No new data model changes needed
