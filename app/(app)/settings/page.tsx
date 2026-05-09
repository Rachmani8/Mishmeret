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
};

const jobFields: Field[] = [
  { key: "name", label: "שם משרה", type: "text" },
  { key: "baseHourlyRate", label: "שכר שעתי בסיסי (₪)", type: "number", step: 0.5 },
  { key: "dailyNormHours", label: "נורמת שעות יומית", type: "number", step: 0.1, hint: "ברירת מחדל: 8.6 שעות (43ש׳ / 5 ימים)" },
  { key: "weekendMultiplier", label: "תוספת שישי/שבת (פקטור)", type: "number", step: 0.05, hint: "ברירת מחדל: 1.5 (150%)" },
  { key: "holidayMultiplier", label: "תוספת חג (פקטור)", type: "number", step: 0.05 },
  { key: "overtime1Multiplier", label: "שעות נוספות 1-2 (פקטור)", type: "number", step: 0.05, hint: "ברירת מחדל: 1.25" },
  { key: "overtime2Multiplier", label: "שעות נוספות 3+ (פקטור)", type: "number", step: 0.05, hint: "ברירת מחדל: 1.5" },
  { key: "commuteEnabled", label: "נסיעות", type: "toggle" },
  { key: "commuteDaily", label: "נסיעות יומיות (₪)", type: "number", step: 0.1, hint: "ברירת מחדל: ₪22.60 ליום" },
  { key: "taxCreditPoints", label: "נקודות זיכוי", type: "number", step: 0.25, hint: "ברירת מחדל: 2.25 לתושב ישראל רווק" },
  { key: "pensionEnabled", label: "פנסיה", type: "toggle" },
  { key: "pensionEmployeePercent", label: "הפרשת עובד לפנסיה (%)", type: "percent", hint: "ברירת מחדל: 6%" },
  { key: "pensionEmployerPercent", label: "הפרשת מעסיק לפנסיה (%)", type: "percent", hint: "ברירת מחדל: 6.5%" },
];

function JobForm({ job, onSave, onDelete }: { job: Job; onSave: (j: Job) => void; onDelete: (id: string) => void }) {
  const [form, setForm] = useState<Job>({ ...job });
  const [saved, setSaved] = useState(false);

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

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      {jobFields.map((field) => {
        if (field.key === "commuteDaily" && !form.commuteEnabled) return null;
        if ((field.key === "pensionEmployeePercent" || field.key === "pensionEmployerPercent") && !form.pensionEnabled) return null;

        const value = form[field.key];

        return (
          <div key={field.key} className="px-4 py-3 border-b border-gray-50 last:border-0">
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
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${value ? "right-0.5" : "left-0.5"}`}
                  />
                </button>
              ) : field.type === "text" ? (
                <input
                  type="text"
                  value={value as string}
                  onChange={(e) => set(field.key, e.target.value)}
                  className="w-40 border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              ) : (
                <input
                  type="number"
                  value={value as number}
                  step={field.step ?? 1}
                  min={0}
                  onChange={(e) => set(field.key, parseFloat(e.target.value) || 0)}
                  className="w-28 border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              )}
            </div>
          </div>
        );
      })}

      <div className="px-4 py-4 flex gap-3 bg-gray-50/50">
        <button
          onClick={() => onDelete(job.id)}
          className="flex-none text-sm font-medium text-red-500 border border-red-300 px-4 py-2 rounded-xl hover:bg-red-50 transition-colors"
        >
          מחק משרה
        </button>
        <button
          onClick={handleSave}
          className={`flex-1 text-sm font-semibold py-2 rounded-xl transition-colors ${
            saved ? "bg-green-600 text-white" : "bg-blue-600 text-white hover:bg-blue-700"
          }`}
        >
          {saved ? "✓ נשמר" : "שמור"}
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

  useEffect(() => {
    db.jobs.toArray().then((j) => {
      setJobs(j);
      if (j.length > 0 && !expandedId) setExpandedId(j[0].id);
    });
    getAppSettings().then((s) => setCityId(s.cityId));
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
      setTimeout(() => setSyncStatus("idle"), 3000);
    } catch {
      setSyncStatus("error");
      setTimeout(() => setSyncStatus("idle"), 3000);
    }
  };

  const addJob = async () => {
    const job = defaultJob({ name: `משרה ${jobs.length + 1}` });
    await db.jobs.add(job);
    setJobs((prev) => [...prev, job]);
    setExpandedId(job.id);
  };

  const handleSave = (updated: Job) => {
    setJobs((prev) => prev.map((j) => (j.id === updated.id ? updated : j)));
  };

  const handleDelete = async (id: string) => {
    if (!confirm("למחוק את המשרה ואת כל המשמרות שלה?")) return;
    await db.jobs.delete(id);
    await db.shifts.where("jobId").equals(id).delete();
    const remaining = jobs.filter((j) => j.id !== id);
    setJobs(remaining);
    setExpandedId(remaining[0]?.id ?? null);
  };

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-gray-100">
        <h1 className="text-xl font-bold text-gray-900">הגדרות משרה</h1>
        <p className="text-sm text-gray-500 mt-0.5">הגדר את פרטי המשרה לחישוב שכר מדויק</p>
      </div>

      <div className="p-4 space-y-4">

        {/* Shabbat city settings */}
        <div className="bg-white border border-gray-100 rounded-2xl px-4 py-3 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-base">🕍</span>
            <h3 className="text-sm font-semibold text-gray-800">זמני כניסת שבת</h3>
          </div>
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
            {syncStatus === "ok" && "✓ שבתות וחגים עודכנו!"}
            {syncStatus === "error" && "שגיאה — נסה שוב"}
            {syncStatus === "idle" && "סנכרן שבתות וחגים לשנה הנוכחית"}
          </button>
          <p className="text-xs text-gray-400">
            זמני הכנסת שבת מדויקים לפי עיר — מחושב דרך HebCal. מספיק לסנכרן פעם בשנה.
          </p>
        </div>

        {jobs.length === 0 && (
          <div className="text-center py-12 text-gray-500 text-sm">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-8 h-8 text-gray-400">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </div>
            <p>לא הוגדרה משרה עדיין</p>
          </div>
        )}

        {jobs.map((job) => (
          <div key={job.id}>
            {/* Job accordion header */}
            <button
              onClick={() => setExpandedId(expandedId === job.id ? null : job.id)}
              className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 rounded-2xl mb-2 hover:bg-gray-100 transition-colors"
            >
              <span className="font-semibold text-gray-800">{job.name}</span>
              <span className="text-xs text-gray-400 font-medium">₪{job.baseHourlyRate}/שעה</span>
            </button>
            {expandedId === job.id && (
              <JobForm job={job} onSave={handleSave} onDelete={handleDelete} />
            )}
          </div>
        ))}

        {/* Add job button */}
        <button
          onClick={addJob}
          className="w-full py-3 border-2 border-dashed border-gray-200 rounded-2xl text-sm font-medium text-gray-500 hover:border-blue-300 hover:text-blue-600 transition-colors flex items-center justify-center gap-2"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
            <path d="M12 5v14M5 12h14" />
          </svg>
          הוסף משרה
        </button>

      </div>
    </div>
  );
}
