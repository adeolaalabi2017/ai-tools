"use client";

import { useMemo, useRef, useState } from "react";
import { Check, Github } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { CATEGORIES, githubAvatar } from "@/lib/aitools/data";
import { ApiError, submitTool } from "@/lib/aitools/api";
import { Dropdown } from "../ui";
import { UploadButton } from "../image-upload";

const PLATFORM_CHIPS = [
  { id: "web", label: "Web" },
  { id: "mac", label: "macOS" },
  { id: "win", label: "Windows" },
  { id: "linux", label: "Linux" },
  { id: "ios", label: "iOS" },
  { id: "android", label: "Android" },
];

const GITHUB_RE = /^github\.com\/([\w.-]+)\/([\w.-]+)/i;

function prettyName(slug: string): string {
  return slug
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

/* Field messages name each field by its visible label. The server's
   submissionSchema uses the same strings, so a 400 maps back to its field. */
const FIELD_MESSAGES = {
  name: "Project name needs 2–60 characters.",
  cat: "Choose a category.",
  alt: "Alternative to needs 2–80 characters.",
  desc: "Short description needs 10–200 characters.",
  platforms: "Choose at least one platform.",
} as const;
const REPO_MESSAGE = "Enter the repository as github.com/owner/repo.";
const FIELD_ORDER = ["name", "cat", "alt", "desc", "platforms"] as const;
const FIELD_IDS: Record<(typeof FIELD_ORDER)[number] | "repo", string> = {
  repo: "repo",
  name: "pname",
  cat: "cat-field",
  alt: "alt",
  desc: "desc",
  platforms: "platforms-field",
};

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-1.5 text-xs font-medium text-destructive">
      {message}
    </p>
  );
}

