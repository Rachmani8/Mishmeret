"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { db } from "@/lib/db";
import type { Job, Shift } from "@/lib/db";
import { defaultShift } from "@/lib/db";
import ShiftDrawer from "@/components/ShiftDrawer";

type ClockState = "idle" | "clocked-in" | "clocked-out" | "reviewed";

const JOB_COLORS = ["#3B82F6", "#F97316", "#10B981", "#8B5CF6"];

function nowTime() {
  const n = new Date();
  return `${String(n.getHours()).padStart(2, "0")}:${String(n.getMinutes()).padStart(2, "0")}`;
}

function timeToSeconds(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 3600 + m * 60;
}

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function calcDuration(clockIn: string, clockOut: string): string {
  const totalMin = timeToSeconds(clockOut) / 60 - timeToSeconds(clockIn) / 60;
  const h = Math.floor(totalMin / 60);
  const m = Math.round(totalMin % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export default function ClockPage() {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const [currentTime, setCurrentTime] = useState(nowTime());
  const [jobs, setJobs] = useState<Job[]>([]);
  const [clockJob, setClockJob] = useState<Job | null>(null);
  const [todayShifts, setTodayShifts] = useState<Shift[]>([]);
  const shiftsLoadedRef = useRef(false);

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
  const [clockShiftId, setClockShiftId] = useState<string | null>(
    () => typeof window !== "undefined" ? localStorage.getItem(`clockShiftId_${todayStr}`) : null
  );
  const [firstClockShiftId, setFirstClockShiftId] = useState<string | null>(
    () => typeof window !== "undefined" ? localStorage.getItem(`firstClockShiftId_${todayStr}`) : null
  );

  const [elapsed, setElapsed] = useState(0);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [drawerShiftId, setDrawerShiftId] = useState<string | null>(null);

  useEffect(() => {
    db.jobs.toArray().then((j) => {
      const sorted = j.slice().sort((a, b) => a.name.localeCompare(b.name, "he"));
      setJobs(sorted);
      if (sorted.length > 0) setClockJob(sorted[0]);
    });
  }, []);

  const loadTodayShifts = useCallback(async () => {
    const data = await db.shifts.filter((s) => s.date === todayStr).toArray();
    setTodayShifts(data);
    shiftsLoadedRef.current = true;
  }, [todayStr]);

  useEffect(() => { loadTodayShifts(); }, [loadTodayShifts]);

  // Tick current time every second (idle display)
  useEffect(() => {
    const id = setInterval(() => setCurrentTime(nowTime()), 1000);
    return () => clearInterval(id);
  }, []);

  // Elapsed timer while clocked in
  useEffect(() => {
    if (clockState !== "clocked-in" || !todayClockIn) return;
    const start = timeToSeconds(todayClockIn);
    const tick = () => {
      const n = new Date();
      const nowSec = n.getHours() * 3600 + n.getMinutes() * 60 + n.getSeconds();
      setElapsed(Math.max(0, nowSec - start));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [clockState, todayClockIn]);

  // Guard: reset to idle if tracked shifts were deleted externally
  useEffect(() => {
    if (!shiftsLoadedRef.current) return;
    if (clockState === "idle" || clockState === "clocked-in") return;
    const ids = todayShifts.map((s) => s.id);
    const shift1Exists = clockShiftId ? ids.includes(clockShiftId) : false;
    const shift2Exists = firstClockShiftId ? ids.includes(firstClockShiftId) : false;
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
  }, [todayShifts, todayStr]);

  const handleClockIn = async () => {
    if (!clockJob) return;
    const time = nowTime();
    const shift =
      clockState === "reviewed"
        ? defaultShift(todayStr, clockJob.id, { clockIn: time })
        : (() => {
            const existing = todayShifts.find((s) => s.jobId === clockJob.id);
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
    await loadTodayShifts();
  };

  const handleClockOut = async () => {
    if (!clockJob) return;
    const time = nowTime();
    const existing = clockShiftId
      ? todayShifts.find((s) => s.id === clockShiftId)
      : todayShifts.find((s) => s.jobId === clockJob.id);
    if (existing) await db.shifts.put({ ...existing, clockOut: time });
    setTodayClockOut(time);
    setClockState("clocked-out");
    localStorage.setItem(`clockState_${todayStr}`, "clocked-out");
    localStorage.setItem(`clockOut_${todayStr}`, time);
    await loadTodayShifts();
  };

  const handleSave = useCallback(async (shift: Shift) => {
    await loadTodayShifts();
    if (shift.date === todayStr) {
      setTodayClockIn(shift.clockIn);
      setTodayClockOut(shift.clockOut);
      localStorage.setItem(`clockIn_${todayStr}`, shift.clockIn);
      localStorage.setItem(`clockOut_${todayStr}`, shift.clockOut);
      if (localStorage.getItem(`clockState_${todayStr}`) === "clocked-out") {
        setClockState("reviewed");
        localStorage.setItem(`clockState_${todayStr}`, "reviewed");
      }
    }
  }, [loadTodayShifts, todayStr]);

  const handleDelete = useCallback((shiftId: string) => {
    const isFirst = shiftId === firstClockShiftId;
    const isSecond = shiftId === clockShiftId;

    setTodayShifts((prev) => prev.filter((s) => s.id !== shiftId));

    if (isFirst && clockShiftId) {
      setFirstClockShiftId(null);
      localStorage.removeItem(`firstClockShiftId_${todayStr}`);
    } else if (isSecond && firstClockShiftId) {
      const remaining = todayShifts.find((s) => s.id === firstClockShiftId);
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
    } else {
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
  }, [todayShifts, todayStr, clockShiftId, firstClockShiftId]);

  const shiftJobFor = (shiftId: string | null) => {
    const s = shiftId ? todayShifts.find((x) => x.id === shiftId) : null;
    return s ? jobs.find((j) => j.id === s.jobId) ?? null : null;
  };

  const jobColorMap = Object.fromEntries(
    jobs.map((j, i) => [j.id, j.color ?? JOB_COLORS[i % JOB_COLORS.length]])
  );

  const editIcon = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3.5 h-3.5">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );

  const hasTwoShifts =
    !!firstClockShiftId && !!clockShiftId && firstClockShiftId !== clockShiftId;

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-64px)] px-6 py-8" dir="rtl">

      {/* ── Job selector (idle only, multi-job) ─────────────────────── */}
      {jobs.length > 1 && (clockState === "idle" || clockState === "reviewed") && (
        <div className="flex gap-2 mb-8 w-full max-w-xs">
          {jobs.map((j) => {
            const isActive = clockJob?.id === j.id;
            const color = j.color ?? "#3B82F6";
            return (
              <button
                key={j.id}
                onClick={() => setClockJob(j)}
                style={isActive ? { backgroundColor: color, borderColor: color } : undefined}
                className={`flex-1 py-2 text-sm font-medium rounded-xl border transition-colors ${
                  isActive ? "text-white" : "border-gray-200 text-gray-600"
                }`}
              >
                {j.name}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Animated clock circle ───────────────────────────────────── */}
      <div className="relative w-52 h-52 mb-8 flex-shrink-0">
        {/* Idle ring — breathing blue pulse */}
        {clockState === "idle" && (
          <div className="absolute inset-0 rounded-full border-4 border-blue-500 animate-pulse-ring" />
        )}

        {/* Clocked-in ring — rotating green arc */}
        {clockState === "clocked-in" && (
          <>
            <div
              className="absolute inset-0 rounded-full animate-spin-slow"
              style={{ background: "conic-gradient(#10B981 0deg, transparent 110deg, transparent 360deg)" }}
            />
            <div className="absolute rounded-full bg-white" style={{ inset: "5px" }} />
          </>
        )}

        {/* Clocked-out ring — static gray */}
        {clockState === "clocked-out" && (
          <div className="absolute inset-0 rounded-full border-4 border-gray-200" />
        )}

        {/* Reviewed ring — static green */}
        {clockState === "reviewed" && (
          <div className="absolute inset-0 rounded-full border-4 border-green-400" />
        )}

        {/* Circle content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
          {clockState === "idle" && (
            <>
              <span className="text-4xl font-bold tabular-nums text-gray-900">{currentTime}</span>
              <span className="text-xs text-gray-400">שעה נוכחית</span>
            </>
          )}
          {clockState === "clocked-in" && (
            <>
              <span className="text-3xl font-bold tabular-nums text-green-600">{formatElapsed(elapsed)}</span>
              <span className="text-xs text-gray-400">שעות:דקות:שניות</span>
            </>
          )}
          {clockState === "clocked-out" && todayClockIn && todayClockOut && (
            <>
              <span className="text-3xl font-bold tabular-nums text-gray-700">
                {calcDuration(todayClockIn, todayClockOut)}
              </span>
              <span className="text-xs text-gray-400">שעות:דקות</span>
            </>
          )}
          {clockState === "reviewed" && (
            <svg viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth={2} className="w-14 h-14">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          )}
        </div>
      </div>

      {/* ── Status text ─────────────────────────────────────────────── */}
      <div className="mb-8 text-center min-h-[32px] flex items-center justify-center">
        {clockState === "idle" && (
          <p className="text-sm text-gray-400">אין משמרת פעילה</p>
        )}
        {clockState === "clocked-in" && (
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-green-700 bg-green-50 px-3 py-1.5 rounded-full border border-green-200">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            משמרת פעילה — כניסה {todayClockIn}
          </span>
        )}
        {clockState === "clocked-out" && (
          <p className="text-sm text-gray-500">המשמרת הסתיימה — אשר/י את היום</p>
        )}
        {clockState === "reviewed" && !hasTwoShifts && (
          <p className="text-sm text-green-600 font-medium">היום אושר ✓</p>
        )}
      </div>

      {/* ── Primary action area ─────────────────────────────────────── */}
      <div className="w-full max-w-xs space-y-3">

        {/* IDLE → clock in */}
        {clockState === "idle" && (
          <button
            onClick={handleClockIn}
            disabled={!clockJob}
            className="w-full py-4 bg-green-500 hover:bg-green-600 disabled:opacity-40 text-white font-bold rounded-2xl text-base flex items-center justify-center gap-2 transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            התחל משמרת
          </button>
        )}

        {/* CLOCKED-IN → clock out */}
        {clockState === "clocked-in" && (
          <button
            onClick={handleClockOut}
            className="w-full py-4 bg-red-500 hover:bg-red-600 text-white font-bold rounded-2xl text-base flex items-center justify-center gap-2 transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
              <rect x="4" y="4" width="16" height="16" rx="2" />
            </svg>
            סיום משמרת
          </button>
        )}

        {/* CLOCKED-OUT → verify day */}
        {clockState === "clocked-out" && (
          <button
            onClick={() => { setDrawerShiftId(null); setSelectedDate(todayStr); }}
            className="w-full py-4 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-2xl text-base flex items-center justify-center gap-2 transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-5 h-5">
              <path d="M9 11l3 3L22 4" />
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
            ווידוא יום
          </button>
        )}

        {/* REVIEWED → show summaries + optional second shift */}
        {clockState === "reviewed" && (
          <>
            {hasTwoShifts ? (
              <div className="space-y-2">
                {([firstClockShiftId, clockShiftId] as string[]).map((sid, i) => {
                  const s = todayShifts.find((x) => x.id === sid);
                  const j = shiftJobFor(sid);
                  const color = j ? (jobColorMap[j.id] ?? "#3B82F6") : "#3B82F6";
                  if (!s) return null;
                  return (
                    <div key={i} className="flex items-center gap-2">
                      <div className="flex-1 px-3 py-2 rounded-2xl" style={{ backgroundColor: `${color}1a` }}>
                        {j && (
                          <div className="text-xs font-semibold leading-tight" style={{ color }}>
                            {j.name}
                          </div>
                        )}
                        <div className="text-xs text-gray-400">משמרת {i + 1}</div>
                        <div className="text-sm font-bold text-gray-900" dir="ltr">
                          {s.clockIn} → {s.clockOut}
                        </div>
                      </div>
                      <button
                        onClick={() => { setDrawerShiftId(sid); setSelectedDate(todayStr); }}
                        className="w-7 h-7 rounded-xl bg-orange-500 hover:bg-orange-600 flex items-center justify-center transition-colors text-white flex-none"
                      >
                        {editIcon}
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                {(() => {
                  const singleJob = shiftJobFor(clockShiftId) ?? clockJob;
                  const color = singleJob ? (jobColorMap[singleJob.id] ?? "#3B82F6") : "#3B82F6";
                  return (
                    <div className="flex-1 px-3 py-2 rounded-2xl" style={{ backgroundColor: `${color}1a` }}>
                      {singleJob && (
                        <div className="text-xs font-semibold leading-tight" style={{ color }}>
                          {singleJob.name}
                        </div>
                      )}
                      <div className="text-xs text-gray-400">היום</div>
                      <div className="text-sm font-bold text-gray-900" dir="ltr">
                        {todayClockIn} → {todayClockOut}
                      </div>
                    </div>
                  );
                })()}
                <button
                  onClick={() => { setDrawerShiftId(clockShiftId); setSelectedDate(todayStr); }}
                  className="w-7 h-7 rounded-xl bg-orange-500 hover:bg-orange-600 flex items-center justify-center transition-colors text-white flex-none"
                >
                  {editIcon}
                </button>
              </div>
            )}

            <button
              onClick={handleClockIn}
              disabled={!clockJob}
              className="w-full py-3.5 bg-green-500 hover:bg-green-600 disabled:opacity-40 text-white font-bold rounded-2xl text-sm flex items-center justify-center gap-1.5 transition-colors"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              כניסה למשמרת נוספת
            </button>
          </>
        )}
      </div>

      {/* ── ShiftDrawer ─────────────────────────────────────────────── */}
      <ShiftDrawer
        date={selectedDate}
        job={clockJob}
        jobs={jobs}
        openShiftId={drawerShiftId}
        onClose={() => { setSelectedDate(null); setDrawerShiftId(null); loadTodayShifts(); }}
        onSave={handleSave}
        onDelete={handleDelete}
      />
    </div>
  );
}
