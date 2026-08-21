import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CycleStep } from "@/lib/utils";

// The full repeating cycle for a parcel's surface type (labourer → semer →
// engrais → récolter, or planter → récolter/couper), with the current step
// highlighted — so "where am I in the cycle" is visible at a glance instead
// of only ever showing the single next step.
export function CycleStepper({
  steps,
  currentIndex,
  inProgress,
}: {
  steps: CycleStep[];
  currentIndex: number;
  inProgress: boolean;
}) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto">
      {steps.map((step, i) => {
        const isCurrent = i === currentIndex;
        return (
          <div key={step.id} className="flex shrink-0 items-center gap-1">
            <span
              className={cn(
                "whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium",
                isCurrent
                  ? inProgress
                    ? "animate-soft-pulse bg-brand-500 text-white"
                    : "bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-300"
                  : "bg-surface-sunken text-foreground-muted",
              )}
            >
              {step.label}
            </span>
            {i < steps.length - 1 && (
              <ChevronRight size={12} className="shrink-0 text-foreground-muted/50" />
            )}
          </div>
        );
      })}
    </div>
  );
}
