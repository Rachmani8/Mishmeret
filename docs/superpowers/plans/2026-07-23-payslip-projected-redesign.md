# Payslip Projected Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the validator/comparison feature from the payslip page and replace it with a clean read-only projected payslip using the "Hero נטו" layout (Option A).

**Architecture:** Single-file change to `app/(app)/payslip/page.tsx`. Remove `ActualValues` state, the `Row` component, and all validator UI. Replace `Row` with a simpler `ReadOnlyRow` component. Add a hero net-pay card at the top of the content area.

**Tech Stack:** Next.js 16, React, Tailwind CSS, Dexie (IndexedDB)

---

### Task 1: Remove validator state and simplify component

**Files:**
- Modify: `app/(app)/payslip/page.tsx`

- [ ] **Step 1: Remove `ActualValues` interface and `emptyActual` factory**

Delete lines 15–32 (the `ActualValues` interface and `emptyActual` function):

```tsx
// DELETE these entirely:
// interface ActualValues { ... }
// const emptyActual = () => ({ ... });
```

- [ ] **Step 2: Remove the `Row` component**

Delete lines 34–90 (the entire `Row` function). It will be replaced in Task 2.

- [ ] **Step 3: Remove validator state from `PayslipPage`**

In the `PayslipPage` component, remove these state declarations:

```tsx
// DELETE these lines:
const [actual, setActual] = useState<ActualValues>(emptyActual());
const [showValidator, setShowValidator] = useState(false);
```

Also remove the `setActualField` helper:
```tsx
// DELETE:
const setActualField = (key: keyof ActualValues, v: string) =>
  setActual((prev) => ({ ...prev, [key]: v }));
```

And remove `actual` reset from the `navigate` function — change it from:
```tsx
const navigate = (dir: -1 | 1) => {
  let m = month + dir;
  let y = year;
  if (m < 1) { m = 12; y--; }
  if (m > 12) { m = 1; y++; }
  setMonth(m);
  setYear(y);
  setActual(emptyActual()); // DELETE this line
};
```
to:
```tsx
const navigate = (dir: -1 | 1) => {
  let m = month + dir;
  let y = year;
  if (m < 1) { m = 12; y--; }
  if (m > 12) { m = 1; y++; }
  setMonth(m);
  setYear(y);
};
```

- [ ] **Step 4: Also remove `infoOpen` state and the info button temporarily**

We'll re-add the info button after cleaning up — for now just verify the file compiles without errors by checking no remaining references to `actual`, `showValidator`, `setActualField`, or `Row`.

- [ ] **Step 5: Verify the app still loads**

Navigate to http://localhost:3000/payslip in the browser. It may show errors — that's expected since we haven't added the new UI yet. The goal here is confirming no TypeScript compile errors in the parts we haven't touched.

- [ ] **Step 6: Commit**

```bash
git add app/(app)/payslip/page.tsx
git commit -m "refactor: remove payslip validator state and Row component"
```

---

### Task 2: Add `ReadOnlyRow` component and hero card

**Files:**
- Modify: `app/(app)/payslip/page.tsx`

- [ ] **Step 1: Add `ReadOnlyRow` component**

Insert this component near the top of the file (after imports, before `PayslipPage`):

```tsx
function ReadOnlyRow({
  label,
  amount,
  isNegative = false,
  bold = false,
  hours,
}: {
  label: string;
  amount: number;
  isNegative?: boolean;
  bold?: boolean;
  hours?: number;
}) {
  return (
    <div
      className={`flex items-center gap-2 py-2.5 ${bold ? "border-t mt-1 pt-3" : "border-b last:border-0"}`}
      style={{ borderColor: "rgba(255,255,255,0.08)" }}
    >
      <span className={`flex-1 text-sm ${bold ? "font-semibold text-[#E8EEFF]" : "text-[#6B8FAA]"}`}>
        {label}
      </span>
      {hours !== undefined && (
        <span className="text-sm font-medium text-[#3E5672] w-16 text-left">
          {hours.toFixed(2)} ש׳
        </span>
      )}
      <span
        dir="ltr"
        className={`text-sm font-medium w-24 text-left ${
          isNegative ? "text-red-400" : bold ? "text-[#3B7FF5] font-bold" : "text-[#E8EEFF]"
        }`}
      >
        {isNegative ? "-" : ""}{formatCurrency(amount).replace("₪", "")}
      </span>
    </div>
  );
}
```

- [ ] **Step 2: Replace the summary cards section with hero + 3 chips**

Find the current summary cards block (the `<div className="grid grid-cols-3 gap-3">` block) and replace it with:

