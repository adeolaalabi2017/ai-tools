"use client";

import { Loader2Icon, StarIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatusIndicator } from "@/components/indicator";
import { catLabel, fmtK } from "@/lib/aitools/data";
import { AppIcon } from "@/components/aitools/ui";
import { apiToolToTool } from "@/components/aitools/tools-provider";
import type { ApiTool } from "@/lib/aitools/api";

/**
 * Featured picks — editors' badges across the directory, newest-first.
 */
export function FeaturedPicks({
  tools,
  featureBusyId,
  onToggleFeatured,
  className,
  ...props
}: ComponentProps<typeof Card> & {
  tools: ApiTool[];
  featureBusyId: string | null;
  onToggleFeatured: (id: string, featured: boolean) => void;
}) {
  return (
    <Card className={cn("shadow-none dark:ring-0", className)} {...props}>
      <CardHeader className="border-b">
        <CardTitle>Featured picks</CardTitle>
        <CardDescription>
          Toggle to badge a tool as an editors&rsquo; pick
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {tools.length === 0 ? (
          <p className="px-4 py-10 text-center text-muted-foreground text-sm">
            No approved tools yet.
          </p>
        ) : (
          <ul className="thin-scroll max-h-80 divide-y divide-border overflow-y-auto">
            {tools.map((t) => {
              const tool = apiToolToTool(t);
              const busy = featureBusyId === t.id;
              return (
                <li
                  className={cn(
                    "flex items-center gap-2.5 px-3 py-2.5 sm:gap-3",
                    t.featured && "bg-accent-soft/40",
                  )}
                  key={t.id}
                >
                  <AppIcon size="sm" tool={tool} />
                  <div className="min-w-0 flex-1 pr-1">
                    <p className="truncate font-medium text-foreground text-sm leading-snug">
                      {t.name}
                    </p>
                    <p className="flex items-center gap-2 text-[10px] leading-snug text-muted-foreground">
                      <span className="flex shrink-0 items-center gap-1">
                        <StatusIndicator
                          color={t.featured ? "emerald" : "amber"}
                          pulse={false}
                        />
                        {t.featured ? "Featured" : "In catalog"}
                      </span>
                      <span className="inline-flex size-1 rounded-full bg-foreground/80" />
                      <span>{catLabel(t.cat)}</span>
                      <span className="inline-flex size-1 rounded-full bg-foreground/80" />
                      <span className="tabular-nums">★ {fmtK(t.stars)}</span>
                    </p>
                  </div>
                  <Button
                    aria-label={
                      t.featured
                        ? `Remove ${t.name} from featured picks`
                        : `Feature ${t.name} as an editors' pick`
                    }
                    aria-pressed={Boolean(t.featured)}
                    className={cn(
                      "size-8 shrink-0",
                      t.featured &&
                        "border-primary/40 bg-accent-soft text-accent hover:bg-accent-soft",
                    )}
                    disabled={featureBusyId !== null}
                    onClick={() => onToggleFeatured(t.id, !t.featured)}
                    size="icon"
                    variant="outline"
                  >
                    {busy ? (
                      <Loader2Icon className="size-3.5 animate-spin" />
                    ) : (
                      <StarIcon
                        className={cn(
                          "size-3.5",
                          t.featured && "fill-current",
                        )}
                      />
                    )}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
