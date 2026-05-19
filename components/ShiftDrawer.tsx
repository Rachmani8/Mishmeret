"use client";

import { useEffect, useRef, useState } from "react";
import type { Job, Shift } from "@/lib/db";
import { defaultShift } from "@/lib/db";
import { SHIFT_TYPE_LABELS } from "@/lib/calculations";

const shiftTypes = ["morning", "afternoon", "evening", "general"] as const;

interface Props {
  date: string | null;
  job: Job | null;
  existingShift: Shift | null;
  onClose: () => void;
  onSave: (shift: Shift) => void;
  onDelete: (shiftId: string) => void;
}

export default function ShiftDrawer({ date, job, existingShift, onClose, onSave, onDelete }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [form, setForm] = useState<Shift | null>(null);

  useEffect(() => {
    if (!date || !job) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm(existingShift ? { ...existingShift } : defaultShift(date, job.id));
  }, [date, job, existingShift]);

  if (!date || !job || !form) return null;

  const dateObj = new Date(date + "T00:00:00");
  const dayNames = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
  const dayLabel = `${dateObj.getDate()}/${dateObj.getMonth() + 1}/${dateObj.getFullYear()} — יום ${dayNames[dateObj.getDay()]}`;

  const handleSave = () => {
    onSave(form);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        ref={overlayRef}
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Drawer */}
      <div className="fixed bottom-16 right-0 left-0 z-50 bg-white rounded-t-2xl shadow-2xl max-w-[430px] mx-auto animate-slide-up">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        <div className="px-5 pb-6 max-h-[75vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between py-3 border-b border-gray-100 mb-4">
            <h2 className="text-base font-semibold text-gray-900">{dayLabel}</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Is work day toggle */}
          <div className="flex items-center justify-between py-3 mb-4">
            <label className="text-sm font-medium text-gray-700">יום עבודה</label>
            <button
              onClick={() => setForm({ ...form, isWorkDay: !form.isWorkDay })}
              className={`relative w-12 h-6 rounded-full transition-colors ${form.isWorkDay ? "bg-blue-600" : "bg-gray-200"}`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${form.isWorkDay ? "right-0.5" : "left-0.5"}`}
              />
            </button>
          </div>

          {form.isWorkDay && (
            <div className="space-y-4">
              {/* Shift type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">סוג משמרת</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {shiftTypes.map((type) => (
                    <button
                      key={type}
                      onClick={() => setForm({ ...form, shiftType: type })}
                      className={`py-2 text-xs rounded-lg border font-medium transition-colors ${
                        form.shiftType === type
                          ? "border-blue-500 bg-blue-50 text-blue-600"
                          : "border-gray-200 text-gray-600 hover:border-gray-300"
                      }`}
                    >
                      {SHIFT_TYPE_LABELS[type]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Clock in / Clock out */}
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
                  placeholder="הוסף הערה..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 mt-6 pb-2">
            {existingShift && (
              <button
                onClick={() => { onDelete(existingShift.id); onClose(); }}
                className="flex-none px-4 py-2.5 text-sm font-medium text-red-500 border border-red-300 rounded-xl hover:bg-red-50 transition-colors"
              >
                מחק
              </button>
            )}
            <button
              onClick={handleSave}
              className="flex-1 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors"
            >
              שמור
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
