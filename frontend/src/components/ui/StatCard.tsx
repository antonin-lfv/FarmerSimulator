import { Card } from "./Card";
import { InfoTip } from "./InfoTip";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  infoTip,
  className,
}: {
  label: string;
  value: string;
  icon?: LucideIcon;
  hint?: string;
  infoTip?: string;
  className?: string;
}) {
  return (
    <Card className={cn("p-5", className)}>
      <div className="flex items-start justify-between">
        <span className="flex items-center gap-1 text-sm font-medium text-foreground-secondary">
          {label}
          {infoTip && <InfoTip text={infoTip} />}
        </span>
        {Icon && (
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
            <Icon size={16} />
          </span>
        )}
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
      {hint && <p className="mt-1 text-xs text-foreground-muted">{hint}</p>}
    </Card>
  );
}
