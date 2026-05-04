import Dexie, { type Table } from "dexie";

export interface Job {
  id: string;
  name: string;
  baseHourlyRate: number;
  weekendMultiplier: number;       // default 1.5
  holidayMultiplier: number;       // default 1.5
  overtime1Multiplier: number;     // default 1.25 (hours 1-2 above norm)
  overtime2Multiplier: number;     // default 1.5  (hour 3+ above norm)
  dailyNormHours: number;          // default 8.6
  commuteEnabled: boolean;
  commuteDaily: number;            // ₪ per day
  taxCreditPoints: number;         // default 2.25
  pensionEnabled: boolean;
  pensionEmployeePercent: number;  // default 6
  pensionEmployerPercent: number;  // default 6.5
}

export interface Shift {
  id: string;
  jobId: string;
  date: string;                    // ISO date "YYYY-MM-DD"
  isWorkDay: boolean;
  shiftType: "morning" | "afternoon" | "evening" | "general";
  clockIn: string;                 // "HH:MM"
  clockOut: string;                // "HH:MM"
  breakMinutes: number;
  tips: number;                    // cash tips, not included in gross
  notes: string;
}

// Candle lighting times per year+city, keyed by "YYYY-MM-DD" → minutes from midnight
export interface ShabbatCache {
  id: string;          // "YYYY-cityId" e.g. "2025-293397"
  year: number;
  cityId: number;
  times: Record<string, number>;  // Friday date → candle lighting minutes
  fetchedAt: number;
}

// Global app settings (single record with id "singleton")
export interface AppSettings {
  id: string;
  cityId: number;
  cityName: string;
}

class MishmeretDB extends Dexie {
  jobs!: Table<Job, string>;
  shifts!: Table<Shift, string>;
  shabbatCache!: Table<ShabbatCache, string>;
  appSettings!: Table<AppSettings, string>;

  constructor() {
    super("mishmeret");
    this.version(1).stores({
      jobs: "id, name",
      shifts: "id, jobId, date",
    });
    this.version(2).stores({
      jobs: "id, name",
      shifts: "id, jobId, date",
      shabbatCache: "id, year, cityId",
      appSettings: "id",
    });
  }
}

export const db = new MishmeretDB();

export function defaultJob(partial?: Partial<Job>): Job {
  return {
    id: crypto.randomUUID(),
    name: "משרה ראשית",
    baseHourlyRate: 40,
    weekendMultiplier: 1.5,
    holidayMultiplier: 1.5,
    overtime1Multiplier: 1.25,
    overtime2Multiplier: 1.5,
    dailyNormHours: 8.6,
    commuteEnabled: true,
    commuteDaily: 30,
    taxCreditPoints: 2.25,
    pensionEnabled: true,
    pensionEmployeePercent: 6,
    pensionEmployerPercent: 6.5,
    ...partial,
  };
}

export function defaultShift(date: string, jobId: string, partial?: Partial<Shift>): Shift {
  return {
    id: crypto.randomUUID(),
    jobId,
    date,
    isWorkDay: true,
    shiftType: "general",
    clockIn: "09:00",
    clockOut: "17:00",
    breakMinutes: 30,
    tips: 0,
    notes: "",
    ...partial,
  };
}
