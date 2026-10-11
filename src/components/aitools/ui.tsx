"use client";

import { useEffect, useRef, useState } from "react";
import {
  Apple,
  AppWindow,
  ArrowUpRight,
  Bot,
  BookOpen,
  ChevronDown,
  Clapperboard,
  Code2,
  Check,
  Globe,
  Image as ImageIcon,
  Layers,
  Mic,
  PenLine,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Star,
  Terminal,
  Workflow,
  Github,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  brandLogoUrl,
  fmtK,
  PLATFORM_LABEL,
  catLabel,
  type Platform,
  type Tool,
} from "@/lib/aitools/data";
import { useTools } from "./tools-provider";

/* --------------------------- category icons --------------------------- */

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  assistants: Sparkles,
  coding: Code2,
  images: ImageIcon,
  video: Clapperboard,
  voice: Mic,
  agents: Bot,
  research: BookOpen,
  writing: PenLine,
  automation: Workflow,
  productivity: Layers,
  privacy: ShieldCheck,
  devtools: Terminal,
};

export function CategoryIcon({ id, className }: { id: string; className?: string }) {
  const Icon = CATEGORY_ICONS[id] ?? Sparkles;
  return <Icon className={className} />;
}

/* ----------------------------- app icon ------------------------------- */

/**
 * Tile icon for a tool. Renders the tool's ORIGINAL brand logo (the repo
 * owner's own GitHub avatar, or an explicit logoUrl override) and degrades
 * to the emoji/glyph tile only when no logo can be loaded.
 */
export function AppIcon({ tool, size = "md" }: { tool: Tool; size?: "sm" | "md" | "lg" }) {
  const dims =
    size === "sm" ? "h-6 w-6 rounded-[7px]" : size === "lg" ? "h-10 w-10 rounded-xl" : "h-9 w-9 rounded-lg";
  const glyphSize = size === "sm" ? "text-[12px]" : size === "lg" ? "text-[20px]" : "text-[16px]";
  const logo = brandLogoUrl(tool);
  /* remember which URL failed (not a boolean) so a changed logo retries without an effect */
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showLogo = Boolean(logo) && failedSrc !== logo;
  return (
    <span
      aria-hidden
      className={cn(
        dims,
        "grid shrink-0 place-items-center overflow-hidden border border-line bg-elev select-none",
        size === "sm" && "rounded-md",
      )}
    >
      {showLogo && logo ? (
        <img
          src={logo}
          alt=""
          draggable={false}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover"
          onError={() => setFailedSrc(logo)}
        />
      ) : tool.glyph ? (
        <span className={cn("font-mono font-bold leading-none tracking-tight text-ink", size === "sm" ? "text-[9px]" : "text-[11px]")}>
          {tool.glyph}
        </span>
      ) : (
        <span className={cn("leading-none", glyphSize)}>{tool.emoji}</span>
      )}
    </span>
  );
}

/* ---------------------------- platform row ---------------------------- */

const PLATFORM_ICONS: Record<Platform, LucideIcon> = {
  web: Globe,
  mac: Apple,
  win: AppWindow,
  linux: Terminal,
  ios: Smartphone,
  android: Smartphone,
};

export function PlatformRow({ platforms, className }: { platforms: Platform[]; className?: string }) {
  return (
    <span className={cn("flex items-center gap-2 text-faint", className)}>
      {platforms.map((p) => {
        const Icon = PLATFORM_ICONS[p];
        return <Icon key={p} className="h-3 w-3" aria-label={PLATFORM_LABEL[p]} />;
      })}
    </span>
  );
}

/* ------------------------------- kbd ---------------------------------- */

export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded-[5px] border border-line bg-elev px-1.5 py-0.5 font-mono text-[10px] leading-none text-faint">
      {children}
    </kbd>
  );
}

/* --------------------------- section header --------------------------- */

export function SectionHeader({
  title,
  sub,
  action,
  onAction,
}: {
  title: string;
  sub?: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="mb-7 flex items-end justify-between gap-6">
      <div>
        <h2 className="text-[22px] font-bold tracking-tight text-ink">{title}</h2>
        {sub && <p className="mt-1 text-sm text-mute">{sub}</p>}
      </div>
      {action && (
        <button
          onClick={onAction}
          className="group flex shrink-0 items-center gap-1 pb-0.5 text-sm text-faint transition-colors hover:text-ink"
        >
          {action}
          <ChevronDown className="h-3.5 w-3.5 -rotate-90 transition-transform group-hover:translate-x-0.5" />
        </button>
      )}
    </div>
  );
}

/* ------------------------------ vote chip ------------------------------ */

/**
 * Tiny upvote control. Rendered as a real <button> by default, or as a
 * focusable <span role="button"> when nested inside another button
 * (e.g. ToolRow) to keep the DOM valid.
 */
export function VoteChip({
  id,
  name,
  as = "button",
}: {
  id: string;
  name?: string;
  as?: "button" | "span";
}) {
  const { votes, myVotes, toggleVote } = useTools();
  const voted = myVotes.has(id);
  const count = votes[id] ?? 0;
  const label = `${voted ? "Remove vote from" : "Upvote"} ${name ?? id}`;
  const classes = cn(
    "inline-flex cursor-pointer select-none items-center gap-0.5 rounded-md border px-1.5 py-0.5 font-mono text-xs leading-none transition-colors",
    voted
      ? "border-accent/40 bg-accent-soft text-accent"
      : "border-line text-faint hover:border-line2 hover:text-ink2",
  );
  const onToggle = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    toggleVote(id);
  };

  if (as === "span") {
    return (
      <span
        role="button"
        tabIndex={0}
        aria-pressed={voted}
        aria-label={label}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            e.stopPropagation();
            toggleVote(id);
          }
        }}
        className={classes}
      >
        ▲ {count}
      </span>
    );
  }

  return (
    <button type="button" aria-pressed={voted} aria-label={label} onClick={onToggle} className={classes}>
      ▲ {count}
    </button>
  );
}

