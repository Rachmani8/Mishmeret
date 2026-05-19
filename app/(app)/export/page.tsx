"use client";

import { useEffect, useRef, useState } from "react";
import { db } from "@/lib/db";
import type { Job } from "@/lib/db";
import {
  calcDayEarnings,
  calcWorkedHours,
  MONTH_NAMES_HE,
  DAY_NAMES_HE,
} from "@/lib/calculations";

export default function ExportPage() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [year, setYear] = useState(currentYear);
  const [selected, setSelected] = useState<Set<number>>(new Set([currentMonth]));
  const [loading, setLoading] = useState(false);
  const [loadingHours, setLoadingHours] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const currentMonthRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    db.jobs.toArray().then((j) => {
      const sorted = j.slice().sort((a, b) => a.name.localeCompare(b.name, "he"));
      setJobs(sorted);
      if (sorted.length > 0) setSelectedJob(sorted[0]);
    });
  }, []);

  // Scroll current month into view when on current year
  useEffect(() => {
    if (year === currentYear) {
      currentMonthRef.current?.scrollIntoView({ block: "nearest", behavior: "instant" });
    }
  }, [year, currentYear]);

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

  const selectAll = () => {
    setSelected(new Set(Array.from({ length: 12 }, (_, i) => i + 1)));
  };
  const selectNone = () => setSelected(new Set());

  const selectedCount = selected.size;

  const selectedList = Array.from(selected)
    .sort((a, b) => a - b)
    .map((m) => ({ year, month: m, label: `${MONTH_NAMES_HE[m - 1]} ${year}` }));

  const handleExport = async () => {
    if (!selectedJob || selectedList.length === 0) {
      alert("בחר/י לפחות חודש אחד לייצוא");
      return;
    }
    setLoading(true);
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.utils.book_new();

      for (const mo of selectedList) {
        const prefix = `${mo.year}-${String(mo.month).padStart(2, "0")}`;
        const shifts = await db.shifts
          .where("jobId").equals(selectedJob.id)
          .and((s) => s.date.startsWith(prefix))
          .toArray();
        const workShifts = shifts.filter((s) => s.isWorkDay).sort((a, b) => a.date.localeCompare(b.date));

        const rows: (string | number)[][] = [
          ["תאריך", "יום", "שעת כניסה", "שעת יציאה", "שעות", "שכר יומי", "נסיעות", "טיפים", 'סה"כ'],
        ];
        let totalHours = 0, totalEarnings = 0, totalCommute = 0, totalTips = 0;

        for (const shift of workShifts) {
          const d = new Date(shift.date + "T00:00:00");
          const e = calcDayEarnings(shift, selectedJob);
          const hours = calcWorkedHours(shift);
          const dailyEarnings = e.baseEarnings + e.overtime1Earnings + e.overtime2Earnings + e.weekendBonus;
          const tips = shift.tips ?? 0;
          totalHours += hours;
          totalEarnings += dailyEarnings;
          totalCommute += e.commuteAmount;
          totalTips += tips;
          rows.push([
            `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`,
            `יום ${DAY_NAMES_HE[d.getDay()]}`,
            shift.clockIn, shift.clockOut,
            parseFloat(hours.toFixed(2)),
            parseFloat(dailyEarnings.toFixed(2)),
            parseFloat(e.commuteAmount.toFixed(2)),
            parseFloat(tips.toFixed(2)),
            parseFloat((dailyEarnings + e.commuteAmount).toFixed(2)),
          ]);
        }
        rows.push(['סה"כ', "", "", "",
          parseFloat(totalHours.toFixed(2)),
          parseFloat(totalEarnings.toFixed(2)),
          parseFloat(totalCommute.toFixed(2)),
          parseFloat(totalTips.toFixed(2)),
          parseFloat((totalEarnings + totalCommute).toFixed(2)),
        ]);

        const ws = XLSX.utils.aoa_to_sheet(rows);
        ws["!cols"] = [{ wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 14 }];
        XLSX.utils.book_append_sheet(wb, ws, mo.label);
      }

      const safeName = selectedJob.name.replace(/[<>:|"?*\/\\]/g, "_");
      const fileName = `משמרת_${safeName}_${new Date().toLocaleDateString("he-IL").replace(/\//g, "-")}.xlsx`;
      XLSX.writeFile(wb, fileName);
    } finally {
      setLoading(false);
    }
  };

  const handleExportHours = async () => {
    if (!selectedJob || selectedList.length === 0) {
      alert("בחר/י לפחות חודש אחד לייצוא");
      return;
    }
    setLoadingHours(true);
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.utils.book_new();

      for (const mo of selectedList) {
        const prefix = `${mo.year}-${String(mo.month).padStart(2, "0")}`;
        const shifts = await db.shifts
          .where("jobId").equals(selectedJob.id)
          .and((s) => s.date.startsWith(prefix))
          .toArray();
        const workShifts = shifts.filter((s) => s.isWorkDay).sort((a, b) => a.date.localeCompare(b.date));

        const rows: (string | number)[][] = [["תאריך", "יום", "שעת כניסה", "שעת יציאה", 'סה"כ שעות']];
        let totalHours = 0;

        for (const shift of workShifts) {
          const d = new Date(shift.date + "T00:00:00");
          const hours = calcWorkedHours(shift);
          totalHours += hours;
          rows.push([
            `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`,
            `יום ${DAY_NAMES_HE[d.getDay()]}`,
            shift.clockIn, shift.clockOut,
            parseFloat(hours.toFixed(2)),
          ]);
        }
        rows.push(['סה"כ', "", "", "", parseFloat(totalHours.toFixed(2))]);

        const ws = XLSX.utils.aoa_to_sheet(rows);
        ws["!cols"] = [{ wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 14 }];
        XLSX.utils.book_append_sheet(wb, ws, mo.label);
      }

      const safeName = selectedJob.name.replace(/[<>:|"?*\/\\]/g, "_");
      const fileName = `שעות_${safeName}_${new Date().toLocaleDateString("he-IL").replace(/\//g, "-")}.xlsx`;
      XLSX.writeFile(wb, fileName);
    } finally {
      setLoadingHours(false);
    }
  };

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">ייצוא לאקסל</h1>
          <button
            onClick={() => setInfoOpen(true)}
            className="w-7 h-7 rounded-full bg-orange-50 text-orange-500 hover:bg-orange-100 flex items-center justify-center text-sm font-bold transition-colors"
          >
            ?
          </button>
        </div>
        <p className="text-sm text-gray-500 mt-0.5">ייצוא נתוני משמרות לקובץ Excel</p>
      </div>

      {jobs.length === 0 && (
        <div className="flex-1 flex items-center justify-center text-sm text-gray-400">הגדר/י משרה תחילה</div>
      )}

      {jobs.length > 0 && (
        <div className="p-4 space-y-4">
          {/* Job selector */}
          {jobs.length > 1 && (
            <div className="flex gap-1 bg-gray-200 rounded-xl p-2">
              {jobs.map((j) => (
                <button
                  key={j.id}
                  onClick={() => setSelectedJob(j)}
                  className={`flex-1 py-1 text-sm font-medium rounded-lg transition-colors ${
                    selectedJob?.id === j.id ? "text-white shadow-sm" : "bg-white text-gray-700 shadow-sm"
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
            {/* Year navigator */}
            <div className="flex items-center justify-between mb-3">
              <button onClick={() => navigateYear(-1)} className="p-1.5 text-gray-500 hover:text-gray-800">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><path d="m9 18 6-6-6-6" /></svg>
              </button>
              <span className="text-base font-semibold text-gray-800">{year}</span>
              <button onClick={() => navigateYear(1)} disabled={year >= currentYear} className="p-1.5 text-gray-500 hover:text-gray-800 disabled:opacity-30">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><path d="m15 18-6-6 6-6" /></svg>
              </button>
            </div>

            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">בחר/י חודשים</label>
              <div className="flex gap-2">
                <button onClick={selectAll} className="text-xs text-blue-600 hover:underline">בחר/י הכל</button>
                <span className="text-gray-300">|</span>
                <button onClick={selectNone} className="text-xs text-gray-500 hover:underline">נקה הכל</button>
              </div>
            </div>

            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
                const sel = selected.has(m);
                const isCurrent = year === currentYear && m === currentMonth;
                return (
                  <button
                    key={m}
                    ref={isCurrent ? currentMonthRef : undefined}
                    onClick={() => toggleMonth(m)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-colors text-sm ${
                      sel
                        ? "border-blue-500 bg-blue-50 text-blue-800"
                        : "border-gray-200 text-gray-700 hover:border-gray-300"
                    }`}
                  >
                    <span className="font-medium">{MONTH_NAMES_HE[m - 1]}</span>
                    {isCurrent && !sel && <span className="text-xs text-gray-400">חודש נוכחי</span>}
                    {sel && (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-4 h-4 text-blue-600">
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Export buttons */}
          <button
            onClick={handleExport}
            disabled={loading || selectedCount === 0}
            className="w-full py-3.5 bg-green-600 text-white font-semibold rounded-2xl text-sm hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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

          <button
            onClick={handleExportHours}
            disabled={loadingHours || selectedCount === 0}
            className="w-full py-3.5 bg-blue-600 text-white font-semibold rounded-2xl text-sm hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loadingHours ? <span>מייצא...</span> : (
              <>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <span>ייצוא טבלת שעות {selectedCount > 0 ? `(${selectedCount} חודשים)` : ""}</span>
              </>
            )}
          </button>

          {/* Info */}
          <div className="bg-gray-50 rounded-2xl px-4 py-3 space-y-1">
            <p className="text-xs text-gray-500"><span className="font-medium text-gray-600">ייצוא מלא</span> — שכר, נסיעות, טיפים וסה״כ</p>
            <p className="text-xs text-gray-500"><span className="font-medium text-gray-600">טבלת שעות</span> — תאריך, שעות כניסה/יציאה וסה״כ שעות בלבד</p>
          </div>
        </div>
      )}

      {/* Info modal */}
      {infoOpen && (
        <>
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={() => setInfoOpen(false)} />
          <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 bg-white rounded-2xl shadow-2xl max-w-[400px] mx-auto p-6">
            <h2 className="text-base font-bold text-gray-900 mb-4">ייצוא לאקסל — מה יש פה?</h2>
            <div className="space-y-4">
              <div>
                <p className="text-sm font-semibold text-gray-800 mb-1">ייצוא מלא</p>
                <p className="text-sm text-gray-600 leading-relaxed">מייצא קובץ Excel עם כל המשמרות של השנה — כולל שעות, תעריפים, שעות נוספות, שבת וחג ורווח יומי.</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800 mb-1">ייצוא שעות בלבד</p>
                <p className="text-sm text-gray-600 leading-relaxed">מייצא קובץ פשוט עם תאריכים ושעות כניסה/יציאה בלבד — מתאים לדיווח למעסיק.</p>
              </div>
            </div>
            <button
              onClick={() => setInfoOpen(false)}
              className="mt-6 w-full py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              הבנתי
            </button>
          </div>
        </>
      )}
    </div>
  );
}
