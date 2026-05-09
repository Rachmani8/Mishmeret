"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/db";
import type { Job, Shift } from "@/lib/db";
import {
  calcDayEarnings,
  calcWorkedHours,
  formatCurrency,
  MONTH_NAMES_HE,
  DAY_NAMES_HE,
  SHIFT_TYPE_LABELS,
} from "@/lib/calculations";

interface MonthOption {
  year: number;
  month: number;
  label: string;
  selected: boolean;
}

function buildMonthOptions(now: Date): MonthOption[] {
  const options: MonthOption[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    options.push({
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      label: `${MONTH_NAMES_HE[d.getMonth()]} ${d.getFullYear()}`,
      selected: i === 0,
    });
  }
  return options;
}

export default function ExportPage() {
  const now = new Date();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [monthOptions, setMonthOptions] = useState<MonthOption[]>(buildMonthOptions(now));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    db.jobs.toArray().then((j) => {
      setJobs(j);
      if (j.length > 0) setSelectedJob(j[0]);
    });
  }, []);

  const toggleMonth = (idx: number) => {
    setMonthOptions((prev) =>
      prev.map((m, i) => (i === idx ? { ...m, selected: !m.selected } : m))
    );
  };

  const selectAll = () => setMonthOptions((prev) => prev.map((m) => ({ ...m, selected: true })));
  const selectNone = () => setMonthOptions((prev) => prev.map((m) => ({ ...m, selected: false })));

  const handleExport = async () => {
    if (!selectedJob) return;
    const selected = monthOptions.filter((m) => m.selected);
    if (selected.length === 0) {
      alert("בחר לפחות חודש אחד לייצוא");
      return;
    }

    setLoading(true);
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.utils.book_new();

      for (const mo of selected) {
        const prefix = `${mo.year}-${String(mo.month).padStart(2, "0")}`;
        const shifts = await db.shifts
          .where("jobId").equals(selectedJob.id)
          .and((s) => s.date.startsWith(prefix))
          .toArray();

        const workShifts = shifts.filter((s) => s.isWorkDay).sort((a, b) => a.date.localeCompare(b.date));

        const rows: (string | number)[][] = [
          // Header row
          ["תאריך", "יום", "שעת כניסה", "שעת יציאה", "שעות", "שכר יומי", "נסיעות", "טיפים", 'סה"כ'],
        ];

        let totalHours = 0;
        let totalEarnings = 0;
        let totalCommute = 0;
        let totalTips = 0;

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
            shift.clockIn,
            shift.clockOut,
            parseFloat(hours.toFixed(2)),
            parseFloat(dailyEarnings.toFixed(2)),
            parseFloat(e.commuteAmount.toFixed(2)),
            parseFloat(tips.toFixed(2)),
            parseFloat((dailyEarnings + e.commuteAmount).toFixed(2)),
          ]);
        }

        // Summary row
        rows.push([
          'סה"כ', "", "", "",
          parseFloat(totalHours.toFixed(2)),
          parseFloat(totalEarnings.toFixed(2)),
          parseFloat(totalCommute.toFixed(2)),
          parseFloat(totalTips.toFixed(2)),
          parseFloat((totalEarnings + totalCommute).toFixed(2)),
        ]);

        const ws = XLSX.utils.aoa_to_sheet(rows);

        // Column widths
        ws["!cols"] = [
          { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
          { wch: 10 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 14 },
        ];

        XLSX.utils.book_append_sheet(wb, ws, mo.label);
      }

      const fileName = `משמרת_${selectedJob.name}_${new Date().toLocaleDateString("he-IL").replace(/\//g, "-")}.xlsx`;
      XLSX.writeFile(wb, fileName);
    } finally {
      setLoading(false);
    }
  };

  const [loadingHours, setLoadingHours] = useState(false);

  const handleExportHours = async () => {
    if (!selectedJob) return;
    const selected = monthOptions.filter((m) => m.selected);
    if (selected.length === 0) {
      alert("בחר לפחות חודש אחד לייצוא");
      return;
    }

    setLoadingHours(true);
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.utils.book_new();

      for (const mo of selected) {
        const prefix = `${mo.year}-${String(mo.month).padStart(2, "0")}`;
        const shifts = await db.shifts
          .where("jobId").equals(selectedJob.id)
          .and((s) => s.date.startsWith(prefix))
          .toArray();

        const workShifts = shifts.filter((s) => s.isWorkDay).sort((a, b) => a.date.localeCompare(b.date));

        const rows: (string | number)[][] = [
          ["תאריך", "יום", "שעת כניסה", "שעת יציאה", 'סה"כ שעות'],
        ];

        let totalHours = 0;

        for (const shift of workShifts) {
          const d = new Date(shift.date + "T00:00:00");
          const hours = calcWorkedHours(shift);
          totalHours += hours;

          rows.push([
            `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`,
            `יום ${DAY_NAMES_HE[d.getDay()]}`,
            shift.clockIn,
            shift.clockOut,
            parseFloat(hours.toFixed(2)),
          ]);
        }

        rows.push(['סה"כ', "", "", "", parseFloat(totalHours.toFixed(2))]);

        const ws = XLSX.utils.aoa_to_sheet(rows);
        ws["!cols"] = [{ wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 14 }];
        XLSX.utils.book_append_sheet(wb, ws, mo.label);
      }

      const fileName = `שעות_${selectedJob.name}_${new Date().toLocaleDateString("he-IL").replace(/\//g, "-")}.xlsx`;
      XLSX.writeFile(wb, fileName);
    } finally {
      setLoadingHours(false);
    }
  };

  const selectedCount = monthOptions.filter((m) => m.selected).length;

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-gray-100">
        <h1 className="text-xl font-bold text-gray-900">ייצוא לאקסל</h1>
        <p className="text-sm text-gray-500 mt-0.5">ייצוא נתוני משמרות לקובץ Excel</p>
      </div>

      {jobs.length === 0 && (
        <div className="flex-1 flex items-center justify-center text-sm text-gray-400">הגדר משרה תחילה</div>
      )}

      {jobs.length > 0 && (
        <div className="p-4 space-y-4">
          {/* Job selector */}
          {jobs.length > 1 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">משרה</label>
              <select
                value={selectedJob?.id ?? ""}
                onChange={(e) => setSelectedJob(jobs.find((j) => j.id === e.target.value) ?? null)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {jobs.map((j) => <option key={j.id} value={j.id}>{j.name}</option>)}
              </select>
            </div>
          )}

          {/* Month selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">בחר חודשים</label>
              <div className="flex gap-2">
                <button onClick={selectAll} className="text-xs text-blue-600 hover:underline">בחר הכל</button>
                <span className="text-gray-300">|</span>
                <button onClick={selectNone} className="text-xs text-gray-500 hover:underline">נקה הכל</button>
              </div>
            </div>
            <div className="space-y-1.5">
              {monthOptions.map((mo, idx) => (
                <button
                  key={idx}
                  onClick={() => toggleMonth(idx)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-colors text-sm ${
                    mo.selected
                      ? "border-blue-500 bg-blue-50 text-blue-800"
                      : "border-gray-200 text-gray-700 hover:border-gray-300"
                  }`}
                >
                  <span className="font-medium">{mo.label}</span>
                  {mo.selected && (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-4 h-4 text-blue-600">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Export button */}
          <button
            onClick={handleExport}
            disabled={loading || selectedCount === 0}
            className="w-full py-3.5 bg-green-600 text-white font-semibold rounded-2xl text-sm hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <span>מייצא...</span>
            ) : (
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

          {/* Hours-only export button */}
          <button
            onClick={handleExportHours}
            disabled={loadingHours || selectedCount === 0}
            className="w-full py-3.5 bg-blue-600 text-white font-semibold rounded-2xl text-sm hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loadingHours ? (
              <span>מייצא...</span>
            ) : (
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
    </div>
  );
}
