"use client";

import { useRef, useState } from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { useClickOutside } from "@/lib/hooks";

// A small "?"-style hint that opens a custom-styled bubble on click — not a
// native `title` tooltip (that only opened on hover, and looked like a plain
// OS tooltip instead of matching the app). Click-to-open, click-outside (or
// re-click) to close, same pattern already used for the map's parcel tooltip
// and the notification bell dropdown.
export function InfoTip({ text, size = 12, className }: { text: string; size?: number; className?: string }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);

  useClickOutside(rootRef, () => setOpen(false), { enabled: open });

  return (
    <span ref={rootRef} className="relative inline-flex">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-label="Plus d'informations"
        aria-expanded={open}
        className={cn(
          "inline-flex shrink-0 cursor-pointer text-foreground-muted/70 hover:text-foreground-muted",
          className,
        )}
      >
        <Info size={size} />
      </button>
      {open && (
        <span
          role="tooltip"
          className="animate-scale-in absolute left-0 top-full z-20 mt-1.5 w-52 origin-top-left rounded-lg border border-border bg-white p-2.5 text-xs font-normal normal-case leading-snug text-foreground-secondary shadow-lg"
        >
          {text}
        </span>
      )}
    </span>
  );
}
