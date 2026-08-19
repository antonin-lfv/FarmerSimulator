"use client";

import { useEffect, useRef, useState } from "react";
import { formatUsd } from "@/lib/utils";

const TWEEN_MS = 700;

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Ticks a number up/down over ~700ms instead of swapping the text instantly —
 * every money/quantity value in the app used to jump straight to the new
 * figure on the next poll with zero visual acknowledgment that anything had
 * happened. Also briefly flashes green/red by direction so a charge or
 * payout is felt, not just read.
 */
export function AnimatedNumber({
  value,
  previousValue,
  format = "number",
}: {
  value: number;
  previousValue: number | null;
  format?: "usd" | "number";
}) {
  const [displayed, setDisplayed] = useState(value);
  const [flash, setFlash] = useState<"up" | "down" | null>(null);
  const rafRef = useRef<number | null>(null);
  const firstRenderRef = useRef(true);

  useEffect(() => {
    // Never tween on first mount — only on subsequent real changes, so the
    // navbar doesn't visibly count up from 0 the moment the page loads.
    if (firstRenderRef.current) {
      firstRenderRef.current = false;
      setDisplayed(value);
      return;
    }
    const from = previousValue ?? value;
    if (from === value) return;

    setFlash(value > from ? "up" : "down");
    const flashTimeout = setTimeout(() => setFlash(null), TWEEN_MS);

    const start = performance.now();
    function tick(now: number) {
      const t = Math.min(1, (now - start) / TWEEN_MS);
      setDisplayed(from + (value - from) * easeOutCubic(t));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      clearTimeout(flashTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run when the target value itself changes
  }, [value]);

  const text = format === "usd" ? formatUsd(displayed) : Math.round(displayed).toLocaleString("fr-FR");

  return (
    <span
      className={
        flash === "up"
          ? "text-brand-300 transition-colors duration-300"
          : flash === "down"
            ? "text-red-300 transition-colors duration-300"
            : "transition-colors duration-300"
      }
    >
      {text}
    </span>
  );
}
