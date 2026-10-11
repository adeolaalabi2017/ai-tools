"use client";

/* ------------------------------------------------------------------ */
/*  TopPagesCard — most viewed pages for the selected window.          */
/*  Shares the ["analytics", days] cache with TrafficCard.             */
/* ------------------------------------------------------------------ */

import { useQuery } from "@tanstack/react-query";
import { Loader2Icon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchAnalytics } from "@/lib/aitools/api";

const PATH_LABEL: Record<string, string> = {
  discover: "Discover",
  categories: "Categories",
  category: "Category detail",
  trending: "Trending",
  browse: "Newest projects",
  submit: "Submit a project",
  tool: "Tool detail",
  wanted: "Wanted board",
  blog: "Blog",
  post: "Blog post",
};

export function TopPagesCard({ days, className }: { days: 14 | 30; className?: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["analytics", days],
    queryFn: () => fetchAnalytics(days),
    staleTime: 30_000,
  });

  const top = data?.topPages ?? [];
  const total = top.reduce((acc, p) => acc + p.views, 0) || 1;

  return (
    <Card className={`shadow-none dark:ring-0 ${className ?? ""}`}>
      <CardHeader>
        <CardTitle>Top pages</CardTitle>
        <CardDescription>Where visitors spend their time.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="grid h-[180px] place-items-center text-muted-foreground">
            <Loader2Icon className="size-5 animate-spin" />
          </div>
        ) : top.length === 0 ? (
          <div className="grid h-[180px] place-items-center text-center text-sm text-muted-foreground">
            No traffic recorded yet.
          </div>
        ) : (
          <ul className="space-y-3">
            {top.map((p) => {
              const share = Math.round((p.views / total) * 100);
              return (
                <li key={p.path}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="truncate text-foreground/90">
                      {PATH_LABEL[p.path] ?? p.path}
                    </span>
                    <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                      {p.views.toLocaleString("en-US")} · {share}%
                    </span>
                  </div>
                  <div
                    aria-hidden
                    className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted"
                  >
                    <div
                      className="h-full rounded-full bg-[var(--chart-1)]"
                      style={{ width: `${Math.max(share, 2)}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
