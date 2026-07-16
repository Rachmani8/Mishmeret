"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { db } from "@/lib/db";
import type { Job } from "@/lib/db";
import { useShabbatTimes } from "@/lib/useShabbatTimes";
import { useHolidayTimes } from "@/lib/useHolidayTimes";
import {
  calcDayEarnings,
  calcWorkedHours,
  MONTH_NAMES_HE,
  DAY_NAMES_HE,
} from "@/lib/calculations";

const EXPORT_FIELDS = [
  { key: "date",          label: "תאריך" },
  { key: "day",           label: "יום" },
  { key: "clockIn",       label: "שעת כניסה" },
  { key: "clockOut",      label: "שעת יציאה" },
  { key: "hours",         label: "שעות" },
  { key: "dailyEarnings", label: "שכר יומי" },
  { key: "commute",       label: "נסיעות" },
  { key: "tips",          label: "טיפים" },
  { key: "total",         label: 'סה"כ' },
] as const;

type FieldKey = typeof EXPORT_FIELDS[number]["key"];

export default function ExportPage() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [year, setYear] = useState(currentYear);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [selectedFields, setSelectedFields] = useState<Set<FieldKey>>(
    new Set(EXPORT_FIELDS.map((f) => f.key))
  );
  const [loading, setLoading] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const shabbatTimes = useShabbatTimes(year);
  const holidays = useHolidayTimes(year);

  useEffect(() => {
    db.jobs.toArray().then((j) => {
      const sorted = j.slice().sort((a, b) => a.name.localeCompare(b.name, "he"));
      setJobs(sorted);
      if (sorted.length > 0) setSelectedJob(sorted[0]);
    });
  }, []);

  const navigateYear = (dir: -1 | 1) => {
    const next = year + dir;
    if (next > currentYear) return;
    setYear(next);
    setSelected(new Set());
  };

  const toggleMonth = (m: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(m)) next.delete(m);
      else next.add(m);
      return next;
    });
  };

  const toggleField = (key: FieldKey) => {
    setSelectedFields((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(Array.from({ length: 12 }, (_, i) => i + 1)));
  const selectNone = () => setSelected(new Set());

  const selectedCount = selected.size;

  const selectedList = Array.from(selected)
    .sort((a, b) => a - b)
    .map((m) => ({ year, month: m, label: `${MONTH_NAMES_HE[m - 1]} ${year}` }));

  const colWidths: Record<FieldKey, number> = {
    date: 14, day: 12, clockIn: 12, clockOut: 12,
    hours: 10, dailyEarnings: 14, commute: 12, tips: 12, total: 14,
  };

  const handleExport = async () => {
    if (!selectedJob || selectedList.length === 0) {
      alert("בחר/י לפחות חודש אחד לייצוא");
      return;
    }
    if (selectedFields.size === 0) {
      alert("בחר/י לפחות שדה אחד לייצוא");
      return;
    }
    setLoading(true);
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.utils.book_new();
      const activeFields = EXPORT_FIELDS.filter((f) => selectedFields.has(f.key));

      for (const mo of selectedList) {
        const prefix = `${mo.year}-${String(mo.month).padStart(2, "0")}`;
        const shifts = await db.shifts
          .where("jobId").equals(selectedJob.id)
          .and((s) => s.date.startsWith(prefix))
          .toArray();
        const workShifts = shifts.filter((s) => s.isWorkDay).sort((a, b) => a.date.localeCompare(b.date));

        const rows: (string | number)[][] = [activeFields.map((f) => f.label)];
        let totalHours = 0, totalEarnings = 0, totalCommute = 0, totalTips = 0, totalTotal = 0;

        for (const shift of workShifts) {
          const d = new Date(shift.date + "T00:00:00");
          const e = calcDayEarnings(shift, selectedJob, shabbatTimes, holidays);
          const hours = calcWorkedHours(shift);
          const dailyEarnings = e.baseEarnings + e.overtime1Earnings + e.overtime2Earnings + e.weekendBonus;
          const tips = shift.tips ?? 0;
          const total = dailyEarnings + e.commuteAmount;
          totalHours += hours; totalEarnings += dailyEarnings;
          totalCommute += e.commuteAmount; totalTips += tips; totalTotal += total;

          const rowData: Record<FieldKey, string | number> = {
            date: `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`,
            day: `יום ${DAY_NAMES_HE[d.getDay()]}`,
            clockIn: shift.clockIn,
            clockOut: shift.clockOut,
            hours: parseFloat(hours.toFixed(2)),
            dailyEarnings: parseFloat(dailyEarnings.toFixed(2)),
            commute: parseFloat(e.commuteAmount.toFixed(2)),
            tips: parseFloat(tips.toFixed(2)),
            total: parseFloat(total.toFixed(2)),
          };
          rows.push(activeFields.map((f) => rowData[f.key]));
        }

        const totalsData: Record<FieldKey, string | number> = {
          date: 'סה"כ', day: "", clockIn: "", clockOut: "",
          hours: parseFloat(totalHours.toFixed(2)),
          dailyEarnings: parseFloat(totalEarnings.toFixed(2)),
          commute: parseFloat(totalCommute.toFixed(2)),
          tips: parseFloat(totalTips.toFixed(2)),
          total: parseFloat(totalTotal.toFixed(2)),
        };
        rows.push(activeFields.map((f) => totalsData[f.key]));

        const ws = XLSX.utils.aoa_to_sheet(rows);
        ws["!cols"] = activeFields.map((f) => ({ wch: colWidths[f.key] }));
        XLSX.utils.book_append_sheet(wb, ws, mo.label);
      }

      const safeName = selectedJob.name.replace(/[<>:|"?*\/\\]/g, "_");
      const fileName = `משמרת_${safeName}_${new Date().toLocaleDateString("he-IL").replace(/\//g, "-")}.xlsx`;
      XLSX.writeFile(wb, fileName);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-full" dir="rtl">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
        <div className="relative flex items-center justify-center">
          <Link href="/settings" className="absolute left-0 w-8 h-8 rounded-full bg-[#162038] border border-white/10 hover:border-white/25 flex items-center justify-center text-[#6B8FAA] hover:text-[#E8EEFF] transition-all">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
            </svg>
          </Link>
          <h1 className="text-xl font-bold text-[#E8EEFF]">ייצוא לאקסל</h1>
          <button
            onClick={() => setInfoOpen(true)}
            className="absolute right-0 w-7 h-7 rounded-full bg-[#FF6B2C]/15 text-[#FF6B2C] border border-[#FF6B2C]/50 hover:border-[#FF6B2C] hover:bg-[#FF6B2C]/25 flex items-center justify-center text-sm font-bold transition-all"
          >
            ?
          </button>
        </div>
        <p className="text-sm text-[#6B8FAA] mt-0.5">ייצוא נתוני משמרות לקובץ Excel</p>
      </div>

      {jobs.length === 0 && (
        <div className="flex-1 flex items-center justify-center text-sm text-[#3E5672]">הגדר/י משרה תחילה</div>
      )}

      {jobs.length > 0 && (
        <div className="p-4 space-y-5">
          {/* Job selector */}
          {jobs.length > 1 && (
            <div className="flex bg-[#162038] rounded-xl p-1 gap-1 self-center w-fit mx-auto">
              {jobs.map((j) => (
                <button
                  key={j.id}
                  onClick={() => setSelectedJob(j)}
                  className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                    selectedJob?.id === j.id ? "text-white" : "text-[#6B8FAA]"
                  }`}
                  style={selectedJob?.id === j.id ? { backgroundColor: j.color } : undefined}
                >
                  {j.name}
                </button>
              ))}
            </div>
          )}

          {/* Month selection */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <button onClick={() => navigateYear(-1)} className="p-1.5 text-[#6B8FAA] hover:text-[#E8EEFF] transition-colors">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><path d="m9 18 6-6-6-6" /></svg>
              </button>
              <span className="text-base font-semibold text-[#E8EEFF]">{year}</span>
              <button onClick={() => navigateYear(1)} disabled={year >= currentYear} className="p-1.5 text-[#6B8FAA] hover:text-[#E8EEFF] transition-colors disabled:opacity-30">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><path d="m15 18-6-6 6-6" /></svg>
              </button>
            </div>

            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-[#E8EEFF]">בחר/י חודשים</label>
              <div className="flex gap-2">
                <button onClick={selectAll} className="text-xs text-[#3B7FF5] hover:underline">בחר/י הכל</button>
                <span className="text-[#3E5672]">|</span>
                <button onClick={selectNone} className="text-xs text-[#6B8FAA] hover:underline">נקה הכל</button>
              </div>
            </div>

            <div className="grid grid-cols-6 gap-1.5">
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
                const sel = selected.has(m);
                const isFuture = year === currentYear && m > currentMonth;
                return (
                  <button
                    key={m}
                    onClick={() => !isFuture && toggleMonth(m)}
                    disabled={isFuture}
                    className={`flex flex-col items-center justify-center rounded-xl py-2.5 px-1 text-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                      sel ? "bg-[#3B7FF5] text-white" : "bg-[#162038] text-[#E8EEFF] hover:bg-[#1C2B4A]"
                    }`}
                  >
                    <span className="text-[11px] font-semibold leading-tight">{MONTH_NAMES_HE[m - 1]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Field selector */}
          <div>
            <label className="text-sm font-medium text-[#E8EEFF] block mb-2">מה יהיה בקובץ</label>
            <div className="rounded-2xl border overflow-y-auto bg-[#162038] max-h-48" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
              {EXPORT_FIELDS.map((f, idx) => {
                const checked = selectedFields.has(f.key);
                return (
                  <button
                    key={f.key}
                    onClick={() => toggleField(f.key)}
                    className={`w-full flex items-center justify-between px-4 py-3.5 text-sm transition-colors ${
                      idx !== EXPORT_FIELDS.length - 1 ? "border-b" : ""
                    } ${checked ? "text-[#E8EEFF]" : "text-[#3E5672]"}`}
                    style={idx !== EXPORT_FIELDS.length - 1 ? { borderColor: "rgba(255,255,255,0.06)" } : undefined}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-5 h-5 flex items-center justify-center flex-shrink-0 ${checked ? "text-[#3B7FF5]" : "text-[#243355]"}`}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} className="w-5 h-5">
                          <path d="M20 6 9 17l-5-5" />
                        </svg>
                      </div>
                      <span className="font-medium">{f.label}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Export button */}
          <button
            onClick={handleExport}
            disabled={loading || selectedCount === 0 || selectedFields.size === 0}
            className="w-full py-3.5 bg-[#3B7FF5] hover:bg-[#2B6EE0] text-white font-semibold rounded-2xl text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? <span>מייצא...</span> : (
              <>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                <span>ייצוא {selectedCount > 0 ? `(${selectedCount} חודשים)` : ""}</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Info modal */}
      {infoOpen && (
        <>
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={() => setInfoOpen(false)} />
          <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 bg-[#162038] border rounded-2xl shadow-2xl max-w-[400px] mx-auto p-6" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
            <h2 className="text-base font-bold text-[#E8EEFF] mb-4">ייצוא לאקסל — מה יש פה?</h2>
            <div className="space-y-4">
              <div>
                <p className="text-sm font-semibold text-[#E8EEFF] mb-1">בחירת חודשים</p>
                <p className="text-sm text-[#6B8FAA] leading-relaxed">לחץ/י על חודש אחד או יותר לכלול בייצוא. כל חודש יופיע כגיליון נפרד בקובץ ה-Excel.</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-[#E8EEFF] mb-1">בחירת שדות</p>
                <p className="text-sm text-[#6B8FAA] leading-relaxed">סמן/י אילו עמודות לכלול — למשל רק שעות לדיווח למעסיק, או שכר מלא לחישוב אישי.</p>
              </div>
            </div>
            <button
              onClick={() => setInfoOpen(false)}
              className="mt-6 w-full py-2.5 bg-[#3B7FF5] hover:bg-[#2B6EE0] text-white text-sm font-semibold rounded-xl transition-colors"
            >
              הבנתי
            </button>
          </div>
        </>
      )}
    </div>
  );
}
