import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

// A small "?"-style hint dropped next to a label to explain what it means or
// how it's computed — native `title` tooltip, so no JS state/positioning
// logic needed. Kept on a wrapping <span> rather than passed to <Info>
// directly: Lucide's icon prop types don't accept `title`.
export function InfoTip({ text, size = 12, className }: { text: string; size?: number; className?: string }) {
  return (
    <span
      title={text}
      className={cn("inline-flex shrink-0 cursor-help text-foreground-muted/70 hover:text-foreground-muted", className)}
    >
      <Info size={size} />
    </span>
  );
}
