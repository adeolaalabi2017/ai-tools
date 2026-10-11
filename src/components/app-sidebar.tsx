"use client";

import { GlobeIcon, ListChecksIcon, SparklesIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { NavGroup } from "@/components/nav-group";
import {
  AdminModuleOpen,
  AdminNavigate,
  footerNavLinks,
  navGroups,
} from "@/components/app-shared";
import { LatestChange } from "@/components/latest-change";

export function AppSidebar({
  pendingCount = 0,
  module: activeModule,
  onNavigate,
  onModule,
}: {
  pendingCount?: number;
  module?: string;
  onNavigate: AdminNavigate;
  onModule: AdminModuleOpen;
}) {
  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader className="h-14 justify-center">
        <SidebarMenuButton
          tooltip="AIStore Admin"
          onClick={() => onModule("overview")}
        >
          <span className="grid size-6 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground">
            <SparklesIcon className="size-3.5" />
          </span>
          <span className="font-semibold tracking-tight">AIStore</span>
          <span className="ml-1 rounded border border-border px-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Admin
          </span>
        </SidebarMenuButton>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenuItem className="flex items-center gap-2">
            <SidebarMenuButton
              className="min-w-8 bg-primary text-primary-foreground duration-200 ease-linear hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground"
              onClick={() => onModule("review")}
              tooltip="Review queue"
            >
              <ListChecksIcon />
              <span>Review queue</span>
              {pendingCount > 0 && (
                <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-black/20 px-1 font-mono text-[11px] tabular-nums">
                  {pendingCount}
                </span>
              )}
            </SidebarMenuButton>
            <Button
              aria-label="Back to AIStore"
              className="size-8 group-data-[collapsible=icon]:opacity-0"
              onClick={() => onNavigate("discover")}
              size="icon"
              variant="outline"
            >
              <GlobeIcon />
              <span className="sr-only">Back to AIStore</span>
            </Button>
          </SidebarMenuItem>
        </SidebarGroup>
        {navGroups.map((group, index) => (
          <NavGroup
            key={`sidebar-group-${index}`}
            {...group}
            onNavigate={onNavigate}
            onModule={onModule}
          />
        ))}
      </SidebarContent>
      <SidebarFooter>
        <LatestChange />
        <SidebarMenu className="mt-2">
          {footerNavLinks.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                className="text-muted-foreground"
                onClick={() => onNavigate(item.view as never)}
                size="sm"
                tooltip={item.title}
              >
                {item.icon}
                <span>{item.title}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
