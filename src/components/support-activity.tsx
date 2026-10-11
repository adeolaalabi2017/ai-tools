"use client";

import { ArrowRightIcon, CheckIcon, SparklesIcon, UserPlusIcon } from "lucide-react";
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
import { catLabel, fmtRelative } from "@/components/admin-format";
import type { ApiTool } from "@/lib/aitools/api";

/**
 * Moderation activity — the latest tools that joined the catalog.
 */
export function ModerationActivity({
  tools,
  onViewCatalog,
  className,
  ...props
}: ComponentProps<typeof Card> & {
  tools: ApiTool[];
  onViewCatalog: () => void;
}) {
  return (
    <Card className={cn("gap-0 shadow-none dark:ring-0", className)} {...props}>
      <CardHeader className="border-b">
        <CardTitle>Recent additions</CardTitle>
        <CardDescription>Latest tools to join the catalog.</CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        {tools.length === 0 ? (
          <p className="px-4 py-10 text-center text-muted-foreground text-sm">
            Nothing yet.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {tools.map((t) => (
              <li className="flex h-16 items-center gap-3 px-3" key={t.id}>
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-md [&_svg]:size-4",
                    t.status === "community"
                      ? "bg-accent-soft text-accent"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {t.status === "community" ? (
                    <UserPlusIcon />
                  ) : (
                    <SparklesIcon />
                  )}
                </span>
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="line-clamp-1 text-pretty text-foreground text-xs leading-snug">
                    <span className="font-medium">{t.name}</span> joined the
                    catalog · {catLabel(t.cat)}
                  </p>
                  <p className="text-muted-foreground text-xs tabular-nums">
                    {t.status === "community" ? "community" : "curated"} ·{" "}
                    {fmtRelative(t.createdAt)}
                  </p>
                </div>
                <CheckIcon
                  aria-label="Approved"
                  className="size-3.5 shrink-0 text-accent"
                />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      <div className="flex items-center justify-center">
        <Button asChild size="sm" variant="ghost">
          <button onClick={onViewCatalog} type="button">
            View catalog
            <ArrowRightIcon />
          </button>
        </Button>
      </div>
    </Card>
  );
}
