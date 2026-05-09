"use client";

import { useEffect, useState } from "react";
import { getAppSettings, getHolidayDates } from "./hebcal";

// Returns holiday dates map for a given year: { "YYYY-MM-DD": "שם החג" }
export function useHolidayTimes(year: number): Record<string, string> {
  const [dates, setDates] = useState<Record<string, string>>({});

  useEffect(() => {
    getAppSettings().then((settings) => {
      getHolidayDates(year, settings.cityId)
        .then(setDates)
        .catch(() => setDates({}));
    });
  }, [year]);

  return dates;
}
