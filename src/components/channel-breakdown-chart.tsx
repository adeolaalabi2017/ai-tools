"use client";

import { cn } from "@/lib/utils";
import type { ComponentProps } from "react";
import { LabelList, Pie, PieChart } from "recharts";
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
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart";

export type CategoryShareDatum = {
  cat: string;
  label: string;
  share: number;
  fill: string;
};

/**
 * Catalog by category — share of approved tools (top slices + "Other").
 */
export function CategoryShareChart({
  data,
  className,
  ...props
}: ComponentProps<typeof Card> & { data: CategoryShareDatum[] }) {
  const chartConfig = {
    share: {
      label: "Share",
    },
    ...Object.fromEntries(
      data.map((d) => [d.cat, { label: d.label, color: d.fill }]),
    ),
  } satisfies ChartConfig;

  return (
    <Card
      className={cn("flex flex-col shadow-none dark:ring-0", className)}
      {...props}
    >
      <CardHeader className="items-center space-y-1 pb-0 sm:items-start">
        <CardTitle>Catalog by category</CardTitle>
        <CardDescription>Share of approved tools</CardDescription>
      </CardHeader>
      <CardContent className="my-auto">
        <ChartContainer
          className="mx-auto aspect-square max-h-72 w-full"
          config={chartConfig}
        >
          <PieChart accessibilityLayer>
            <Pie
              cornerRadius={8}
              data={data}
              dataKey="share"
              innerRadius={36}
              nameKey="cat"
              outerRadius="88%"
              stroke="var(--card)"
              strokeWidth={4}
            >
              <LabelList
                className="fill-background font-medium"
                dataKey="share"
                fill="currentColor"
                fontWeight={500}
                formatter={(label) => {
                  const n = Number(label);
                  return Number.isFinite(n) ? `${n}%` : String(label ?? "");
                }}
                position="inside"
                stroke="none"
              />
            </Pie>
            <ChartLegend
              /* recharts injects `payload` via cloneElement at runtime */
              content={<ChartLegendContent nameKey="cat" /> as React.ReactElement}
            />
          </PieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
