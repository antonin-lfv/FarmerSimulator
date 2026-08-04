import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SelectHTMLAttributes } from "react";

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select
        className={cn(
          "w-full appearance-none rounded-lg border border-border bg-white py-2.5 pl-3.5 pr-10 text-sm text-foreground transition-colors hover:border-foreground-muted focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-foreground-muted",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        size={16}
        className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-foreground-muted"
      />
    </div>
  );
}
