import { cn } from "@/lib/utils";

export function ProgressBar({
  value,
  className,
  trackClassName,
}: {
  value: number;
  className?: string;
  trackClassName?: string;
}) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-surface-sunken", trackClassName)}>
      <div
        className={cn("h-full rounded-full bg-brand-500 transition-[width] duration-500 ease-out", className)}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
