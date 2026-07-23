"use client";

import { useEffect, useState } from "react";
import { db, defaultJob } from "@/lib/db";
import type { Job } from "@/lib/db";
import { ISRAELI_CITIES, getAppSettings, saveAppSettings, fetchAndCache, fetchHolidayDatesAndCache } from "@/lib/hebcal";
import JobWizard from "./JobWizard";

type Field = {
  key: keyof Job;
  label: string;
  type: "text" | "number" | "toggle" | "percent";
  hint?: string;
  step?: number;
  max?: number;
};

const topFields: Field[] = [
  { key: "name", label: "שם משרה", type: "text" },
  { key: "baseHourlyRate", label: "שכר שעתי בסיסי (₪)", type: "number", step: 0.5, max: 5000 },
];

const rateFields: Field[] = [
  { key: "dailyNormHours", label: "נורמת שעות יומית", type: "number", step: 0.1, max: 24, hint: "מעל מספר שעות זה מתחילות שעות נוספות. לפי חוק: 8.6 שע׳ (43ש׳ ÷ 5 ימים)." },
  { key: "weekendMultiplier", label: "תוספת שישי/שבת (פקטור)", type: "number", step: 0.05, max: 5, hint: "פקטור על כל שעות העבודה בשבת ובשישי לאחר כניסת שבת. מינימום חוקי: 1.5×." },
  { key: "holidayMultiplier", label: "תוספת חג (פקטור)", type: "number", step: 0.05, max: 5, hint: "פקטור על שעות עבודה בימי חג רשמיים. מינימום חוקי: 1.5×." },
  { key: "overtime1Multiplier", label: "שעות נוספות 1-2 (פקטור)", type: "number", step: 0.05, max: 5, hint: "שכר לשעתיים הראשונות מעל הנורמה. מינימום חוקי: 1.25×." },
  { key: "overtime2Multiplier", label: "שעות נוספות 3+ (פקטור)", type: "number", step: 0.05, max: 5, hint: "שכר משעה שלישית ואילך מעל הנורמה. מינימום חוקי: 1.5×." },
];

const taxField: Field = { key: "taxCreditPoints", label: "נקודות זיכוי", type: "number", step: 0.25, max: 20, hint: "ברירת מחדל: 2.25 לתושב/ת ישראל רווק/ה" };
const commuteSubField: Field = { key: "commuteDaily", label: "נסיעות יומיות (₪)", type: "number", step: 0.1, max: 1000, hint: "ברירת מחדל: ₪22.60 ליום" };
const JOB_COLORS = ["#B45309", "#65A30D", "#CA8A04"];

const pensionSubFields: Field[] = [
  { key: "pensionEmployeePercent", label: "הפרשת עובד/ת (%)", type: "percent", max: 50, hint: "ברירת מחדל: 6%" },
  { key: "pensionEmployerPercent", label: "תגמולים מעסיק (%)", type: "percent", max: 50, hint: "ברירת מחדל: 6.5%" },
  { key: "pensionSeverancePercent", label: "פיצויים מעסיק (%)", type: "percent", max: 50, hint: "ברירת מחדל: 6%" },
];

const inputBase = "border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#3B7FF5]/50 bg-[#0C1221] text-[#E8EEFF]";
const inputBorder = { borderColor: "rgba(255,255,255,0.15)" };

