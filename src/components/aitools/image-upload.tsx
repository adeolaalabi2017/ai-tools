"use client";

/* Shared image-upload button: pick a file → POST /api/upload → hand back
 * the app-relative URL. Used by the submit form (tool branding) and the
 * admin blog CMS (post covers). Server-side validation is strict (2MB,
 * raster formats, magic-byte sniffed) — errors surface inline here. */

import { useRef, useState } from "react";
import { ImageIcon } from "lucide-react";
import { ApiError, uploadImage } from "@/lib/aitools/api";
import { cn } from "@/lib/utils";

export function UploadButton({
  onUploaded,
  label = "Upload",
  className,
}: {
  onUploaded: (url: string) => void;
  label?: string;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const result = await uploadImage(file);
      onUploaded(result.url);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Upload failed. Try again.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = ""; // allow re-picking the same file
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        className="hidden"
        aria-hidden
        tabIndex={-1}
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-card px-3 text-[12px] text-mute transition-colors hover:border-line2 hover:text-ink disabled:opacity-50",
          className,
        )}
      >
        <ImageIcon className="h-3.5 w-3.5" />
        {busy ? "Uploading…" : label}
      </button>
      {error && (
        <p role="alert" className="mt-1 text-[11px] leading-snug text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
