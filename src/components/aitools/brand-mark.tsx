/* ------------------------------------------------------------------ */
/*  Open AI Stack brand mark: three stacked plates, the top one solid. */
/*  The open (stroked) plates below read as "open"; the solid top one  */
/*  as the stack you build. Drawn on a 24px grid in currentColor so it */
/*  takes the accent (or any) colour from its parent. public/logo.svg  */
/*  and public/apple-touch-icon.png are the same geometry.             */
/* ------------------------------------------------------------------ */

export const BRAND_MARK_PATHS = {
  /* solid top plate */
  top: "M12 2.75 21 7.25 12 11.75 3 7.25Z",
  /* open plates beneath, as chevrons */
  middle: "M3 12 12 16.5 21 12",
  bottom: "M3 16.75 12 21.25 21 16.75",
} as const;

export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
    >
      <path d={BRAND_MARK_PATHS.top} fill="currentColor" />
      <path d={BRAND_MARK_PATHS.middle} />
      <path d={BRAND_MARK_PATHS.bottom} />
    </svg>
  );
}