export function Submit({
  onDiscover,
  onWanted,
}: {
  onDiscover: () => void;
  onWanted: () => void;
}) {
  const queryClient = useQueryClient();
  const [repo, setRepo] = useState("");
  const [fetchState, setFetchState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [name, setName] = useState("");
  const [category, setCategory] = useState<string>("");
  const [alt, setAlt] = useState("");
  const [desc, setDesc] = useState("");
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [logoUrl, setLogoUrl] = useState("");
  const [screenshotUrl, setScreenshotUrl] = useState("");
  const [headerUrl, setHeaderUrl] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [createdName, setCreatedName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [repoError, setRepoError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Logo URL we auto-filled from the repo owner's avatar (so repo edits can retract it). */
  const autoLogo = useRef<string | null>(null);

  const repoValid = useMemo(() => GITHUB_RE.test(repo.trim()), [repo]);

  /* per-field errors, shown under each field; messages use the field's own
     label and match the server's rules in submissionSchema */
  type Field = "name" | "cat" | "alt" | "desc" | "platforms";
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<Field, string>>>({});
  const clearError = (f: Field) => setFieldErrors((e) => (e[f] ? { ...e, [f]: undefined } : e));
  const validate = () => {
    const errs: Partial<Record<Field, string>> = {};
    const len = (v: string) => v.trim().length;
    if (len(name) < 2 || len(name) > 60) errs.name = FIELD_MESSAGES.name;
    if (!category) errs.cat = FIELD_MESSAGES.cat;
    if (len(alt) < 2 || len(alt) > 80) errs.alt = FIELD_MESSAGES.alt;
    if (len(desc) < 10 || len(desc) > 200) errs.desc = FIELD_MESSAGES.desc;
    if (platforms.length === 0) errs.platforms = FIELD_MESSAGES.platforms;
    return errs;
  };
  const focusField = (id: string) => {
    const el = document.getElementById(id);
    const target = el?.matches("input, textarea, button") ? el : el?.querySelector<HTMLElement>("input, textarea, button");
    target?.focus();
  };

  const fetchRepo = () => {
    if (!repoValid) {
      setFetchState("error");
      return;
    }
    setFetchState("loading");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const m = repo.trim().match(GITHUB_RE);
      if (m) {
        setName((n) => n || prettyName(m[2]));
        /* prefill the logo with the project's original brand mark (the repo
           owner's own GitHub avatar) unless the submitter typed one already */
        const avatar = githubAvatar(`${m[1]}/${m[2]}`);
        autoLogo.current = avatar;
        setLogoUrl((l) => (l.trim() ? l : avatar));
        setFetchState("done");
      } else {
        setFetchState("error");
      }
    }, 700);
  };

  const togglePlatform = (id: string) =>
    setPlatforms((ps) => (ps.includes(id) ? ps.filter((p) => p !== id) : [...ps, id]));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setRepoError(null);
    setFormError(null);
    /* validate on submit: show every problem beside its field, then move
       focus to the first one */
    const errs = validate();
    setFieldErrors(errs);
    if (!repoValid) setRepoError(REPO_MESSAGE);
    const first = !repoValid ? "repo" : FIELD_ORDER.find((f) => errs[f]);
    if (first) {
      focusField(FIELD_IDS[first]);
      return;
    }
    setSubmitting(true);
    const m = repo.trim().match(GITHUB_RE);
    try {
      const created = await submitTool({
        name: name.trim(),
        /* the API expects "owner/repo" */
        repo: m ? `${m[1]}/${m[2]}` : repo.trim(),
        desc: desc.trim(),
        replaces: alt.trim(),
        cat: category,
        platforms,
        logoUrl: logoUrl.trim() || undefined,
        screenshotUrl: screenshotUrl.trim() || undefined,
        headerUrl: headerUrl.trim() || undefined,
      });
      setCreatedName(created.name || name.trim());
      /* let every list know a new tool exists */
      void queryClient.invalidateQueries({ queryKey: ["tools", "all"] });
      setSubmitted(true);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409) {
          setRepoError(err.message || "This repository is already listed.");
        } else if (err.status === 400) {
          /* the server's messages match FIELD_MESSAGES, so route each one
             back to its field; anything unrecognised goes above the button */
          const routed: Partial<Record<Field, string>> = {};
          const rest: string[] = [];
          for (const issue of err.issues) {
            const f = FIELD_ORDER.find((k) => FIELD_MESSAGES[k] === issue);
            if (f) routed[f] = issue;
            else rest.push(issue);
          }
          setFieldErrors(routed);
          if (rest.length || !Object.keys(routed).length) {
            setFormError(rest[0] ?? "Check the highlighted fields, then submit again.");
          }
          const firstRouted = FIELD_ORDER.find((f) => routed[f]);
          if (firstRouted) focusField(FIELD_IDS[firstRouted]);
        } else {
          /* 5xx or other: the server's text ("Internal server error") gives
             the submitter nothing to act on, so say what to do instead */
          setFormError("Unable to submit right now. Your answers are still here, so try again in a minute.");
        }
      } else {
        setFormError("Unable to reach the server. Check your connection, then submit again. Your answers are still here.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="mx-auto max-w-3xl px-5 pb-24">
        <div className="mt-24 rounded-2xl border border-line bg-card p-10 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full border border-accent/40 bg-accent-soft">
            <Check className="h-5 w-5 text-accent" />
          </span>
          <h1 className="mt-5 text-2xl font-bold tracking-tight text-ink">Submission received</h1>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-mute">
            <span className="text-ink2">&ldquo;{createdName}&rdquo;</span> was sent to the editors.
          </p>
          <p className="mx-auto mt-1 max-w-md text-sm leading-relaxed text-mute">
            It will appear in the directory once approved.
          </p>
          <div className="mt-7 flex items-center justify-center gap-3">
            <button
              onClick={() => {
                setSubmitted(false);
                setRepo("");
                setName("");
                setCategory("");
                setAlt("");
                setDesc("");
                setPlatforms([]);
                setFetchState("idle");
                setCreatedName("");
                setRepoError(null);
                setFormError(null);
                setLogoUrl("");
                setScreenshotUrl("");
                setHeaderUrl("");
                autoLogo.current = null;
              }}
              className="rounded-lg border border-line bg-elev px-4 py-2.5 text-sm text-ink2 transition-colors hover:border-line2 hover:text-ink"
            >
              Submit another
            </button>
            <button
              onClick={onDiscover}
              className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/90"
            >
              Back to Discover
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-5 pb-24">
      <header className="pb-10 pt-14">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-faint">Contribute</p>
        <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-ink">Submit a project</h1>
        <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-mute">
          Suggest an open-source AI tool for Open AI Stack. Paste its GitHub repository and we'll fill in what we can. No
          account needed.
        </p>

        <div className="mt-7 flex flex-wrap items-center gap-x-3 gap-y-2 text-[13px] text-mute">
          <Step n={1} label="Listed in Community Finds" />
          <Dash />
          <Step n={2} label="Community votes" />
          <Dash />
          <Step n={3} label="Editorial review" />
        </div>
      </header>

      <form
        onSubmit={(e) => {
          void handleSubmit(e);
        }}
      >
        {/* 01 — repository */}
        <section className="grid grid-cols-1 gap-4 border-t border-line py-10 md:grid-cols-[200px_1fr] md:gap-10">
          <div>
            <p className="font-mono text-xs text-faint">01</p>
            <h2 className="mt-1 text-[15px] font-semibold text-ink">Repository</h2>
            <p className="mt-2 text-[13px] leading-relaxed text-faint">
              Public GitHub repositories only. Projects already listed or submitted can't be added twice.
            </p>
          </div>
          <div>
            <label htmlFor="repo" className="block text-[13px] font-medium text-ink2">
              GitHub repository URL
            </label>
            <div className="mt-2 flex gap-2">
              <div
                className={cn(
                  "flex h-11 flex-1 items-center gap-2.5 rounded-lg border bg-card px-3.5 transition-colors",
                  fetchState === "error" || repoError ? "border-destructive/60" : "border-line focus-within:border-line2",
                )}
              >
                <Github className="h-4 w-4 shrink-0 text-faint" />
                <input
                  id="repo"
                  value={repo}
                  onChange={(e) => {
                    setRepo(e.target.value);
                    setFetchState("idle");
                    setRepoError(null);
                    /* switching repos retracts the auto-filled logo but keeps a user-typed URL */
                    setLogoUrl((l) => (l.trim() && l.trim() === autoLogo.current ? "" : l));
                    autoLogo.current = null;
                  }}
                  placeholder="github.com/owner/repo"
                  aria-invalid={repoError || fetchState === "error" ? true : undefined}
                  aria-describedby={repoError && fetchState !== "error" ? "repo-error" : "repo-hint"}
                  className="h-full min-w-0 flex-1 bg-transparent font-mono text-[13px] text-ink outline-none placeholder:text-faint"
                />
              </div>
              <button
                type="button"
                onClick={fetchRepo}
                disabled={fetchState === "loading"}
                className="h-11 shrink-0 rounded-lg border border-line2 bg-elev px-4 text-sm text-ink transition-colors hover:bg-card disabled:opacity-60"
              >
                {fetchState === "loading" ? "Fetching…" : "Fetch"}
              </button>
            </div>
            <p
              id="repo-hint"
              className={cn(
                "mt-2 text-xs",
                fetchState === "error"
                  ? "text-destructive"
                  : fetchState === "done"
                    ? "text-accent-text"
                    : "text-faint",
              )}
            >
              {fetchState === "error"
                ? REPO_MESSAGE
                : fetchState === "done"
                  ? "Name and logo filled in from the repository."
                  : "The name and logo fill in from the repository."}
            </p>
            {repoError && fetchState !== "error" && (
              <p id="repo-error" className="mt-2 text-xs font-medium text-destructive">
                {repoError}
              </p>
            )}
          </div>
        </section>

        {/* 02 — details */}
        <section className="grid grid-cols-1 gap-4 border-t border-line py-10 md:grid-cols-[200px_1fr] md:gap-10">
          <div>
            <p className="font-mono text-xs text-faint">02</p>
            <h2 className="mt-1 text-[15px] font-semibold text-ink">Project details</h2>
            <p className="mt-2 text-[13px] leading-relaxed text-faint">Where it fits and what it replaces.</p>
          </div>
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="pname" className="block text-[13px] font-medium text-ink2">
                  Project name
                </label>
                <input
                  id="pname"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    clearError("name");
                  }}
                  placeholder="e.g. AppFlowy"
                  aria-invalid={fieldErrors.name ? true : undefined}
                  aria-describedby={fieldErrors.name ? "pname-error" : undefined}
                  className={cn(
                    "mt-2 h-11 w-full rounded-lg border bg-card px-3.5 text-sm text-ink outline-none transition-colors placeholder:text-faint",
                    fieldErrors.name ? "border-destructive/60" : "border-line focus:border-line2",
                  )}
                />
                <FieldError id="pname-error" message={fieldErrors.name} />
              </div>
              <div>
                <span className="block text-[13px] font-medium text-ink2">Category</span>
                <div id="cat-field" className="mt-2">
                  <Dropdown
                    value={category}
                    onChange={(v) => {
                      setCategory(v);
                      clearError("cat");
                    }}
                    align="left"
                    label="Choose a category"
                    options={CATEGORIES.map((c) => ({ value: c.id, label: c.label }))}
                  />
                </div>
                <FieldError id="cat-error" message={fieldErrors.cat} />
              </div>
            </div>

            <div>
              <label htmlFor="alt" className="block text-[13px] font-medium text-ink2">
                Alternative to
              </label>
              <input
                id="alt"
                value={alt}
                onChange={(e) => {
                  setAlt(e.target.value);
                  clearError("alt");
                }}
                placeholder="e.g. Notion, Confluence"
                aria-invalid={fieldErrors.alt ? true : undefined}
                aria-describedby={fieldErrors.alt ? "alt-error alt-hint" : "alt-hint"}
                className={cn(
                  "mt-2 h-11 w-full rounded-lg border bg-card px-3.5 text-sm text-ink outline-none transition-colors placeholder:text-faint",
                  fieldErrors.alt ? "border-destructive/60" : "border-line focus:border-line2",
                )}
              />
              <FieldError id="alt-error" message={fieldErrors.alt} />
              <p id="alt-hint" className="mt-1.5 text-xs text-faint">
                Proprietary products it can replace, separated by commas.
              </p>
            </div>

            <div>
              <label htmlFor="desc" className="block text-[13px] font-medium text-ink2">
                Short description
              </label>
              <textarea
                id="desc"
                value={desc}
                maxLength={200}
                onChange={(e) => {
                  setDesc(e.target.value);
                  clearError("desc");
                }}
                placeholder="What does this project help people do?"
                aria-invalid={fieldErrors.desc ? true : undefined}
                aria-describedby={fieldErrors.desc ? "desc-error desc-hint" : "desc-hint"}
                className={cn(
                  "mt-2 min-h-28 w-full resize-y rounded-lg border bg-card px-3.5 py-3 text-sm leading-relaxed text-ink outline-none transition-colors placeholder:text-faint",
                  fieldErrors.desc ? "border-destructive/60" : "border-line focus:border-line2",
                )}
              />
              <FieldError id="desc-error" message={fieldErrors.desc} />
              <div id="desc-hint" className="mt-1.5 flex items-center justify-between text-xs text-faint">
                <span>One or two plain sentences, 10–200 characters.</span>
                <span className="font-mono tabular-nums">{desc.length} / 200</span>
              </div>
            </div>

            <div>
              <span className="flex items-baseline gap-2">
                <span className="text-[13px] font-medium text-ink2">Available on</span>
                <span className="text-xs text-faint">Choose at least one</span>
              </span>
              <div id="platforms-field" className="mt-2.5 flex flex-wrap gap-2">
                {PLATFORM_CHIPS.map((p) => {
                  const active = platforms.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => {
                        togglePlatform(p.id);
                        clearError("platforms");
                      }}
                      className={cn(
                        "h-9 rounded-full border px-4 text-[13px] transition-colors",
                        active
                          ? "border-accent/40 bg-accent-soft text-accent-text"
                          : "border-line text-mute hover:border-line2 hover:text-ink",
                      )}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
              <FieldError id="platforms-error" message={fieldErrors.platforms} />
            </div>
          </div>
        </section>

        {/* 03 — branding */}
        <section className="grid grid-cols-1 gap-4 border-t border-line py-10 md:grid-cols-[200px_1fr] md:gap-10">
          <div>
            <p className="font-mono text-xs text-faint">03</p>
            <h2 className="mt-1 text-[15px] font-semibold text-ink">Branding</h2>
            <p className="mt-2 text-[13px] leading-relaxed text-faint">
              The logo is prefilled with the project's official GitHub avatar — paste a different URL to override.
              Screenshot and header are optional: paste direct image URLs and previews render as you type.
            </p>
          </div>
          <div className="grid gap-5">
            <ImageField
              id="logo"
              label="Logo"
              placeholder="https://…/logo.png (square works best)"
              value={logoUrl}
              onChange={setLogoUrl}
              previewClass="h-14 w-14 rounded-xl"
            />
            <ImageField
              id="screenshot"
              label="Screenshot"
              placeholder="https://…/screenshot.png (app window or UI)"
              value={screenshotUrl}
              onChange={setScreenshotUrl}
              previewClass="h-16 w-28 rounded-lg"
            />
            <ImageField
              id="header"
              label="Header image"
              placeholder="https://…/banner.png (wide banner, ~3:1)"
              value={headerUrl}
              onChange={setHeaderUrl}
              previewClass="h-14 w-36 rounded-lg"
            />
          </div>
        </section>

        {formError && (
          <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {formError}
          </p>
        )}

        {/* footer actions */}
        <div className="flex flex-col gap-4 border-t border-line pt-7 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[13px] text-faint">
            Looking for an alternative instead?{" "}
            <button
              type="button"
              onClick={onWanted}
              className="text-ink2 underline underline-offset-4 transition-colors hover:text-ink"
            >
              Request one
            </button>
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onDiscover}
              className="rounded-lg px-4 py-2.5 text-sm text-mute transition-colors hover:text-ink"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {submitting ? "Submitting…" : "Submit project"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function Step({ n, label }: { n: number; label: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className="grid h-6 w-6 place-items-center rounded-full border border-line2 text-[11px] text-ink2">
        {n}
      </span>
      {label}
    </span>
  );
}

/* app-hosted uploads (/uploads/… local, /api/uploads/… adapter-served) are
   valid image refs alongside http(s) URLs */
const IMAGE_REF_RE = /^(https?:\/\/\S+|\/(api\/)?uploads\/[\w.-]+)$/i;

/** URL input with a live thumbnail preview (plain <img> — arbitrary remote hosts). */
function ImageField({
  id,
  label,
  placeholder,
  value,
  onChange,
  previewClass,
}: {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  previewClass: string;
}) {
  const trimmed = value.trim();
  const looksValid = IMAGE_REF_RE.test(trimmed);
  const [failed, setFailed] = useState(false);
  const showPreview = looksValid && !failed;

  return (
    <div className="flex items-start gap-4">
      <span
        aria-hidden
        className={cn(
          "grid shrink-0 place-items-center overflow-hidden border border-dashed border-line2 bg-card",
          previewClass,
        )}
      >
        {showPreview ? (
           
          <img
            src={trimmed}
            alt=""
            className="h-full w-full object-cover"
            onError={() => setFailed(true)}
            onLoad={() => setFailed(false)}
          />
        ) : (
          <span className="text-[10px] text-faint">{failed ? "can't load" : "preview"}</span>
        )}
      </span>
      <div className="min-w-0 flex-1">
        <label htmlFor={id} className="block text-[13px] font-medium text-ink2">
          {label} <span className="font-normal text-faint">(URL or upload)</span>
        </label>
        <div className="mt-2 flex items-center gap-2">
          <input
            id={id}
            type="url"
            value={value}
            onChange={(e) => {
              setFailed(false);
              onChange(e.target.value);
            }}
            placeholder={placeholder}
            className={cn(
              "h-11 min-w-0 flex-1 rounded-lg border bg-card px-3.5 text-sm text-ink outline-none transition-colors placeholder:text-faint",
              trimmed && !looksValid ? "border-destructive/60" : "border-line focus:border-line2",
            )}
          />
          <UploadButton
            label="Upload"
            className="h-11 shrink-0"
            onUploaded={(url) => {
              setFailed(false);
              onChange(url);
            }}
          />
        </div>
        {trimmed && !looksValid && (
          <p className="mt-1.5 text-xs text-destructive">
            Enter a full http(s) image URL, or upload a file.
          </p>
        )}
      </div>
    </div>
  );
}

function Dash() {
  return <span className="hidden h-px w-8 bg-line2 sm:block" aria-hidden />;
}
