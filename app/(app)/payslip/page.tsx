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
  // walletImpact: positive = good for user, negative = bad for user
  // For deductions: paying more than expected is bad → flip sign
  const walletImpact = diff !== null ? (isNegative ? -diff : diff) : null;
  const isGood = walletImpact !== null && walletImpact > 0;

  const hoursLabel = hours !== undefined ? hours.toFixed(2) : null;

  return (
    <div className={`flex items-center gap-2 py-2.5 border-b border-gray-50 last:border-0 ${bold ? "border-t border-gray-200 mt-1 pt-3" : ""}`}>
      <span className={`flex-1 text-sm ${bold ? "font-semibold text-gray-900" : "text-gray-700"}`}>{label}</span>
      <span className="text-sm font-medium text-gray-400 w-16 text-left">
        {hoursLabel ? `${hoursLabel} ש׳` : ""}
      </span>
      <span dir="ltr" className={`text-sm font-medium w-24 text-left ${isNegative ? "text-red-500" : bold ? "text-blue-600 font-bold" : "text-gray-800"}`}>
        {isNegative ? "-" : ""}{formatCurrency(calculated).replace("₪", "")}
      </span>
      <div className="relative w-24">
        <input
          type="number"
          placeholder="בפועל"
          value={actual}
          onChange={(e) => onChange(e.target.value)}
          onFocus={(e) => e.target.select()}
          className={`w-full text-sm px-2 py-1 border rounded-lg text-center focus:outline-none focus:ring-2 ${
            hasDiscrepancy
              ? isGood ? "border-green-500 ring-green-500/20 bg-green-50 text-green-600" : "border-red-500 ring-red-500/20 bg-red-50 text-red-500"
              : "border-gray-200 focus:ring-blue-500"
          }`}
        />
        {hasDiscrepancy && (
          <span className={`absolute -top-4 right-0 text-[10px] font-medium ${isGood ? "text-green-600" : "text-red-500"}`}>
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

  useEffect(() => {
    db.jobs.toArray().then((j) => {
      setJobs(j);
      if (j.length > 0) setSelectedJob(j[0]);
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
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 pt-4 pb-3">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold text-gray-900">תלוש משוער</h1>
          {jobs.length > 1 && (
            <div className="flex gap-1.5">
              {jobs.map((j) => (
                <button
                  key={j.id}
                  onClick={() => setSelectedJob(j)}
                  className={`px-3 py-1 text-xs font-medium rounded-lg border transition-colors ${
                    selectedJob?.id === j.id
                      ? "bg-blue-600 border-blue-600 text-white"
                      : "border-gray-200 text-gray-600 hover:border-gray-300"
                  }`}
                >
                  {j.name}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center justify-between">
          <button onClick={() => navigate(-1)} className="p-1.5 text-gray-500 hover:text-gray-800">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><path d="m9 18 6-6-6-6" /></svg>
          </button>
          <span className="text-base font-semibold text-gray-800">{MONTH_NAMES_HE[month - 1]} {year}</span>
          <button onClick={() => navigate(1)} className="p-1.5 text-gray-500 hover:text-gray-800">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><path d="m15 18-6-6 6-6" /></svg>
          </button>
        </div>
      </div>

      {jobs.length === 0 && (
        <div className="flex-1 flex items-center justify-center text-sm text-gray-400">הגדר/י משרה תחילה</div>
      )}

      {jobs.length > 0 && !payslip && (
        <div className="flex-1 flex items-center justify-center text-sm text-gray-400">אין נתונים לחודש זה</div>
      )}

      {payslip && (
        <div className="p-4 space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-blue-50 rounded-2xl p-3 text-center">
              <div className="text-xs text-blue-400 mb-1">ימי עבודה</div>
              <div className="text-lg font-bold text-blue-600">{payslip.workDays}</div>
            </div>
            <div className="bg-green-50 rounded-2xl p-3 text-center">
              <div className="text-xs text-green-400 mb-1">שעות</div>
              <div className="text-lg font-bold text-green-600">
                {payslip.totalHours.toFixed(2)}
              </div>
            </div>
            <div className="bg-purple-50 rounded-2xl p-3 text-center">
              <div className="text-xs text-purple-400 mb-1">נטו</div>
              <div className="text-base font-bold text-purple-700">{formatCurrency(payslip.netPay)}</div>
            </div>
          </div>

          {/* Column headers */}
          {showValidator && (
            <div className="flex items-center gap-2 px-0">
              <span className="flex-1" />
              <span className="text-xs text-gray-400 w-24 text-center">מחושב</span>
              <span className="text-xs text-gray-400 w-24 text-center">בתלוש בפועל</span>
            </div>
          )}

          {/* Income section */}
          <div className="bg-white border border-gray-100 rounded-2xl px-4 py-1">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide pt-3 pb-1">הכנסות</h3>
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
          <div className="bg-white border border-gray-100 rounded-2xl px-4 py-1">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide pt-3 pb-1">ניכויים</h3>
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

          {/* Tips — informational only */}
          {totalTips > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-4 flex items-center justify-between">
              <div>
                <span className="text-amber-800 font-semibold text-base">🪙 טיפים החודש</span>
                <p className="text-xs text-amber-600 mt-0.5">מזומן שהתקבל ישירות — לא נכלל בשכר</p>
              </div>
              <span className="text-amber-700 font-bold text-xl">{formatCurrency(totalTips)}</span>
            </div>
          )}

          {/* Validator toggle */}
          <button
            onClick={() => setShowValidator(!showValidator)}
            className="w-full py-3 border-2 border-dashed border-gray-200 rounded-2xl text-sm font-medium text-gray-500 hover:border-blue-300 hover:text-blue-600 transition-colors"
          >
            {showValidator ? "סגור/י בדיקת תלוש" : "בדיקת תלוש בפועל"}
          </button>

          {showValidator && (
            <div className="bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3">
              <p className="text-xs text-amber-700 font-medium mb-1">הנחיות:</p>
              <p className="text-xs text-amber-600">הזן/י את הסכומים מהתלוש שלך בעמודה &quot;בפועל&quot;. הערכים יסומנו בירוק (לטובתך) או אדום (לרעתך) אם יש פערים משמעותיים.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
