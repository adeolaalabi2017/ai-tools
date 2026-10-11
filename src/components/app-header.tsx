"use client";

import { MoonIcon, ShieldCheckIcon, SunIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { AppBreadcrumbs } from "@/components/app-breadcrumbs";
import { CustomSidebarTrigger } from "@/components/custom-sidebar-trigger";
import { NavUser } from "@/components/nav-user";
import { MODULE_META, type AdminModule, type AdminNavigate } from "@/components/app-shared";

function toggleTheme() {
  const next =
    document.documentElement.dataset.theme === "light" ? "dark" : "light";
  document.documentElement.dataset.theme = next;
  try {
    localStorage.setItem("aistore-theme", next);
  } catch {}
}

export function AppHeader({
  onNavigate,
  module = "overview",
}: {
  onNavigate: AdminNavigate;
  module?: AdminModule;
}) {
  return (
    <header className="sticky top-0 z-50 flex h-14 shrink-0 items-center justify-between gap-2 border-b bg-surface/85 px-4 backdrop-blur md:px-6">
      <div className="flex items-center gap-3">
        <CustomSidebarTrigger />
        <Separator
          className="mr-2 h-4 data-[orientation=vertical]:self-center"
          orientation="vertical"
        />
        <AppBreadcrumbs
          page={{
            title: `Admin · ${MODULE_META[module].title}`,
            icon: <ShieldCheckIcon className="text-primary" />,
          }}
        />
      </div>
      <div className="flex items-center gap-2">
        <Button
          onClick={() => onNavigate("discover")}
          size="sm"
          variant="outline"
        >
          View site
        </Button>
        <Button
          aria-label="Toggle theme"
          onClick={toggleTheme}
          size="icon-sm"
          variant="outline"
        >
          <SunIcon className="hidden h-4 w-4 [html[data-theme='dark']_&]:block" />
          <MoonIcon className="hidden h-4 w-4 [html[data-theme='light']_&]:block" />
          <span className="sr-only">Toggle theme</span>
        </Button>
        <Separator
          className="h-4 data-[orientation=vertical]:self-center"
          orientation="vertical"
        />
        <NavUser />
      </div>
    </header>
  );
}