```tsx
{/* Hero net card */}
<div
  className="rounded-2xl p-5 text-center border"
  style={{
    background: "linear-gradient(135deg, #1a3a6b 0%, #162038 100%)",
    borderColor: "rgba(59,127,245,0.25)",
  }}
>
  <div className="text-xs text-[#6B8FAA] mb-2">נטו לתשלום</div>
  <div className="text-4xl font-extrabold text-green-400" dir="ltr">
    {formatCurrency(payslip.netPay)}
  </div>
  <div className="text-xs text-[#3E5672] mt-2" dir="ltr">
    מתוך ברוטו {formatCurrency(payslip.grossTotal)}
  </div>
</div>

{/* Stat chips */}
<div className="grid grid-cols-3 gap-3">
  <div className="bg-[#162038] rounded-2xl p-3 text-center border" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
    <div className="text-xs text-[#6B8FAA] mb-1">ימי עבודה</div>
    <div className="text-lg font-bold text-[#3B7FF5]">{payslip.workDays}</div>
  </div>
  <div className="bg-[#162038] rounded-2xl p-3 text-center border" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
    <div className="text-xs text-[#6B8FAA] mb-1">שעות</div>
    <div className="text-lg font-bold text-green-400">{payslip.totalHours.toFixed(2)}</div>
  </div>
  <div className="bg-[#162038] rounded-2xl p-3 text-center border" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
    <div className="text-xs text-[#6B8FAA] mb-1">טיפים</div>
    <div className={`text-base font-bold ${totalTips > 0 ? "text-amber-400" : "text-[#3E5672]"}`}>
      {totalTips > 0 ? formatCurrency(totalTips) : "—"}
    </div>
  </div>
</div>
```

- [ ] **Step 3: Replace income section rows**

Find the income section block and replace all `Row` calls with `ReadOnlyRow`:

```tsx
{/* Income section */}
<div className="bg-[#162038] border rounded-2xl px-4 py-1" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
  <h3 className="text-xs font-semibold text-[#3E5672] uppercase tracking-wide pt-3 pb-1">הכנסות</h3>
  <ReadOnlyRow label="שכר בסיס" amount={payslip.baseSalary} hours={payslip.totalHours} />
  {payslip.overtime1Pay > 0 && (
    <ReadOnlyRow label="שעות נוספות 125%" amount={payslip.overtime1Pay} hours={payslip.overtime1Hours} />
  )}
  {payslip.overtime2Pay > 0 && (
    <ReadOnlyRow label="שעות נוספות 150%" amount={payslip.overtime2Pay} hours={payslip.overtime2Hours} />
  )}
  {payslip.weekendHolidayBonus > 0 && (
    <ReadOnlyRow label="תוספת שבת/חג 150%" amount={payslip.weekendHolidayBonus} hours={payslip.weekendHours} />
  )}
  <ReadOnlyRow label="נסיעות" amount={payslip.commuteTotal} />
</div>
```

- [ ] **Step 4: Remove the gross total card**

Delete the orange gross card block entirely (it was `<div className="bg-orange-500 rounded-2xl ...>`). The gross is now shown in the hero subline.

- [ ] **Step 5: Replace deductions section rows**

```tsx
{/* Deductions section */}
<div className="bg-[#162038] border rounded-2xl px-4 py-1" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
  <h3 className="text-xs font-semibold text-[#3E5672] uppercase tracking-wide pt-3 pb-1">ניכויים</h3>
  {selectedJob?.pensionEnabled && (
    <ReadOnlyRow label="פנסיה (עובד)" amount={payslip.pensionEmployee} isNegative />
  )}
  <ReadOnlyRow label="ביטוח לאומי" amount={payslip.nationalInsurance} isNegative />
  <ReadOnlyRow label="ביטוח בריאות" amount={payslip.healthInsurance} isNegative />
  <ReadOnlyRow label="מס הכנסה" amount={payslip.incomeTax} isNegative />
</div>
```

- [ ] **Step 6: Remove validator toggle button and validator callout**

Delete the dashed-border validator toggle button and the amber instructions callout that follows it.

- [ ] **Step 7: Update the info modal — remove the validator section**

Find the "מוודא תלוש" `<div>` block inside the info modal and delete it:

```tsx
// DELETE this block from the modal:
<div>
  <p className="text-sm font-semibold text-[#E8EEFF] mb-1">מוודא תלוש</p>
  <p className="text-sm text-[#6B8FAA] leading-relaxed">הזן/י נתונים מהתלוש האמיתי שלך כדי לבדוק אם חושב נכון.</p>
</div>
```

- [ ] **Step 8: Check the page renders correctly**

Open http://localhost:3000/payslip. With a job configured it should show: hero card → chips → income → deductions → net → tips. With no job: "הגדר/י משרה תחילה".

- [ ] **Step 9: Commit**

```bash
git add app/(app)/payslip/page.tsx
git commit -m "feat: redesign payslip as clean projected view with hero net card"
```
