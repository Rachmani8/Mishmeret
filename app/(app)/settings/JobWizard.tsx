"use client";

import React, { useState, useEffect } from "react";
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

  const progressPct = step === 0 ? 0 : step >= 7 ? 100 : Math.round((step / STEP_COUNT) * 100);

  const nextLabel = step === 0 ? "בואו נתחיל" : step === 6 ? "סיכום" : "הבא";
  const nextClass = "bg-gradient-to-l from-[#2a5bd4] to-[#5b9af5]";

  return (
    <div
      className={`fixed inset-y-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] z-[100] flex flex-col bg-[#0d1220] transition-transform duration-300 ${
        open ? "translate-y-0" : "translate-y-full"
      }`}
      aria-hidden={!open}
      dir="rtl"
    >
      {/* Progress bar — hidden on welcome and summary */}
      {step > 0 && step < 7 && (
        <div className="px-5 pt-12 pb-0">
          <div className="flex mb-2.5">
            <span className="text-[11px] text-[#a8b8d0] tracking-wide">
              שלב {step} מתוך {STEP_COUNT}
            </span>
          </div>
          <div className="flex gap-1">
            {Array.from({ length: STEP_COUNT }).map((_, i) => (
              <div
                key={i}
                className="flex-1 h-1.5 rounded-full border transition-all duration-300"
                style={{
                  borderColor: i < step ? "#5b9af5" : "#2a3050",
                  background: i < step
                    ? "linear-gradient(90deg, #3b6fd4, #5b9af5)"
                    : "#1a2038",
                }}
              />
            ))}
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
          <StepSummary draft={draft} onGoTo={goTo} />
        )}
      </div>

      {/* Nav buttons — always visible */}
      <div
        className="flex-none flex gap-2.5 px-5 pt-2"
        style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
      >
        <button
          onClick={step === 0 ? () => onClose() : back}
          className="w-12 h-12 flex-none flex items-center justify-center rounded-2xl text-[#a8b8d0] text-lg"
          style={{ background: "#1a2540", border: "1.5px solid #243050" }}
        >
          →
        </button>
        {step < 7 ? (
          <button
            onClick={next}
            className={`flex-1 h-12 rounded-2xl text-white text-[15px] font-bold flex items-center justify-center gap-2 ${nextClass}`}
          >
            {nextLabel}
          </button>
        ) : (
          <button
            onClick={handleSave}
            className="flex-1 h-12 rounded-2xl text-white text-[15px] font-bold flex items-center justify-center gap-2 bg-gradient-to-l from-[#1a8a50] to-[#2ac870]"
          >
            ✓ שמרו משרה
          </button>
        )}
      </div>
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
      <p className="text-[12px] text-[#9ab5e0] leading-relaxed">{children}</p>
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
        {sub && <div className="text-[11px] text-[#a8b8d0] mt-0.5">{sub}</div>}
      </div>
      <ToggleSwitch on={on} onToggle={onToggle} />
    </div>
  );
}

// ── Shared input style constants ─────────────────────────────────

const INPUT_CLS_BASE =
  "text-center border rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#3B7FF5]/50 bg-[#0C1221] text-[#E8EEFF]";
const INPUT_STYLE = { borderColor: "rgba(255,255,255,0.15)" };

// ── Steps ────────────────────────────────────────────────────────

