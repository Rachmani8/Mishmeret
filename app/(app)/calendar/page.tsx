"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { db } from "@/lib/db";
import type { Job, Shift } from "@/lib/db";
import { defaultShift } from "@/lib/db";
import ShiftDrawer from "@/components/ShiftDrawer";
import { useHolidayTimes } from "@/lib/useHolidayTimes";
import { DAY_ABBR_HE, MONTH_NAMES_HE } from "@/lib/calculations";

const JOB_COLORS = ["#3B82F6", "#F97316", "#10B981", "#8B5CF6"];

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
  const [selectedDateHoliday, setSelectedDateHoliday] = useState<string | undefined>(undefined);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [clockJob, setClockJob] = useState<Job | null>(null);
  const [clockShiftId, setClockShiftId] = useState<string | null>(
    () => typeof window !== "undefined" ? localStorage.getItem(`clockShiftId_${todayStr}`) : null
  );
  const [firstClockShiftId, setFirstClockShiftId] = useState<string | null>(
    () => typeof window !== "undefined" ? localStorage.getItem(`firstClockShiftId_${todayStr}`) : null
  );
  const [drawerShiftId, setDrawerShiftId] = useState<string | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);

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
      const sorted = j.slice().sort((a, b) => a.name.localeCompare(b.name, "he"));
      setJobs(sorted);
      if (sorted.length > 0) {
        setSelectedJob(sorted[0]);
        setClockJob(sorted[0]);
      }
    });
  }, []);

  const shiftsLoadedRef = useRef(false);

  const loadShifts = useCallback(async (date: Date) => {
    const prefix = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const data = await db.shifts.filter((s) => s.date.startsWith(prefix)).toArray();
    setShifts(data);
    shiftsLoadedRef.current = true;
  }, []);

  useEffect(() => {
    loadShifts(currentDate);
  }, [currentDate, loadShifts]);

  const shiftMap = shifts.reduce<Record<string, Shift[]>>((acc, s) => {
    (acc[s.date] ??= []).push(s);
    return acc;
  }, {});
  const jobColorMap = Object.fromEntries(jobs.map((j, i) => [j.id, j.color ?? JOB_COLORS[i % JOB_COLORS.length]]));
  const jobNameMap = Object.fromEntries(jobs.map((j) => [j.id, j.name]));

  // If tracked shift IDs no longer exist in DB (e.g. jobs/shifts deleted), reset clock state
  useEffect(() => {
    if (!shiftsLoadedRef.current) return; // wait for first real load before validating
    if (clockState === "idle" || clockState === "clocked-in") return;
    const todayShifts = shiftMap[todayStr] ?? [];
    const shift1Exists = clockShiftId ? todayShifts.some((s) => s.id === clockShiftId) : false;
    const shift2Exists = firstClockShiftId ? todayShifts.some((s) => s.id === firstClockShiftId) : false;
    if (!shift1Exists && !shift2Exists) {
      setClockState("idle");
      setClockShiftId(null);
      setFirstClockShiftId(null);
      setTodayClockIn("");
      setTodayClockOut("");
      localStorage.removeItem(`clockState_${todayStr}`);
      localStorage.removeItem(`clockIn_${todayStr}`);
      localStorage.removeItem(`clockOut_${todayStr}`);
      localStorage.removeItem(`clockShiftId_${todayStr}`);
      localStorage.removeItem(`firstClockShiftId_${todayStr}`);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shifts, todayStr]);

  // Clock In
  const handleClockIn = async () => {
    if (!clockJob) return;
    const time = nowTime();
    // In reviewed state, always start a fresh shift and remember the first shift's ID
    const shift = clockState === "reviewed"
      ? defaultShift(todayStr, clockJob.id, { clockIn: time })
      : (() => {
          const existing = shiftMap[todayStr]?.find((s) => s.jobId === clockJob.id);
          return existing
            ? { ...existing, isWorkDay: true, clockIn: time }
            : defaultShift(todayStr, clockJob.id, { clockIn: time });
        })();
    if (clockState === "reviewed") {
      setFirstClockShiftId(clockShiftId);
      if (clockShiftId) localStorage.setItem(`firstClockShiftId_${todayStr}`, clockShiftId);
    }
    await db.shifts.put(shift);
    setClockShiftId(shift.id);
    localStorage.setItem(`clockShiftId_${todayStr}`, shift.id);
    setTodayClockIn(time);
    setClockState("clocked-in");
    localStorage.setItem(`clockState_${todayStr}`, "clocked-in");
    localStorage.setItem(`clockIn_${todayStr}`, time);
    await loadShifts(currentDate);
  };

  // Clock Out
  const handleClockOut = async () => {
    if (!clockJob) return;
    const time = nowTime();
    // Use clockShiftId to update the exact shift started by the current clock-in
    const existing = clockShiftId
      ? shiftMap[todayStr]?.find((s) => s.id === clockShiftId)
      : shiftMap[todayStr]?.find((s) => s.jobId === clockJob.id);
    if (existing) {
      await db.shifts.put({ ...existing, clockOut: time });
    }
    setTodayClockOut(time);
    setClockState("clocked-out");
    localStorage.setItem(`clockState_${todayStr}`, "clocked-out");
    localStorage.setItem(`clockOut_${todayStr}`, time);
    await loadShifts(currentDate);
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
    const key = formatDate(d);
    const isSat = d.getDay() === 6;
    const isHoliday = !!holidays[key];
    const nextKey = formatDate(new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1));
    const holiday = isHoliday
      ? holidays[key]
      : (!isSat && holidays[nextKey] ? `ערב ${holidays[nextKey]}` : undefined);
    setSelectedDateHoliday(holiday);
    setSelectedDate(key);
  };

  const handleSave = useCallback(async (shift: Shift) => {
    await loadShifts(currentDate);
    if (shift.date === todayStr) {
      setTodayClockIn(shift.clockIn);
      setTodayClockOut(shift.clockOut);
      localStorage.setItem(`clockIn_${todayStr}`, shift.clockIn);
      localStorage.setItem(`clockOut_${todayStr}`, shift.clockOut);
      const cur = localStorage.getItem(`clockState_${todayStr}`);
      if (cur === "clocked-out") {
        setClockState("reviewed");
        localStorage.setItem(`clockState_${todayStr}`, "reviewed");
      }
    }
  }, [currentDate, loadShifts, todayStr]);

  const handleDelete = useCallback(async (shiftId: string) => {
    const shift = shifts.find((s) => s.id === shiftId);
    setShifts((prev) => prev.filter((s) => s.id !== shiftId));
    if (shift?.date !== todayStr) return;

    const isFirst = shiftId === firstClockShiftId;
    const isSecond = shiftId === clockShiftId;

    if (isFirst && clockShiftId) {
      // Deleted first shift — second shift remains, promote it to the only reviewed shift
      setFirstClockShiftId(null);
      localStorage.removeItem(`firstClockShiftId_${todayStr}`);
      // clockShiftId + clockState "reviewed" stay as-is
    } else if (isSecond && firstClockShiftId) {
      // Deleted second shift — first shift remains, demote it to the single reviewed shift
      const remaining = shifts.find((s) => s.id === firstClockShiftId);
      setClockShiftId(firstClockShiftId);
      localStorage.setItem(`clockShiftId_${todayStr}`, firstClockShiftId);
      setFirstClockShiftId(null);
      localStorage.removeItem(`firstClockShiftId_${todayStr}`);
      if (remaining) {
        setTodayClockIn(remaining.clockIn);
        setTodayClockOut(remaining.clockOut);
        localStorage.setItem(`clockIn_${todayStr}`, remaining.clockIn);
        localStorage.setItem(`clockOut_${todayStr}`, remaining.clockOut);
      }
      // clockState stays "reviewed"
    } else {
      // Last tracked shift deleted — reset to idle
      setClockState("idle");
      setClockShiftId(null);
      setFirstClockShiftId(null);
      setTodayClockIn("");
      setTodayClockOut("");
      localStorage.removeItem(`clockState_${todayStr}`);
      localStorage.removeItem(`clockIn_${todayStr}`);
      localStorage.removeItem(`clockOut_${todayStr}`);
      localStorage.removeItem(`clockShiftId_${todayStr}`);
      localStorage.removeItem(`firstClockShiftId_${todayStr}`);
    }
  }, [shifts, todayStr, clockShiftId, firstClockShiftId]);

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
    const dayShifts = shiftMap[key] ?? [];
    const workedShifts = dayShifts.filter((s) => s.isWorkDay);
    const todayDay = isToday(date);
    const isPast = date < today && !todayDay;
    const isWorkedDay = isPast && workedShifts.length > 0;
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

        <span className={`font-bold ${compact ? "text-sm" : "text-base"} ${todayDay ? "text-blue-600" : "text-gray-800"}`}>
          {date.getDate()}
        </span>
        {workedShifts.map((s) => (
          <span
            key={s.id}
            className="w-full rounded-md text-white text-[10px] font-medium text-center py-0.5 leading-tight"
            style={{ backgroundColor: jobColorMap[s.jobId] }}
          >
            {jobNameMap[s.jobId]}
          </span>
        ))}
      </button>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 pt-4 pb-3">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold text-gray-900">לוח שנה</h1>
          <button
            onClick={() => setInfoOpen(true)}
            className="w-7 h-7 rounded-full bg-orange-50 text-orange-500 hover:bg-orange-100 flex items-center justify-center text-sm font-bold transition-colors"
          >
            ?
          </button>
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
          <a href="/settings" className="text-xs font-semibold text-amber-700 underline whitespace-nowrap">הגדר/י משרה</a>
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
            <div className="flex flex-col gap-2">
              {jobs.length > 1 && (
                <div className="flex gap-2">
                  {jobs.map((j) => {
                    const isActive = clockJob?.id === j.id;
                    const color = j.color ?? "#EF4444";
                    return (
                      <button
                        key={j.id}
                        onClick={() => setClockJob(j)}
                        style={isActive ? { backgroundColor: color, borderColor: color } : undefined}
                        className={`flex-1 py-1.5 text-sm font-medium rounded-xl border transition-colors ${
                          isActive ? "text-white" : "border-gray-200 text-gray-600 hover:border-gray-300"
                        }`}
                      >
                        {j.name}
                      </button>
                    );
                  })}
                </div>
              )}
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
            </div>
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

          {clockState === "clocked-out" && (
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <div className="text-xs text-gray-400">היום</div>
                <div className="text-base font-bold text-gray-900" dir="ltr">{todayClockIn} → {todayClockOut}</div>
              </div>
              <button
                onClick={() => setSelectedDate(todayStr)}
                className="flex-1 py-3.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-2xl text-base flex items-center justify-center gap-2 transition-colors"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-5 h-5">
                  <path d="M9 11l3 3L22 4" />
                  <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                </svg>
                ווידוא יום
              </button>
            </div>
          )}

          {clockState === "reviewed" && (() => {
            const editIcon = (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3.5 h-3.5">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            );

            // Derive each shift's job directly from saved shift data
            const shiftJobFor = (shiftId: string | null) => {
              const s = shiftId ? (shiftMap[todayStr] ?? []).find((x) => x.id === shiftId) : null;
              return s ? jobs.find((j) => j.id === s.jobId) ?? null : null;
            };

            // Two shifts = firstClockShiftId was set when starting the second clock-in
            if (firstClockShiftId && clockShiftId && firstClockShiftId !== clockShiftId) {
              const pairs: Array<{ shiftId: string }> = [
                { shiftId: firstClockShiftId },
                { shiftId: clockShiftId },
              ];
              return (
                <div className="flex items-center gap-2">
                  {pairs.map(({ shiftId }, i) => {
                    const s = (shiftMap[todayStr] ?? []).find((x) => x.id === shiftId);
                    const j = shiftJobFor(shiftId);
                    const color = j?.color ?? "#EF4444";
                    if (!s) return null;
                    return (
                      <div key={i} className="flex items-center gap-1.5 flex-1">
                        <div
                          className="flex-1 px-3 py-2 rounded-2xl"
                          style={{ backgroundColor: `${color}1a` }}
                        >
                          {j && (
                            <div className="text-xs font-semibold leading-tight" style={{ color }}>
                              {j.name}
                            </div>
                          )}
                          <div className="text-xs text-gray-400">משמרת {i + 1}</div>
                          <div className="text-sm font-bold text-gray-900" dir="ltr">{s.clockIn} → {s.clockOut}</div>
                        </div>
                        <button
                          onClick={() => { setDrawerShiftId(shiftId); setSelectedDate(todayStr); }}
                          aria-label="עריכה"
                          className="flex-none w-7 h-7 rounded-xl bg-orange-500 hover:bg-orange-600 flex items-center justify-center transition-colors text-white"
                        >
                          {editIcon}
                        </button>
                      </div>
                    );
                  })}
                </div>
              );
            }

            // Single completed shift — derive job from saved data, not from clockJob picker
            const singleJob = shiftJobFor(clockShiftId) ?? clockJob;
            const singleColor = singleJob?.color ?? "#EF4444";
            return (
              <div className="flex items-center justify-between gap-2">
                {/* Right: reviewed box + edit */}
                <div className="flex items-center gap-2">
                  <div
                    className="px-3 py-2 rounded-2xl"
                    style={{ backgroundColor: `${singleColor}1a` }}
                  >
                    {singleJob && (
                      <div className="text-xs font-semibold leading-tight" style={{ color: singleColor }}>
                        {singleJob.name}
                      </div>
                    )}
                    <div className="text-xs text-gray-400">היום</div>
                    <div className="text-sm font-bold text-gray-900" dir="ltr">{todayClockIn} → {todayClockOut}</div>
                  </div>
                  <button
                    onClick={() => setSelectedDate(todayStr)}
                    aria-label="עריכה"
                    className="flex-none w-7 h-7 rounded-xl bg-orange-500 hover:bg-orange-600 flex items-center justify-center transition-colors text-white"
                  >
                    {editIcon}
                  </button>
                </div>

                {/* Left: new clock-in picker + button */}
                <div className="flex flex-col gap-1.5 min-w-[120px]">
                  {jobs.length > 1 && (
                    <div className="flex gap-1">
                      {jobs.map((j) => {
                        const isActive = clockJob?.id === j.id;
                        return (
                          <button
                            key={j.id}
                            onClick={() => setClockJob(j)}
                            style={isActive ? { backgroundColor: j.color, borderColor: j.color } : undefined}
                            className={`flex-1 py-0.5 text-xs font-medium rounded-lg border transition-colors ${
                              isActive ? "text-white" : "border-gray-200 text-gray-600"
                            }`}
                          >
                            {j.name}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <button
                    onClick={handleClockIn}
                    className="w-full py-2 px-4 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-4 h-4">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    כניסה למשמרת נוספת
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Shift Drawer */}
      <ShiftDrawer
        date={selectedDate}
        job={selectedJob}
        jobs={jobs}
        holidayLabel={selectedDateHoliday}
        openShiftId={
          selectedDate === todayStr
            ? drawerShiftId ?? ((clockState === "clocked-out" || clockState === "reviewed") ? clockShiftId : null)
            : null
        }
        onClose={() => { setSelectedDate(null); setSelectedDateHoliday(undefined); setDrawerShiftId(null); loadShifts(currentDate); }}
        onSave={handleSave}
        onDelete={handleDelete}
      />

      {/* Info modal */}
      {infoOpen && (
        <>
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={() => setInfoOpen(false)} />
          <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 bg-white rounded-2xl shadow-2xl max-w-[400px] mx-auto p-6">
            <h2 className="text-base font-bold text-gray-900 mb-4">לוח שנה ורישום משמרות — איך עובד?</h2>

            <div className="space-y-4">
              <div>
                <p className="text-sm font-semibold text-gray-800 mb-1">רישום משמרות</p>
                <p className="text-sm text-gray-600 leading-relaxed">לחץ/י על יום בלוח כדי לפתוח אותו — תוכל/י להוסיף, לערוך או למחוק משמרות. ניתן לרשום יותר ממשמרת אחת ביום.</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800 mb-1">כניסה ויציאה מהעבודה</p>
                <p className="text-sm text-gray-600 leading-relaxed">בתחתית המסך יש כפתורי כניסה ויציאה — לחיצה עליהם תרשום אוטומטית את השעה להיום. לאחר היציאה, לחץ/י <span className="font-medium">ווידוא יום</span> כדי לאשר ולשמור.</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800 mb-1">ימים בצע</p>
                <div className="text-sm text-gray-600 space-y-0.5">
                  <p>🟠 שבת — מסומן בכתום</p>
                  <p>🟣 חג — מסומן בסגול</p>
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800 mb-1">חישוב שכר</p>
                <p className="text-sm text-gray-600 leading-relaxed">כל המשמרות מחושבות אוטומטית לפי ההגדרות שהזנת בעמוד ההגדרות — כולל שעות נוספות, שבת וחגים ומתווספות לחישוב התלוש.</p>
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
