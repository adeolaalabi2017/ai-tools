"use client";

import { cn } from "@/lib/utils";
import { type ComponentProps, useId, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Delta, DeltaIcon, DeltaValue } from "@/components/delta";

export type CatalogGrowthRow = {
  /** ISO "YYYY-MM" */
  month: string;
  /** Cumulative approved tools by end of month */
  total: number;
};

type WindowMonths = 12 | 24 | 999;

const chartConfig = {
  total: {
    label: "Tools",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

/**
 * Catalog growth — cumulative approved tools by month.
 */
export function CatalogGrowthChart({
  data,
  className,
  ...props
}: ComponentProps<typeof Card> & { data: CatalogGrowthRow[] }) {
  const chartUid = useId().replace(/:/g, "");
  const idAreaGradient = `catalog-growth-area-grad-${chartUid}`;

  const [windowMonths, setWindowMonths] = useState<WindowMonths>(12);

  const chartRows = useMemo(() => {
    if (windowMonths >= 999) return data;
    return data.slice(-windowMonths);
  }, [data, windowMonths]);

  const growthPctNum = useMemo(() => {
    const first = chartRows[0];
    const last = chartRows.at(-1);
    if (!first || !last || first.total <= 0) return 0;
    return ((last.total - first.total) / first.total) * 100;
  }, [chartRows]);

  if (data.length === 0) {
    return (
      <Card
        className={cn(
          "shadow-none md:col-span-2 lg:col-span-3 dark:ring-0",
          className,
        )}
        {...props}
      >
        <CardHeader>
          <CardTitle>Catalog growth</CardTitle>
          <CardDescription>No approved tools yet.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card
      className={cn(
        "shadow-none md:col-span-2 lg:col-span-3 dark:ring-0",
        className,
      )}
      {...props}
    >
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle>Catalog growth</CardTitle>
            <Delta value={growthPctNum} variant="badge">
              <DeltaIcon variant="trend" />
              <DeltaValue />
            </Delta>
          </div>
          <CardDescription>
            Cumulative approved tools, month by month.
          </CardDescription>
        </div>
        <Select
          onValueChange={(v) => {
            const n = Number(v);
            setWindowMonths(n as WindowMonths);
          }}
          value={String(windowMonths)}
        >
          <SelectTrigger
            aria-label="Catalog growth time range"
            className="w-full min-w-36 sm:w-fit"
            size="sm"
          >
            <SelectValue placeholder="Range" />
          </SelectTrigger>
          <SelectContent align="end">
            <SelectItem value="12">Last 12 months</SelectItem>
            <SelectItem value="24">Last 24 months</SelectItem>
            <SelectItem value="999">All time</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        <ChartContainer className="aspect-22/8 w-full" config={chartConfig}>
          <AreaChart
            accessibilityLayer
            data={chartRows}
            margin={{ left: 4, right: 8, top: 8, bottom: 0 }}
          >
            <defs>
              <linearGradient id={idAreaGradient} x1="0" x2="0" y1="0" y2="1">
                <stop
                  offset="0%"
                  stopColor="var(--color-total)"
                  stopOpacity={0.45}
                />
                <stop
                  offset="55%"
                  stopColor="var(--color-total)"
                  stopOpacity={0.12}
                />
                <stop
                  offset="100%"
                  stopColor="var(--color-total)"
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>
            <CartesianGrid className="stroke-border" vertical={false} />
            <XAxis
              axisLine={false}
              dataKey="month"
              interval="preserveStartEnd"
              minTickGap={28}
              tickFormatter={(value) => String(value)}
              tickLine={false}
              tickMargin={8}
            />
            <YAxis
              axisLine={false}
              tick={{ className: "tabular-nums" }}
              tickLine={false}
              tickMargin={8}
              width={36}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent className="min-w-34" indicator="line" />
              }
              cursor={false}
            />
            <Area
              dataKey="total"
              dot={false}
              fill={`url(#${idAreaGradient})`}
              stroke="var(--color-total)"
              strokeWidth={2}
              type="natural"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
