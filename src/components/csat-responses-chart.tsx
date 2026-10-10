"use client";

import { cn } from "@/lib/utils";
import type { ComponentProps } from "react";
import { Bar, BarChart, Rectangle, XAxis } from "recharts";
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

export type MonthlyAdditionsRow = {
  /** Short label, e.g. "Jun" */
  month: string;
  community: number;
  curated: number;
};

const chartConfig = {
  community: {
    label: "Community",
    color: "var(--chart-1)",
  },
  curated: {
    label: "Curated",
    color: "var(--chart-5)",
  },
} satisfies ChartConfig;

/** Half of bar width (8) so ends read as fully rounded "caps". */
const BAR_RADIUS = 5;

/** Hover background for the hovered month column. */
function ColumnHoverCursor(props: React.ComponentProps<typeof Rectangle>) {
  return (
    <Rectangle
      fill="var(--muted)"
      fillOpacity={0.5}
      radius={BAR_RADIUS * 2}
      stroke="none"
      {...props}
    />
  );
}

/**
 * Additions per month — community submissions vs curated entries, last 12 months.
 */
export function MonthlyAdditionsChart({
  data,
  className,
  ...props
}: ComponentProps<typeof Card> & { data: MonthlyAdditionsRow[] }) {
  return (
    <Card
      className={cn("shadow-none md:col-span-2 dark:ring-0", className)}
      {...props}
    >
      <CardHeader>
        <CardTitle>Additions per month</CardTitle>
        <CardDescription>
          New tools by source — curated picks vs community submissions, last 12
          months.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer className="aspect-video w-full" config={chartConfig}>
          <BarChart accessibilityLayer data={[...data]}>
            <XAxis
              axisLine={false}
              dataKey="month"
              interval={0}
              minTickGap={8}
              tickFormatter={(value) => String(value)}
              tickLine={false}
              tickMargin={10}
            />
            <ChartTooltip
              content={<ChartTooltipContent hideLabel />}
              cursor={<ColumnHoverCursor />}
            />
            <Bar
              background={{
                fill: "var(--muted)",
                radius: BAR_RADIUS,
              }}
              barSize={8}
              dataKey="curated"
              fill="var(--color-curated)"
              overflow="visible"
              radius={[0, 0, BAR_RADIUS, BAR_RADIUS]}
              stackId="adds"
            />
            <Bar
              barSize={8}
              dataKey="community"
              fill="var(--color-community)"
              overflow="visible"
              radius={[BAR_RADIUS, BAR_RADIUS, 0, 0]}
              stackId="adds"
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
