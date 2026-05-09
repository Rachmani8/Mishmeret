"use client";

import { useEffect } from "react";
import { db } from "@/lib/db";

export default function DbCleanup() {
  useEffect(() => {
    db.jobs.toArray().then((jobs) => {
      const validIds = new Set(jobs.map((j) => j.id));
      db.shifts.filter((s) => !validIds.has(s.jobId)).delete();
    });
  }, []);

  return null;
}
