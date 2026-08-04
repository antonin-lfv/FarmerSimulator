"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { MarketPricePoint } from "@/lib/types";
import { formatUsd } from "@/lib/utils";

const INK_MUTED = "#898781";
const GRIDLINE = "#e1e0d9";
const SERIES_COLOR = "#2c7838";

export function PriceChart({ data }: { data: MarketPricePoint[] }) {
  const formatted = data.map((point) => ({
    ...point,
    label: new Date(point.timestamp * 1000).toLocaleTimeString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }),
  }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={formatted} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={GRIDLINE} vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fill: INK_MUTED, fontSize: 12 }}
          axisLine={{ stroke: GRIDLINE }}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: INK_MUTED, fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          width={56}
          tickFormatter={(v) => formatUsd(v)}
        />
        <Tooltip
          formatter={(value) => formatUsd(Number(value))}
          contentStyle={{
            borderRadius: 8,
            border: "1px solid rgba(11,11,11,0.1)",
            fontSize: 13,
          }}
        />
        <Line
          type="monotone"
          dataKey="price"
          stroke={SERIES_COLOR}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
