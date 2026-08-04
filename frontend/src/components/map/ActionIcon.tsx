import { iconForAction } from "@/lib/utils";

export function ActionIcon({
  actionType,
  size = 18,
  className,
  strokeWidth,
}: {
  actionType: string;
  size?: number;
  className?: string;
  strokeWidth?: number;
}) {
  const Icon = iconForAction(actionType);
  // eslint-disable-next-line react-hooks/static-components -- picking among a fixed set of stateless Lucide icons; no state to lose on "recreation"
  return <Icon size={size} className={className} strokeWidth={strokeWidth} />;
}
