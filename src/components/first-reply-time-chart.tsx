"use client";

import { cn } from "@/lib/utils";
import { fmtK } from "@/lib/aitools/data";
import type { ComponentProps } from "react";
import { CartesianGrid, LabelList, Line, LineChart, XAxis } from "recharts";
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

export type CategoryStarsRow = {
  cat: string;
  label: string;
  median: number;
};

const chartConfig = {
  median: {
    label: "Median stars",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

/**
 * Median stars by category — where the catalog's gravitational pull sits.
 */
export function CategoryStarsChart({
  data,
  className,
  ...props
}: ComponentProps<typeof Card> & { data: CategoryStarsRow[] }) {
  return (
    <Card
      className={cn("shadow-none md:col-span-2 dark:ring-0", className)}
      {...props}
    >
      <CardHeader className="space-y-1">
        <CardTitle>Median stars by category</CardTitle>
        <CardDescription>
          GitHub stars at the middle of each category, top eight.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer className="aspect-video w-full" config={chartConfig}>
          <LineChart
            accessibilityLayer
            data={data}
            margin={{ top: 24, left: 20, right: 12, bottom: 8 }}
          >
            <CartesianGrid className="stroke-border" vertical={false} />
            <XAxis
              axisLine={false}
              dataKey="label"
              interval={0}
              tickFormatter={(value) => String(value).slice(0, 6)}
              tickLine={false}
              tickMargin={8}
            />
            <ChartTooltip
              content={<ChartTooltipContent indicator="line" />}
              cursor={false}
            />
            <Line
              activeDot={{ r: 6 }}
              dataKey="median"
              dot={{ fill: "var(--color-median)" }}
              stroke="var(--color-median)"
              strokeWidth={2}
              type="natural"
            >
              <LabelList
                className="fill-foreground"
                dataKey="median"
                fontSize={12}
                formatter={(label) => {
                  const n = Number(label);
                  return Number.isFinite(n) ? fmtK(n) : String(label ?? "");
                }}
                offset={12}
                position="top"
              />
            </Line>
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