function StepWelcome() {
  return (
    <div className="text-center pt-8 pb-4">
      <div className="text-5xl mb-4">👋</div>
      <h2 className="text-[22px] font-extrabold text-[#dde4f8] leading-tight mb-3">
        בואו נגדיר<br />את המשרה שלכם
      </h2>
      <p className="text-[13px] text-[#a8b8d0] leading-relaxed mb-8">
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
              <div className="text-[11px] text-[#a8b8d0]">{item.sub}</div>
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
        זה רק לזיהוי — למשל{" "}
        <strong className="text-[#5b9af5]">״עבודה ראשית״</strong> או{" "}
        <strong className="text-[#5b9af5]">״עבודה שנייה״</strong>. ניתן לשנות בכל עת.
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
        <strong className="text-[#5b9af5]">32.30 ₪</strong> לשעה. לא בטוחים? אפשר לשנות אחר כך.
      </TipBox>
      <div
        className="flex items-center gap-3 px-4 py-4 rounded-2xl mb-3"
        style={{ background: "#1a2540", border: "1.5px solid #243050" }}
      >
        <button
          onClick={() => adj(-1)}
          className="w-11 h-11 flex-none rounded-xl flex items-center justify-center text-2xl text-[#a8b8d0]"
          style={{ background: "#0d1220", border: "1px solid #243050" }}
        >
          −
        </button>
        <div className="flex-1 flex items-center justify-center gap-1.5">
          <input
            type="number"
            value={value}
            min={0}
            step={1}
            onChange={(e) => onChange(Math.max(0, parseFloat(e.target.value) || 0))}
            onFocus={(e) => e.target.select()}
            className="w-24 text-center text-[32px] font-extrabold text-[#dde4f8] bg-transparent focus:outline-none tabular-nums"
          />
          <span className="text-[13px] text-[#a8b8d0]">₪/שע׳</span>
        </div>
        <button
          onClick={() => adj(1)}
          className="w-11 h-11 flex-none rounded-xl flex items-center justify-center text-2xl text-[#5b9af5]"
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
      <span className="text-[13px] text-[#a8b8d0]">{label}</span>
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
  return (
    <>
      <StepEyebrow>שעות עבודה</StepEyebrow>
      <StepHeading>תעריפי שעות<br />נוספות ותוספות</StepHeading>
      <TipBox>
        כל הערכים מטה הם{" "}
        <strong className="text-[#5b9af5]">לפי החוק הישראלי</strong>. אם המעסיק לא קבע אחרת — אפשר לאשר ולהמשיך.
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
            רוצים לשנות ערכים? לחצו כאן
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
            <span className="text-[13px] text-[#a8b8d0]">{label}</span>
            <input
              type="number"
              value={draft[key] as number}
              step={step}
              min={0}
              onChange={(e) => onChange(key, parseFloat(e.target.value) || 0)}
              onFocus={(e) => e.target.select()}
              className={`w-24 ${INPUT_CLS_BASE}`}
              style={INPUT_STYLE}
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
      <StepHeading>כמה נקודות<br />זיכוי יש לכם?</StepHeading>
      <TipBox>
        נקודת זיכוי = <strong className="text-[#5b9af5]">223 ₪</strong> פחות מס בחודש.
        לתושבי ישראל —{" "}
        <strong className="text-[#5b9af5]">2.25 נקודות</strong> מינימום. ניתן לבדוק בתלוש האחרון.
      </TipBox>

      <div className="flex items-center justify-center gap-3 mb-3">
        <button
          onClick={() => adj(-0.25)}
          className="w-12 h-12 flex items-center justify-center rounded-2xl text-2xl text-[#a8b8d0]"
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
      <p className="text-center text-[12px] text-[#a8b8d0] mb-4">
        ברירת מחדל: 2.25 (תושבי ישראל)
      </p>
      <a
        href="https://www.hon.co.il/%d7%9e%d7%97%d7%a9%d7%91%d7%95%d7%9f-%d7%a0%d7%a7%d7%95%d7%93%d7%95%d7%aa-%d7%96%d7%99%d7%9b%d7%95%d7%99/"
        target="_blank"
        rel="noopener noreferrer"
        className="block px-3 py-2.5 rounded-xl text-[11px]"
        style={{ background: "#131b2e", border: "1px solid #1a2540", color: "#5b9af5" }}
      >
        <div className="text-[#a8b8d0] mb-0.5">רוצים לבדוק כמה נקודות זיכוי מגיעות לכם?</div>
        🔗 <span className="underline underline-offset-2">סימולטור נקודות זיכוי</span>
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
        לפי העלות בפועל של התחבורה הציבורית (הזולה ביותר הנדרשת להגעה לעבודה), ובלבד שאינו עולה על תקרה מקסימלית של{" "}
        <strong className="text-[#5b9af5]">22.60 ₪ ליום עבודה</strong>.
      </TipBox>
      <ToggleRow label="הפעילו נסיעות" sub="יתווסף לכל משמרת" on={enabled} onToggle={onToggle} />
      {enabled && (
        <div
          className="flex justify-between items-center py-2.5"
          style={{ borderColor: "rgba(255,255,255,0.08)" }}
        >
          <span className="text-[13px] text-[#a8b8d0]">סכום יומי (₪)</span>
          <input
            type="number"
            value={daily}
            step={0.1}
            min={0}
            max={1000}
            onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
            onFocus={(e) => e.target.select()}
            className={`w-24 ${INPUT_CLS_BASE}`}
            style={INPUT_STYLE}
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
  const rowBorder = { borderColor: "rgba(255,255,255,0.08)" };

  return (
    <>
      <StepEyebrow>פנסיה</StepEyebrow>
      <StepHeading>הגדרות<br />פנסיה</StepHeading>
      <TipBox>
        פנסיה חובה על כל העובדים השכירים. סה&quot;כ{" "}
        <strong className="text-[#5b9af5]">18.5% מהשכר</strong> — המעסיק משלם 12.5%,
        העובד/ת 6%.
      </TipBox>
      <ToggleRow label="הפעילו פנסיה" sub="חובה על פי חוק" on={enabled} onToggle={onToggle} />
      {enabled && (
        <>
          <div
            className="flex justify-between items-center px-4 py-2.5 rounded-xl mt-3 mb-2"
            style={{ background: "rgba(52,196,122,0.07)", border: "1px solid rgba(52,196,122,0.15)" }}
          >
            <span className="text-[13px] text-[#a8b8d0]">סה&quot;כ הפרשה לפנסיה</span>
            <span className="text-[18px] font-extrabold text-[#34c47a]">
              {total.toFixed(1)}%
            </span>
          </div>
          {[
            { label: "חלק העובד/ת (%)", value: employee, onChange: onEmployee },
            { label: "תגמולים מעסיק (%)", value: employer, onChange: onEmployer },
            { label: "פיצויים מעסיק (%)", value: severance, onChange: onSeverance },
          ].map(({ label, value, onChange }) => (
            <div
              key={label}
              className="flex justify-between items-center py-2.5 border-b last:border-0"
              style={rowBorder}
            >
              <span className="text-[13px] text-[#a8b8d0]">{label}</span>
              <input
                type="number"
                value={value}
                step={0.5}
                min={0}
                max={50}
                onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
                onFocus={(e) => e.target.select()}
                className={`w-20 ${INPUT_CLS_BASE}`}
                style={INPUT_STYLE}
              />
            </div>
          ))}
        </>
      )}
    </>
  );
}

const SUMMARY_ROW_BORDER = { borderColor: "rgba(255,255,255,0.08)" };

function SummarySection({ title, children, onEdit }: { title: string; children: React.ReactNode; onEdit?: () => void }) {
  return (
    <div
      className="rounded-2xl overflow-hidden mb-3"
      style={{ background: "#1a2540", border: "1px solid #1a2038" }}
    >
      <div
        className="px-4 py-2.5 text-[12px] font-semibold text-[#dde4f8] border-b underline underline-offset-2 flex items-center gap-2"
        style={SUMMARY_ROW_BORDER}
      >
        <EditIcon onEdit={onEdit} />
        <span className="flex-1">{title}</span>
      </div>
      {children}
    </div>
  );
}

function EditIcon({ onEdit }: { onEdit?: () => void }) {
  if (!onEdit) return <span className="w-3.5 h-3.5 inline-block" />;
  return (
    <button onClick={onEdit} className="text-[#5b9af5] opacity-70 hover:opacity-100 transition-opacity flex-none">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
      </svg>
    </button>
  );
}

function SummaryRow({
  label, value, onEdit,
}: {
  label: string; value: string; onEdit?: () => void;
}) {
  return (
    <div
      className="flex items-center px-4 py-2.5 border-b last:border-0 gap-2"
      style={SUMMARY_ROW_BORDER}
    >
      <EditIcon onEdit={onEdit} />
      <span className="text-[12px] text-[#a8b8d0] flex-1">{label}</span>
      <span className="text-[13px] font-bold text-[#dde4f8]">{value}</span>
    </div>
  );
}

function StepSummary({
  draft, onGoTo,
}: {
  draft: Job; onGoTo: (s: number) => void;
}) {
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
        <p className="text-[12px] text-[#a8b8d0]">בדקו ואשרו את הגדרות המשרה</p>
      </div>

      <SummarySection title="בסיס">
        <SummaryRow label="שם משרה" value={draft.name || "משרה ראשית"} onEdit={() => onGoTo(1)} />
        <SummaryRow label="שכר שעתי" value={`${draft.baseHourlyRate} ₪/שע׳`} onEdit={() => onGoTo(2)} />
      </SummarySection>

      <SummarySection title="שעות עבודה" onEdit={() => onGoTo(3)}>
        <SummaryRow label="נורמת יומית" value={`${draft.dailyNormHours} שע׳`} />
        <SummaryRow label="שישי/שבת/חג" value={`${draft.weekendMultiplier}×`} />
        <SummaryRow label="שע׳ נוספות" value={`${draft.overtime1Multiplier}× / ${draft.overtime2Multiplier}×`} />
      </SummarySection>

      <SummarySection title="תוספות ומס">
        <SummaryRow
          label="נקודות זיכוי"
          value={String(draft.taxCreditPoints)}
          onEdit={() => onGoTo(4)}
        />
        <SummaryRow
          label="נסיעות"
          value={draft.commuteEnabled ? `${draft.commuteDaily} ₪/יום ✓` : "ללא"}
          onEdit={() => onGoTo(5)}
        />
        <SummaryRow
          label="פנסיה סה״כ"
          value={draft.pensionEnabled ? `${pensionTotal}% ✓` : "ללא"}
          onEdit={() => onGoTo(6)}
        />
      </SummarySection>

      <div className="pb-4">
        <p className="text-center text-[11px] text-[#a8b8d0]">
          לחצו על שמרו למטה לסיום
        </p>
      </div>
    </>
  );
}