/* ------------------------------ tool row ------------------------------ */

export function ToolRow({
  tool,
  badge,
  onClick,
}: {
  tool: Tool;
  badge?: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group w-full border-t border-line pt-5 pb-7 text-left"
    >
      <div className="flex items-start gap-3">
        <AppIcon tool={tool} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2 truncate text-[15px] font-semibold text-ink">
              <span className="truncate">{tool.name}</span>
              {tool.featured && <FeaturedBadge />}
              {badge}
            </span>
            <Github className="h-4 w-4 shrink-0 text-faint transition-colors group-hover:text-ink2" />
          </div>
          <p className="mt-1 line-clamp-1 text-[13px] text-mute">{tool.desc}</p>
          <p className="mt-1 text-[13px] text-faint">
            Alternative to <span className="text-ink2">{tool.replaces}</span>
          </p>
          <div className="mt-2.5 flex items-center gap-1.5 text-xs text-faint">
            <Star className="h-3 w-3" />
            <span className="font-mono">{fmtK(tool.stars)}</span>
            <span className="mx-1 opacity-50">·</span>
            {catLabel(tool.cat)}
            <span className="mx-1 opacity-50">·</span>
            {PLATFORM_LABEL[tool.platforms[0] ?? "web"]}
            <span className="mx-1 opacity-50">·</span>
            <VoteChip id={tool.id} name={tool.name} as="span" />
          </div>
        </div>
      </div>
    </button>
  );
}

/* ------------------------------ dropdown ------------------------------ */

export interface DropdownOption {
  value: string;
  label: string;
  checked?: boolean;
}

export function Dropdown({
  value,
  options,
  onChange,
  icon: Icon,
  align = "right",
  label,
}: {
  value: string;
  options: DropdownOption[];
  onChange: (v: string) => void;
  icon?: LucideIcon;
  align?: "left" | "right";
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const current = options.find((o) => o.value === value);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex h-10 items-center gap-2 rounded-lg border border-line bg-card px-3 text-sm text-ink2 transition-colors hover:border-line2 hover:text-ink"
      >
        {Icon && <Icon className="h-3.5 w-3.5 text-faint" />}
        <span className="whitespace-nowrap">{current?.label ?? label ?? "Select"}</span>
        <ChevronDown className={cn("h-3.5 w-3.5 text-faint transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div
          role="listbox"
          className={cn(
            "animate-pop absolute top-11 z-40 min-w-[176px] rounded-xl border border-line bg-elev p-1 shadow-2xl shadow-black/40",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          {options.map((o) => {
            const active = o.value === value;
            return (
              <button
                key={o.value}
                role="option"
                aria-selected={active}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                  active ? "bg-card text-ink" : "text-mute hover:bg-card hover:text-ink",
                )}
              >
                {o.label}
                {o.checked !== undefined ? (
                  o.checked ? (
                    <Check className="h-3.5 w-3.5 text-accent" />
                  ) : (
                    <span className="h-3.5 w-3.5" />
                  )
                ) : active ? (
                  <Check className="h-3.5 w-3.5 text-accent" />
                ) : null}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------------------------- trend meter ----------------------------- */

export function TrendBar({ gain, max }: { gain: number; max: number }) {
  const pct = Math.max(4, Math.round((gain / Math.max(max, 1)) * 100));
  return (
    <span className="flex items-center gap-3">
      <span className="relative hidden h-1 w-24 overflow-hidden rounded-full bg-line md:block">
        <span
          className="animate-bar absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-accent/50 to-accent"
          style={{ width: `${pct}%` }}
        />
      </span>
      <span className="font-mono text-[13px] text-accent">+{fmtK(gain)}</span>
    </span>
  );
}

/* -------------------------- weekly gain badge ------------------------- */

export function WeeklyGain({ gain }: { gain: number }) {
  return (
    <span className="inline-flex items-center gap-1 font-mono text-xs text-accent">
      <ArrowUpRight className="h-3 w-3" />
      {fmtK(gain)}
      <span className="text-accent/60">/wk</span>
    </span>
  );
}

/* ------------------------- source-available --------------------------- */

export function SourceBadge() {
  return (
    <span className="rounded-md border border-amber-500/25 bg-amber-500/10 px-1.5 py-px text-[10px] font-medium text-amber-500">
      Source-available
    </span>
  );
}

/* ---------------------------- featured badge --------------------------- */

/** Editorial "Featured" pick — set by moderators at approval or via the queue. */
export function FeaturedBadge() {
  return (
    <span
      title="Editors' pick"
      className="inline-flex shrink-0 items-center gap-1 rounded-md border border-accent/40 bg-accent-soft px-1.5 py-px text-[10px] font-medium leading-[1.4] text-accent"
    >
      <Sparkles className="h-3 w-3" aria-hidden />
      Featured
    </span>
  );
}
