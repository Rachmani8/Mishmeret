import type { Job, Shift } from "./db";

export interface DayEarnings {
  date: string;
  workedHours: number;
  baseEarnings: number;
  overtime1Earnings: number;  // hours 1-2 above norm (125%)
  overtime2Earnings: number;  // hour 3+ above norm (150%)
  overtime1Hours: number;
  overtime2Hours: number;
  weekendBonus: number;
  weekendHours: number;
  commuteAmount: number;
  totalGross: number;
  isWeekend: boolean;
}

export interface MonthlyPayslip {
  baseSalary: number;
  overtime1Pay: number;  // 125%
  overtime2Pay: number;  // 150%
  overtime1Hours: number;
  overtime2Hours: number;
  weekendHolidayBonus: number;
  weekendHours: number;
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
  const worked = (end - start) / 60;
  return Math.max(0, worked);
}

// Returns earnings split into three components matching real payslip structure:
// base = all hours at 1× (regardless of type)
// overtime = only the extra premium for overtime hours
// bonus = only the extra premium for Shabbat/holiday hours
function calcHoursBreakdown(
  hours: number,
  hoursAlreadyWorked: number,
  norm: number,
  baseRate: number,
  isShabbat: boolean,
  weekendMult: number,
  ot1Mult: number,
  ot2Mult: number,
): { base: number; overtime1: number; overtime2: number; bonus: number; ot1Hours: number; ot2Hours: number } {
  const normLeft = Math.max(0, norm - hoursAlreadyWorked);
  const ot1Hours = Math.max(0, Math.min(hours - normLeft, 2));
  const ot2Hours = Math.max(0, hours - normLeft - 2);

  const base = hours * baseRate;
  const overtime1 = ot1Hours * baseRate * (ot1Mult - 1);
  const overtime2 = ot2Hours * baseRate * (ot2Mult - 1);
  const bonus = isShabbat ? hours * baseRate * (weekendMult - 1) : 0;

  return { base, overtime1, overtime2, bonus, ot1Hours, ot2Hours };
}

