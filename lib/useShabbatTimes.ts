"use client";

import { useEffect, useState } from "react";
import { getAppSettings, getShabbatTimes } from "./hebcal";

// Returns the shabbat times map for a given year (cached locally)
export function useShabbatTimes(year: number): Record<string, number> {
  const [times, setTimes] = useState<Record<string, number>>({});

  useEffect(() => {
    getAppSettings().then((settings) => {
      getShabbatTimes(year, settings.cityId)
        .then(setTimes)
        .catch(() => setTimes({})); // silent fallback to 19:00
    });
  }, [year]);

  return times;
}