function JobForm({ job, onSave, onDelete }: { job: Job; onSave: (j: Job) => void; onDelete: (id: string) => void }) {
  const [form, setForm] = useState<Job>({ ...defaultJob(), ...job });
  const [saved, setSaved] = useState(false);
  const [ratesOpen, setRatesOpen] = useState(false);
  const [commuteOpen, setCommuteOpen] = useState(false);
  const [pensionOpen, setPensionOpen] = useState(false);
  const [taxOpen, setTaxOpen] = useState(false);

  const set = (key: keyof Job, value: unknown) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleSave = async () => {
    await db.jobs.put(form);
    onSave(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const rowBorder = { borderColor: "rgba(255,255,255,0.08)" };

  const renderField = (field: Field) => {
    const value = form[field.key];
    return (
      <div key={field.key} className="px-4 py-3 border-b last:border-0" style={rowBorder}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <label className="block text-sm font-medium text-[#E8EEFF]">{field.label}</label>
            {field.hint && <p className="text-xs text-[#3E5672] mt-0.5 leading-relaxed">{field.hint}</p>}
          </div>
          {field.type === "toggle" ? (
            <button
              onClick={() => set(field.key, !value)}
              className={`relative flex-none w-12 h-6 rounded-full transition-colors ${value ? "bg-[#3B7FF5]" : "bg-[#3E5672]"}`}
            >
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${value ? "right-0.5" : "left-0.5"}`} />
            </button>
          ) : field.type === "text" ? (
            <input
              type="text"
              value={value as string}
              onChange={(e) => set(field.key, e.target.value)}
              onFocus={(e) => e.target.select()}
              className={`w-40 text-right ${inputBase}`}
              style={inputBorder}
            />
          ) : (
            <input
              type="number"
              value={value as number}
              step={field.step ?? 1}
              min={0}
              max={field.max}
              onChange={(e) => set(field.key, parseFloat(e.target.value) || 0)}
              onFocus={(e) => e.target.select()}
              className={`w-28 text-center ${inputBase}`}
              style={inputBorder}
            />
          )}
        </div>
      </div>
    );
  };

  const sectionHeader = (label: string, isOpen: boolean, toggle: () => void) => (
    <button
      onClick={toggle}
      className="w-full flex items-center justify-between px-4 py-3 border-b transition-colors"
      style={{ background: "#1C2B4A", borderColor: "rgba(255,255,255,0.08)" }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "#243355")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "#1C2B4A")}
    >
      <span className="text-sm font-bold text-[#E8EEFF]">{label}</span>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={`w-4 h-4 text-[#6B8FAA] transition-transform ${isOpen ? "rotate-180" : ""}`}>
        <path d="m6 9 6 6 6-6" />
      </svg>
    </button>
  );

  return (
    <div className="bg-[#162038] rounded-2xl border overflow-hidden" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
      {topFields.map(renderField)}

      {sectionHeader("הגדרת תעריפי שבת/חג/שע׳ נוספות", ratesOpen, () => setRatesOpen((o) => !o))}
      {ratesOpen && rateFields.map(renderField)}

      {sectionHeader("נקודות זיכוי במס", taxOpen, () => setTaxOpen((o) => !o))}
      {taxOpen && (
        <>
          {renderField(taxField)}
          <div className="px-4 py-3 border-b" style={{ background: "#111C32", borderColor: "rgba(255,255,255,0.08)" }}>
            <p className="text-xs text-[#6B8FAA] leading-relaxed">
              לא יודע/ת כמה נקודות זיכוי יש לך? ניתן לבדוק בתלוש השכר האחרון שלך.
            </p>
            <a
              href="https://secapp.taxes.gov.il/srsimulatorNZ/#/simulator"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-2 text-xs font-medium text-[#3B7FF5] underline underline-offset-2"
              onClick={(e) => e.stopPropagation()}
            >
              סימולטור נקודות זיכוי — רשות המסים ←
            </a>
          </div>
        </>
      )}

      {sectionHeader("נסיעות", commuteOpen, () => setCommuteOpen((o) => !o))}
      {commuteOpen && (
        <>
          <div className="px-4 py-3 border-b flex items-center justify-between gap-3" style={rowBorder}>
            <label className="text-sm font-medium text-[#E8EEFF]">הפעל/י נסיעות</label>
            <button
              onClick={() => set("commuteEnabled", !form.commuteEnabled)}
              className={`relative flex-none w-12 h-6 rounded-full transition-colors ${form.commuteEnabled ? "bg-[#3B7FF5]" : "bg-[#3E5672]"}`}
            >
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${form.commuteEnabled ? "right-0.5" : "left-0.5"}`} />
            </button>
          </div>
          {renderField(commuteSubField)}
          <div className="px-4 py-3 border-b" style={{ background: "#111C32", borderColor: "rgba(255,255,255,0.08)" }}>
            <p className="text-xs text-[#6B8FAA] leading-relaxed">
              על פי חוק, המעסיק חייב לשלם החזר נסיעות בגובה עלות התחבורה הציבורית הזולה ביותר. הסכום המקסימלי: ₪22.60 ליום.
            </p>
          </div>
        </>
      )}

      {sectionHeader("פנסיה", pensionOpen, () => setPensionOpen((o) => !o))}
      {pensionOpen && (
        <>
          <div className="px-4 py-3 border-b flex items-center justify-between gap-3" style={rowBorder}>
            <label className="text-sm font-medium text-[#E8EEFF]">הפעל/י פנסיה</label>
            <button
              onClick={() => set("pensionEnabled", !form.pensionEnabled)}
              className={`relative flex-none w-12 h-6 rounded-full transition-colors ${form.pensionEnabled ? "bg-[#3B7FF5]" : "bg-[#3E5672]"}`}
            >
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${form.pensionEnabled ? "right-0.5" : "left-0.5"}`} />
            </button>
          </div>
          {pensionSubFields.map(renderField)}
          <div className="px-4 py-3 border-b" style={{ background: "#111C32", borderColor: "rgba(255,255,255,0.08)" }}>
            <p className="text-xs text-[#6B8FAA] leading-relaxed">
              פנסיה חובה חלה על כל עובד/ת שכיר/ה. סה״כ 18.5% מהשכר: 6% עובד, 6.5% תגמולים + 6% פיצויים ממעסיק.
            </p>
          </div>
        </>
      )}

      <div className="px-4 py-4 flex gap-3" style={{ background: "rgba(255,255,255,0.02)" }}>
        <button
          onClick={() => onDelete(job.id)}
          className="flex-none text-sm font-medium text-red-400 border border-red-500/40 px-4 py-2 rounded-xl hover:bg-red-900/20 transition-colors"
        >
          מחק/י משרה
        </button>
        <button
          onClick={handleSave}
          className={`flex-1 text-sm font-semibold py-2 rounded-xl transition-colors ${
            saved ? "bg-green-600 text-white" : "bg-[#3B7FF5] text-white hover:bg-[#2B6EE0]"
          }`}
        >
          {saved ? "✓ נשמר" : "שמור/י"}
        </button>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [cityId, setCityId] = useState<number>(293397);
  const [syncStatus, setSyncStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [shabbatOpen, setShabbatOpen] = useState(false);
  const [hasSynced, setHasSynced] = useState(true);
  const [infoOpen, setInfoOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);

  useEffect(() => {
    if (localStorage.getItem("settingsInfoDismissed") !== "1") setInfoOpen(true);
  }, []);

  useEffect(() => {
    db.jobs.toArray().then(async (j) => {
      const sorted = j.slice().sort((a, b) => a.name.localeCompare(b.name, "he"));
      const colored = sorted.map((job, i) => ({ ...job, color: JOB_COLORS[i % JOB_COLORS.length] }));
      await Promise.all(colored.map((job) => db.jobs.put(job)));
      setJobs(colored);
    });
    getAppSettings().then((s) => setCityId(s.cityId));
    db.shabbatCache.count().then((n) => setHasSynced(n > 0));
  }, []);

  const handleCityChange = async (newCityId: number) => {
    setCityId(newCityId);
    const city = ISRAELI_CITIES.find((c) => c.id === newCityId)!;
    await saveAppSettings(newCityId, city.name);
  };

  const handleSync = async () => {
    setSyncStatus("loading");
    try {
      const year = new Date().getFullYear();
      await Promise.all([
        fetchAndCache(year, cityId),
        fetchAndCache(year + 1, cityId),
        fetchHolidayDatesAndCache(year, cityId),
        fetchHolidayDatesAndCache(year + 1, cityId),
      ]);
      setSyncStatus("ok");
      setHasSynced(true);
      setTimeout(() => setSyncStatus("idle"), 3000);
    } catch {
      setSyncStatus("error");
      setTimeout(() => setSyncStatus("idle"), 3000);
    }
  };

  const wizardColor = JOB_COLORS[jobs.length % JOB_COLORS.length];
  const openWizard = () => setWizardOpen(true);

  const handleSave = (updated: Job) => {
    setJobs((prev) => prev.map((j) => (j.id === updated.id ? updated : j)));
    setExpandedId(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("למחוק את המשרה וכל המשמרות שלה?")) return;
    await db.jobs.delete(id);
    await db.shifts.where("jobId").equals(id).delete();
    setJobs(jobs.filter((j) => j.id !== id));
    setExpandedId(null);
  };

  return (
    <div className="flex flex-col min-h-full" dir="rtl">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
        <div className="relative flex items-center justify-center">
          <div className="w-8" />
          <h1 className="text-xl font-bold text-[#E8EEFF]">הגדרות משרה</h1>
          <button
            onClick={() => { setInfoOpen(true); localStorage.removeItem("settingsInfoDismissed"); }}
            className="absolute right-0 w-7 h-7 rounded-full bg-[#FF6B2C]/15 text-[#FF6B2C] border border-[#FF6B2C]/50 hover:border-[#FF6B2C] hover:bg-[#FF6B2C]/25 flex items-center justify-center text-sm font-bold transition-all"
          >
            ?
          </button>
        </div>
        <p className="text-sm text-[#6B8FAA] mt-0.5">הגדירו את פרטי המשרה לחישוב שכר מדויק</p>
      </div>

      <div className="p-4 space-y-4">
        {jobs.map((job) => (
          <div key={job.id}>
            {expandedId === job.id ? (
              <JobForm job={job} onSave={handleSave} onDelete={handleDelete} />
            ) : (
              <div
                className="flex items-center justify-between px-4 py-3 rounded-2xl mb-2 border"
                style={{ backgroundColor: `${job.color}18`, borderColor: job.color }}
              >
                <span className="text-sm font-medium text-[#E8EEFF]">{job.name}</span>
                <button
                  onClick={() => setExpandedId(job.id)}
                  className="text-sm font-medium text-[#3B7FF5] hover:text-[#6AADFF] underline transition-colors"
                >
                  פתיחת הגדרות משרה
                </button>
              </div>
            )}
          </div>
        ))}

        {/* Add job button */}
        <button
          onClick={openWizard}
          className="w-full py-3.5 border-2 border-dashed rounded-2xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 text-[#3E5672] hover:text-[#6B8FAA]"
          style={{ borderColor: "rgba(255,255,255,0.12)", background: "transparent" }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
            <path d="M12 5v14M5 12h14" />
          </svg>
          הוסיפו משרה
        </button>

        {/* Shabbat sync */}
        <div className="bg-[#162038] border rounded-2xl overflow-hidden" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
          <button
            onClick={() => setShabbatOpen((o) => !o)}
            className="w-full flex items-center justify-between px-4 py-3 transition-colors"
            style={{ background: "#1C2B4A" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#243355")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#1C2B4A")}
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-[#3B7FF5] underline">הגדירו זמני כניסת שבת וחגים</span>
              {hasSynced
                ? <span className="text-xs text-green-400 font-medium">✓ סונכרן</span>
                : <span className="text-xs text-amber-400 font-medium">! לא סונכרן</span>
              }
            </div>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={`w-4 h-4 text-[#6B8FAA] transition-transform ${shabbatOpen ? "rotate-180" : ""}`}>
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
          {shabbatOpen && (
            <div className="px-4 py-3 space-y-3">
              <div>
                <label className="block text-xs text-[#6B8FAA] mb-1.5">עיר מגורים</label>
                <select
                  value={cityId}
                  onChange={(e) => handleCityChange(Number(e.target.value))}
                  className="w-full border rounded-xl px-3 py-2.5 text-sm text-[#E8EEFF] focus:outline-none focus:ring-2 focus:ring-[#3B7FF5]/50 bg-[#0C1221]"
                  style={{ borderColor: "rgba(255,255,255,0.15)" }}
                >
                  {ISRAELI_CITIES.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleSync}
                disabled={syncStatus === "loading"}
                className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                  syncStatus === "ok"
                    ? "bg-green-600 text-white"
                    : syncStatus === "error"
                    ? "bg-red-500 text-white"
                    : "bg-[#3B7FF5] text-white hover:bg-[#2B6EE0] disabled:opacity-60"
                }`}
              >
                {syncStatus === "loading" && "מוריד זמני שבת וחגים..."}
                {syncStatus === "ok" && "✓ שבתות וחגים עודכנו"}
                {syncStatus === "error" && "שגיאה — נסו שוב"}
                {syncStatus === "idle" && "סנכרנו שבתות וחגים לשנה הנוכחית"}
              </button>
              <div className="rounded-xl p-3" style={{ background: "#111C32" }}>
                <p className="text-xs text-[#6B8FAA] leading-relaxed">
                  פעולה חד-פעמית — לאחר הסנכרון הנתונים נשמרים ואין צורך לחזור עליה. האפליקציה משתמשת בזמני כניסת שבת המדויקים לפי עיר המגורים. ללא סנכרון, ברירת המחדל היא 19:00.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Info modal */}
      {infoOpen && (
        <>
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={() => { setInfoOpen(false); localStorage.setItem("settingsInfoDismissed", "1"); }} />
          <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 bg-[#162038] border rounded-2xl shadow-2xl max-w-[400px] mx-auto p-6" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
            <h2 className="text-base font-bold text-[#E8EEFF] mb-4">הגדרות — איך מגדירים משרה?</h2>
            <div className="space-y-4">
              <div>
                <p className="text-sm font-semibold text-[#E8EEFF] mb-1">הגדרת משרה</p>
                <p className="text-sm text-[#6B8FAA] leading-relaxed">הגדירו שכר שעתי, שעות נוספות ונסיעות. האפליקציה תשתמש בנתונים אלה לכל חישובי השכר.</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-[#E8EEFF] mb-1">כמה משרות</p>
                <p className="text-sm text-[#6B8FAA] leading-relaxed">אפשר להוסיף מספר משרות — למשל שתי עבודות במקביל.</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-[#E8EEFF] mb-1">סנכרון שבת וחגים</p>
                <p className="text-sm text-[#6B8FAA] leading-relaxed">מומלץ לסנכרן כדי שחישובי שישי/שבת וחגים יהיו מדויקים.</p>
              </div>
              <p className="text-sm text-[#6B8FAA] leading-relaxed">לאחר שמירה, כל החישובים באפליקציה מתעדכנים אוטומטית.</p>
            </div>
            <button
              onClick={() => { setInfoOpen(false); localStorage.setItem("settingsInfoDismissed", "1"); }}
              className="mt-6 w-full py-2.5 bg-[#3B7FF5] hover:bg-[#2B6EE0] text-white text-sm font-semibold rounded-xl transition-colors"
            >
              הבנתי
            </button>
          </div>
        </>
      )}

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
    </div>
  );
}
