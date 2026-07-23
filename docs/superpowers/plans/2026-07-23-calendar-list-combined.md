# Calendar + List Combined View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge the calendar and summary tabs into one page with a calendar/list toggle, removing the weekly view and the summary tab from the bottom nav.

**Architecture:** The calendar page gains a `viewMode` state of `"calendar" | "list"`. The list view renders all days of the month as cards using the same shift data already loaded. The summary tab is removed from BottomNav. The weekly view code is deleted.

**Tech Stack:** Next.js App Router, Dexie, Tailwind CSS, `calcDayEarnings` from `lib/calculations.ts`

---

## Files

- Modify: `components/BottomNav.tsx` — remove summary tab
- Modify: `app/(app)/calendar/page.tsx` — replace week/month toggle with calendar/list icon toggle, remove weekly view, add list view component

---

### Task 1: Remove summary tab from BottomNav

**Files:**
- Modify: `components/BottomNav.tsx`

- [ ] **Step 1: Remove the summary tab entry**

In `components/BottomNav.tsx`, delete this object from the `tabs` array:

```ts
{
  href: "/summary",
  label: "סיכום",
  icon: (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} stroke="currentColor" className="w-6 h-6">
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  ),
},
```

- [ ] **Step 2: Verify in browser**

Navigate to any page. Confirm the bottom nav shows 4 tabs: ייצוא, תלוש, לוח שנה, שעון. No סיכום tab.

- [ ] **Step 3: Commit**

```bash
git add components/BottomNav.tsx
git commit -m "feat: remove summary tab from bottom nav"
```

---

### Task 2: Replace week/month toggle with calendar/list icon toggle

**Files:**
- Modify: `app/(app)/calendar/page.tsx`

- [ ] **Step 1: Change viewMode type and default**

Change line 17 from:
```ts
const [viewMode, setViewMode] = useState<"week" | "month">("month");
```
To:
```ts
const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");
```

- [ ] **Step 2: Remove the weekly navigation logic from `navigate`**

Replace the `navigate` function (lines 76–81) with:
```ts
const navigate = (dir: -1 | 1) => {
  const d = new Date(currentDate);
  d.setMonth(d.getMonth() + dir);
  setCurrentDate(d);
};
```

- [ ] **Step 3: Simplify `headerLabel`**

