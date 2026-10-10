"use client";

import { FolderGit2Icon, ListChecksIcon, StarIcon, VoteIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export type AdminStat = {
  label: string;
  value: string;
  footnote: string;
  icon: React.ReactNode;
  tone?: "default" | "warn";
};

export function DashboardStats({ stats }: { stats: AdminStat[] }) {
  return (
    <>
      {stats.map((s) => (
        <Card className={cn("shadow-none dark:ring-0")} key={s.label}>
          <CardHeader>
            <CardTitle className="flex items-center justify-between font-normal text-muted-foreground text-xs">
              {s.label}
              <span
                className={cn(
                  "grid size-6 place-items-center rounded-md [&_svg]:size-3.5",
                  s.tone === "warn"
                    ? "bg-amber-500/10 text-amber-500"
                    : "bg-accent-soft text-accent",
                )}
              >
                {s.icon}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1">
            <p className="font-semibold text-2xl tabular-nums">{s.value}</p>
            <span className="text-muted-foreground text-xs">{s.footnote}</span>
          </CardContent>
        </Card>
      ))}
    </>
  );
}

export const statIcons = {
  tools: <FolderGit2Icon />,
  pending: <ListChecksIcon />,
  votes: <VoteIcon />,
  featured: <StarIcon />,
};
