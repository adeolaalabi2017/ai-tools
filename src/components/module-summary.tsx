"use client";

/* ------------------------------------------------------------------ */
/*  ModuleSummaries — compact per-module stats with "open" shortcuts.  */
/*  The "summary of other important sections" block on the Overview.   */
/* ------------------------------------------------------------------ */

import {
  ArrowRightIcon,
  ListChecksIcon,
  MegaphoneIcon,
  NewspaperIcon,
  TargetIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { AdminModule } from "@/components/app-shared";

export type ModuleSummaryData = {
  pending: number;
  wantsOpen: number;
  postsPublished: number;
  adsActive: number;
  adImpressions: number;
  adClicks: number;
};

export function ModuleSummaries({
  data,
  onOpenModule,
}: {
  data: ModuleSummaryData;
  onOpenModule: (m: AdminModule) => void;
}) {
  const ctr =
    data.adImpressions > 0
      ? `${((data.adClicks / data.adImpressions) * 100).toFixed(1)}%`
      : "—";

  const cards: {
    key: string;
    module: AdminModule;
    title: string;
    value: string;
    footnote: string;
    icon: React.ReactNode;
    warn?: boolean;
  }[] = [
    {
      key: "review",
      module: "review",
      title: "Review queue",
      value: String(data.pending),
      footnote: data.pending === 1 ? "submission awaiting review" : "submissions awaiting review",
      icon: <ListChecksIcon />,
      warn: data.pending > 0,
    },
    {
      key: "wants",
      module: "wants",
      title: "Wanted board",
      value: String(data.wantsOpen),
      footnote: "open community requests",
      icon: <TargetIcon />,
    },
    {
      key: "blog",
      module: "blog",
      title: "Blog",
      value: String(data.postsPublished),
      footnote: "published posts live",
      icon: <NewspaperIcon />,
    },
    {
      key: "ads",
      module: "ads",
      title: "Ads",
      value: String(data.adsActive),
      footnote: `active · ${data.adImpressions.toLocaleString("en-US")} impressions · ${ctr} CTR`,
      icon: <MegaphoneIcon />,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" id="admin-sections">
      {cards.map((c) => (
        <Card key={c.key} className="shadow-none dark:ring-0">
          <CardHeader>
            <CardTitle className="flex items-center justify-between font-normal text-muted-foreground text-xs">
              {c.title}
              <span
                className={cn(
                  "grid size-6 place-items-center rounded-md [&_svg]:size-3.5",
                  c.warn ? "bg-amber-500/10 text-amber-500" : "bg-accent-soft text-accent",
                )}
              >
                {c.icon}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-semibold text-2xl tabular-nums">{c.value}</p>
            <span className="text-muted-foreground text-xs">{c.footnote}</span>
          </CardContent>
          <CardFooter className="border-t !py-2.5">
            <Button
              className="h-7 gap-1 px-2 text-xs"
              onClick={() => onOpenModule(c.module)}
              size="sm"
              variant="ghost"
            >
              Open module
              <ArrowRightIcon className="size-3" />
            </Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
