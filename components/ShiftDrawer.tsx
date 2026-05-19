"use client";

import { useEffect, useRef, useState } from "react";
import { db } from "@/lib/db";
import type { Job, Shift } from "@/lib/db";
import { defaultShift } from "@/lib/db";

interface Props {
  date: string | null;
  job: Job | null;
  jobs: Job[];
  holidayLabel?: string;
  openShiftId?: string | null;
  onClose: () => void;
  onSave: (shift: Shift) => void;
  onDelete: (shiftId: string) => void;
}

export default function ShiftDrawer({ date, job, jobs, holidayLabel, openShiftId, onClose, onSave, onDelete }: Props) {
  const [dayShifts, setDayShifts] = useState<Shift[]>([]);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [form, setForm] = useState<Shift | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "form">("list");
  const openShiftIdRef = useRef(openShiftId);
  openShiftIdRef.current = openShiftId;

  const loadDayShifts = async (d: string) => {
    const found = await db.shifts.where("date").equals(d).toArray();
    setDayShifts(found.sort((a, b) => a.clockIn.localeCompare(b.clockIn)));
  };

  useEffect(() => {
    if (!date) return;
    setViewMode("list");
    setEditingShift(null);
    setForm(null);
    db.shifts.where("date").equals(date).toArray().then((found) => {
      const sorted = found.sort((a, b) => a.clockIn.localeCompare(b.clockIn));
      setDayShifts(sorted);
      const sid = openShiftIdRef.current;
      if (sid) {
        const target = sorted.find((s) => s.id === sid);
        if (target) {
          setEditingShift(target);
          setForm({ ...target });
          setViewMode("form");
        }
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const openNewForm = () => {
    if (!date || !job) return;
    setEditingShift(null);
    setForm(defaultShift(date, job.id));
    setViewMode("form");
  };

  const openEditForm = (s: Shift) => {
    setEditingShift(s);
    setForm({ ...s });
    setViewMode("form");
  };

  const handleSave = async () => {
    if (!form || !date) return;
    const shift = { ...form, isWorkDay: true };
    await db.shifts.put(shift);
    onSave(shift);
    await loadDayShifts(date);
    setViewMode("list");
    setEditingShift(null);
    setForm(null);
  };

  const handleDelete = async () => {
    if (!editingShift || !date) return;
    await db.shifts.delete(editingShift.id);
    onDelete(editingShift.id);
    await loadDayShifts(date);
    setViewMode("list");
    setEditingShift(null);
    setForm(null);
  };

  if (!date || !job) return null;

  const dateObj = new Date(date + "T00:00:00");
  const dayNames = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
  const dayLabel = `${dateObj.getDate()}/${dateObj.getMonth() + 1}/${dateObj.getFullYear()} — יום ${dayNames[dateObj.getDay()]}`;
  const isSat = dateObj.getDay() === 6;
  const headerColor = holidayLabel ? "text-purple-600" : isSat ? "text-orange-500" : "text-gray-900";

  const formJob = form ? (jobs.find((j) => j.id === form.jobId) ?? job) : null;
  const handleColor = formJob?.color ?? "#d1d5db";
  const jobNameMap = Object.fromEntries(jobs.map((j) => [j.id, j.name]));

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed bottom-16 right-0 left-0 z-50 bg-white rounded-t-2xl shadow-2xl max-w-[430px] mx-auto animate-slide-up">
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full transition-colors duration-200" style={{ backgroundColor: handleColor }} />
        </div>

        <div className="px-5 pb-6 max-h-[75vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between py-3 border-b border-gray-100 mb-4">
            <div className="flex items-center gap-1">
              {viewMode === "form" && (
                <button
                  onClick={() => { setViewMode("list"); setEditingShift(null); setForm(null); }}
                  className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 -me-1"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
                    <path d="m15 18-6-6 6-6" />
                  </svg>
                </button>
              )}
              <div>
                <h2 className={`text-base font-semibold ${headerColor}`}>{dayLabel}</h2>
                {holidayLabel && <p className={`text-xs font-medium mt-0.5 ${headerColor}`}>{holidayLabel}</p>}
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* List view */}
          {viewMode === "list" && (
            <div className="space-y-2">
              {dayShifts.map((s, i) => {
                const rowJob = jobs.find((j) => j.id === s.jobId);
                const rowColor = rowJob?.color ?? "#EF4444";
                return (
                <div
                  key={s.id}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl border"
                  style={{ backgroundColor: `${rowColor}18`, borderColor: rowColor }}
                >
                  {(dayShifts.length > 1 || jobs.length > 1) && (
                    <span className="text-sm text-gray-600 flex-none">
                      {dayShifts.length > 1 ? `${i + 1}` : ""}
                      {dayShifts.length > 1 && jobs.length > 1 ? " · " : ""}
                      {jobs.length > 1 ? jobNameMap[s.jobId] ?? "" : ""}
                    </span>
                  )}
                  <span className="text-sm font-bold text-gray-900 flex-1 text-center">
                    {s.clockIn} → {s.clockOut}
                  </span>
                  <div className="flex gap-3 flex-none">
                    <button
                      onClick={() => openEditForm(s)}
                      className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors underline"
                    >
                      ערוך
                    </button>
                    <button
                      onClick={async () => {
                        await db.shifts.delete(s.id);
                        onDelete(s.id);
                        await loadDayShifts(date!);
                      }}
                      className="text-sm font-medium text-red-500 hover:text-red-600 transition-colors underline"
                    >
                      מחק
                    </button>
                  </div>
                </div>
                );
              })}
              {dayShifts.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-6">אין משמרות ביום זה</p>
              )}
              <button
                onClick={openNewForm}
                className="w-full py-3 rounded-xl border border-dashed border-gray-300 text-sm font-medium text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors"
              >
                + הוסף משמרת
              </button>
            </div>
          )}

          {/* Form view */}
          {viewMode === "form" && form && (
            <>
              <div className="space-y-4">
                {/* Job selector */}
                {jobs.length > 1 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">משרה</label>
                    <select
                      value={form.jobId}
                      onChange={(e) => setForm({ ...form, jobId: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                      style={{
                        backgroundColor: `${formJob?.color ?? "#EF4444"}18`,
                        borderColor: formJob?.color ?? "#EF4444",
                        color: formJob?.color ?? "#EF4444",
                      }}
                    >
                      {jobs.map((j) => (
                        <option key={j.id} value={j.id} style={{ color: "#111827", backgroundColor: "#ffffff" }}>{j.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Clock in / out */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">שעת כניסה</label>
                    <input
                      type="time"
                      value={form.clockIn}
                      onChange={(e) => setForm({ ...form, clockIn: e.target.value })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-center"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">שעת יציאה</label>
                    <input
                      type="time"
                      value={form.clockOut}
                      onChange={(e) => setForm({ ...form, clockOut: e.target.value })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-center"
                    />
                  </div>
                </div>

                {/* Tips */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">טיפים (₪)</label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={form.tips ?? 0}
                    onChange={(e) => setForm({ ...form, tips: Number(e.target.value) || 0 })}
                    onFocus={(e) => e.target.select()}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0"
                  />
                  <p className="text-xs text-gray-400 mt-1">מזומן שהתקבל ישירות — לא נכלל בחישוב השכר</p>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">הערות</label>
                  <textarea
                    rows={2}
                    maxLength={500}
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    placeholder="הוסף/י הערה..."
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6 pb-2">
                {editingShift && (
                  <button
                    onClick={handleDelete}
                    className="flex-none px-4 py-2.5 text-sm font-medium text-red-500 border border-red-300 rounded-xl hover:bg-red-50 transition-colors"
                  >
                    מחק/י
                  </button>
                )}
                <button
                  onClick={handleSave}
                  className="flex-1 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors"
                >
                  שמור/י
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