export function calcDayEarnings(
  shift: Shift,
  job: Job,
  shabbatTimes?: Record<string, number>,
  holidays?: Record<string, string>
): DayEarnings {
  const workedHours = calcWorkedHours(shift);
  const norm = job.dailyNormHours;
  const date = new Date(shift.date + "T00:00:00");
  const dayOfWeek = date.getDay();
  const isSaturday = dayOfWeek === 6;
  const isHolidayDay = !isSaturday && !!(holidays?.[shift.date]);
  // Candle-lighting entry exists for both Shabbat eves (Fridays) and holiday eves (erev chag)
  const candleEntry = !isSaturday && !isHolidayDay ? shabbatTimes?.[shift.date] : undefined;

  let baseEarnings = 0;
  let overtime1Earnings = 0;
  let overtime2Earnings = 0;
  let overtime1Hours = 0;
  let overtime2Hours = 0;
  let weekendBonus = 0;
  let weekendHours = 0;
  let isWeekend = false;

  if (isSaturday) {
    isWeekend = true;
    const isAlsoHoliday = !!(holidays?.[shift.date]);
    const satMult = (isAlsoHoliday && job.holidayMultiplier > job.weekendMultiplier)
      ? job.holidayMultiplier
      : job.weekendMultiplier;
    const bd = calcHoursBreakdown(workedHours, 0, norm, job.baseHourlyRate, true,
      satMult, job.overtime1Multiplier, job.overtime2Multiplier);
    baseEarnings = bd.base;
    overtime1Earnings = bd.overtime1; overtime1Hours = bd.ot1Hours;
    overtime2Earnings = bd.overtime2; overtime2Hours = bd.ot2Hours;
    weekendBonus = bd.bonus; weekendHours = workedHours;
  } else if (isHolidayDay) {
    isWeekend = true;
    const bd = calcHoursBreakdown(workedHours, 0, norm, job.baseHourlyRate, true,
      job.holidayMultiplier, job.overtime1Multiplier, job.overtime2Multiplier);
    baseEarnings = bd.base;
    overtime1Earnings = bd.overtime1; overtime1Hours = bd.ot1Hours;
    overtime2Earnings = bd.overtime2; overtime2Hours = bd.ot2Hours;
    weekendBonus = bd.bonus; weekendHours = workedHours;
  } else if (candleEntry !== undefined) {
    const candleMin = candleEntry;
    const clockInMin = timeToMinutes(shift.clockIn);
    let clockOutMin = timeToMinutes(shift.clockOut);
    if (clockOutMin <= clockInMin) clockOutMin += 24 * 60;

    const regularMins = Math.max(0, Math.min(clockOutMin, candleMin) - clockInMin);
    const shabbatMins = Math.max(0, clockOutMin - Math.max(clockInMin, candleMin));
    const regularHours = regularMins / 60;
    const shabbatHours = shabbatMins / 60;

    isWeekend = shabbatHours > 0;

    const regBd = calcHoursBreakdown(regularHours, 0, norm, job.baseHourlyRate, false,
      job.weekendMultiplier, job.overtime1Multiplier, job.overtime2Multiplier);
    baseEarnings = regBd.base;
    overtime1Earnings = regBd.overtime1; overtime1Hours = regBd.ot1Hours;
    overtime2Earnings = regBd.overtime2; overtime2Hours = regBd.ot2Hours;

    const shabBd = calcHoursBreakdown(shabbatHours, regularHours, norm, job.baseHourlyRate, true,
      job.weekendMultiplier, job.overtime1Multiplier, job.overtime2Multiplier);
    baseEarnings += shabBd.base;
    overtime1Earnings += shabBd.overtime1; overtime1Hours += shabBd.ot1Hours;
    overtime2Earnings += shabBd.overtime2; overtime2Hours += shabBd.ot2Hours;
    weekendBonus = shabBd.bonus; weekendHours = shabbatHours;
  } else {
    const bd = calcHoursBreakdown(workedHours, 0, norm, job.baseHourlyRate, false,
      job.weekendMultiplier, job.overtime1Multiplier, job.overtime2Multiplier);
    baseEarnings = bd.base;
    overtime1Earnings = bd.overtime1; overtime1Hours = bd.ot1Hours;
    overtime2Earnings = bd.overtime2; overtime2Hours = bd.ot2Hours;
  }

  const commuteAmount = job.commuteEnabled && shift.isWorkDay ? job.commuteDaily : 0;

  return {
    date: shift.date,
    workedHours,
    baseEarnings,
    overtime1Earnings,
    overtime2Earnings,
    overtime1Hours,
    overtime2Hours,
    weekendBonus,
    weekendHours,
    commuteAmount,
    totalGross: baseEarnings + overtime1Earnings + overtime2Earnings + weekendBonus + commuteAmount,
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

export function calcMonthlyPayslip(
  shifts: Shift[],
  job: Job,
  shabbatTimes?: Record<string, number>,
  holidays?: Record<string, string>
): MonthlyPayslip {
  const workShifts = shifts.filter((s) => s.isWorkDay);
  const earnings = workShifts.map((s) => calcDayEarnings(s, job, shabbatTimes, holidays));

  const baseSalary = earnings.reduce((sum, e) => sum + e.baseEarnings, 0);
  const overtime1Pay = earnings.reduce((sum, e) => sum + e.overtime1Earnings, 0);
  const overtime2Pay = earnings.reduce((sum, e) => sum + e.overtime2Earnings, 0);
  const overtime1Hours = earnings.reduce((sum, e) => sum + e.overtime1Hours, 0);
  const overtime2Hours = earnings.reduce((sum, e) => sum + e.overtime2Hours, 0);
  const weekendHolidayBonus = earnings.reduce((sum, e) => sum + e.weekendBonus, 0);
  const weekendHours = earnings.reduce((sum, e) => sum + e.weekendHours, 0);
  const commuteTotal = earnings.reduce((sum, e) => sum + e.commuteAmount, 0);
  const earningsGross = baseSalary + overtime1Pay + overtime2Pay + weekendHolidayBonus;
  const grossTotal = earningsGross + commuteTotal;
  const totalHours = earnings.reduce((sum, e) => sum + e.workedHours, 0);

  const pensionEmployee = job.pensionEnabled
    ? baseSalary * (job.pensionEmployeePercent / 100)
    : 0;
  const nationalInsurance = calcNationalInsurance(earningsGross);
  const healthInsurance = calcHealthInsurance(earningsGross);
  const incomeTax = calcIncomeTax(earningsGross, job.taxCreditPoints);
  const netPay = grossTotal - pensionEmployee - nationalInsurance - healthInsurance - incomeTax;

  return {
    baseSalary,
    overtime1Pay,
    overtime2Pay,
    overtime1Hours,
    overtime2Hours,
    weekendHolidayBonus,
    weekendHours,
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
  return hours.toFixed(2);
}

export const DAY_NAMES_HE = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
export const DAY_ABBR_HE = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];
export const MONTH_NAMES_HE = [
  "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
  "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר",
];
