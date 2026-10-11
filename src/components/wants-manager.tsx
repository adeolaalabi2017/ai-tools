"use client";

/* ------------------------------------------------------------------ */
/*  WantsManager — moderate the "Wanted alternatives" board: set       */
/*  status, connect catalog tools to a fulfilled request, delete spam. */
/* ------------------------------------------------------------------ */

import { useMemo, useState } from "react";
import { ExternalLinkIcon, Link2Icon, Loader2Icon, Trash2Icon, XIcon } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { deleteWant, fetchWants, updateWant, type ApiWant } from "@/lib/aitools/api";
import { useTools } from "@/components/aitools/tools-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const STATUS_LABEL: Record<string, string> = {
  open: "Open",
  progress: "In progress",
  fulfilled: "Fulfilled",
};

export function WantsManager({ className, ...props }: React.ComponentProps<typeof Card>) {
  const queryClient = useQueryClient();
  const { tools } = useTools();

  const wantsQuery = useQuery({
    queryKey: ["wants", "admin"],
    queryFn: () => fetchWants("votes"),
  });
  const wants = useMemo(() => wantsQuery.data?.wants ?? [], [wantsQuery.data]);

  const [rowBusyId, setRowBusyId] = useState<string | null>(null);
  const [armedDelete, setArmedDelete] = useState<string | null>(null);

  const toolName = (id: string) => tools.find((t) => t.id === id)?.name ?? id;
  const connectable = (w: ApiWant) => tools.filter((t) => !w.connected.includes(t.id));

  const patch = async (id: string, payload: { status?: string; connected?: string[] }) => {
    if (rowBusyId) return;
    setRowBusyId(id);
    /* optimistic update on both the admin list and the public board cache */
    const prev = queryClient.getQueryData<{ wants: ApiWant[]; total: number }>(["wants", "admin"]);
    queryClient.setQueryData<{ wants: ApiWant[]; total: number }>(["wants", "admin"], (old) =>
      old
        ? {
            ...old,
            wants: old.wants.map((w) => (w.id === id ? { ...w, ...payload } : w)),
          }
        : old,
    );
    try {
      await updateWant(id, payload as { status?: "open" | "progress" | "fulfilled"; connected?: string[] });
      await queryClient.invalidateQueries({ queryKey: ["wants"] });
    } catch {
      queryClient.setQueryData(["wants", "admin"], prev);
    } finally {
      setRowBusyId(null);
    }
  };

  const remove = async (w: ApiWant) => {
    if (armedDelete !== w.id) {
      setArmedDelete(w.id);
      return;
    }
    setArmedDelete(null);
    if (rowBusyId) return;
    setRowBusyId(w.id);
    const prev = queryClient.getQueryData<{ wants: ApiWant[]; total: number }>(["wants", "admin"]);
    queryClient.setQueryData<{ wants: ApiWant[]; total: number }>(["wants", "admin"], (old) =>
      old ? { ...old, wants: old.wants.filter((x) => x.id !== w.id), total: Math.max(0, old.total - 1) } : old,
    );
    try {
      await deleteWant(w.id);
      await queryClient.invalidateQueries({ queryKey: ["wants"] });
    } catch {
      queryClient.setQueryData(["wants", "admin"], prev);
    } finally {
      setRowBusyId(null);
    }
  };

  return (
    <Card className={cn("gap-0 shadow-none md:col-span-2 dark:ring-0", className)} {...props}>
      <CardHeader className="border-b">
        <CardTitle>Wanted board</CardTitle>
        <CardDescription>
          {wants.length > 0
            ? `${wants.length} request${wants.length === 1 ? "" : "s"} · ${wants.filter((w) => w.status === "fulfilled").length} fulfilled`
            : "Community requests for alternatives"}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {wantsQuery.isLoading ? (
          <div className="grid place-items-center px-6 py-14">
            <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : wants.length === 0 ? (
          <div className="grid place-items-center px-6 py-14 text-center">
            <p className="text-sm text-muted-foreground">No requests on the board.</p>
          </div>
        ) : (
          <div className="thin-scroll max-h-[62vh] overflow-auto">
            <Table className="min-w-[820px]">
              <TableHeader className="sticky top-0 z-10 bg-card">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-6">Request</TableHead>
                  <TableHead className="hidden lg:table-cell">Votes</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Connected tools</TableHead>
                  <TableHead className="pr-6 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {wants.map((w) => (
                  <TableRow className="h-14 align-top" key={w.id}>
                    <TableCell className="max-w-56 pl-6 pt-4">
                      <p className="truncate font-medium text-sm">{w.target}</p>
                      {w.note && (
                        <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">{w.note}</p>
                      )}
                      <p className="mt-0.5 font-mono text-[10px] text-muted-foreground/70">
                        {w.requester ?? "anonymous"}
                        {w.dupes > 0 ? ` · ${w.dupes} dupes` : ""}
                      </p>
                    </TableCell>
                    <TableCell className="hidden pt-4 lg:table-cell">
                      <span className="font-mono text-sm text-muted-foreground">▲ {w.votes}</span>
                    </TableCell>
                    <TableCell className="pt-3.5">
                      <Select
                        onValueChange={(v) => void patch(w.id, { status: v })}
                        value={w.status}
                      >
                        <SelectTrigger
                          aria-label={`Status for ${w.target}`}
                          className="h-8 w-[130px] text-xs"
                          size="sm"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(STATUS_LABEL).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="max-w-64 pt-3.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {w.connected.map((id) => (
                          <span
                            key={id}
                            className="inline-flex items-center gap-1 rounded-md border border-primary/40 bg-accent-soft px-1.5 py-0.5 text-[11px] text-accent"
                          >
                            <Link2Icon className="size-3" />
                            {toolName(id)}
                            <button
                              aria-label={`Unlink ${toolName(id)} from ${w.target}`}
                              className="ml-0.5 opacity-70 transition-opacity hover:opacity-100"
                              disabled={rowBusyId === w.id}
                              onClick={() =>
                                void patch(w.id, {
                                  connected: w.connected.filter((c) => c !== id),
                                })
                              }
                            >
                              <XIcon className="size-3" />
                            </button>
                          </span>
                        ))}
                        {connectable(w).length > 0 && w.connected.length < 6 && (
                          <Select
                            onValueChange={(id) =>
                              void patch(w.id, { connected: [...w.connected, id] })
                            }
                            value=""
                          >
                            <SelectTrigger
                              aria-label={`Connect a tool to ${w.target}`}
                              className="h-6 w-[110px] gap-1 border-dashed px-2 text-[11px] text-muted-foreground"
                              size="sm"
                            >
                              <ExternalLinkIcon className="size-3" />
                              Connect…
                            </SelectTrigger>
                            <SelectContent className="max-h-64">
                              {connectable(w).map((t) => (
                                <SelectItem className="text-xs" key={t.id} value={t.id}>
                                  {t.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                        {w.connected.length === 0 && connectable(w).length === 0 && (
                          <span className="text-[11px] text-muted-foreground">—</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="pr-6 pt-4 text-right">
                      <Button
                        aria-label={
                          armedDelete === w.id ? `Confirm delete ${w.target}` : `Delete ${w.target}`
                        }
                        className={cn(
                          "size-8",
                          armedDelete === w.id
                            ? "text-destructive hover:text-destructive"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                        disabled={rowBusyId === w.id}
                        onBlur={() => setArmedDelete((a) => (a === w.id ? null : a))}
                        onClick={() => void remove(w)}
                        size="icon"
                        variant="ghost"
                      >
                        {rowBusyId === w.id ? (
                          <Loader2Icon className="size-3.5 animate-spin" />
                        ) : (
                          <Trash2Icon className="size-3.5" />
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <div className="flex items-center justify-between border-t px-6 py-3">
          <Badge className="font-mono text-[10px]" variant="secondary">
            status + links go live instantly
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
