"use client";

/* ------------------------------------------------------------------ */
/*  AdSlot — small, non-intrusive sponsored card for the public site.  */
/*  - fetches active ads for a placement (weighted rotation server-side)*/
/*  - one impression beacon per mount, click beacon on CTA             */
/*  - renders nothing while loading or when no active ads exist        */
/* ------------------------------------------------------------------ */

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { fetchAds, trackAd, type AdPlacement } from "@/lib/aitools/api";

export function useAds(placement: AdPlacement) {
  return useQuery({
    queryKey: ["ads", placement],
    queryFn: () => fetchAds(placement, 1),
    staleTime: 60_000,
    retry: 0,
    refetchOnWindowFocus: false,
  });
}

export function AdSlot({
  placement,
  className,
}: {
  placement: AdPlacement;
  className?: string;
}) {
  const query = useAds(placement);
  const ad = query.data?.ads[0];

  /* a mounted, visible slot counts exactly one impression */
  useEffect(() => {
    if (ad) trackAd(ad.id, "impression");
  }, [ad]);

  if (!ad) return null;

  return (
    <aside
      aria-label="Sponsored card"
      className={cn(
        "flex items-center gap-3.5 rounded-xl border border-line bg-card p-4",
        className,
      )}
    >
      <span
        aria-hidden
        className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-lg border border-line bg-elev"
      >
        {ad.imageUrl ? (
           
          <img src={ad.imageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-lg leading-none">{ad.emoji || "✨"}</span>
        )}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-[13px] font-semibold text-ink">{ad.headline}</p>
          <span className="shrink-0 rounded border border-line px-1 py-px font-mono text-[9px] uppercase tracking-wider text-faint">
            Sponsored
          </span>
        </div>
        <p className="mt-0.5 line-clamp-1 text-xs text-mute">{ad.body}</p>
      </div>
      <a
        href={ad.ctaUrl}
        target="_blank"
        rel="noreferrer sponsored"
        onClick={() => trackAd(ad.id, "click")}
        className="shrink-0 rounded-lg border border-line2 bg-elev px-3 py-1.5 text-xs font-medium text-ink2 transition-colors hover:border-accent/40 hover:text-accent"
      >
        {ad.ctaLabel}
      </a>
    </aside>
  );
}
