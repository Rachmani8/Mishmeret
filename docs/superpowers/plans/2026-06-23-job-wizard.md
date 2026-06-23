# Job Setup Wizard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the instant "הוסף/י משרה" flow with a guided 6-step wizard overlay that walks the user through job configuration one question at a time.

**Architecture:** One new component (`JobWizard.tsx`) renders as a fixed full-screen overlay with slide-up animation. It holds a `Job` draft initialized from `defaultJob()` and saves to Dexie on the final step. The settings page wires it up by replacing the existing `addJob()` call with `setWizardOpen(true)`.

**Tech Stack:** Next.js 16, React, Dexie (IndexedDB), Tailwind CSS, TypeScript

---

## File Map

| Action | File | What changes |
|--------|------|--------------|
| **Create** | `app/(app)/settings/JobWizard.tsx` | Full wizard component — all steps, animation, save logic |
| **Modify** | `app/(app)/settings/page.tsx` | Add `wizardOpen` state; render `<JobWizard>`; remove `addJob()` |

---

## Task 1: Create `JobWizard.tsx`

**Files:**
- Create: `app/(app)/settings/JobWizard.tsx`

- [ ] **Step 1: Create the file with the complete wizard component**

```tsx
"use client";

import { useState, useEffect } from "react";
import { db, defaultJob } from "@/lib/db";
import type { Job } from "@/lib/db";

interface Props {
  open: boolean;
  initialColor: string;
  onClose: (job?: Job) => void;
}

const STEP_COUNT = 6;

export default function JobWizard({ open, initialColor, onClose }: Props) {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Job>(() => defaultJob({ name: "", color: initialColor }));
  const [ratesExpanded, setRatesExpanded] = useState(false);

  // Re-initialize draft each time the wizard opens
  useEffect(() => {
    if (open) {
      setStep(0);
      setDraft(defaultJob({ name: "", color: initialColor }));
      setRatesExpanded(false);
    }
  }, [open, initialColor]);

  const set = <K extends keyof Job>(key: K, value: Job[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const next = () => setStep((s) => Math.min(s + 1, 7));
  const back = () => setStep((s) => Math.max(s - 1, 0));
  const goTo = (s: number) => setStep(s);

  const handleSave = async () => {
    const job: Job = { ...draft, name: draft.name.trim() || "משרה ראשית" };
    await db.jobs.add(job);
    onClose(job);
  };

  if (!open) return null;

  const progressPct = step === 0 ? 0 : step >= 7 ? 100 : Math.round((step / STEP_COUNT) * 100);

  const chips: { icon: string; val: string }[] = [];
  if (step >= 2 && draft.name) chips.push({ icon: "📋", val: draft.name });
  if (step >= 3) chips.push({ icon: "💰", val: `${draft.baseHourlyRate} ₪` });
  if (step >= 4) chips.push({ icon: "⏱", val: "חוק" });
  if (step >= 5) chips.push({ icon: "🎯", val: String(draft.taxCreditPoints) });
  if (step >= 6) chips.push({ icon: "🚌", val: draft.commuteEnabled ? `${draft.commuteDaily} ₪` : "ללא" });

  const nextLabel =
    step === 0 ? "בואו נתחיל ←" :
    step === 6 ? "סיום → סיכום 🎉" :
    "המשך →";

  const nextClass =
    step === 6
      ? "bg-gradient-to-l from-[#1a8a50] to-[#2ac870]"
      : step === 0
      ? "bg-gradient-to-l from-[#1a3a70] to-[#2a5bd4]"
      : "bg-gradient-to-l from-[#2a5bd4] to-[#5b9af5]";

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col bg-[#0d1220] transition-transform duration-300 ${
        open ? "translate-y-0" : "translate-y-full"
      }`}
      dir="rtl"
    >
      {/* Progress bar — hidden on welcome and summary */}
      {step > 0 && step < 7 && (
        <div className="px-5 pt-12 pb-0">
          <div className="flex justify-between items-center mb-2.5">
            <span className="text-[11px] text-[#3a4a70] tracking-wide">
              שלב {step} מתוך {STEP_COUNT}
            </span>
            <button onClick={next} className="text-[11px] text-[#3a4a70] underline underline-offset-2">
              דלג/י
            </button>
          </div>
          <div className="h-0.5 bg-[#1a2038] rounded-full">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${progressPct}%`,
                background: "linear-gradient(90deg, #3b6fd4, #5b9af5)",
              }}
            />
          </div>
        </div>
      )}

      {/* Step content */}
      <div className="flex-1 overflow-y-auto px-5 pt-6">
        {step === 0 && <StepWelcome />}
        {step === 1 && (
          <StepName value={draft.name} onChange={(v) => set("name", v)} />
        )}
        {step === 2 && (
          <StepWage
            value={draft.baseHourlyRate}
            onChange={(v) => set("baseHourlyRate", v)}
          />
        )}
        {step === 3 && (
          <StepOvertime
            draft={draft}
            expanded={ratesExpanded}
            onExpand={() => setRatesExpanded(true)}
            onChange={set}
          />
        )}
        {step === 4 && (
          <StepTaxPoints
            value={draft.taxCreditPoints}
            onChange={(v) => set("taxCreditPoints", v)}
          />
        )}
        {step === 5 && (
          <StepCommute
            enabled={draft.commuteEnabled}
            daily={draft.commuteDaily}
            onToggle={(v) => set("commuteEnabled", v)}
            onChange={(v) => set("commuteDaily", v)}
          />
        )}
        {step === 6 && (
          <StepPension
            enabled={draft.pensionEnabled}
            employee={draft.pensionEmployeePercent}
            employer={draft.pensionEmployerPercent}
            severance={draft.pensionSeverancePercent}
            onToggle={(v) => set("pensionEnabled", v)}
            onEmployee={(v) => set("pensionEmployeePercent", v)}
            onEmployer={(v) => set("pensionEmployerPercent", v)}
            onSeverance={(v) => set("pensionSeverancePercent", v)}
          />
        )}
        {step === 7 && (
          <StepSummary draft={draft} onGoTo={goTo} onSave={handleSave} />
        )}
      </div>

      {/* Already-set chips */}
      {chips.length > 0 && step < 7 && (
        <div className="flex flex-wrap gap-1.5 px-5 py-2">
          {chips.map((c, i) => (
            <div
              key={i}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px]"
              style={{
                background: "rgba(59,111,212,0.08)",
                border: "1px solid rgba(59,111,212,0.15)",
                color: "#4a6090",
              }}
            >
              {c.icon}{" "}
              <span style={{ color: "#5b7ab0", fontWeight: 600 }}>{c.val}</span>
            </div>
          ))}
        </div>
      )}

      {/* Nav buttons — hidden on summary (summary has its own save button) */}
      {step < 7 && (
        <div className="flex gap-2.5 px-5 pb-8 pt-2">
          {step > 0 && (
            <button
              onClick={back}
              className="w-12 h-12 flex-none flex items-center justify-center rounded-2xl text-[#8090b8] text-lg"
              style={{ background: "#1a2540", border: "1.5px solid #243050" }}
            >
              ←
            </button>
          )}
          <button
            onClick={next}
            className={`flex-1 h-12 rounded-2xl text-white text-[15px] font-bold flex items-center justify-center gap-2 ${nextClass}`}
          >
            {nextLabel}
          </button>
        </div>
      )}

      {/* Dot pagination — hidden on summary */}
      {step < 7 && (
        <div className="flex justify-center gap-1.5 pb-4">
          {Array.from({ length: 7 }, (_, i) => {
            const state = i < step ? "done" : i === step ? "active" : "future";
            return (
              <div
                key={i}
                className="h-1.5 rounded-full transition-all duration-300"
                style={{
                  width: state === "active" ? 20 : 6,
                  background:
                    state === "done" ? "#3b6fd4" :
                    state === "active" ? "#5b9af5" :
                    "#243050",
                  opacity: state === "done" ? 0.4 : 1,
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Shared primitives ────────────────────────────────────────────

function TipBox({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-xl px-3 py-2.5 mb-5"
      style={{
        background: "rgba(59,111,212,0.08)",
        borderRight: "3px solid rgba(91,154,245,0.35)",
      }}
    >
      <p className="text-[12px] text-[#6a8acc] leading-relaxed">{children}</p>
    </div>
  );
}

function StepEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] tracking-widest uppercase text-[#5b9af5] opacity-70 mb-1.5">
      {children}
    </div>
  );
}

function StepHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[21px] font-extrabold text-[#dde4f8] leading-tight mb-4">
      {children}
    </h2>
  );
}

function ToggleSwitch({ on, onToggle }: { on: boolean; onToggle: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onToggle(!on)}
      className={`relative flex-none w-11 h-6 rounded-full transition-colors ${on ? "bg-[#3b6fd4]" : "bg-[#2a3050]"}`}
    >
      <span
        className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${on ? "right-0.5" : "left-0.5"}`}
      />
    </button>
  );
}

