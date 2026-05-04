import { db } from "./db";

export const ISRAELI_CITIES = [
  { id: 293397, name: "תל אביב" },
  { id: 281184, name: "ירושלים" },
  { id: 294801, name: "חיפה" },
  { id: 294098, name: "באר שבע" },
  { id: 293422, name: "ראשון לציון" },
  { id: 293369, name: "פתח תקווה" },
  { id: 295629, name: "אשדוד" },
  { id: 293231, name: "נתניה" },
  { id: 294034, name: "חולון" },
  { id: 293807, name: "רמת גן" },
  { id: 294117, name: "בת ים" },
  { id: 293253, name: "נס ציונה" },
  { id: 293742, name: "רחובות" },
  { id: 295584, name: "בני ברק" },
  { id: 293024, name: "עכו" },
  { id: 294999, name: "אילת" },
];

export const DEFAULT_CITY = ISRAELI_CITIES[0]; // Tel Aviv

// Returns candle lighting times for a year: { "YYYY-MM-DD": minutesFromMidnight }
export async function getShabbatTimes(
  year: number,
  cityId: number
): Promise<Record<string, number>> {
  const cacheKey = `${year}-${cityId}`;
  const cached = await db.shabbatCache.get(cacheKey);
  if (cached) return cached.times;

  return fetchAndCache(year, cityId);
}

export async function fetchAndCache(
  year: number,
  cityId: number
): Promise<Record<string, number>> {
  const cacheKey = `${year}-${cityId}`;
  const url =
    `https://www.hebcal.com/hebcal?v=1&cfg=json&year=${year}` +
    `&maj=off&min=off&nx=off&mf=off&ss=off&mod=off` +
    `&s=on&c=on&geo=geonameid&geonameid=${cityId}&M=on`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`HebCal fetch failed: ${res.status}`);
  const data = await res.json();

  const times: Record<string, number> = {};
  for (const item of data.items ?? []) {
    if (item.category === "candles") {
      // item.date is like "2025-04-11T19:27:00+03:00"
      const dt = new Date(item.date);
      // Use local Israel time — HebCal returns times in the city's local timezone
      // We parse hour/minute from the ISO string directly to avoid JS timezone conversion
      const timePart = item.date.substring(11, 16); // "HH:MM"
      const [h, m] = timePart.split(":").map(Number);
      // The date of candle lighting is always a Friday — use the date part
      const datePart = item.date.substring(0, 10); // "YYYY-MM-DD"
      times[datePart] = h * 60 + m;
    }
  }

  await db.shabbatCache.put({
    id: cacheKey,
    year,
    cityId,
    times,
    fetchedAt: Date.now(),
  });

  return times;
}

// Get or load app settings, defaulting to Tel Aviv
export async function getAppSettings() {
  const s = await db.appSettings.get("singleton");
  if (s) return s;
  const defaults = { id: "singleton", cityId: DEFAULT_CITY.id, cityName: DEFAULT_CITY.name };
  await db.appSettings.put(defaults);
  return defaults;
}

export async function saveAppSettings(cityId: number, cityName: string) {
  await db.appSettings.put({ id: "singleton", cityId, cityName });
}

// Candle lighting time for a specific Friday, with 19:00 fallback
export function getCandleLighting(
  fridayDate: string,
  shabbatTimes: Record<string, number>
): number {
  return shabbatTimes[fridayDate] ?? 19 * 60;
}
