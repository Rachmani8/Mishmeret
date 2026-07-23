# Payslip Page — Projected Redesign

**Date:** 2026-07-23  
**Status:** Approved

## Overview

Remove the validator/comparison feature entirely. The payslip page becomes a clean, read-only projected payslip using layout Option A: a large "hero" net-pay card at the top, followed by income breakdown and deductions.

## What Changes

### Removed
- All `ActualValues` state and `emptyActual()` factory
- `Row` component (which rendered a calculated value + editable actual input)
- `showValidator` state and the validator toggle button
- The validator instructions callout
- The `actual` input fields from the gross card

### New Layout (top → bottom)

1. **Header** — same: title "תלוש משוער", month nav, job selector if multiple jobs
2. **Hero card** — large blue-gradient card showing:
   - Label: "נטו לתשלום"
   - Value: net pay (large, green, prominent)
   - Subline: "מתוך ברוטו ₪X,XXX" (smaller, muted)
3. **3 stat chips** — work days (blue) | hours (green) | tips (orange, only if tips > 0; otherwise show something neutral or omit third chip)
4. **הכנסות section** — read-only rows: label | hours (if applicable) | amount
   - שכר בסיס (with hours)
   - שע״נ 125% (if > 0, with hours)
   - שע״נ 150% (if > 0, with hours)
   - תוספת שבת/חג (if > 0, with hours)
   - נסיעות (no hours)
5. **ניכויים section** — read-only rows: label | amount (red)
   - פנסיה (עובד) — only if pension enabled
   - ביטוח לאומי
   - ביטוח בריאות
   - מס הכנסה
6. **Net pay card** — green card "נטו לתשלום" (smaller repeat at bottom, consistent with current design)
7. **Tips card** — amber card, only if tips > 0

### Component Changes

Replace the existing `Row` component with a simpler `ReadOnlyRow`:
```
{ label, amount, hours?, isNegative? }
```
No `actual`, no `onChange`, no diff/discrepancy logic.

## What Stays the Same

- Month navigation
- Job selector (multi-job)
- `calcMonthlyPayslip` logic — untouched
- The `?` info button and info modal (content may be updated to remove validator references)
- Empty states ("הגדר/י משרה תחילה", "אין נתונים לחודש זה")
- Tips display
- Overall dark color scheme

## Info Modal Update

Remove the "מוודא תלוש" section from the info modal content, since that feature is gone.

## Out of Scope

- No changes to calculations
- No changes to other pages
- No new data or API calls
