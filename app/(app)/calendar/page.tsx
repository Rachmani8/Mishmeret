"use client";

import { useEffect, useState, useCallback } from "react";
import { db } from "@/lib/db";
import type { Job, Shift } from "@/lib/db";
import { defaultShift } from "@/lib/db";
import ShiftDrawer from "@/components/ShiftDrawer";
import {
  SHIFT_TYPE_COLORS,
  SHIFT_TYPE_LABELS,
  DAY_NAMES_HE,
  DAY_ABBR_HE,
  MONTH_NAMES_HE,
} from "@/lib/calculations";

export default function CalendarPage() {
  const today = new Date();
  const [viewMode, setViewMode] = useState<"week" | "month">("month");
  const [currentDate, setCurrentDate] = useState(today);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  useEffect(() => {
    db.jobs.toArray().then((j) => {
      setJobs(j);
      if (j.length > 0) setSelectedJob(j[0]);
    });
  }, []);

  useEffect(() => {
    if (!selectedJob) return;
    // Load shifts for visible month range
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;
    const prefix = `${year}-${String(month).padStart(2, "0")}`;
    db.shifts
      .where("jobId")
      .equals(selectedJob.id)
      .and((s) => s.date.startsWith(prefix))
      .toArray()
      .then(setShifts);
  }, [selectedJob, currentDate]);

  const shiftMap = Object.fromEntries(shifts.map((s) => [s.date, s]));

  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();

  const getWeekDays = () => {
    const startOfWeek = new Date(currentDate);
    const day = startOfWeek.getDay(); // 0=Sun
    startOfWeek.setDate(startOfWeek.getDate() - day);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(startOfWeek);
      d.setDate(d.getDate() + i);
      return d;
    });
  };

  const getMonthDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = getDaysInMonth(year, month);
    const cells: (Date | null)[] = Array(firstDay).fill(null);
    for (let i = 1; i <= daysInMonth; i++) {
      cells.push(new Date(year, month, i));
    }
    return cells;
  };

  const formatDate = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  const isToday = (d: Date) => formatDate(d) === formatDate(today);

  const navigate = (dir: -1 | 1) => {
    const d = new Date(currentDate);
    if (viewMode === "week") d.setDate(d.getDate() + dir * 7);
    else d.setMonth(d.getMonth() + dir);
    setCurrentDate(d);
  };

  const openDay = (d: Date) => {
    if (!selectedJob) return;
    setSelectedDate(formatDate(d));
  };

  const handleSave = useCallback(async (shift: Shift) => {
    if (!selectedJob) return;
    const existing = shiftMap[shift.date];
    if (existing) {
      await db.shifts.put({ ...shift, id: existing.id });
    } else {
      await db.shifts.put(shift);
    }
    // Refresh
    const prefix = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}`;
    const updated = await db.shifts
      .where("jobId").equals(selectedJob.id)
      .and((s) => s.date.startsWith(prefix))
      .toArray();
    setShifts(updated);
    setSelectedDate(null);
  }, [selectedJob, shiftMap, currentDate]);

  const handleDelete = useCallback(async (shiftId: string) => {
    await db.shifts.delete(shiftId);
    setShifts((prev) => prev.filter((s) => s.id !== shiftId));
  }, []);

  const headerLabel =
    viewMode === "month"
      ? `${MONTH_NAMES_HE[currentDate.getMonth()]} ${currentDate.getFullYear()}`
      : (() => {
          const days = getWeekDays();
          const first = days[0];
          const last = days[6];
          if (first.getMonth() === last.getMonth()) {
            return `${first.getDate()}–${last.getDate()} ${MONTH_NAMES_HE[first.getMonth()]} ${first.getFullYear()}`;
          }
          return `${first.getDate()} ${MONTH_NAMES_HE[first.getMonth()]} – ${last.getDate()} ${MONTH_NAMES_HE[last.getMonth()]}`;
        })();

  const DayCell = ({ date, compact = false }: { date: Date; compact?: boolean }) => {
    const key = formatDate(date);
    const shift = shiftMap[key];
    const todayDay = isToday(date);
    const isPast = date < today && !todayDay;
    const isWorkedDay = isPast && shift?.isWorkDay;
    const isSat = date.getDay() === 6;
    const isFri = date.getDay() === 5;

    return (
      <button
        onClick={() => openDay(date)}
        className={`
          flex flex-col items-center justify-start rounded-xl border transition-all
          ${compact ? "p-1 gap-0.5 min-h-[56px]" : "p-2 gap-1 min-h-[72px]"}
          ${todayDay ? "border-blue-500 bg-blue-50" : isWorkedDay ? "border-green-200 bg-green-50" : "border-gray-100 bg-white hover:border-gray-200 hover:bg-gray-50"}
          ${!todayDay && !isWorkedDay && (isSat || isFri) ? "bg-orange-50/50" : ""}
        `}
      >
        <span
          className={`text-xs font-semibold ${
            todayDay ? "text-blue-600" : isSat ? "text-orange-500" : "text-gray-500"
          }`}
        >
          {DAY_ABBR_HE[date.getDay()]}
        </span>
        <span
          className={`font-bold ${compact ? "text-sm" : "text-base"} ${
            todayDay ? "text-blue-600" : "text-gray-800"
          }`}
        >
          {date.getDate()}
        </span>
        {shift?.isWorkDay && (
          <span
            className="w-full rounded-md text-white text-[10px] font-medium text-center py-0.5 leading-tight"
            style={{ backgroundColor: SHIFT_TYPE_COLORS[shift.shiftType] }}
          >
            {SHIFT_TYPE_LABELS[shift.shiftType]}
          </span>
        )}
      </button>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 pt-4 pb-3">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold text-gray-900">לוח שנה</h1>
          {jobs.length > 1 && (
            <select
              value={selectedJob?.id ?? ""}
              onChange={(e) => setSelectedJob(jobs.find((j) => j.id === e.target.value) ?? null)}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1 text-gray-700"
            >
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>{j.name}</option>
              ))}
            </select>
          )}
        </div>

        {/* View toggle + navigation */}
        <div className="flex items-center gap-2">
          <div className="flex bg-gray-100 rounded-lg p-0.5 text-xs">
            <button
              onClick={() => setViewMode("week")}
              className={`px-3 py-1 rounded-md font-medium transition-colors ${viewMode === "week" ? "bg-white shadow text-gray-900" : "text-gray-500"}`}
            >
              שבועי
            </button>
            <button
              onClick={() => setViewMode("month")}
              className={`px-3 py-1 rounded-md font-medium transition-colors ${viewMode === "month" ? "bg-white shadow text-gray-900" : "text-gray-500"}`}
            >
              חודשי
            </button>
          </div>
          <div className="flex items-center gap-1 flex-1 justify-center">
            <button onClick={() => navigate(-1)} className="p-1 text-gray-500 hover:text-gray-800">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                <path d="m9 18 6-6-6-6" />
              </svg>
            </button>
            <span className="text-sm font-medium text-gray-700 min-w-[160px] text-center">{headerLabel}</span>
            <button onClick={() => navigate(1)} className="p-1 text-gray-500 hover:text-gray-800">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                <path d="m15 18-6-6 6-6" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* No job configured message */}
      {jobs.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-8 gap-3">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-8 h-8 text-gray-400">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
          </div>
          <p className="text-gray-500 text-sm">כדי להתחיל, הגדר משרה בלשונית <strong>הגדרות</strong></p>
        </div>
      )}

      {/* Calendar grid */}
      {jobs.length > 0 && viewMode === "week" && (
        <div className="p-4 grid grid-cols-7 gap-1.5">
          {getWeekDays().map((d, i) => (
            <DayCell key={i} date={d} />
          ))}
        </div>
      )}

      {jobs.length > 0 && viewMode === "month" && (
        <div className="p-4">
          {/* Day headers */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {DAY_ABBR_HE.map((abbr) => (
              <div key={abbr} className="text-center text-xs text-gray-400 font-medium py-1">
                {abbr}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {getMonthDays().map((d, i) =>
              d ? (
                <DayCell key={i} date={d} compact />
              ) : (
                <div key={i} />
              )
            )}
          </div>
        </div>
      )}

      {/* Shift Drawer */}
      <ShiftDrawer
        date={selectedDate}
        job={selectedJob}
        existingShift={selectedDate ? (shiftMap[selectedDate] ?? null) : null}
        onClose={() => setSelectedDate(null)}
        onSave={handleSave}
        onDelete={handleDelete}
      />
    </div>
  );
}
