import type { Job, Shift } from "./db";

export interface DayEarnings {
  date: string;
  workedHours: number;
  baseEarnings: number;
  overtimeEarnings: number;
  weekendBonus: number;
  commuteAmount: number;
  totalGross: number;
  isWeekend: boolean;
}

export interface MonthlyPayslip {
  baseSalary: number;
  overtimePay: number;
  weekendHolidayBonus: number;
  commuteTotal: number;
  grossTotal: number;
  pensionEmployee: number;
  nationalInsurance: number;
  healthInsurance: number;
  incomeTax: number;
  netPay: number;
  totalHours: number;
  workDays: number;
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export function calcWorkedHours(shift: Shift): number {
  if (!shift.clockIn || !shift.clockOut) return 0;
  const start = timeToMinutes(shift.clockIn);
  let end = timeToMinutes(shift.clockOut);
  if (end <= start) end += 24 * 60; // overnight shift
  const worked = (end - start - shift.breakMinutes) / 60;
  return Math.max(0, worked);
}

export function isWeekendShift(shift: Shift, shabbatTimes?: Record<string, number>): boolean {
  const date = new Date(shift.date + "T00:00:00");
  const dayOfWeek = date.getDay();
  if (dayOfWeek === 6) return true;
  if (dayOfWeek === 5) {
    const candleMin = shabbatTimes?.[shift.date] ?? 19 * 60;
    return timeToMinutes(shift.clockIn) >= candleMin;
  }
  return false;
}

function calcHoursEarnings(
  hours: number,
  hoursAlreadyWorked: number,
  norm: number,
  baseRate: number,
  isShabbat: boolean,
  weekendMult: number,
  ot1Mult: number,
  ot2Mult: number,
): number {
  const normLeft = Math.max(0, norm - hoursAlreadyWorked);
  const normalHours = Math.min(hours, normLeft);
  const ot1Hours = Math.max(0, Math.min(hours - normLeft, 2));
  const ot2Hours = Math.max(0, hours - normLeft - 2);

  if (isShabbat) {
    return (
      normalHours * baseRate * weekendMult +
      ot1Hours * baseRate * (weekendMult + 0.25) +
      ot2Hours * baseRate * (weekendMult + 0.50)
    );
  }
  return (
    normalHours * baseRate +
    ot1Hours * baseRate * ot1Mult +
    ot2Hours * baseRate * ot2Mult
  );
}

export function calcDayEarnings(
  shift: Shift,
  job: Job,
  shabbatTimes?: Record<string, number>
): DayEarnings {
  const workedHours = calcWorkedHours(shift);
  const norm = job.dailyNormHours;
  const date = new Date(shift.date + "T00:00:00");
  const dayOfWeek = date.getDay();
  const isSaturday = dayOfWeek === 6;
  const isFriday = dayOfWeek === 5;

  let baseEarnings = 0;
  let overtimeEarnings = 0;
  let weekendBonus = 0;
  let isWeekend = false;

  if (isSaturday) {
    isWeekend = true;
    weekendBonus = calcHoursEarnings(
      workedHours, 0, norm, job.baseHourlyRate, true,
      job.weekendMultiplier, job.overtime1Multiplier, job.overtime2Multiplier
    );
  } else if (isFriday) {
    const candleMin = shabbatTimes?.[shift.date] ?? 19 * 60;
    const clockInMin = timeToMinutes(shift.clockIn);
    let clockOutMin = timeToMinutes(shift.clockOut);
    if (clockOutMin <= clockInMin) clockOutMin += 24 * 60;

    const regularMins = Math.max(0, Math.min(clockOutMin, candleMin) - clockInMin);
    const shabbatMins = Math.max(0, clockOutMin - Math.max(clockInMin, candleMin));
    const regularHours = regularMins / 60;
    const shabbatHours = shabbatMins / 60;

    isWeekend = shabbatHours > 0;

    // Regular part (before candle lighting)
    const regNormal = Math.min(regularHours, norm);
    const regOt1 = Math.max(0, Math.min(regularHours - norm, 2));
    const regOt2 = Math.max(0, regularHours - norm - 2);
    baseEarnings = regNormal * job.baseHourlyRate;
    overtimeEarnings =
      regOt1 * job.baseHourlyRate * job.overtime1Multiplier +
      regOt2 * job.baseHourlyRate * job.overtime2Multiplier;

    // Shabbat part (after candle lighting) — norm already partially consumed
    weekendBonus = calcHoursEarnings(
      shabbatHours, regularHours, norm, job.baseHourlyRate, true,
      job.weekendMultiplier, job.overtime1Multiplier, job.overtime2Multiplier
    );
  } else {
    const normalHours = Math.min(workedHours, norm);
    const ot1Hours = Math.max(0, Math.min(workedHours - norm, 2));
    const ot2Hours = Math.max(0, workedHours - norm - 2);
    baseEarnings = normalHours * job.baseHourlyRate;
    overtimeEarnings =
      ot1Hours * job.baseHourlyRate * job.overtime1Multiplier +
      ot2Hours * job.baseHourlyRate * job.overtime2Multiplier;
  }

  const commuteAmount = job.commuteEnabled && shift.isWorkDay ? job.commuteDaily : 0;

  return {
    date: shift.date,
    workedHours,
    baseEarnings,
    overtimeEarnings,
    weekendBonus,
    commuteAmount,
    totalGross: baseEarnings + overtimeEarnings + weekendBonus + commuteAmount,
    isWeekend,
  };
}

export function calcNationalInsurance(monthlyGross: number): number {
  const threshold = 7522;
  if (monthlyGross <= threshold) return monthlyGross * 0.035;
  return threshold * 0.035 + (monthlyGross - threshold) * 0.12;
}

export function calcHealthInsurance(monthlyGross: number): number {
  const threshold = 7522;
  if (monthlyGross <= threshold) return monthlyGross * 0.031;
  return threshold * 0.031 + (monthlyGross - threshold) * 0.05;
}

export function calcIncomeTax(monthlyGross: number, taxCreditPoints: number): number {
  const annual = monthlyGross * 12;
  const brackets = [
    { up: 81480, rate: 0.10 },
    { up: 116760, rate: 0.14 },
    { up: 187440, rate: 0.20 },
    { up: 260520, rate: 0.31 },
    { up: 542160, rate: 0.35 },
    { up: Infinity, rate: 0.47 },
  ];

  let annualTax = 0;
  let prev = 0;
  for (const bracket of brackets) {
    if (annual <= prev) break;
    const taxable = Math.min(annual, bracket.up) - prev;
    annualTax += taxable * bracket.rate;
    prev = bracket.up;
  }

  const monthlyTax = annualTax / 12;
  const creditAmount = taxCreditPoints * 242;
  return Math.max(0, monthlyTax - creditAmount);
}

export function calcMonthlyPayslip(shifts: Shift[], job: Job, shabbatTimes?: Record<string, number>): MonthlyPayslip {
  const workShifts = shifts.filter((s) => s.isWorkDay);
  const earnings = workShifts.map((s) => calcDayEarnings(s, job, shabbatTimes));

  const baseSalary = earnings.reduce((sum, e) => sum + e.baseEarnings, 0);
  const overtimePay = earnings.reduce((sum, e) => sum + e.overtimeEarnings, 0);
  const weekendHolidayBonus = earnings.reduce((sum, e) => sum + e.weekendBonus, 0);
  const commuteTotal = earnings.reduce((sum, e) => sum + e.commuteAmount, 0);
  const earningsGross = baseSalary + overtimePay + weekendHolidayBonus;
  const grossTotal = earningsGross + commuteTotal;
  const totalHours = earnings.reduce((sum, e) => sum + e.workedHours, 0);

  const pensionEmployee = job.pensionEnabled
    ? earningsGross * (job.pensionEmployeePercent / 100)
    : 0;
  const nationalInsurance = calcNationalInsurance(earningsGross);
  const healthInsurance = calcHealthInsurance(earningsGross);
  const incomeTax = calcIncomeTax(earningsGross, job.taxCreditPoints);
  const netPay = grossTotal - pensionEmployee - nationalInsurance - healthInsurance - incomeTax;

  return {
    baseSalary,
    overtimePay,
    weekendHolidayBonus,
    commuteTotal,
    grossTotal,
    pensionEmployee,
    nationalInsurance,
    healthInsurance,
    incomeTax,
    netPay,
    totalHours,
    workDays: workShifts.length,
  };
}

export function formatCurrency(amount: number): string {
  return `₪${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}

export function formatHours(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}:${m.toString().padStart(2, "0")}`;
}

export function getMonthShifts(shifts: Shift[], year: number, month: number): Shift[] {
  const prefix = `${year}-${String(month).padStart(2, "0")}`;
  return shifts.filter((s) => s.date.startsWith(prefix));
}

export const SHIFT_TYPE_LABELS: Record<string, string> = {
  morning: "בוקר",
  afternoon: "צהריים",
  evening: "ערב",
  general: "לילה",
};

export const SHIFT_TYPE_COLORS: Record<string, string> = {
  morning: "#fbbf24",
  afternoon: "#34d399",
  evening: "#818cf8",
  general: "#60a5fa",
};

export const DAY_NAMES_HE = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
export const DAY_ABBR_HE = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];
export const MONTH_NAMES_HE = [
  "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
  "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר",
];
