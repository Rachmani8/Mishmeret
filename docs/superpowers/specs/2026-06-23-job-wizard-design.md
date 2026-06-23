# Job Setup Wizard — Design Spec

**Date:** 2026-06-23  
**Status:** Approved

---

## Overview

Replace the "הוסף/י משרה" instant-create flow with a guided 6-step wizard. The wizard walks the user through the key job settings one at a time, with legal defaults pre-filled and a tip box on each step explaining the context. Existing job editing (the inline form on the settings page) is unchanged.

---

## Trigger & Placement

- Tapping "הוסף/י משרה" on the settings page opens the wizard.
- The wizard renders as a **fixed full-screen overlay** (`position: fixed, inset: 0, z-50`) that slides up from the bottom over the settings page.
- After saving, the overlay slides back down and the new job appears in the settings list. The user stays on the settings page.
- No routing change. No new URL.

---

## Implementation

**One new file:** `app/(app)/settings/JobWizard.tsx`

- Single component with `currentStep: number` state (0–7).
- Holds one `Partial<Job>` draft, initialized from `defaultJob()` when the wizard opens.
- Each step reads/writes the draft.
- On final save: calls `db.jobs.add(draft)` then calls `onClose(newJob)` so the settings page can append the job to its list.

**Settings page changes (`settings/page.tsx`):**
- Add `wizardOpen: boolean` state.
- "הוסף/י משרה" button sets `wizardOpen = true`.
- Render `<JobWizard open={wizardOpen} onClose={(job) => { append job; setWizardOpen(false) }} />`.
- Remove the existing `addJob()` function.

---

## Steps

| Step | Hebrew question | Input | Default |
|------|----------------|-------|---------|
| 0 | Welcome screen | None | — |
| 1 | מה שם המשרה? | Text input | "משרה ראשית" |
| 2 | כמה מרוויחים לשעה? | Number with +/− buttons | ₪40 |
| 3 | תעריפי שעות נוספות ושבת | Read-only legal-default rows; "רוצה לשנות?" expands editable fields | legal defaults |
| 4 | כמה נקודות זיכוי יש לך? | Stepper (−/+ in 0.25 steps) | 2.25 |
| 5 | האם מקבלים דמי נסיעה? | Toggle on/off + daily amount field | on, ₪22.60 |
| 6 | הגדרות פנסיה | Toggle on/off + 3 percentage fields | on, 6% / 6.5% / 6% |
| 7 | Summary | All values listed, each with "ערוך" link that jumps back to its step | — |

**Skip behavior:** tapping "דלג/י" on any step keeps the current default for that field and advances to the next step. The job is always valid — no broken/incomplete state possible.

**"Already set" chips:** small pill tags displayed below the step content showing answers confirmed so far (name, wage, etc.). Visual only, not clickable.

---

## Visual Design

Matches the existing dark navy theme and the provided mockup.

- **Background:** `#0d1220`, full screen
- **Slide animation:** `translate-y-full` → `translate-y-0` on open, reversed on close
- **Progress bar:** thin gradient bar at top (`#3b6fd4` → `#5b9af5`), width = `(currentStep / 7) * 100%`
- **Step header:** small eyebrow label (step N of 6), skip link
- **Tip box:** soft blue-tinted card with right border, explains legal context for each step
- **Back button:** small square icon button (←)
- **Next button:** full-width blue gradient. Step 6 → green gradient ("שמור/י משרה 🎉")
- **Dot pagination:** row at bottom — done dots small + dim blue, active dot wide + bright, future dots dark
- **Step 3 overtime rows:** each row shows value + "חוק" badge. Collapsed by default; "רוצה לשנות? לחץ/י כאן" link expands editable number inputs inline.

---

## Data Flow

```
wizardOpen = true
    ↓
draft = defaultJob()
    ↓
user fills steps (each step mutates draft)
    ↓
summary screen confirms
    ↓
db.jobs.add(draft)
    ↓
onClose(draft) → settings page appends job, wizardOpen = false
```

---

## Out of Scope

- Editing existing jobs — unchanged, uses current inline form.
- Navigation to calendar after save — user stays on settings.
- Night shift settings — separate future feature.
