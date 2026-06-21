"use client";

import { useEffect, useState, useCallback } from "react";
import { db } from "@/lib/db";
import type { Job, Shift } from "@/lib/db";
import ShiftDrawer from "@/components/ShiftDrawer";
import { useHolidayTimes } from "@/lib/useHolidayTimes";
import { DAY_ABBR_HE, MONTH_NAMES_HE } from "@/lib/calculations";

const JOB_COLORS = ["#3B82F6", "#F97316", "#10B981", "#8B5CF6"];

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
    if (viewMode === "week") d.setDate(d.getDate() + dir * 7);
    else d.setMonth(d.getMonth() + dir);
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

  const handleSave = useCallback(async (_shift: Shift) => {
    await loadShifts(currentDate);
  }, [currentDate, loadShifts]);

  const handleDelete = useCallback((shiftId: string) => {
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
    const erevName = !isSat && !isHoliday && holidays[formatDate(nextDay)] ? true : false;

    let bg = "bg-[#162038] hover:bg-[#1C2B4A]";
    let border = "border-white/[0.06] hover:border-white/[0.12]";

    if (todayDay) { bg = "bg-[#162C4A]"; border = "border-[#3B7FF5]"; }
    else if (isWorkedDay) { bg = "bg-green-900/20"; border = "border-green-700/40"; }
    else if (isHoliday || erevName) { bg = "bg-[#1D1830] hover:bg-[#231B40]"; border = "border-white/[0.06]"; }
    else if (isSat || isFri) { bg = "bg-[#1E1810] hover:bg-[#251F12]"; border = "border-white/[0.06]"; }

    const dayNumColor = todayDay
      ? "text-[#3B7FF5]"
      : isPast
      ? "text-[#4A6080]"
      : "text-[#E8EEFF]";

    const dayAbbrColor = (isHoliday || erevName)
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
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold text-[#E8EEFF]">לוח שנה</h1>
          <button
            onClick={() => setInfoOpen(true)}
            className="w-7 h-7 rounded-full bg-[#162038] text-[#6B8FAA] hover:text-[#E8EEFF] flex items-center justify-center text-sm font-bold transition-colors"
          >
            ?
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex bg-[#162038] rounded-lg p-0.5 text-xs">
            <button
              onClick={() => setViewMode("week")}
              className={`px-3 py-1 rounded-md font-medium transition-colors ${viewMode === "week" ? "bg-[#1C2B4A] text-[#E8EEFF]" : "text-[#3E5672]"}`}
            >
              שבועי
            </button>
            <button
              onClick={() => setViewMode("month")}
              className={`px-3 py-1 rounded-md font-medium transition-colors ${viewMode === "month" ? "bg-[#1C2B4A] text-[#E8EEFF]" : "text-[#3E5672]"}`}
            >
              חודשי
            </button>
          </div>
          <div className="flex items-center gap-1 flex-1 justify-center">
            <button onClick={() => navigate(-1)} className="p-1 text-[#6B8FAA] hover:text-[#E8EEFF] transition-colors">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><path d="m9 18 6-6-6-6" /></svg>
            </button>
            <span className="text-sm font-medium text-[#E8EEFF] min-w-[160px] text-center">{headerLabel}</span>
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
                  <p><span className="text-orange-400">■</span> שבת — בצבע חום/כתום</p>
                  <p><span className="text-purple-400">■</span> חג — בצבע סגול</p>
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
