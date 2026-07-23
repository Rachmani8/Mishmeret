"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { db } from "@/lib/db";
import type { Job, Shift } from "@/lib/db";
import { useShabbatTimes } from "@/lib/useShabbatTimes";
import { useHolidayTimes } from "@/lib/useHolidayTimes";
import {
  calcMonthlyPayslip,
  formatCurrency,
  MONTH_NAMES_HE,
} from "@/lib/calculations";

export default function PayslipPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [totalTips, setTotalTips] = useState(0);
  const shabbatTimes = useShabbatTimes(year);
  const holidays = useHolidayTimes(year);
  const [infoOpen, setInfoOpen] = useState(false);

  useEffect(() => {
    db.jobs.toArray().then((j) => {
      const sorted = j.slice().sort((a, b) => a.name.localeCompare(b.name, "he"));
      setJobs(sorted);
      if (sorted.length > 0) setSelectedJob(sorted[0]);
    });
  }, []);

  useEffect(() => {
    if (!selectedJob) return;
    const prefix = `${year}-${String(month).padStart(2, "0")}`;
    db.shifts
      .where("jobId").equals(selectedJob.id)
      .and((s) => s.date.startsWith(prefix))
      .toArray()
      .then((s) => {
        setShifts(s);
        setTotalTips(s.filter(x => x.isWorkDay).reduce((sum, x) => sum + (x.tips ?? 0), 0));
      });
  }, [selectedJob, year, month]);

  const payslip = useMemo(
    () => selectedJob ? calcMonthlyPayslip(shifts, selectedJob, shabbatTimes, holidays) : null,
    [shifts, selectedJob, shabbatTimes, holidays]
  );

  const navigate = (dir: -1 | 1) => {
    let m = month + dir;
    let y = year;
    if (m < 1) { m = 12; y--; }
    if (m > 12) { m = 1; y++; }
    setMonth(m);
    setYear(y);
  };

  return (
    <div className="flex flex-col min-h-full" dir="rtl">
      {/* Header */}
      <div className="sticky top-0 z-10 px-4 pt-4 pb-3 border-b" style={{ background: "#0C1221", borderColor: "rgba(255,255,255,0.07)" }}>
        <div className="relative flex items-center justify-center mb-3">
          <Link href="/settings" className="absolute left-0 w-8 h-8 rounded-full bg-[#162038] border border-white/10 hover:border-white/25 flex items-center justify-center text-[#6B8FAA] hover:text-[#E8EEFF] transition-all">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
            </svg>
          </Link>
          <h1 className="text-xl font-bold text-[#E8EEFF]">תלוש משוער</h1>
          <button
            onClick={() => setInfoOpen(true)}
            className="absolute right-0 w-7 h-7 rounded-full bg-[#FF6B2C]/15 text-[#FF6B2C] border border-[#FF6B2C]/50 hover:border-[#FF6B2C] hover:bg-[#FF6B2C]/25 flex items-center justify-center text-sm font-bold transition-all"
          >
            ?
          </button>
        </div>

        {jobs.length > 1 && (
          <div className="flex bg-[#162038] rounded-xl p-1 gap-1 w-fit mx-auto mb-3">
            {jobs.map((j) => (
              <button
                key={j.id}
                onClick={() => setSelectedJob(j)}
                className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                  selectedJob?.id === j.id ? "text-white" : "text-[#6B8FAA]"
                }`}
                style={selectedJob?.id === j.id ? { backgroundColor: j.color } : undefined}
              >
                {j.name}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between">
          <button onClick={() => navigate(-1)} className="p-1.5 text-[#6B8FAA] hover:text-[#E8EEFF] transition-colors">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><path d="m9 18 6-6-6-6" /></svg>
          </button>
          <span className="text-base font-semibold text-[#E8EEFF]">{MONTH_NAMES_HE[month - 1]} {year}</span>
          <button onClick={() => navigate(1)} className="p-1.5 text-[#6B8FAA] hover:text-[#E8EEFF] transition-colors">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><path d="m15 18-6-6 6-6" /></svg>
          </button>
        </div>
      </div>

      {jobs.length === 0 && (
        <div className="flex-1 flex items-center justify-center text-sm text-[#3E5672]">הגדר/י משרה תחילה</div>
      )}

      {jobs.length > 0 && !payslip && (
        <div className="flex-1 flex items-center justify-center text-sm text-[#3E5672]">אין נתונים לחודש זה</div>
      )}

      {payslip && (
        <div className="p-4 space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-[#162038] rounded-2xl p-3 text-center border" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
              <div className="text-xs text-[#6B8FAA] mb-1">ימי עבודה</div>
              <div className="text-lg font-bold text-[#3B7FF5]">{payslip.workDays}</div>
            </div>
            <div className="bg-[#162038] rounded-2xl p-3 text-center border" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
              <div className="text-xs text-[#6B8FAA] mb-1">שעות</div>
              <div className="text-lg font-bold text-green-400">
                {payslip.totalHours.toFixed(2)}
              </div>
            </div>
            <div className="bg-[#162038] rounded-2xl p-3 text-center border" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
              <div className="text-xs text-[#6B8FAA] mb-1">נטו</div>
              <div className="text-base font-bold text-green-400">{formatCurrency(payslip.netPay)}</div>
            </div>
          </div>

          {/* Income section */}
          <div className="bg-[#162038] border rounded-2xl px-4 py-1" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
            <h3 className="text-xs font-semibold text-[#3E5672] uppercase tracking-wide pt-3 pb-1">הכנסות</h3>
            <div className="flex items-center gap-2 py-2.5 border-b last:border-0" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
              <span className="flex-1 text-sm text-[#6B8FAA]">שכר בסיס</span>
              <span className="text-sm font-medium text-[#E8EEFF]">{formatCurrency(payslip.baseSalary)}</span>
            </div>
            {payslip.overtime1Pay > 0 && (
              <div className="flex items-center gap-2 py-2.5 border-b last:border-0" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
                <span className="flex-1 text-sm text-[#6B8FAA]">שעות נוספות 125%</span>
                <span className="text-sm font-medium text-[#E8EEFF]">{formatCurrency(payslip.overtime1Pay)}</span>
              </div>
            )}
            {payslip.overtime2Pay > 0 && (
              <div className="flex items-center gap-2 py-2.5 border-b last:border-0" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
                <span className="flex-1 text-sm text-[#6B8FAA]">שעות נוספות 150%</span>
                <span className="text-sm font-medium text-[#E8EEFF]">{formatCurrency(payslip.overtime2Pay)}</span>
              </div>
            )}
            {payslip.weekendHolidayBonus > 0 && (
              <div className="flex items-center gap-2 py-2.5 border-b last:border-0" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
                <span className="flex-1 text-sm text-[#6B8FAA]">תוספת שבת/חג 150%</span>
                <span className="text-sm font-medium text-[#E8EEFF]">{formatCurrency(payslip.weekendHolidayBonus)}</span>
              </div>
            )}
            <div className="flex items-center gap-2 py-2.5 last:border-0" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
              <span className="flex-1 text-sm text-[#6B8FAA]">נסיעות</span>
              <span className="text-sm font-medium text-[#E8EEFF]">{formatCurrency(payslip.commuteTotal)}</span>
            </div>
          </div>

          {/* Gross total card */}
          <div className="bg-orange-500 rounded-2xl px-4 py-4">
            <div className="flex items-center justify-between">
              <span className="text-white font-semibold text-base">ברוטו</span>
              <span className="text-white font-bold text-xl">{formatCurrency(payslip.grossTotal)}</span>
            </div>
          </div>

          {/* Deductions section */}
          <div className="bg-[#162038] border rounded-2xl px-4 py-1" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
            <h3 className="text-xs font-semibold text-[#3E5672] uppercase tracking-wide pt-3 pb-1">ניכויים</h3>
            {selectedJob?.pensionEnabled && (
              <div className="flex items-center gap-2 py-2.5 border-b last:border-0" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
                <span className="flex-1 text-sm text-[#6B8FAA]">פנסיה (עובד)</span>
                <span className="text-sm font-medium text-red-400">-{formatCurrency(payslip.pensionEmployee)}</span>
              </div>
            )}
            <div className="flex items-center gap-2 py-2.5 border-b last:border-0" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
              <span className="flex-1 text-sm text-[#6B8FAA]">ביטוח לאומי</span>
              <span className="text-sm font-medium text-red-400">-{formatCurrency(payslip.nationalInsurance)}</span>
            </div>
            <div className="flex items-center gap-2 py-2.5 border-b last:border-0" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
              <span className="flex-1 text-sm text-[#6B8FAA]">ביטוח בריאות</span>
              <span className="text-sm font-medium text-red-400">-{formatCurrency(payslip.healthInsurance)}</span>
            </div>
            <div className="flex items-center gap-2 py-2.5 last:border-0" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
              <span className="flex-1 text-sm text-[#6B8FAA]">מס הכנסה</span>
              <span className="text-sm font-medium text-red-400">-{formatCurrency(payslip.incomeTax)}</span>
            </div>
          </div>

          {/* Net */}
          <div className="bg-green-600 rounded-2xl px-4 py-4 flex items-center justify-between">
            <span className="text-white font-semibold text-base">נטו לתשלום</span>
            <span className="text-white font-bold text-xl">{formatCurrency(payslip.netPay)}</span>
          </div>

          {/* Tips */}
          {totalTips > 0 && (
            <div className="bg-amber-900/20 border border-amber-700/30 rounded-2xl px-4 py-4 flex items-center justify-between">
              <div>
                <span className="text-amber-300 font-semibold text-base">טיפים החודש</span>
                <p className="text-xs text-amber-500/80 mt-0.5">מזומן שהתקבל ישירות — לא נכלל בשכר</p>
              </div>
              <span className="text-amber-300 font-bold text-xl">{formatCurrency(totalTips)}</span>
            </div>
          )}
        </div>
      )}

      {/* Info modal */}
      {infoOpen && (
        <>
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={() => setInfoOpen(false)} />
          <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 bg-[#162038] border rounded-2xl shadow-2xl max-w-[400px] mx-auto p-6" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
            <h2 className="text-base font-bold text-[#E8EEFF] mb-4">תלוש משוער — מה זה אומר?</h2>
            <div className="space-y-4">
              <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 px-3 py-2">
                <p className="text-sm text-blue-300/80 leading-relaxed">זהו תלוש <span className="font-semibold">משוער בלבד</span> — מבוסס על המשמרות שרשמת. לא מסמך רשמי.</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-[#E8EEFF] mb-1">מה מוצג</p>
                <p className="text-sm text-[#6B8FAA] leading-relaxed">ברוטו (בסיס + שעות נוספות + תוספות), וניכויים: ביטוח לאומי, בריאות, מס הכנסה ופנסיה.</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-[#E8EEFF] mb-1">טיפים</p>
                <p className="text-sm text-[#6B8FAA] leading-relaxed">נרשמים בנפרד ואינם נכללים בחישוב המס — כנדרש בחוק.</p>
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
