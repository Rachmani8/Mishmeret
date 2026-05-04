"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/db";
import type { Job, Shift } from "@/lib/db";
import { useShabbatTimes } from "@/lib/useShabbatTimes";
import {
  calcDayEarnings,
  calcWorkedHours,
  formatCurrency,
  formatHours,
  MONTH_NAMES_HE,
  SHIFT_TYPE_LABELS,
  SHIFT_TYPE_COLORS,
  DAY_NAMES_HE,
} from "@/lib/calculations";

export default function SummaryPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1); // 1-indexed
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const shabbatTimes = useShabbatTimes(year);

  useEffect(() => {
    db.jobs.toArray().then((j) => {
      setJobs(j);
      if (j.length > 0) setSelectedJob(j[0]);
    });
  }, []);

  useEffect(() => {
    if (!selectedJob) return;
    const prefix = `${year}-${String(month).padStart(2, "0")}`;
    db.shifts
      .where("jobId").equals(selectedJob.id)
      .and((s) => s.date.startsWith(prefix))
      .toArray()
      .then((s) => setShifts(s.sort((a, b) => a.date.localeCompare(b.date))));
  }, [selectedJob, year, month]);

  const navigate = (dir: -1 | 1) => {
    let m = month + dir;
    let y = year;
    if (m < 1) { m = 12; y--; }
    if (m > 12) { m = 1; y++; }
    setMonth(m);
    setYear(y);
  };

  const workShifts = shifts.filter((s) => s.isWorkDay);

  const totalHours = workShifts.reduce((sum, s) => sum + calcWorkedHours(s), 0);
  const totalGross = selectedJob
    ? workShifts.reduce((sum, s) => sum + calcDayEarnings(s, selectedJob, shabbatTimes).totalGross, 0)
    : 0;
  const totalCommute = selectedJob && selectedJob.commuteEnabled
    ? workShifts.length * selectedJob.commuteDaily
    : 0;
  const totalTips = workShifts.reduce((sum, s) => sum + (s.tips ?? 0), 0);

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 pt-4 pb-3">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold text-gray-900">סיכום חודשי</h1>
          {jobs.length > 1 && (
            <select
              value={selectedJob?.id ?? ""}
              onChange={(e) => setSelectedJob(jobs.find((j) => j.id === e.target.value) ?? null)}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1 text-gray-700"
            >
              {jobs.map((j) => <option key={j.id} value={j.id}>{j.name}</option>)}
            </select>
          )}
        </div>

        {/* Month navigation */}
        <div className="flex items-center justify-between">
          <button onClick={() => navigate(-1)} className="p-1.5 text-gray-500 hover:text-gray-800">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
          <span className="text-base font-semibold text-gray-800">
            {MONTH_NAMES_HE[month - 1]} {year}
          </span>
          <button onClick={() => navigate(1)} className="p-1.5 text-gray-500 hover:text-gray-800">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
        </div>
      </div>

      {/* No job */}
      {jobs.length === 0 && (
        <div className="flex-1 flex items-center justify-center text-sm text-gray-400">
          הגדר משרה תחילה
        </div>
      )}

      {jobs.length > 0 && (
        <>
          {/* Shifts list */}
          <div className="flex-1 p-4 space-y-2">
            {workShifts.length === 0 && (
              <div className="text-center py-16 text-sm text-gray-400">
                אין ימי עבודה מוקלטים לחודש זה
              </div>
            )}

            {workShifts.map((shift) => {
              const dateObj = new Date(shift.date + "T00:00:00");
              const earnings = selectedJob ? calcDayEarnings(shift, selectedJob, shabbatTimes) : null;

              return (
                <div key={shift.id} className="bg-white border border-gray-100 rounded-2xl px-4 py-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: SHIFT_TYPE_COLORS[shift.shiftType] }}
                      />
                      <span className="text-sm font-semibold text-gray-800">
                        {dateObj.getDate()} {MONTH_NAMES_HE[dateObj.getMonth()]}
                      </span>
                      <span className="text-xs text-gray-400">
                        יום {DAY_NAMES_HE[dateObj.getDay()]}
                      </span>
                      <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-md">
                        {SHIFT_TYPE_LABELS[shift.shiftType]}
                      </span>
                    </div>
                    {earnings && (
                      <span className="text-sm font-bold text-gray-900">
                        {formatCurrency(earnings.totalGross)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span>{shift.clockIn} → {shift.clockOut}</span>
                    <span className="font-medium text-gray-700">
                      {earnings ? formatHours(earnings.workedHours) : "—"} שעות
                    </span>
                    {earnings && earnings.commuteAmount > 0 && (
                      <span className="text-green-600">+{formatCurrency(earnings.commuteAmount)} נסיעות</span>
                    )}
                    {(shift.tips ?? 0) > 0 && (
                      <span className="text-amber-600 font-medium">🪙 {formatCurrency(shift.tips)} טיפים</span>
                    )}
                  </div>
                  {shift.notes && (
                    <p className="text-xs text-gray-400 mt-1 truncate">{shift.notes}</p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Totals bar */}
          <div className="sticky bottom-16 bg-white border-t border-gray-100 px-4 py-3">
            <div className="flex items-center justify-between text-sm">
              <div className="text-center">
                <div className="text-xs text-gray-400 mb-0.5">ימי עבודה</div>
                <div className="font-bold text-gray-900">{workShifts.length}</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-400 mb-0.5">סה״כ שעות</div>
                <div className="font-bold text-gray-900">{formatHours(totalHours)}</div>
              </div>
              {totalCommute > 0 && (
                <div className="text-center">
                  <div className="text-xs text-gray-400 mb-0.5">נסיעות</div>
                  <div className="font-bold text-green-600">{formatCurrency(totalCommute)}</div>
                </div>
              )}
              {totalTips > 0 && (
                <div className="text-center">
                  <div className="text-xs text-gray-400 mb-0.5">טיפים</div>
                  <div className="font-bold text-amber-500">{formatCurrency(totalTips)}</div>
                </div>
              )}
              <div className="text-center">
                <div className="text-xs text-gray-400 mb-0.5">ברוטו</div>
                <div className="font-bold text-blue-600">{formatCurrency(totalGross)}</div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
