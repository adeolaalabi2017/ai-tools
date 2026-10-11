"use client";

import {
  ActivityIcon,
  CompassIcon,
  FolderTreeIcon,
  GlobeIcon,
  LayoutGridIcon,
  LayoutListIcon,
  ListChecksIcon,
  MegaphoneIcon,
  NewspaperIcon,
  PlusIcon,
  StarIcon,
  TargetIcon,
  TrendingUpIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import type { ViewId } from "@/lib/aitools/data";

/** Standalone admin modules — each gets its own full-width page. */
export type AdminModule = "overview" | "review" | "catalog" | "wants" | "blog" | "ads";

export const MODULE_META: Record<AdminModule, { title: string }> = {
  overview: { title: "Overview" },
  review: { title: "Review queue" },
  catalog: { title: "All tools" },
  wants: { title: "Wanted board" },
  blog: { title: "Blog" },
  ads: { title: "Ads" },
};

export type SidebarNavItem = {
  title: string;
  path?: string;
  icon?: ReactNode;
  isActive?: boolean;
  /** SPA view to open (renders a button instead of an anchor). */
  view?: ViewId;
  /** Standalone admin module this item opens. */
  module?: AdminModule;
  /** Optional in-page section to scroll to after switching module. */
  section?: string;
  subItems?: SidebarNavItem[];
};

export type SidebarNavGroup = {
  label?: string;
  items: SidebarNavItem[];
};

/** Fired when a nav item wants to open an SPA view. */
export type AdminNavigate = (v: ViewId) => void;
/** Fired when a nav item wants to open an admin module (optionally at a section). */
export type AdminModuleOpen = (module: AdminModule, section?: string) => void;

export const navGroups: SidebarNavGroup[] = [
  {
    items: [
      {
        title: "Overview",
        module: "overview",
        icon: <LayoutGridIcon />,
        isActive: true,
      },
    ],
  },
  {
    label: "Moderation",
    items: [
      {
        title: "Review queue",
        module: "review",
        icon: <ListChecksIcon />,
      },
      {
        title: "Wanted requests",
        module: "wants",
        icon: <TargetIcon />,
      },
      {
        title: "Featured picks",
        module: "overview",
        section: "admin-featured",
        icon: <StarIcon />,
      },
      {
        title: "Activity",
        module: "overview",
        section: "admin-activity",
        icon: <ActivityIcon />,
      },
    ],
  },
  {
    label: "Catalog",
    items: [
      {
        title: "All tools",
        module: "catalog",
        icon: <LayoutListIcon />,
      },
    ],
  },
  {
    label: "Content",
    items: [
      {
        title: "Blog",
        module: "blog",
        icon: <NewspaperIcon />,
      },
      {
        title: "Ads",
        module: "ads",
        icon: <MegaphoneIcon />,
      },
    ],
  },
  {
    label: "Directory",
    items: [
      { title: "Browse tools", view: "browse", icon: <CompassIcon /> },
      { title: "Categories", view: "categories", icon: <FolderTreeIcon /> },
      { title: "Trending", view: "trending", icon: <TrendingUpIcon /> },
      { title: "Wanted board", view: "wanted", icon: <TargetIcon /> },
    ],
  },
];

export const footerNavLinks: SidebarNavItem[] = [
  {
    title: "Back to AIStore",
    view: "discover",
    icon: <GlobeIcon />,
  },
  {
    title: "Submit an app",
    view: "submit",
    icon: <PlusIcon />,
  },
];
