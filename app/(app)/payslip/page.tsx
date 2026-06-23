"use client";

import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/db";
import type { Job, Shift } from "@/lib/db";
import { useShabbatTimes } from "@/lib/useShabbatTimes";
import { useHolidayTimes } from "@/lib/useHolidayTimes";
import {
  calcMonthlyPayslip,
  formatCurrency,
  MONTH_NAMES_HE,
} from "@/lib/calculations";

interface ActualValues {
  baseSalary: string;
  overtime1Pay: string;
  overtime2Pay: string;
  weekendBonus: string;
  commute: string;
  grossTotal: string;
  pensionEmployee: string;
  nationalInsurance: string;
  healthInsurance: string;
  incomeTax: string;
  netPay: string;
}

const emptyActual = (): ActualValues => ({
  baseSalary: "", overtime1Pay: "", overtime2Pay: "", weekendBonus: "", commute: "", grossTotal: "",
  pensionEmployee: "", nationalInsurance: "", healthInsurance: "", incomeTax: "", netPay: "",
});

function Row({
  label,
  calculated,
  actual,
  onChange,
  isNegative = false,
  bold = false,
  hours,
}: {
  label: string;
  calculated: number;
  actual: string;
  onChange: (v: string) => void;
  isNegative?: boolean;
  bold?: boolean;
  hours?: number;
}) {
  const actualNum = parseFloat(actual);
  const diff = !isNaN(actualNum) ? actualNum - calculated : null;
  const hasDiscrepancy = diff !== null && Math.abs(diff) >= 1;
  const walletImpact = diff !== null ? (isNegative ? -diff : diff) : null;
  const isGood = walletImpact !== null && walletImpact > 0;

  return (
    <div className={`flex items-center gap-2 py-2.5 last:border-0 ${bold ? "border-t mt-1 pt-3" : "border-b"}`}
      style={{ borderColor: "rgba(255,255,255,0.08)" }}>
      <span className={`flex-1 text-sm ${bold ? "font-semibold text-[#E8EEFF]" : "text-[#6B8FAA]"}`}>{label}</span>
      <span className="text-sm font-medium text-[#3E5672] w-16 text-left">
        {hours !== undefined ? `${hours.toFixed(2)} ש׳` : ""}
      </span>
      <span dir="ltr" className={`text-sm font-medium w-24 text-left ${isNegative ? "text-red-400" : bold ? "text-[#3B7FF5] font-bold" : "text-[#E8EEFF]"}`}>
        {isNegative ? "-" : ""}{formatCurrency(calculated).replace("₪", "")}
      </span>
      <div className="relative w-24">
        <input
          type="number"
          placeholder="בפועל"
          value={actual}
          onChange={(e) => onChange(e.target.value)}
          onFocus={(e) => e.target.select()}
          className={`w-full text-sm px-2 py-1 rounded-lg text-center focus:outline-none focus:ring-2 border ${
            hasDiscrepancy
              ? isGood
                ? "border-green-500 ring-green-500/20 bg-green-900/20 text-green-400"
                : "border-red-500 ring-red-500/20 bg-red-900/20 text-red-400"
              : "border-white/[0.15] bg-[#0C1221] text-[#E8EEFF] focus:ring-[#3B7FF5]/40"
          }`}
        />
        {hasDiscrepancy && (
          <span className={`absolute -top-4 right-0 text-[10px] font-medium ${isGood ? "text-green-400" : "text-red-400"}`}>
            {walletImpact! > 0 ? "+" : ""}{walletImpact!.toFixed(0)}₪
          </span>
        )}
      </div>
    </div>
  );
}

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
  const [actual, setActual] = useState<ActualValues>(emptyActual());
  const [showValidator, setShowValidator] = useState(false);
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
    setActual(emptyActual());
  };

  const setActualField = (key: keyof ActualValues, v: string) =>
    setActual((prev) => ({ ...prev, [key]: v }));

  return (
    <div className="flex flex-col min-h-full" dir="rtl">
      {/* Header */}
      <div className="sticky top-0 z-10 px-4 pt-4 pb-3 border-b" style={{ background: "#0C1221", borderColor: "rgba(255,255,255,0.07)" }}>
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold text-[#E8EEFF]">תלוש משוער</h1>
          <button
            onClick={() => setInfoOpen(true)}
            className="w-7 h-7 rounded-full bg-[#162038] text-[#5b9af5] border border-[#3B7FF5]/40 hover:border-[#3B7FF5]/80 hover:text-white flex items-center justify-center text-sm font-bold transition-all"
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

          {/* Column headers (validator mode) */}
          {showValidator && (
            <div className="flex items-center gap-2 px-0">
              <span className="flex-1" />
              <span className="text-xs text-[#3E5672] w-24 text-center">מחושב</span>
              <span className="text-xs text-[#3E5672] w-24 text-center">בתלוש בפועל</span>
            </div>
          )}

          {/* Income section */}
          <div className="bg-[#162038] border rounded-2xl px-4 py-1" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
            <h3 className="text-xs font-semibold text-[#3E5672] uppercase tracking-wide pt-3 pb-1">הכנסות</h3>
            <Row label="שכר בסיס" calculated={payslip.baseSalary} actual={actual.baseSalary} onChange={(v) => setActualField("baseSalary", v)} hours={payslip.totalHours} />
            {payslip.overtime1Pay > 0 && (
              <Row label="שעות נוספות 125%" calculated={payslip.overtime1Pay} actual={actual.overtime1Pay} onChange={(v) => setActualField("overtime1Pay", v)} hours={payslip.overtime1Hours} />
            )}
            {payslip.overtime2Pay > 0 && (
              <Row label="שעות נוספות 150%" calculated={payslip.overtime2Pay} actual={actual.overtime2Pay} onChange={(v) => setActualField("overtime2Pay", v)} hours={payslip.overtime2Hours} />
            )}
            {payslip.weekendHolidayBonus > 0 && (
              <Row label="תוספת שבת/חג 150%" calculated={payslip.weekendHolidayBonus} actual={actual.weekendBonus} onChange={(v) => setActualField("weekendBonus", v)} hours={payslip.weekendHours} />
            )}
            <Row label="נסיעות" calculated={payslip.commuteTotal} actual={actual.commute} onChange={(v) => setActualField("commute", v)} />
          </div>

          {/* Gross total card */}
          <div className="bg-orange-500 rounded-2xl px-4 py-4">
            <div className="flex items-center justify-between">
              <span className="text-white font-semibold text-base">ברוטו</span>
              <span className="text-white font-bold text-xl">{formatCurrency(payslip.grossTotal)}</span>
            </div>
            {showValidator && (
              <div className="mt-2 flex items-center gap-2 justify-end">
                <span className="text-orange-200 text-xs">בפועל:</span>
                <input
                  type="number"
                  placeholder="הזן/י סכום"
                  value={actual.grossTotal}
                  onChange={(e) => setActualField("grossTotal", e.target.value)}
                  onFocus={(e) => e.target.select()}
                  className="w-28 text-sm px-2 py-1 border border-orange-300 rounded-lg text-center bg-orange-400 text-white placeholder-orange-200 focus:outline-none focus:ring-2 focus:ring-white/50"
                />
              </div>
            )}
          </div>

          {/* Deductions section */}
          <div className="bg-[#162038] border rounded-2xl px-4 py-1" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
            <h3 className="text-xs font-semibold text-[#3E5672] uppercase tracking-wide pt-3 pb-1">ניכויים</h3>
            {selectedJob?.pensionEnabled && (
              <Row label="פנסיה (עובד)" calculated={payslip.pensionEmployee} actual={actual.pensionEmployee} onChange={(v) => setActualField("pensionEmployee", v)} isNegative />
            )}
            <Row label="ביטוח לאומי" calculated={payslip.nationalInsurance} actual={actual.nationalInsurance} onChange={(v) => setActualField("nationalInsurance", v)} isNegative />
            <Row label="ביטוח בריאות" calculated={payslip.healthInsurance} actual={actual.healthInsurance} onChange={(v) => setActualField("healthInsurance", v)} isNegative />
            <Row label="מס הכנסה" calculated={payslip.incomeTax} actual={actual.incomeTax} onChange={(v) => setActualField("incomeTax", v)} isNegative />
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

          {/* Validator toggle */}
          <button
            onClick={() => setShowValidator(!showValidator)}
            className="w-full py-3 rounded-2xl text-sm font-medium transition-colors border-2 border-dashed text-[#6B8FAA] hover:text-[#3B7FF5] hover:border-[#3B7FF5]/50"
            style={{ borderColor: "rgba(255,255,255,0.12)" }}
          >
            {showValidator ? "סגור/י בדיקת תלוש" : "בדיקת תלוש בפועל"}
          </button>

          {showValidator && (
            <div className="bg-amber-900/20 border border-amber-700/30 rounded-2xl px-4 py-3">
              <p className="text-xs text-amber-400 font-medium mb-1">הנחיות:</p>
              <p className="text-xs text-amber-500/90">הזן/י את הסכומים מהתלוש שלך בעמודה &quot;בפועל&quot;. הערכים יסומנו בירוק (לטובתך) או אדום (לרעתך) אם יש פערים משמעותיים.</p>
            </div>
          )}
        </div>
      )}

      {/* Info modal */}
      {infoOpen && (
        <>
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={() => setInfoOpen(false)} />
          <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 bg-[#162038] border rounded-2xl shadow-2xl max-w-[400px] mx-auto p-6" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
            <h2 className="text-base font-bold text-[#E8EEFF] mb-4">תלוש משוער — מה יש פה?</h2>
            <div className="space-y-4">
              <div>
                <p className="text-sm font-semibold text-[#E8EEFF] mb-1">חישוב שכר</p>
                <p className="text-sm text-[#6B8FAA] leading-relaxed">האפליקציה מחשבת תלוש משוער על בסיס המשמרות שרשמת והגדרות המשרה — שכר בסיס, שעות נוספות, תוספות שבת וחג ונסיעות.</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-[#E8EEFF] mb-1">ניכויים</p>
                <p className="text-sm text-[#6B8FAA] leading-relaxed">מוצגים ניכויי ביטוח לאומי, ביטוח בריאות, מס הכנסה ופנסיה — לפי מדרגות המס העדכניות.</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-[#E8EEFF] mb-1">מוודא תלוש</p>
                <p className="text-sm text-[#6B8FAA] leading-relaxed">ניתן להזין את הנתונים מהתלוש האמיתי כדי להשוות ולבדוק אם הכל תואם.</p>
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
