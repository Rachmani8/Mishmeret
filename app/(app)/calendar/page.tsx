"use client";

import { useEffect, useState, useCallback } from "react";
import { db } from "@/lib/db";
import type { Job, Shift } from "@/lib/db";
import Link from "next/link";
import ShiftDrawer from "@/components/ShiftDrawer";
import { useHolidayTimes } from "@/lib/useHolidayTimes";
import { DAY_ABBR_HE, MONTH_NAMES_HE, calcDayEarnings, calcWorkedHours } from "@/lib/calculations";
import { useShabbatTimes } from "@/lib/useShabbatTimes";

const JOB_COLORS = ["#3B82F6", "#F97316", "#10B981", "#8B5CF6"];

export default function CalendarPage() {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");
  const [currentDate, setCurrentDate] = useState(today);
  const holidays = useHolidayTimes(currentDate.getFullYear());
  const shabbatTimes = useShabbatTimes(currentDate.getFullYear());
  const [jobs, setJobs] = useState<Job[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedDateHoliday, setSelectedDateHoliday] = useState<string | undefined>(undefined);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);

  useEffect(() => {
    db.jobs.toArray().then((j) => {
      const sorted = j.slice().sort((a, b) => a.name.localeCompare(b.name, "he"));
      setJobs(sorted);
      if (sorted.length > 0) setSelectedJob(sorted[0]);
    });
  }, []);

  const loadShifts = useCallback(async (date: Date) => {
    const prefix = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const data = await db.shifts.filter((s) => s.date.startsWith(prefix)).toArray();
    setShifts(data);
  }, []);

  useEffect(() => { loadShifts(currentDate); }, [currentDate, loadShifts]);

  const shiftMap = shifts.reduce<Record<string, Shift[]>>((acc, s) => {
    (acc[s.date] ??= []).push(s);
    return acc;
  }, {});
  const jobColorMap = Object.fromEntries(jobs.map((j, i) => [j.id, j.color ?? JOB_COLORS[i % JOB_COLORS.length]]));
  const jobNameMap = Object.fromEntries(jobs.map((j) => [j.id, j.name]));

  const getMonthDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (Date | null)[] = Array(firstDay).fill(null);
    for (let i = 1; i <= daysInMonth; i++) cells.push(new Date(year, month, i));
    return cells;
  };

  const formatDate = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  const isToday = (d: Date) => formatDate(d) === todayStr;

  const navigate = (dir: -1 | 1) => {
    const d = new Date(currentDate);
    d.setMonth(d.getMonth() + dir);
    setCurrentDate(d);
  };

  const openDay = (d: Date) => {
    if (!selectedJob) return;
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

  const openShift = (date: Date, jobId: string) => {
    const job = jobs.find((j) => j.id === jobId) ?? selectedJob;
    if (!job) return;
    const key = formatDate(date);
    const isSat = date.getDay() === 6;
    const isHoliday = !!holidays[key];
    const nextKey = formatDate(new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1));
    const holiday = isHoliday
      ? holidays[key]
      : (!isSat && holidays[nextKey] ? `ערב ${holidays[nextKey]}` : undefined);
    setSelectedDateHoliday(holiday);
    setSelectedJob(job);
    setSelectedDate(key);
  };

  const getMonthDates = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1));
  };

  const handleSave = useCallback(async (_shift: Shift) => {
    await loadShifts(currentDate);
  }, [currentDate, loadShifts]);

  const handleDelete = useCallback((shiftId: string) => {
    setShifts((prev) => prev.filter((s) => s.id !== shiftId));
  }, []);

  const headerLabel = `${MONTH_NAMES_HE[currentDate.getMonth()]} ${currentDate.getFullYear()}`;

  const DayCell = ({ date, compact = false }: { date: Date; compact?: boolean }) => {
    const key = formatDate(date);
    const dayShifts = shiftMap[key] ?? [];
    const workedShifts = dayShifts.filter((s) => s.isWorkDay);
    const todayDay = isToday(date);
    const isPast = date < today && !todayDay;
    const isWorkedDay = isPast && workedShifts.length > 0;
    const isSat = date.getDay() === 6;
    const isFri = date.getDay() === 5;
    const holidayName: string | undefined = holidays[key];
    const isHoliday = !!holidayName;
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);
    const erevHolidayName: string | undefined =
      !isSat && !isHoliday ? holidays[formatDate(nextDay)] : undefined;

    let bg = "bg-[#162038] hover:bg-[#1C2B4A]";
    let border = "border-white/[0.06] hover:border-white/[0.12]";

    if (todayDay) { bg = "bg-[#162C4A]"; border = "border-[#3B7FF5]"; }
    else if (isWorkedDay) { bg = "bg-[#1a2540] hover:bg-[#1C2B4A]"; border = "border-white/[0.10]"; }

    const dayNumColor = todayDay
      ? "text-[#3B7FF5]"
      : isPast
      ? "text-[#4A6080]"
      : "text-[#E8EEFF]";

    const dayAbbrColor = (isHoliday || erevHolidayName)
      ? "text-purple-400"
      : isSat
      ? "text-orange-400"
      : todayDay
      ? "text-[#3B7FF5]"
      : "text-[#3E5672]";

    return (
      <button
        onClick={() => openDay(date)}
        className={`flex flex-col items-center justify-start rounded-xl border transition-all ${compact ? "p-1 gap-0.5 min-h-[56px]" : "p-2 gap-1 min-h-[72px]"} ${bg} ${border}`}
      >
        <span className={`text-xs font-semibold ${dayAbbrColor}`}>
          {DAY_ABBR_HE[date.getDay()]}
        </span>
        {holidayName && (
          <span className="text-[9px] leading-tight text-purple-400/80 text-center w-full truncate px-0.5">
            {holidayName}
          </span>
        )}
        {erevHolidayName && (
          <span className="text-[9px] leading-tight text-purple-400/80 text-center w-full truncate px-0.5">
            ערב {erevHolidayName}
          </span>
        )}
        <span className={`font-bold ${compact ? "text-sm" : "text-base"} ${dayNumColor}`}>
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
    <div className="flex flex-col h-full" dir="rtl">
      {/* Header */}
      <div className="sticky top-0 z-10 px-4 pt-4 pb-3 border-b" style={{ background: "#0C1221", borderColor: "rgba(255,255,255,0.07)" }}>
        <div className="relative flex items-center justify-center mb-3">
          <Link href="/settings" className="absolute left-0 w-8 h-8 rounded-full bg-[#162038] border border-white/10 hover:border-white/25 flex items-center justify-center text-[#6B8FAA] hover:text-[#E8EEFF] transition-all">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
            </svg>
          </Link>
          <h1 className="text-xl font-bold text-[#E8EEFF]">יומן</h1>
          <button
            onClick={() => setInfoOpen(true)}
            className="absolute right-0 w-7 h-7 rounded-full bg-[#FF6B2C]/15 text-[#FF6B2C] border border-[#FF6B2C]/50 hover:border-[#FF6B2C] hover:bg-[#FF6B2C]/25 flex items-center justify-center text-sm font-bold transition-all"
          >
            ?
          </button>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex bg-[#162038] rounded-full p-0.5 gap-0.5">
            <button
              onClick={() => setViewMode("calendar")}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${viewMode === "calendar" ? "bg-[#3B7FF5] text-white" : "text-[#6B8FAA]"}`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <path d="M16 2v4M8 2v4M3 10h18" />
              </svg>
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${viewMode === "list" ? "bg-[#3B7FF5] text-white" : "text-[#6B8FAA]"}`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" />
                <line x1="3" y1="12" x2="3.01" y2="12" />
                <line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
            </button>
          </div>
          <div className="flex items-center gap-1 flex-1 justify-center">
            <button onClick={() => navigate(-1)} className="p-1 text-[#6B8FAA] hover:text-[#E8EEFF] transition-colors">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><path d="m9 18 6-6-6-6" /></svg>
            </button>
            <span className="text-sm font-medium text-[#E8EEFF] min-w-[140px] text-center">{headerLabel}</span>
            <button onClick={() => navigate(1)} className="p-1 text-[#6B8FAA] hover:text-[#E8EEFF] transition-colors">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><path d="m15 18-6-6 6-6" /></svg>
            </button>
          </div>
        </div>
      </div>

      {/* No job banner */}
      {jobs.length === 0 && (
        <div className="mx-4 mt-3 px-4 py-3 bg-amber-900/20 border border-amber-700/30 rounded-2xl flex items-center justify-between gap-3">
          <p className="text-sm text-amber-300">לא הוגדרה משרה — לא ניתן לפתוח ימים</p>
          <a href="/settings" className="text-xs font-semibold text-amber-400 underline whitespace-nowrap">הגדר/י משרה</a>
        </div>
      )}

      {/* Calendar grid */}
      {viewMode === "calendar" && (
        <div className="p-4 pb-2">
          <div className="grid grid-cols-7 gap-1 mb-1">
            {DAY_ABBR_HE.map((abbr) => (
              <div key={abbr} className="text-center text-xs text-[#3E5672] font-medium py-1">
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

      {/* List view */}
      {viewMode === "list" && (
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2 pb-4">
          {getMonthDates().map((date) => {
            const key = formatDate(date);
            const dayShifts = (shiftMap[key] ?? []).filter((s) => s.isWorkDay);
            const isSat = date.getDay() === 6;
            const holidayName = holidays[key];
            const nextKey = formatDate(new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1));
            const isErevHoliday = !isSat && !holidayName && !!holidays[nextKey];
            const isHoliday = !!holidayName;
            const isTodayRow = key === todayStr;

            const dateColor = isSat
              ? "text-[#FF6B2C]"
              : isHoliday || isErevHoliday
              ? "text-purple-400"
              : "text-[#E8EEFF]";

            const letterColor = isSat
              ? "text-[#FF6B2C]"
              : isHoliday || isErevHoliday
              ? "text-purple-400"
              : "text-[#6B8FAA]";

            const cardClass = isTodayRow
              ? "border-[#3B7FF5] border-[1.5px] bg-[#1a2540]"
              : isSat
              ? "border border-[rgba(255,107,44,0.2)] bg-[#162038]"
              : isHoliday || isErevHoliday
              ? "border border-[rgba(167,139,250,0.2)] bg-[#162038]"
              : "border border-white/[0.06] bg-[#162038]";

            return (
              <div key={key} className={`flex items-stretch rounded-xl overflow-hidden ${cardClass}`}>
                {/* Date column */}
                <div className="flex flex-col items-center justify-center px-3 py-2 min-w-[44px] gap-0.5">
                  <span className={`text-xl font-bold leading-none ${dateColor}`}>{date.getDate()}</span>
                  <span className={`text-[10px] font-medium ${letterColor}`}>{DAY_ABBR_HE[date.getDay()]}</span>
                </div>

                {/* Vertical divider */}
                <div className="w-px bg-white/[0.08] my-2" />

                {/* Shifts or empty */}
                <div className="flex-1 flex flex-col">
                  {dayShifts.length === 0 ? (
                    <button
                      className="flex items-center justify-between px-3 py-3 w-full"
                      onClick={() => openDay(date)}
                    >
                      <span className="text-xs text-[#6B8FAA]/40">{isSat ? "שבת" : "אין משמרת"}</span>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-[#3E5672] flex-shrink-0">
                        <path d="m15 18-6-6 6-6" />
                      </svg>
                    </button>
                  ) : (
                    dayShifts.map((shift, idx) => {
                      const job = jobs.find((j) => j.id === shift.jobId);
                      if (!job) return null;
                      const earnings = calcDayEarnings(shift, job, shabbatTimes, holidays);
                      const hours = calcWorkedHours(shift);
                      const jobColor = jobColorMap[shift.jobId] ?? "#3B7FF5";

                      return (
                        <div key={shift.id}>
                          {idx > 0 && <div className="mx-3 border-t border-dashed border-white/[0.12]" />}
                          <button
                            className="w-full text-right flex items-center gap-2 px-3 py-2"
                            onClick={() => openShift(date, shift.jobId)}
                          >
                            <div className="flex-1 flex flex-col gap-0.5">
                              <span className="text-xs font-semibold" style={{ color: jobColor }}>
                                {jobNameMap[shift.jobId]}
                              </span>
                              <span className="text-[12px] font-semibold text-[#E8EEFF]">
                                {shift.clockIn} — {shift.clockOut}
                              </span>
                              <div className="flex gap-2 text-[10px] text-[#6B8FAA]">
                                <span>{hours.toFixed(1)} שע׳</span>
                                {shift.tips ? (
                                  <span style={{ color: "#2DD4BF" }}>טיפים: ₪{shift.tips}</span>
                                ) : null}
                              </div>
                            </div>
                            <span className="text-sm font-bold text-[#3B7FF5] min-w-[52px] text-left">
                              ₪{Math.round(earnings.totalGross - earnings.commuteAmount)}
                            </span>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-[#3E5672] flex-shrink-0">
                              <path d="m15 18-6-6 6-6" />
                            </svg>
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ShiftDrawer
        date={selectedDate}
        job={selectedJob}
        jobs={jobs}
        holidayLabel={selectedDateHoliday}
        onClose={() => { setSelectedDate(null); setSelectedDateHoliday(undefined); loadShifts(currentDate); }}
        onSave={handleSave}
        onDelete={handleDelete}
      />

      {/* Info modal */}
      {infoOpen && (
        <>
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={() => setInfoOpen(false)} />
          <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 bg-[#162038] border rounded-2xl shadow-2xl max-w-[400px] mx-auto p-6" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
            <h2 className="text-base font-bold text-[#E8EEFF] mb-4">לוח שנה ורישום משמרות — איך עובד?</h2>
            <div className="space-y-4">
              <div>
                <p className="text-sm font-semibold text-[#E8EEFF] mb-1">רישום משמרות</p>
                <p className="text-sm text-[#6B8FAA] leading-relaxed">לחץ/י על יום בלוח כדי לפתוח אותו — תוכל/י להוסיף, לערוך או למחוק משמרות. ניתן לרשום יותר ממשמרת אחת ביום.</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-[#E8EEFF] mb-1">כניסה ויציאה</p>
                <p className="text-sm text-[#6B8FAA] leading-relaxed">בלשונית <span className="text-[#E8EEFF] font-medium">שעון</span> תוכל/י להתחיל ולסיים משמרת — השעה תירשם אוטומטית.</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-[#E8EEFF] mb-1">ימים מיוחדים</p>
                <div className="text-sm text-[#6B8FAA] space-y-0.5">
                  <p><span className="text-orange-400">ש׳</span> שבת — האות בכתום</p>
                  <p><span className="text-purple-400">א׳</span> חג / ערב חג — האות בסגול</p>
                </div>
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
