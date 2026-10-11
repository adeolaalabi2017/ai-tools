"use client";

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppHeader } from "@/components/app-header";
import { AppSidebar } from "@/components/app-sidebar";
import type {
  AdminModule,
  AdminModuleOpen,
  AdminNavigate,
} from "@/components/app-shared";

/**
 * Full-viewport admin console shell: inset sidebar + sticky header + scrollable content.
 * `module` drives the active page (sidebar highlight + breadcrumb).
 */
export function AppShell({
  children,
  onNavigate,
  module = "overview",
  onModule,
  pendingCount = 0,
}: {
  children: React.ReactNode;
  onNavigate: AdminNavigate;
  module?: AdminModule;
  onModule: AdminModuleOpen;
  pendingCount?: number;
}) {
  return (
    <div className="h-svh overflow-hidden">
      <SidebarProvider className="relative h-svh">
        <AppSidebar
          module={module}
          onNavigate={onNavigate}
          onModule={onModule}
          pendingCount={pendingCount}
        />
        <SidebarInset className="md:peer-data-[variant=inset]:ml-0">
          <AppHeader module={module} onNavigate={onNavigate} />
          <div
            id="admin-scroll"
            className="flex flex-1 flex-col gap-4 overflow-y-auto p-4 md:p-6"
          >
            {children}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}

export function scrollToSection(id: string) {
  if (id === "admin-top") {
    document
      .getElementById("admin-scroll")
      ?.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
}