function ToggleRow({
  label, sub, on, onToggle,
}: {
  label: string; sub?: string; on: boolean; onToggle: (v: boolean) => void;
}) {
  return (
    <div
      className="flex justify-between items-center py-3 border-b"
      style={{ borderColor: "rgba(255,255,255,0.08)" }}
    >
      <div>
        <div className="text-[14px] font-semibold text-[#dde4f8]">{label}</div>
        {sub && <div className="text-[11px] text-[#3a4a70] mt-0.5">{sub}</div>}
      </div>
      <ToggleSwitch on={on} onToggle={onToggle} />
    </div>
  );
}

// ── Steps ────────────────────────────────────────────────────────

function StepWelcome() {
  return (
    <div className="text-center pt-8 pb-4">
      <div className="text-5xl mb-4">👋</div>
      <h2 className="text-[22px] font-extrabold text-[#dde4f8] leading-tight mb-3">
        בוא/י נגדיר<br />את המשרה שלך
      </h2>
      <p className="text-[13px] text-[#8090b8] leading-relaxed mb-8">
        6 שאלות קצרות — כולן<br />עם ברירות מחדל לפי חוק.<br />לוקח בערך דקה.
      </p>
      <div className="space-y-2 text-right">
        {[
          { icon: "⚖️", title: "כל הגדרות ברירת מחדל לפי חוק", sub: "שעות נוספות, נסיעות, פנסיה" },
          { icon: "✏️", title: "ניתן לשנות הכל בכל עת", sub: "מההגדרות של כל משרה" },
        ].map((item) => (
          <div
            key={item.title}
            className="flex items-center gap-3 px-4 py-3 rounded-xl"
            style={{ background: "#131b2e", border: "1px solid #1a2540" }}
          >
            <span className="text-lg">{item.icon}</span>
            <div>
              <div className="text-[12px] font-semibold text-[#dde4f8]">{item.title}</div>
              <div className="text-[11px] text-[#3a4a70]">{item.sub}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StepName({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <>
      <StepEyebrow>התחלה</StepEyebrow>
      <StepHeading>מה שם המשרה?</StepHeading>
      <TipBox>
        זה רק לזיהוי שלך — למשל{" "}
        <strong className="text-[#5b9af5]">״גילי״</strong>,{" "}
        <strong className="text-[#5b9af5]">״קפה שעורה״</strong> או{" "}
        <strong className="text-[#5b9af5]">״משמרת לילה״</strong>. ניתן לשנות בכל עת.
      </TipBox>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="שם המשרה"
        autoFocus
        className="w-full rounded-2xl px-4 py-4 text-[20px] font-bold text-[#dde4f8] bg-[#1a2540] focus:outline-none focus:ring-2 focus:ring-[#3b6fd4]/50"
        style={{ border: "1.5px solid #3b6fd4" }}
      />
    </>
  );
}

function StepWage({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const adj = (delta: number) =>
    onChange(Math.max(0, parseFloat((value + delta).toFixed(2))));

  return (
    <>
      <StepEyebrow>שכר</StepEyebrow>
      <StepHeading>כמה מרוויחים<br />לשעה?</StepHeading>
      <TipBox>
        שכר המינימום עומד על{" "}
        <strong className="text-[#5b9af5]">32.30 ₪</strong> לשעה. לא בטוח/ה? תוכל/י
        לשנות אחר כך.
      </TipBox>
      <div
        className="flex items-center justify-between px-5 py-4 rounded-2xl mb-3"
        style={{ background: "#1a2540", border: "1.5px solid #243050" }}
      >
        <button
          onClick={() => adj(-0.5)}
          className="w-10 h-10 rounded-xl flex items-center justify-center text-xl text-[#8090b8]"
          style={{ background: "#0d1220", border: "1px solid #243050" }}
        >
          −
        </button>
        <div className="text-center">
          <span className="text-[32px] font-extrabold text-[#dde4f8] tabular-nums">
            {value}
          </span>
          <span className="text-[13px] text-[#8090b8] mr-1">₪ לשעה</span>
        </div>
        <button
          onClick={() => adj(0.5)}
          className="w-10 h-10 rounded-xl flex items-center justify-center text-xl text-[#5b9af5]"
          style={{ background: "#0d1220", border: "1.5px solid #3b6fd4" }}
        >
          +
        </button>
      </div>
    </>
  );
}

function FactorRow({
  label, value,
}: {
  label: string; value: string | number;
}) {
  return (
    <div
      className="flex justify-between items-center py-2.5 border-b last:border-0"
      style={{ borderColor: "rgba(255,255,255,0.08)" }}
    >
      <span className="text-[13px] text-[#8090b8]">{label}</span>
      <div className="flex items-center gap-2">
        <span
          className="px-3 py-1 rounded-lg text-[14px] font-bold text-[#dde4f8] tabular-nums"
          style={{ background: "#1a2540", border: "1px solid #243050" }}
        >
          {value}
        </span>
        <span
          className="text-[10px] px-1.5 py-0.5 rounded"
          style={{ background: "rgba(52,196,122,0.1)", color: "#34c47a" }}
        >
          חוק
        </span>
      </div>
    </div>
  );
}

function StepOvertime({
  draft, expanded, onExpand, onChange,
}: {
  draft: Job;
  expanded: boolean;
  onExpand: () => void;
  onChange: <K extends keyof Job>(key: K, value: Job[K]) => void;
}) {
  const inputCls =
    "w-24 text-center border rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#3B7FF5]/50 bg-[#0C1221] text-[#E8EEFF]";
  const inputStyle = { borderColor: "rgba(255,255,255,0.15)" };

  return (
    <>
      <StepEyebrow>שעות עבודה</StepEyebrow>
      <StepHeading>תעריפי שעות<br />נוספות ותוספות</StepHeading>
      <TipBox>
        כל הערכים מטה הם{" "}
        <strong className="text-[#5b9af5]">לפי החוק הישראלי</strong>. אם המעסיק שלך לא
        קבע אחרת — אפשר לאשר ולהמשיך.
      </TipBox>

      {!expanded ? (
        <>
          <FactorRow label="נורמת שעות יומית" value={`${draft.dailyNormHours} שע׳`} />
          <FactorRow label="שישי / שבת" value={`${draft.weekendMultiplier}×`} />
          <FactorRow label="חג רשמי" value={`${draft.holidayMultiplier}×`} />
          <FactorRow label="שע׳ נוספות 1–2" value={`${draft.overtime1Multiplier}×`} />
          <FactorRow label="שע׳ נוספות 3+" value={`${draft.overtime2Multiplier}×`} />
          <button
            onClick={onExpand}
            className="w-full text-[11px] text-[#5b9af5] underline underline-offset-2 text-center mt-4 opacity-70"
          >
            רוצה לשנות ערכים? לחץ/י כאן
          </button>
        </>
      ) : (
        (
          [
            { key: "dailyNormHours" as keyof Job, label: "נורמת יומית (שע׳)", step: 0.1 },
            { key: "weekendMultiplier" as keyof Job, label: "שישי/שבת (פקטור)", step: 0.05 },
            { key: "holidayMultiplier" as keyof Job, label: "חג (פקטור)", step: 0.05 },
            { key: "overtime1Multiplier" as keyof Job, label: "שע׳ נוספות 1–2", step: 0.05 },
            { key: "overtime2Multiplier" as keyof Job, label: "שע׳ נוספות 3+", step: 0.05 },
          ]
        ).map(({ key, label, step }) => (
          <div
            key={key}
            className="flex justify-between items-center py-2.5 border-b last:border-0"
            style={{ borderColor: "rgba(255,255,255,0.08)" }}
          >
            <span className="text-[13px] text-[#8090b8]">{label}</span>
            <input
              type="number"
              value={draft[key] as number}
              step={step}
              min={0}
              onChange={(e) => onChange(key, parseFloat(e.target.value) || 0)}
              onFocus={(e) => e.target.select()}
              className={inputCls}
              style={inputStyle}
            />
          </div>
        ))
      )}
    </>
  );
}

function StepTaxPoints({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const adj = (delta: number) =>
    onChange(Math.min(20, Math.max(0, parseFloat((value + delta).toFixed(2)))));

  return (
    <>
      <StepEyebrow>מס הכנסה</StepEyebrow>
      <StepHeading>כמה נקודות<br />זיכוי יש לך?</StepHeading>
      <TipBox>
        נקודת זיכוי = <strong className="text-[#5b9af5]">223 ₪</strong> פחות מס בחודש.
        לתושב/ת ישראל רגיל/ה —{" "}
        <strong className="text-[#5b9af5]">2.25 נקודות</strong> מינימום. ניתן לבדוק
        בתלוש האחרון שלך.
      </TipBox>

      <div className="flex items-center justify-center gap-3 mb-3">
        <button
          onClick={() => adj(-0.25)}
          className="w-12 h-12 flex items-center justify-center rounded-2xl text-2xl text-[#8090b8]"
          style={{ background: "#1a2540", border: "1.5px solid #243050" }}
        >
          −
        </button>
        <div
          className="min-w-[80px] text-center px-4 py-2.5 rounded-2xl text-[28px] font-extrabold text-[#dde4f8] tabular-nums"
          style={{ background: "#1a2540", border: "1.5px solid #243050" }}
        >
          {value}
        </div>
        <button
          onClick={() => adj(0.25)}
          className="w-12 h-12 flex items-center justify-center rounded-2xl text-2xl text-[#5b9af5]"
          style={{ background: "#1a2540", border: "1.5px solid #3b6fd4" }}
        >
          +
        </button>
      </div>
      <p className="text-center text-[12px] text-[#3a4a70] mb-4">
        ברירת מחדל: 2.25 (תושב/ת ישראל)
      </p>
      <a
        href="https://secapp.taxes.gov.il/srsimulatorNZ/#/simulator"
        target="_blank"
        rel="noopener noreferrer"
        className="block px-3 py-2.5 rounded-xl text-[11px]"
        style={{ background: "#131b2e", border: "1px solid #1a2540", color: "#5b9af5" }}
      >
        🔗 <span className="underline underline-offset-2">סימולטור נקודות זיכוי — רשות המסים</span>
      </a>
    </>
  );
}

function StepCommute({
  enabled, daily, onToggle, onChange,
}: {
  enabled: boolean; daily: number; onToggle: (v: boolean) => void; onChange: (v: number) => void;
}) {
  return (
    <>
      <StepEyebrow>הוצאות נסיעה</StepEyebrow>
      <StepHeading>האם מקבלים<br />דמי נסיעה?</StepHeading>
      <TipBox>
        על פי חוק, המעסיק חייב לשלם את עלות התחבורה הציבורית הזולה ביותר, עד{" "}
        <strong className="text-[#5b9af5]">22.60 ₪ ליום</strong>.
      </TipBox>
      <ToggleRow label="הפעל/י נסיעות" sub="יתווסף לכל משמרת" on={enabled} onToggle={onToggle} />
      {enabled && (
        <div
          className="flex justify-between items-center py-2.5"
          style={{ borderColor: "rgba(255,255,255,0.08)" }}
        >
          <span className="text-[13px] text-[#8090b8]">סכום יומי (₪)</span>
          <input
            type="number"
            value={daily}
            step={0.1}
            min={0}
            max={1000}
            onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
            onFocus={(e) => e.target.select()}
            className="w-24 text-center border rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#3B7FF5]/50 bg-[#0C1221] text-[#E8EEFF]"
            style={{ borderColor: "rgba(255,255,255,0.15)" }}
          />
        </div>
      )}
    </>
  );
}

function StepPension({
  enabled, employee, employer, severance,
  onToggle, onEmployee, onEmployer, onSeverance,
}: {
  enabled: boolean; employee: number; employer: number; severance: number;
  onToggle: (v: boolean) => void; onEmployee: (v: number) => void;
  onEmployer: (v: number) => void; onSeverance: (v: number) => void;
}) {
  const total = employee + employer + severance;
  const inputCls =
    "w-20 text-center border rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#3B7FF5]/50 bg-[#0C1221] text-[#E8EEFF]";
  const inputStyle = { borderColor: "rgba(255,255,255,0.15)" };
  const rowBorder = { borderColor: "rgba(255,255,255,0.08)" };

  return (
    <>
      <StepEyebrow>פנסיה</StepEyebrow>
      <StepHeading>הגדרות<br />פנסיה</StepHeading>
      <TipBox>
        פנסיה חובה על כל עובד שכיר. סה&quot;כ{" "}
        <strong className="text-[#5b9af5]">18.5% מהשכר</strong> — המעסיק משלם 12.5%,
        העובד/ת 6%.
      </TipBox>
      <ToggleRow label="הפעל/י פנסיה" sub="חובה על פי חוק" on={enabled} onToggle={onToggle} />
      {enabled && (
        <>
          <div
            className="flex justify-between items-center px-4 py-2.5 rounded-xl mt-3 mb-2"
            style={{ background: "rgba(52,196,122,0.07)", border: "1px solid rgba(52,196,122,0.15)" }}
          >
            <span className="text-[13px] text-[#8090b8]">סה&quot;כ מהשכר</span>
            <span className="text-[18px] font-extrabold text-[#34c47a]">
              {total.toFixed(1)}%
            </span>
          </div>
          {[
            { label: "עובד/ת (%)", value: employee, onChange: onEmployee },
            { label: "תגמולים מעסיק (%)", value: employer, onChange: onEmployer },
            { label: "פיצויים מעסיק (%)", value: severance, onChange: onSeverance },
          ].map(({ label, value, onChange }) => (
            <div
              key={label}
              className="flex justify-between items-center py-2.5 border-b last:border-0"
              style={rowBorder}
            >
              <span className="text-[13px] text-[#8090b8]">{label}</span>
              <input
                type="number"
                value={value}
                step={0.5}
                min={0}
                max={50}
                onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
                onFocus={(e) => e.target.select()}
                className={inputCls}
                style={inputStyle}
              />
            </div>
          ))}
        </>
      )}
    </>
  );
}

function StepSummary({
  draft, onGoTo, onSave,
}: {
  draft: Job; onGoTo: (s: number) => void; onSave: () => void;
}) {
  const rowBorder = { borderColor: "rgba(255,255,255,0.08)" };

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div
      className="rounded-2xl overflow-hidden mb-3"
      style={{ background: "#1a2540", border: "1px solid #1a2038" }}
    >
      <div
        className="px-4 py-2 text-[10px] uppercase tracking-widest text-[#3a4a70] border-b"
        style={rowBorder}
      >
        {title}
      </div>
      {children}
    </div>
  );

  const Row = ({
    label, value, onEdit,
  }: {
    label: string; value: string; onEdit?: () => void;
  }) => (
    <div
      className="flex justify-between items-center px-4 py-2.5 border-b last:border-0"
      style={rowBorder}
    >
      <span className="text-[12px] text-[#8090b8]">{label}</span>
      <div className="flex items-center gap-2">
        {onEdit && (
          <button
            onClick={onEdit}
            className="text-[10px] text-[#5b9af5] underline underline-offset-1 opacity-70"
          >
            ערוך
          </button>
        )}
        <span className="text-[13px] font-bold text-[#dde4f8]">{value}</span>
      </div>
    </div>
  );

  const pensionTotal = (
    draft.pensionEmployeePercent +
    draft.pensionEmployerPercent +
    draft.pensionSeverancePercent
  ).toFixed(1);

  return (
    <>
      <div className="text-center pt-4 pb-6">
        <div className="text-4xl mb-2">🎉</div>
        <h2 className="text-[20px] font-extrabold text-[#dde4f8] mb-1">הכל מוכן!</h2>
        <p className="text-[12px] text-[#3a4a70]">בדוק/י ואשר/י את הגדרות המשרה</p>
      </div>

      <Section title="בסיס">
        <Row label="שם משרה" value={draft.name || "משרה ראשית"} onEdit={() => onGoTo(1)} />
        <Row label="שכר שעתי" value={`${draft.baseHourlyRate} ₪/שע׳`} onEdit={() => onGoTo(2)} />
      </Section>

      <Section title="שעות עבודה">
        <Row label="נורמת יומית" value={`${draft.dailyNormHours} שע׳`} />
        <Row label="שישי/שבת/חג" value="1.5×" />
        <Row label="שע׳ נוספות" value="1.25× / 1.5×" />
      </Section>

      <Section title="תוספות ומס">
        <Row
          label="נקודות זיכוי"
          value={String(draft.taxCreditPoints)}
          onEdit={() => onGoTo(4)}
        />
        <Row
          label="נסיעות"
          value={draft.commuteEnabled ? `${draft.commuteDaily} ₪/יום ✓` : "ללא"}
        />
        <Row
          label="פנסיה סה״כ"
          value={draft.pensionEnabled ? `${pensionTotal}% ✓` : "ללא"}
        />
      </Section>

      <div className="pb-8">
        <button
          onClick={onSave}
          className="w-full h-14 rounded-2xl text-white text-[16px] font-extrabold flex items-center justify-center gap-2"
          style={{ background: "linear-gradient(135deg, #1a8a50, #2ac870)" }}
        >
          ✓ שמור/י משרה
        </button>
        <p className="text-center text-[11px] text-[#3a4a70] mt-2">
          תישאר/י בדף ההגדרות
        </p>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Verify the file exists and TypeScript compiles**

Run from the project root:
```bash
npx tsc --noEmit
```
Expected: no errors. If you see type errors about `React.ReactNode`, add `import React from "react";` at the top of the file.

- [ ] **Step 3: Commit**

```bash
git add app/(app)/settings/JobWizard.tsx
git commit -m "feat: add JobWizard component — 6-step guided job setup overlay"
```

---

## Task 2: Wire `JobWizard` into `settings/page.tsx`

**Files:**
- Modify: `app/(app)/settings/page.tsx`

- [ ] **Step 1: Add the import at the top of the file**

In `app/(app)/settings/page.tsx`, after the existing imports, add:

```tsx
import JobWizard from "./JobWizard";
```

- [ ] **Step 2: Add wizard state to `SettingsPage`**

Inside `SettingsPage`, after the existing `useState` declarations, add:

```tsx
const [wizardOpen, setWizardOpen] = useState(false);
```

- [ ] **Step 3: Replace `addJob` with `openWizard`**

Remove the existing `addJob` function:
```tsx
// DELETE this entire function:
const addJob = async () => {
  const color = JOB_COLORS[jobs.length % JOB_COLORS.length];
  const job = defaultJob({ name: `משרה ${jobs.length + 1}`, color });
  await db.jobs.add(job);
  setJobs((prev) => [...prev, job]);
  setExpandedId(job.id);
};
```

Replace it with:
```tsx
const wizardColor = JOB_COLORS[jobs.length % JOB_COLORS.length];
const openWizard = () => setWizardOpen(true);
```

- [ ] **Step 4: Update the "הוסף/י משרה" button to call `openWizard`**

Find the button that calls `addJob` and change `onClick={addJob}` to `onClick={openWizard}`:

```tsx
<button
  onClick={openWizard}
  className="w-full py-3.5 border-2 border-dashed rounded-2xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 text-[#3E5672] hover:text-[#6B8FAA]"
  style={{ borderColor: "rgba(255,255,255,0.12)", background: "transparent" }}
>
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
    <path d="M12 5v14M5 12h14" />
  </svg>
  הוסף/י משרה
</button>
```

- [ ] **Step 5: Render `<JobWizard>` at the bottom of the `SettingsPage` return**

Just before the closing `</div>` of the page return, add:

```tsx
<JobWizard
  open={wizardOpen}
  initialColor={wizardColor}
  onClose={(job) => {
    if (job) {
      setJobs((prev) => [...prev, job]);
    }
    setWizardOpen(false);
  }}
/>
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 7: Run the dev server and test manually**

```bash
npm run dev
```

Open the app at `http://localhost:3000`. Navigate to Settings. Tap "הוסף/י משרה". Verify:
- The wizard slides up from the bottom
- All 6 steps are reachable via the Next button
- "דלג/י" advances the step without changing values from defaults
- Back button returns to the previous step
- "ערוך" links in the summary jump to the correct step
- Saving on the summary screen closes the wizard and the new job appears in the settings list
- Opening the wizard a second time shows fresh defaults (not the previous draft)

- [ ] **Step 8: Commit**

```bash
git add app/(app)/settings/page.tsx
git commit -m "feat: wire JobWizard into settings page — replace addJob with guided wizard"
```