Replace the `headerLabel` block (lines 104–115) with:
```ts
const headerLabel = `${MONTH_NAMES_HE[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
```

- [ ] **Step 4: Replace the toggle UI in the header**

Replace the toggle+nav block (lines 207–231):
```tsx
<div className="flex items-center gap-2">
  <div className="flex bg-[#162038] rounded-lg p-0.5 text-xs">
    <button
      onClick={() => setViewMode("week")}
      ...
    >שבועי</button>
    <button
      onClick={() => setViewMode("month")}
      ...
    >חודשי</button>
  </div>
  <div className="flex items-center gap-1 flex-1 justify-center">
    ...month nav...
  </div>
</div>
```

With:
```tsx
<div className="flex items-center justify-between">
  <div className="flex bg-[#162038] rounded-full p-0.5 gap-0.5">
    <button
      onClick={() => setViewMode("calendar")}
      className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${viewMode === "calendar" ? "bg-[#3B7FF5]" : "text-[#6B8FAA]"}`}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
      </svg>
    </button>
    <button
      onClick={() => setViewMode("list")}
      className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${viewMode === "list" ? "bg-[#3B7FF5]" : "text-[#6B8FAA]"}`}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
        <line x1="8" y1="6" x2="21" y2="6" />
        <line x1="8" y1="12" x2="21" y2="12" />
        <line x1="8" y1="18" x2="21" y2="18" />
        <line x1="3" y1="6" x2="3.01" y2="6" />
        <line x1="3" y1="12" x2="3.01" y2="12" />
        <line x1="3" y1="18" x2="3.01" y2="18" />
      </svg>
    </button>
  </div>
  <div className="flex items-center gap-1">
    <button onClick={() => navigate(-1)} className="p-1 text-[#6B8FAA] hover:text-[#E8EEFF] transition-colors">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><path d="m9 18 6-6-6-6" /></svg>
    </button>
    <span className="text-sm font-medium text-[#E8EEFF] min-w-[140px] text-center">{headerLabel}</span>
    <button onClick={() => navigate(1)} className="p-1 text-[#6B8FAA] hover:text-[#E8EEFF] transition-colors">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><path d="m15 18-6-6 6-6" /></svg>
    </button>
  </div>
</div>
```

- [ ] **Step 5: Remove the weekly view render block**

Delete these lines (roughly 243–249):
```tsx
{viewMode === "week" && (
  <div className="p-4 grid grid-cols-7 gap-1.5">
    {getWeekDays().map((d, i) => (
      <DayCell key={i} date={d} />
    ))}
  </div>
)}
```

- [ ] **Step 6: Update the monthly calendar render condition**

Change:
```tsx
{viewMode === "month" && (
```
To:
```tsx
{viewMode === "calendar" && (
```

- [ ] **Step 7: Delete the `getWeekDays` function** (lines 50–59) — it is no longer used.

- [ ] **Step 8: Verify in browser**

Open the calendar tab. Confirm:
- Toggle shows calendar icon (active/blue) and list icon
- Month navigation works
- Calendar grid renders correctly
- No weekly view exists

- [ ] **Step 9: Commit**

```bash
git add app/(app)/calendar/page.tsx
git commit -m "feat: replace week/month toggle with calendar/list icon toggle"
```

---

### Task 3: Add list view

**Files:**
- Modify: `app/(app)/calendar/page.tsx`

- [ ] **Step 1: Add `calcDayEarnings` and `calcWorkedHours` imports**

Add to the import from `@/lib/calculations`:
```ts
import { DAY_ABBR_HE, MONTH_NAMES_HE, calcDayEarnings, calcWorkedHours } from "@/lib/calculations";
```

- [ ] **Step 2: Add shabbat times hook**

The `useShabbatTimes` hook provides candle-lighting times needed for Friday split calculations. Add the import:
```ts
import { useShabbatTimes } from "@/lib/useShabbatTimes";
```

Add inside the component, after the `holidays` line:
```ts
const shabbatTimes = useShabbatTimes(currentDate.getFullYear());
```

- [ ] **Step 3: Build `getMonthDates` helper**

Add this helper after `getMonthDays`:
```ts
const getMonthDates = () => {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1));
};
```

- [ ] **Step 4: Add the `openShift` helper for opening a specific shift from the list**

The existing `openDay` opens by date and picks the first job. For the list view, tapping a shift block should open the drawer for that date. Add:
```ts
const openShift = (date: Date, jobId: string) => {
  const job = jobs.find((j) => j.id === jobId) ?? selectedJob;
  if (!job) return;
  const key = formatDate(date);
  const isSat = date.getDay() === 6;
  const isHoliday = !!holidays[key];
  const nextKey = formatDate(new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1));
  const holiday = isHoliday
    ? holidays[key]
    : (!isSat && holidays[nextKey] ? `ערב ${holidays[nextKey]}` : undefined);
  setSelectedDateHoliday(holiday);
  setSelectedJob(job);
  setSelectedDate(key);
};
```

- [ ] **Step 5: Add the list view render block**

After the `{viewMode === "calendar" && ( ... )}` block and before `<ShiftDrawer`, add:

```tsx
{viewMode === "list" && (
  <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2 pb-4">
    {getMonthDates().map((date) => {
      const key = formatDate(date);
      const dayShifts = (shiftMap[key] ?? []).filter((s) => s.isWorkDay);
      const isSat = date.getDay() === 6;
      const holidayName = holidays[key];
      const nextKey = formatDate(new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1));
      const isErevHoliday = !isSat && !holidayName && !!holidays[nextKey];
      const isHoliday = !!holidayName;
      const isSpecial = isSat || isHoliday || isErevHoliday;
      const isToday = key === todayStr;

      const dateColor = isSat
        ? "text-[#FF6B2C]"
        : isHoliday || isErevHoliday
        ? "text-purple-400"
        : "text-[#E8EEFF]";

      const letterColor = isSat
        ? "text-[#FF6B2C]"
        : isHoliday || isErevHoliday
        ? "text-purple-400"
        : "text-[#6B8FAA]";

      const cardBorder = isToday
        ? "border-[#3B7FF5] border-[1.5px] bg-[#1a2540]"
        : isSat
        ? "border-[rgba(255,107,44,0.2)]"
        : isHoliday || isErevHoliday
        ? "border-[rgba(167,139,250,0.2)]"
        : "border-white/[0.06]";

      return (
        <div
          key={key}
          className={`flex items-stretch bg-[#162038] rounded-xl border overflow-hidden ${cardBorder}`}
        >
          {/* Date column */}
          <div className="flex flex-col items-center justify-center px-3 py-2 min-w-[44px] gap-0.5">
            <span className={`text-xl font-bold leading-none ${dateColor}`}>{date.getDate()}</span>
            <span className={`text-[10px] font-medium ${letterColor}`}>{DAY_ABBR_HE[date.getDay()]}</span>
          </div>

          {/* Vertical divider */}
          <div className="w-px bg-white/[0.08] my-2" />

          {/* Shifts or empty */}
          <div className="flex-1 flex flex-col">
            {dayShifts.length === 0 ? (
              <div className="flex items-center px-3 py-3">
                <span className="text-xs text-[#6B8FAA]/40">
                  {isSat ? "שבת" : "אין משמרת"}
                </span>
              </div>
            ) : (
              dayShifts.map((shift, idx) => {
                const job = jobs.find((j) => j.id === shift.jobId);
                if (!job) return null;
                const earnings = calcDayEarnings(shift, job, shabbatTimes, holidays);
                const hours = calcWorkedHours(shift);
                const jobColor = jobColorMap[shift.jobId] ?? "#3B7FF5";

                return (
                  <div key={shift.id}>
                    {idx > 0 && (
                      <div className="mx-3 border-t border-dashed border-white/[0.12]" />
                    )}
                    <button
                      className="w-full text-right flex items-center gap-2 px-3 py-2"
                      onClick={() => openShift(date, shift.jobId)}
                    >
                      <div className="flex-1 flex flex-col gap-0.5">
                        <span className="text-[10px] font-semibold" style={{ color: jobColor }}>
                          {jobNameMap[shift.jobId]}
                        </span>
                        <span className="text-sm font-semibold text-[#E8EEFF]">
                          {shift.clockIn} — {shift.clockOut}
                        </span>
                        <div className="flex gap-2 text-[11px] text-[#6B8FAA]">
                          <span>{hours.toFixed(1)} שע׳</span>
                          {shift.tips ? (
                            <span style={{ color: "#2DD4BF" }}>טיפים: ₪{shift.tips}</span>
                          ) : null}
                        </div>
                      </div>
                      <span className="text-sm font-bold text-[#3B7FF5] min-w-[52px] text-left">
                        ₪{Math.round(earnings.totalGross)}
                      </span>
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      );
    })}
  </div>
)}
```

- [ ] **Step 6: Verify in browser**

Switch to the list view. Confirm:
- All days of the month appear as cards
- Days with no shift show "אין משמרת" (or "שבת" on Saturdays)
- Shabbat date/letter is orange, holiday is purple, today has blue border
- Shifts show: job name in job color, time range, hours, tips in teal, total in blue
- Days with 2 shifts show both with a dashed separator
- Tapping a shift row opens the ShiftDrawer for that date

- [ ] **Step 7: Commit**

```bash
git add app/(app)/calendar/page.tsx
git commit -m "feat: add list view to calendar page"
```

---

### Task 4: Push

- [ ] **Step 1: Push to remote**

```bash
git push
```
