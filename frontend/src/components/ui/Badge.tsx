import { cn } from "@/lib/utils";

type Tone = "brand" | "neutral" | "warning" | "critical";

const toneClasses: Record<Tone, string> = {
  brand: "bg-brand-50 text-brand-700",
  neutral: "bg-surface-sunken text-foreground-secondary",
  warning: "bg-amber-50 text-amber-700",
  critical: "bg-red-50 text-red-700",
};

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
