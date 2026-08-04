"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { usePolledData } from "@/lib/hooks";
import { api } from "@/lib/api";
import type { CalendarDay } from "@/lib/types";

interface CalendarContextValue {
  calendar: CalendarDay | null;
  /** Seconds into the current game day, ticking locally once a second. */
  elapsed: number | null;
  refresh: () => Promise<void>;
}

const CalendarContext = createContext<CalendarContextValue | null>(null);

// One shared poll for the whole app instead of every widget (navbar clock,
// weather card...) fetching /api/calendar independently on its own timer —
// that let two widgets briefly disagree on the date whenever a day boundary
// fell between their two poll times. Everyone now reads the same state.
export function CalendarProvider({ children }: { children: ReactNode }) {
  const { data: calendar, refresh } = usePolledData(() => api.getCalendar(), 4000);
  const [elapsed, setElapsed] = useState<number | null>(null);

  useEffect(() => {
    if (!calendar) return;
    setElapsed(calendar.day_duration_seconds - calendar.seconds_until_next_day);
  }, [calendar]);

  useEffect(() => {
    const id = setInterval(() => {
      setElapsed((cur) => {
        if (cur == null || !calendar) return cur;
        const next = cur + 1;
        // The local clock just crossed midnight — the real day_index has
        // almost certainly advanced too. Refetch immediately rather than
        // waiting up to 4s for the next scheduled poll to notice.
        if (next >= calendar.day_duration_seconds) {
          refresh();
          return 0;
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [calendar, refresh]);

  return <CalendarContext.Provider value={{ calendar, elapsed, refresh }}>{children}</CalendarContext.Provider>;
}

export function useCalendar() {
  const ctx = useContext(CalendarContext);
  if (!ctx) throw new Error("useCalendar must be used within a CalendarProvider");
  return ctx;
}
