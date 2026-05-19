"use client";

import { useEffect, useState } from "react";
import { db, defaultJob } from "@/lib/db";
import type { Job } from "@/lib/db";
import { ISRAELI_CITIES, getAppSettings, saveAppSettings, fetchAndCache, fetchHolidayDatesAndCache } from "@/lib/hebcal";

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
  { key: "dailyNormHours", label: "נורמת שעות יומית", type: "number", step: 0.1, max: 24, hint: "מעל מספר שעות זה מתחילות שעות נוספות. לפי חוק: 8.6 שע׳ (43ש׳ ÷ 5 ימים). ייתכן שחוזה העבודה שלך קובע נורמה אחרת." },
  { key: "weekendMultiplier", label: "תוספת שישי/שבת (פקטור)", type: "number", step: 0.05, max: 5, hint: "פקטור על כל שעות העבודה בשבת ובשישי לאחר כניסת שבת. המינימום החוקי: 1.5×." },
  { key: "holidayMultiplier", label: "תוספת חג (פקטור)", type: "number", step: 0.05, max: 5, hint: "פקטור על שעות עבודה בימי חג רשמיים לפי חוק. המינימום החוקי: 1.5×." },
  { key: "overtime1Multiplier", label: "שעות נוספות 1-2 (פקטור)", type: "number", step: 0.05, max: 5, hint: "שכר לשעתיים הראשונות מעל הנורמה היומית. המינימום החוקי: 1.25×." },
  { key: "overtime2Multiplier", label: "שעות נוספות 3+ (פקטור)", type: "number", step: 0.05, max: 5, hint: "שכר משעה שלישית ואילך מעל הנורמה היומית. המינימום החוקי: 1.5×." },
];

const taxField: Field = { key: "taxCreditPoints", label: "נקודות זיכוי", type: "number", step: 0.25, max: 20, hint: "ברירת מחדל: 2.25 לתושב/ת ישראל רווק/ה" };
const commuteSubField: Field = { key: "commuteDaily", label: "נסיעות יומיות (₪)", type: "number", step: 0.1, max: 1000, hint: "ברירת מחדל: ₪22.60 ליום" };
const JOB_COLORS = ["#B45309", "#65A30D", "#CA8A04"]; // amber, lime, golden yellow — by job order

