"use client";

import { useEffect, useState, useCallback } from "react";
import { db } from "@/lib/db";
import type { Job, Shift } from "@/lib/db";
import { defaultShift } from "@/lib/db";
import ShiftDrawer from "@/components/ShiftDrawer";
import { useHolidayTimes } from "@/lib/useHolidayTimes";
import {
  SHIFT_TYPE_COLORS,
  SHIFT_TYPE_LABELS,
  DAY_ABBR_HE,
  MONTH_NAMES_HE,
} from "@/lib/calculations";

type ClockState = "idle" | "clocked-in" | "clocked-out" | "reviewed";

function nowTime() {
  const n = new Date();
  return `${String(n.getHours()).padStart(2, "0")}:${String(n.getMinutes()).padStart(2, "0")}`;
}

export default function CalendarPage() {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const [viewMode, setViewMode] = useState<"week" | "month">("month");
  const [currentDate, setCurrentDate] = useState(today);
  const holidays = useHolidayTimes(currentDate.getFullYear());
  const [jobs, setJobs] = useState<Job[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  // Clock in/out — initialized from localStorage on mount (guard for SSR)
  const [clockState, setClockState] = useState<ClockState>(
    () => typeof window !== "undefined"
      ? (localStorage.getItem(`clockState_${todayStr}`) as ClockState | null) ?? "idle"
      : "idle"
  );
  const [todayClockIn, setTodayClockIn] = useState(
    () => typeof window !== "undefined" ? localStorage.getItem(`clockIn_${todayStr}`) ?? "" : ""
  );
  const [todayClockOut, setTodayClockOut] = useState(
    () => typeof window !== "undefined" ? localStorage.getItem(`clockOut_${todayStr}`) ?? "" : ""
  );

  useEffect(() => {
    db.jobs.toArray().then((j) => {
      setJobs(j);
      if (j.length > 0) setSelectedJob(j[0]);
    });
  }, []);

  const loadShifts = useCallback(async (job: Job, date: Date) => {
    const prefix = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const data = await db.shifts.where("jobId").equals(job.id).and((s) => s.date.startsWith(prefix)).toArray();
    setShifts(data);
    // Clear stale clock state if no shift exists for today under this job
    if (prefix === todayStr.substring(0, 7) && !data.some((s) => s.date === todayStr)) {
      setClockState("idle");
      setTodayClockIn("");
      setTodayClockOut("");
      localStorage.removeItem(`clockState_${todayStr}`);
      localStorage.removeItem(`clockIn_${todayStr}`);
      localStorage.removeItem(`clockOut_${todayStr}`);
    }
  }, [todayStr]);

  useEffect(() => {
    if (!selectedJob) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadShifts(selectedJob, currentDate);
  }, [selectedJob, currentDate, loadShifts]);

  const shiftMap = Object.fromEntries(shifts.map((s) => [s.date, s]));

  // Clock In
  const handleClockIn = async () => {
    if (!selectedJob) return;
    const time = nowTime();
    const existing = shiftMap[todayStr];
    const shift = existing
      ? { ...existing, isWorkDay: true, clockIn: time }
      : defaultShift(todayStr, selectedJob.id, { clockIn: time });
    await db.shifts.put(shift);
    setTodayClockIn(time);
    setClockState("clocked-in");
    localStorage.setItem(`clockState_${todayStr}`, "clocked-in");
    localStorage.setItem(`clockIn_${todayStr}`, time);
    await loadShifts(selectedJob, currentDate);
  };

  // Clock Out
  const handleClockOut = async () => {
    if (!selectedJob) return;
    const time = nowTime();
    const existing = shiftMap[todayStr];
    if (existing) {
      await db.shifts.put({ ...existing, clockOut: time });
    }
    setTodayClockOut(time);
    setClockState("clocked-out");
    localStorage.setItem(`clockState_${todayStr}`, "clocked-out");
    localStorage.setItem(`clockOut_${todayStr}`, time);
    await loadShifts(selectedJob, currentDate);
  };

  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();

  const getWeekDays = () => {
    const startOfWeek = new Date(currentDate);
    const day = startOfWeek.getDay();
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

  const isToday = (d: Date) => formatDate(d) === todayStr;

  const navigate = (dir: -1 | 1) => {
    const d = new Date(currentDate);
    if (viewMode === "week") d.setDate(d.getDate() + dir * 7);
    else d.setMonth(d.getMonth() + dir);
    setCurrentDate(d);
  };

  const openDay = (d: Date) => {
    if (!selectedJob) return; // no job → calendar is read-only
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
    await loadShifts(selectedJob, currentDate);
    setSelectedDate(null);
    // If saving today after clocking out, mark as reviewed
    if (shift.date === todayStr) {
      const cur = localStorage.getItem(`clockState_${todayStr}`);
      if (cur === "clocked-out") {
        setClockState("reviewed");
        localStorage.setItem(`clockState_${todayStr}`, "reviewed");
      }
    }
  }, [selectedJob, shiftMap, currentDate, loadShifts, todayStr]);

  const handleDelete = useCallback(async (shiftId: string) => {
    const shift = shifts.find((s) => s.id === shiftId);
    await db.shifts.delete(shiftId);
    setShifts((prev) => prev.filter((s) => s.id !== shiftId));
    // If deleting today's shift, reset clock state
    if (shift?.date === todayStr) {
      setClockState("idle");
      setTodayClockIn("");
      setTodayClockOut("");
      localStorage.removeItem(`clockState_${todayStr}`);
      localStorage.removeItem(`clockIn_${todayStr}`);
      localStorage.removeItem(`clockOut_${todayStr}`);
    }
    setSelectedDate(null);
  }, [shifts, todayStr]);

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
    const isHoliday = !!holidays[key];
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);
    const nextKey = formatDate(nextDay);
    const erevName = !isSat && !isHoliday && holidays[nextKey] ? `ערב ${holidays[nextKey]}` : undefined;
    const isErevChag = !!erevName;

    return (
      <button
        onClick={() => openDay(date)}
        className={`
          flex flex-col items-center justify-start rounded-xl border transition-all
          ${compact ? "p-1 gap-0.5 min-h-[56px]" : "p-2 gap-1 min-h-[72px]"}
          ${todayDay ? "border-blue-500 bg-blue-50" : isWorkedDay ? "border-green-200 bg-green-50" : "border-gray-100 bg-white hover:border-gray-200 hover:bg-gray-50"}
          ${!todayDay && !isWorkedDay && !isHoliday && (isSat || (isFri && !isErevChag)) ? "bg-orange-50/50" : ""}
          ${!todayDay && !isWorkedDay && (isHoliday || isErevChag) ? "bg-purple-50/60" : ""}
        `}
      >
        <span className={`text-xs font-semibold ${todayDay ? "text-blue-600" : (isHoliday || isErevChag) ? "text-purple-600" : isSat ? "text-orange-500" : "text-gray-500"}`}>
          {DAY_ABBR_HE[date.getDay()]}
        </span>
        {(isHoliday || isErevChag) && (
          <span className="text-[9px] font-medium text-purple-600 leading-tight text-center w-full truncate px-0.5">
            {isHoliday ? holidays[key] : erevName}
          </span>
        )}
        <span className={`font-bold ${compact ? "text-sm" : "text-base"} ${todayDay ? "text-blue-600" : "text-gray-800"}`}>
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
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><path d="m9 18 6-6-6-6" /></svg>
            </button>
            <span className="text-sm font-medium text-gray-700 min-w-[160px] text-center">{headerLabel}</span>
            <button onClick={() => navigate(1)} className="p-1 text-gray-500 hover:text-gray-800">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><path d="m15 18-6-6 6-6" /></svg>
            </button>
          </div>
        </div>
      </div>

      {/* No job banner */}
      {jobs.length === 0 && (
        <div className="mx-4 mt-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-between gap-3">
          <p className="text-sm text-amber-800">לא הוגדרה משרה — לא ניתן לפתוח ימים</p>
          <a href="/settings" className="text-xs font-semibold text-amber-700 underline whitespace-nowrap">הגדר משרה</a>
        </div>
      )}

      {/* Calendar grid */}
      {viewMode === "week" && (
        <div className="p-4 grid grid-cols-7 gap-1.5">
          {getWeekDays().map((d, i) => (
            <DayCell key={i} date={d} />
          ))}
        </div>
      )}

      {viewMode === "month" && (
        <div className="p-4 pb-2">
          <div className="grid grid-cols-7 gap-1 mb-1">
            {DAY_ABBR_HE.map((abbr) => (
              <div key={abbr} className="text-center text-xs text-gray-400 font-medium py-1">
                {abbr}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {getMonthDays().map((d, i) =>
              d ? <DayCell key={i} date={d} compact /> : <div key={i} />
            )}
          </div>
        </div>
      )}

      {/* Clock In / Out Bar */}
      {jobs.length > 0 && (
        <div className="sticky bottom-16 z-20 bg-white border-t border-gray-100 px-4 py-3">
          {clockState === "idle" && (
            <button
              onClick={handleClockIn}
              className="w-full py-3.5 bg-green-500 hover:bg-green-600 text-white font-bold rounded-2xl text-base flex items-center justify-center gap-2 transition-colors"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-5 h-5">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              כניסה לעבודה
            </button>
          )}

          {clockState === "clocked-in" && (
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <div className="text-xs text-gray-400">נכנסת בשעה</div>
                <div className="text-xl font-bold text-gray-900">{todayClockIn}</div>
              </div>
              <button
                onClick={handleClockOut}
                className="flex-1 py-3.5 bg-red-500 hover:bg-red-600 text-white font-bold rounded-2xl text-base flex items-center justify-center gap-2 transition-colors"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-5 h-5">
                  <rect x="4" y="4" width="16" height="16" rx="2" />
                </svg>
                יציאה
              </button>
            </div>
          )}

          {(clockState === "clocked-out" || clockState === "reviewed") && (
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <div className="text-xs text-gray-400">היום</div>
                <div className="text-base font-bold text-gray-900">{todayClockIn} → {todayClockOut}</div>
              </div>
              <button
                onClick={() => setSelectedDate(todayStr)}
                className={`flex-1 py-3.5 text-white font-bold rounded-2xl text-base flex items-center justify-center gap-2 transition-colors ${
                  clockState === "reviewed"
                    ? "bg-blue-600 hover:bg-blue-700"
                    : "bg-amber-500 hover:bg-amber-600"
                }`}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-5 h-5">
                  <path d="M9 11l3 3L22 4" />
                  <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                </svg>
                בדיקת יום
              </button>
            </div>
          )}
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
