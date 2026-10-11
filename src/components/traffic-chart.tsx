"use client";

/* ------------------------------------------------------------------ */
/*  TrafficCard — page views + unique visitors per day (analytics).    */
/*  Shares the ["analytics", days] cache with TopPagesCard.            */
/* ------------------------------------------------------------------ */

import { useId, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { fetchAnalytics } from "@/lib/aitools/api";
import { Loader2Icon } from "lucide-react";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function dayLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

const chartConfig = {
  views: {
    label: "Pageviews",
    color: "var(--chart-1)",
  },
  visitors: {
    label: "Visitors",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

export function TrafficCard({ className }: { className?: string }) {
  const chartUid = useId().replace(/:/g, "");
  const idViewsGrad = `traffic-views-grad-${chartUid}`;
  const idVisitorGrad = `traffic-visitors-grad-${chartUid}`;

  const [days, setDays] = useState<14 | 30>(14);
  const { data, isLoading } = useQuery({
    queryKey: ["analytics", days],
    queryFn: () => fetchAnalytics(days),
    staleTime: 30_000,
  });

  const rows = useMemo(
    () => (data?.series ?? []).map((d) => ({ ...d, label: dayLabel(d.date) })),
    [data],
  );

  const avgPerVisitor = useMemo(() => {
    const uv = data?.uniqueVisitors ?? 0;
    const tv = data?.totalViews ?? 0;
    return uv > 0 ? (tv / uv).toFixed(1) : "0.0";
  }, [data]);

  return (
    <Card className={`shadow-none dark:ring-0 ${className ?? ""}`}>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-2">
          <CardTitle>Traffic</CardTitle>
          <CardDescription className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden className="h-2 w-2 rounded-full bg-[var(--color-views)]" />
              Pageviews
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden className="h-2 w-2 rounded-full bg-[var(--color-visitors)]" />
              Unique visitors
            </span>
          </CardDescription>
        </div>
        <Select
          onValueChange={(v) => setDays(Number(v) as 14 | 30)}
          value={String(days)}
        >
          <SelectTrigger
            aria-label="Traffic time range"
            className="w-full min-w-32 sm:w-fit"
            size="sm"
          >
            <SelectValue placeholder="Range" />
          </SelectTrigger>
          <SelectContent align="end">
            <SelectItem value="14">Last 14 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="grid h-[180px] place-items-center text-muted-foreground">
            <Loader2Icon className="size-5 animate-spin" />
          </div>
        ) : (
          <ChartContainer className="aspect-22/8 w-full" config={chartConfig}>
            <AreaChart
              accessibilityLayer
              data={rows}
              margin={{ left: 4, right: 8, top: 8, bottom: 0 }}
            >
              <defs>
                <linearGradient id={idViewsGrad} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-views)" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="var(--color-views)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id={idVisitorGrad} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-visitors)" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="var(--color-visitors)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid className="stroke-border" vertical={false} />
              <XAxis
                axisLine={false}
                dataKey="label"
                interval="preserveStartEnd"
                minTickGap={24}
                tickLine={false}
                tickMargin={8}
              />
              <YAxis
                axisLine={false}
                tick={{ className: "tabular-nums" }}
                tickLine={false}
                tickMargin={8}
                width={32}
                allowDecimals={false}
              />
              <ChartTooltip content={<ChartTooltipContent className="min-w-36" indicator="line" />} />
              <Area
                dataKey="views"
                dot={false}
                fill={`url(#${idViewsGrad})`}
                stroke="var(--color-views)"
                strokeWidth={2}
                type="monotone"
              />
              <Area
                dataKey="visitors"
                dot={false}
                fill={`url(#${idVisitorGrad})`}
                stroke="var(--color-visitors)"
                strokeWidth={2}
                type="monotone"
              />
            </AreaChart>
          </ChartContainer>
        )}

        <div className="grid grid-cols-3 divide-x divide-border rounded-lg border bg-background/50">
          <div className="px-4 py-3">
            <p className="text-[11px] text-muted-foreground">Pageviews</p>
            <p className="mt-0.5 font-semibold text-xl tabular-nums">
              {(data?.totalViews ?? 0).toLocaleString("en-US")}
            </p>
          </div>
          <div className="px-4 py-3">
            <p className="text-[11px] text-muted-foreground">Unique visitors</p>
            <p className="mt-0.5 font-semibold text-xl tabular-nums">
              {(data?.uniqueVisitors ?? 0).toLocaleString("en-US")}
            </p>
          </div>
          <div className="px-4 py-3">
            <p className="text-[11px] text-muted-foreground">Views / visitor</p>
            <p className="mt-0.5 font-semibold text-xl tabular-nums">{avgPerVisitor}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