const pensionSubFields: Field[] = [
  { key: "pensionEmployeePercent", label: "הפרשת עובד/ת (%)", type: "percent", max: 50, hint: "ברירת מחדל: 6%" },
  { key: "pensionEmployerPercent", label: "תגמולים מעסיק (%)", type: "percent", max: 50, hint: "ברירת מחדל: 6.5%" },
  { key: "pensionSeverancePercent", label: "פיצויים מעסיק (%)", type: "percent", max: 50, hint: "ברירת מחדל: 6%" },
];

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

  const renderField = (field: Field) => {
    const value = form[field.key];
    return (
      <div key={field.key} className="px-4 py-3 border-b border-gray-200 last:border-0">
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <label className="block text-sm font-medium text-gray-800">{field.label}</label>
            {field.hint && <p className="text-xs text-gray-400 mt-0.5">{field.hint}</p>}
          </div>
          {field.type === "toggle" ? (
            <button
              onClick={() => set(field.key, !value)}
              className={`relative flex-none w-12 h-6 rounded-full transition-colors ${value ? "bg-blue-600" : "bg-gray-200"}`}
            >
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${value ? "right-0.5" : "left-0.5"}`} />
            </button>
          ) : field.type === "text" ? (
            <input
              type="text"
              value={value as string}
              onChange={(e) => set(field.key, e.target.value)}
              onFocus={(e) => e.target.select()}
              className="w-40 border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              className="w-28 border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      {topFields.map(renderField)}

      {/* Collapsible rates section */}
      <button
        onClick={() => setRatesOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-100 hover:bg-gray-200 transition-colors"
      >
        <span className="text-sm font-bold text-gray-800">הגדרת תעריפי שבת/חג/שע׳ נוספות</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={`w-4 h-4 text-gray-500 transition-transform ${ratesOpen ? "rotate-180" : ""}`}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {ratesOpen && rateFields.map(renderField)}

      {/* Tax credit points section */}
      <button
        onClick={() => setTaxOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-100 hover:bg-gray-200 transition-colors"
      >
        <span className="text-sm font-bold text-gray-800">נקודות זיכוי במס</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={`w-4 h-4 text-gray-500 transition-transform ${taxOpen ? "rotate-180" : ""}`}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {taxOpen && (
        <>
          {renderField(taxField)}
          <div className="px-4 py-3 border-b border-gray-200 bg-blue-50/50">
            <p className="text-xs text-gray-600 leading-relaxed">
              לא יודע/ת כמה נקודות זיכוי יש לך? ניתן לבדוק בתלוש השכר האחרון שלך.
            </p>
            <p className="text-xs text-gray-600 leading-relaxed mt-1.5">
              לא בטוח/ה כמה נקודות זיכוי מגיעות לך? ניתן להשתמש בסימולטור של רשות המיסים כדי לחשב את הזכאות לפי החוק.
            </p>
            <a
              href="https://secapp.taxes.gov.il/srsimulatorNZ/#/simulator"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-2 text-xs font-medium text-blue-600 underline underline-offset-2"
              onClick={(e) => e.stopPropagation()}
            >
              סימולטור נקודות זיכוי — רשות המסים ←
            </a>
          </div>
        </>
      )}

      {/* Commute section */}
      <button
        onClick={() => setCommuteOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-100 hover:bg-gray-200 transition-colors"
      >
        <span className="text-sm font-bold text-gray-800">נסיעות</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={`w-4 h-4 text-gray-500 transition-transform ${commuteOpen ? "rotate-180" : ""}`}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {commuteOpen && (
        <>
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between gap-3">
            <label className="text-sm font-medium text-gray-800">הפעל/י נסיעות</label>
            <button
              onClick={() => set("commuteEnabled", !form.commuteEnabled)}
              className={`relative flex-none w-12 h-6 rounded-full transition-colors ${form.commuteEnabled ? "bg-blue-600" : "bg-gray-200"}`}
            >
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${form.commuteEnabled ? "right-0.5" : "left-0.5"}`} />
            </button>
          </div>
          {renderField(commuteSubField)}
          <div className="px-4 py-3 border-b border-gray-200 bg-blue-50/50">
            <p className="text-xs text-gray-600 leading-relaxed">
              על פי חוק, המעסיק חייב לשלם החזר נסיעות בגובה עלות התחבורה הציבורית הזולה ביותר לעבודה.
            </p>
            <p className="text-xs text-gray-600 leading-relaxed mt-1.5">
              הסכום המינימלי הוא עלות הנסיעה בפועל (אוטובוס/רכבת). הסכום המקסימלי הוא ₪22.60 ליום — התעריף הקבוע בצו ההרחבה, וגם ברירת המחדל של האפליקציה. אם המעסיק שלך משלם סכום קבוע אחר, הזן/י אותו כאן.
            </p>
          </div>
        </>
      )}

      {/* Pension section */}
      <button
        onClick={() => setPensionOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-100 hover:bg-gray-200 transition-colors"
      >
        <span className="text-sm font-bold text-gray-800">פנסיה</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={`w-4 h-4 text-gray-500 transition-transform ${pensionOpen ? "rotate-180" : ""}`}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {pensionOpen && (
        <>
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between gap-3">
            <label className="text-sm font-medium text-gray-800">הפעל/י פנסיה</label>
            <button
              onClick={() => set("pensionEnabled", !form.pensionEnabled)}
              className={`relative flex-none w-12 h-6 rounded-full transition-colors ${form.pensionEnabled ? "bg-blue-600" : "bg-gray-200"}`}
            >
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${form.pensionEnabled ? "right-0.5" : "left-0.5"}`} />
            </button>
          </div>
          {pensionSubFields.map(renderField)}
          <div className="px-4 py-3 border-b border-gray-200 bg-blue-50/50">
            <p className="text-xs text-gray-600 leading-relaxed">
              פנסיה חובה חלה על כל עובד/ת שכיר/ה מגיל 20 (נשים) או 21 (גברים). סה״כ ההפרשה היא 18.5% מהשכר: 6% על חשבון העובד/ת, 6.5% תגמולים ו־6% פיצויים על חשבון המעסיק.
            </p>
            <p className="text-xs text-gray-600 leading-relaxed mt-1.5">
              ללא קרן פנסיה קודמת — ההפרשות מתחילות לאחר 6 חודשי עבודה, ללא תשלום רטרואקטיבי.
              <br />
              עם קרן פנסיה קודמת — הזכאות מיום הראשון, אך ההפקדות מבוצעות בפועל לאחר 3 חודשים או בתום שנת המס, רטרואקטיבית.
            </p>
            <p className="text-xs text-gray-600 leading-relaxed mt-1.5">
              רק חלק העובד/ת מנוכה מהשכר ברוטו שלך — חלק המעסיק מוצג לידיעה בלבד. את האחוזים המדויקים ניתן למצוא בחוזה העבודה או בתלוש השכר.
            </p>
          </div>
        </>
      )}


<div className="px-4 py-4 flex gap-3 bg-gray-50/50">
        <button
          onClick={() => onDelete(job.id)}
          className="flex-none text-sm font-medium text-red-500 border border-red-300 px-4 py-2 rounded-xl hover:bg-red-50 transition-colors"
        >
          מחק/י משרה
        </button>
        <button
          onClick={handleSave}
          className={`flex-1 text-sm font-semibold py-2 rounded-xl transition-colors ${
            saved ? "bg-green-600 text-white" : "bg-blue-600 text-white hover:bg-blue-700"
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
  const [infoOpen, setInfoOpen] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("settingsInfoDismissed") !== "1" : true
  );

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

  const addJob = async () => {
    const color = JOB_COLORS[jobs.length % JOB_COLORS.length];
    const job = defaultJob({ name: `משרה ${jobs.length + 1}`, color });
    await db.jobs.add(job);
    setJobs((prev) => [...prev, job]);
    setExpandedId(job.id);
  };

  const handleSave = (updated: Job) => {
    setJobs((prev) => prev.map((j) => (j.id === updated.id ? updated : j)));
    setExpandedId(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("למחוק את המשרה וכל המשמרות שלה?")) return;
    await db.jobs.delete(id);
    await db.shifts.where("jobId").equals(id).delete();
    const remaining = jobs.filter((j) => j.id !== id);
    setJobs(remaining);
    setExpandedId(null);
  };

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">הגדרות משרה</h1>
          <button
            onClick={() => { setInfoOpen(true); localStorage.removeItem("settingsInfoDismissed"); }}
            className="w-7 h-7 rounded-full bg-orange-50 text-orange-500 hover:bg-orange-100 flex items-center justify-center text-sm font-bold transition-colors"
          >
            ?
          </button>
        </div>
        <p className="text-sm text-gray-500 mt-0.5">הגדר/י את פרטי המשרה לחישוב שכר מדויק</p>
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
                <span className="text-sm font-medium text-gray-800">{job.name}</span>
                <button
                  onClick={() => setExpandedId(job.id)}
                  className="text-sm font-medium text-blue-600 hover:text-blue-700 underline"
                >
                  פתיחת הגדרות משרה
                </button>
              </div>
            )}
          </div>
        ))}

        {/* Add job button */}
        <button
          onClick={addJob}
          className="w-full py-3.5 bg-white border-2 border-dashed border-gray-300 hover:border-gray-400 text-gray-500 hover:text-gray-700 rounded-2xl text-sm font-semibold transition-colors flex items-center justify-center gap-2"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
            <path d="M12 5v14M5 12h14" />
          </svg>
          הוסף/י משרה
        </button>

        {/* Shabbat city settings */}
        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
          <button
            onClick={() => setShabbatOpen((o) => !o)}
            className="w-full flex items-center justify-between px-4 py-3 bg-blue-50 hover:bg-blue-100 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-blue-800 underline">הגדר/י זמני כניסת שבת וחגים</span>
              {hasSynced
                ? <span className="text-xs text-green-500 font-medium">✓ סונכרן</span>
                : <span className="text-xs text-orange-400 font-medium">! לא סונכרן</span>
              }
            </div>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={`w-4 h-4 text-gray-500 transition-transform ${shabbatOpen ? "rotate-180" : ""}`}>
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
          {shabbatOpen && (
            <div className="px-4 py-3 space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">עיר מגורים</label>
                <select
                  value={cityId}
                  onChange={(e) => handleCityChange(Number(e.target.value))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    : "bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                }`}
              >
                {syncStatus === "loading" && "מוריד זמני שבת וחגים..."}
                {syncStatus === "ok" && "✓ שבתות וחגים עודכנו"}
                {syncStatus === "error" && "שגיאה — נסה/י שוב"}
                {syncStatus === "idle" && "סנכרן/י שבתות וחגים לשנה הנוכחית"}
              </button>
              <div className="px-0 py-1 bg-blue-50/50 rounded-xl p-3">
                <p className="text-xs text-gray-600 leading-relaxed">
                  האפליקציה משתמשת בזמני כניסת שבת המדויקים לפי עיר המגורים שלך כדי לפצל משמרות שישי נכון — שעות לפני כניסת שבת מחושבות בתעריף רגיל, ושעות לאחר מכן בתעריף שבת.
                </p>
                <p className="text-xs text-gray-600 leading-relaxed mt-1.5">
                  ללא סנכרון, ברירת המחדל היא כניסת שבת ב־19:00 — מה שעלול לגרום לחישוב לא מדויק. מומלץ לסנכרן/י פעם בשנה. הנתונים מגיעים מ־HebCal.
                </p>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* Info modal */}
      {infoOpen && (
        <>
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={() => { setInfoOpen(false); localStorage.setItem("settingsInfoDismissed", "1"); }} />
          <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 bg-white rounded-2xl shadow-2xl max-w-[400px] mx-auto p-6">
            <h2 className="text-base font-bold text-gray-900 mb-4">ברוכ/ה הבא/ה להגדרות המשרה!</h2>
            <div className="space-y-4">
              <p className="text-sm text-gray-600 leading-relaxed">כאן תוכל/י להגדיר משרה אחת או יותר — האפליקציה תשתמש בהן כדי לחשב את שכרך בצורה מדויקת.</p>
              <p className="text-sm text-gray-600 leading-relaxed">בכל קטע תמצא/י הסבר קצר: מה המשמעות של כל רכיב בשכר, איך לבדוק אם לא בטוח/ה, ומה קובע החוק.</p>
              <p className="text-sm text-gray-600 leading-relaxed">סיימת להגדיר? לחץ/י <span className="font-semibold">שמור/י</span> — והמשרה תהיה מוכנה לרישום משמרות.</p>
              <p className="text-sm text-gray-600 leading-relaxed">לא לשכוח לסנכרן זמני שבת וחגים לדיוק מירבי 🙂</p>
            </div>
            <p className="text-sm text-orange-500 font-medium mt-4">בהצלחה!</p>
            <button
              onClick={() => { setInfoOpen(false); localStorage.setItem("settingsInfoDismissed", "1"); }}
              className="mt-4 w-full py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              הבנתי
            </button>
          </div>
        </>
      )}
    </div>
  );
}
