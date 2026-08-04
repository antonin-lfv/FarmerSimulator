"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";
import { usePolledData } from "@/lib/hooks";
import { api } from "@/lib/api";
import { formatUsd, cn } from "@/lib/utils";
import type { MarketPrice } from "@/lib/types";

type Trend = "up" | "down" | "flat";

export function MarketTicker() {
  const { data: prices } = usePolledData(() => api.getMarketPrices(), 8000);
  const previousRef = useRef<Map<string, number>>(new Map());
  const [trends, setTrends] = useState<Map<string, Trend>>(new Map());

  useEffect(() => {
    if (!prices) return;
    const nextTrends = new Map<string, Trend>();
    for (const price of prices) {
      const key = `${price.category}-${price.subcategory}`;
      const previous = previousRef.current.get(key);
      if (previous == null) nextTrends.set(key, "flat");
      else if (price.price > previous) nextTrends.set(key, "up");
      else if (price.price < previous) nextTrends.set(key, "down");
      else nextTrends.set(key, "flat");
      previousRef.current.set(key, price.price);
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- trend is a diff against the previous poll, not derivable during render
    setTrends(nextTrends);
  }, [prices]);

  if (!prices || prices.length === 0) return null;

  const items = [...prices, ...prices];

  return (
    <div className="w-full min-w-0 max-w-full overflow-hidden border-b border-border bg-brand-900 py-2.5">
      <div className="flex w-max min-w-0 animate-ticker gap-10">
        {items.map((price, index) => {
          const key = `${price.category}-${price.subcategory}`;
          const trend = trends.get(key) ?? "flat";
          return (
            <TickerItem key={`${key}-${index}`} price={price} trend={trend} />
          );
        })}
      </div>
    </div>
  );
}

function TickerItem({ price, trend }: { price: MarketPrice; trend: Trend }) {
  const Icon = trend === "up" ? ArrowUp : trend === "down" ? ArrowDown : Minus;
  const color = trend === "up" ? "text-emerald-400" : trend === "down" ? "text-red-400" : "text-white/40";

  return (
    <div className="flex shrink-0 items-center gap-2 whitespace-nowrap text-sm">
      <span className="font-medium capitalize text-white/90">{price.subcategory}</span>
      <span className="font-semibold text-white">{formatUsd(price.price)}</span>
      <Icon size={13} className={cn(color)} />
    </div>
  );
}
