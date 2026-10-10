"use client";

import {
  ActivityIcon,
  CompassIcon,
  FolderTreeIcon,
  GlobeIcon,
  LayoutGridIcon,
  LayoutListIcon,
  ListChecksIcon,
  NewspaperIcon,
  PlusIcon,
  StarIcon,
  TargetIcon,
  TrendingUpIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import type { ViewId } from "@/lib/aitools/data";

export type SidebarNavItem = {
  title: string;
  path?: string;
  icon?: ReactNode;
  isActive?: boolean;
  /** SPA view to open (renders a button instead of an anchor). */
  view?: ViewId;
  /** In-page section anchor on the admin dashboard (e.g. "admin-queue"). */
  section?: string;
  subItems?: SidebarNavItem[];
};

export type SidebarNavGroup = {
  label?: string;
  items: SidebarNavItem[];
};

/** Fired when a nav item wants to open an SPA view. */
export type AdminNavigate = (v: ViewId) => void;
/** Fired when a nav item wants to scroll to a dashboard section. */
export type AdminSection = (id: string) => void;

export const navGroups: SidebarNavGroup[] = [
  {
    items: [
      {
        title: "Overview",
        section: "admin-top",
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
        section: "admin-queue",
        icon: <ListChecksIcon />,
      },
      {
        title: "Wanted requests",
        section: "admin-wants",
        icon: <TargetIcon />,
      },
      {
        title: "Featured picks",
        section: "admin-featured",
        icon: <StarIcon />,
      },
      {
        title: "Activity",
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
        section: "admin-catalog",
        icon: <LayoutListIcon />,
      },
    ],
  },
  {
    label: "Content",
    items: [
      {
        title: "Blog",
        section: "admin-blog",
        icon: <NewspaperIcon />,
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

export const navLinks: SidebarNavItem[] = [
  ...navGroups.flatMap((group) =>
    group.items.flatMap((item) =>
      item.subItems?.length ? [item, ...item.subItems] : [item],
    ),
  ),
  ...footerNavLinks,
];
