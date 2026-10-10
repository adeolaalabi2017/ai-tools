"use client";

import { useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Github } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { CATEGORIES } from "@/lib/aitools/data";
import { ApiError, submitTool } from "@/lib/aitools/api";
import { Dropdown } from "../ui";

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

export function Submit({ onDiscover }: { onDiscover: () => void }) {
  const queryClient = useQueryClient();
  const [repo, setRepo] = useState("");
  const [fetchState, setFetchState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [name, setName] = useState("");
  const [category, setCategory] = useState<string>("");
  const [alt, setAlt] = useState("");
  const [desc, setDesc] = useState("");
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [website, setWebsite] = useState("");
  const [docs, setDocs] = useState("");
  const [audience, setAudience] = useState("");
  const [selfHosting, setSelfHosting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [createdName, setCreatedName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [repoError, setRepoError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [cancelNote, setCancelNote] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const repoValid = useMemo(() => GITHUB_RE.test(repo.trim()), [repo]);

  const canSubmit =
    repoValid && name.trim().length > 0 && category !== "" && platforms.length > 0 && desc.trim().length > 0;

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
        setAlt((a) => a || "ChatGPT");
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
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setRepoError(null);
    setFormError(null);
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
        homepage: website.trim() || undefined,
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
          setFormError(err.issues[0] ?? err.message ?? "Please double-check the form and try again.");
        } else {
          setFormError(err.message || "Something went wrong. Please try again.");
        }
      } else {
        setFormError("Couldn't reach the server. Please try again.");
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
            <span className="text-ink2">{createdName}</span> is live in the directory. Once it gathers enough
            votes, our editors will take a closer look for a curated spot.
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
              }}
              className="rounded-lg border border-line bg-elev px-4 py-2.5 text-sm text-ink2 transition-colors hover:border-line2 hover:text-ink"
            >
              Submit another
            </button>
            <button
              onClick={onDiscover}
              className="rounded-lg bg-solid px-4 py-2.5 text-sm font-medium text-solidfg transition-colors hover:bg-solidhover"
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
          Suggest an open-source AI tool for AIStore. Paste its GitHub repository and we'll fill in what we can. No
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
                  fetchState === "error" ? "border-amber-500/60" : "border-line focus-within:border-line2",
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
                  }}
                  placeholder="github.com/owner/repo"
                  className="h-full min-w-0 flex-1 bg-transparent font-mono text-[13px] text-ink outline-none placeholder:text-faint"
                />
              </div>
              <button
                type="button"
                onClick={fetchRepo}
                disabled={fetchState === "loading"}
                className="h-11 shrink-0 rounded-lg border border-line2 bg-elev px-4 text-sm text-ink transition-colors hover:bg-card disabled:opacity-60"
              >
                {fetchState === "loading" ? "Fetching..." : "Fetch"}
              </button>
            </div>
            <p
              className={cn(
                "mt-2 text-xs",
                fetchState === "error"
                  ? "text-amber-500"
                  : fetchState === "done"
                    ? "text-accent"
                    : "text-faint",
              )}
            >
              {fetchState === "error"
                ? "Enter a valid github.com/owner/repo URL."
                : fetchState === "done"
                  ? "Fetched from GitHub — name, description, and website filled in."
                  : "Name, description, and website fill in from GitHub."}
            </p>
            {repoError && <p className="mt-2 text-xs font-medium text-amber-500">{repoError}</p>}
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
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. AppFlowy"
                  className="mt-2 h-11 w-full rounded-lg border border-line bg-card px-3.5 text-sm text-ink outline-none transition-colors placeholder:text-faint focus:border-line2"
                />
              </div>
              <div>
                <span className="block text-[13px] font-medium text-ink2">Category</span>
                <div className="mt-2">
                  <Dropdown
                    value={category}
                    onChange={setCategory}
                    align="left"
                    label="Choose a category"
                    options={CATEGORIES.map((c) => ({ value: c.id, label: c.label }))}
                  />
                </div>
              </div>
            </div>

            <div>
              <label htmlFor="alt" className="block text-[13px] font-medium text-ink2">
                Alternative to
              </label>
              <input
                id="alt"
                value={alt}
                onChange={(e) => setAlt(e.target.value)}
                placeholder="e.g. Notion, Confluence"
                className="mt-2 h-11 w-full rounded-lg border border-line bg-card px-3.5 text-sm text-ink outline-none transition-colors placeholder:text-faint focus:border-line2"
              />
              <p className="mt-1.5 text-xs text-faint">Proprietary products it can replace, separated by commas.</p>
            </div>

            <div>
              <label htmlFor="desc" className="block text-[13px] font-medium text-ink2">
                Short description
              </label>
              <textarea
                id="desc"
                value={desc}
                maxLength={320}
                onChange={(e) => setDesc(e.target.value)}
                placeholder="What does this project help people do?"
                className="mt-2 min-h-28 w-full resize-y rounded-lg border border-line bg-card px-3.5 py-3 text-sm leading-relaxed text-ink outline-none transition-colors placeholder:text-faint focus:border-line2"
              />
              <div className="mt-1.5 flex items-center justify-between text-xs text-faint">
                <span>One or two plain sentences.</span>
                <span className="font-mono">{desc.length} / 320</span>
              </div>
            </div>

            <div>
              <span className="flex items-baseline gap-2">
                <span className="text-[13px] font-medium text-ink2">Available on</span>
                <span className="text-xs text-faint">Choose at least one</span>
              </span>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {PLATFORM_CHIPS.map((p) => {
                  const active = platforms.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => togglePlatform(p.id)}
                      className={cn(
                        "h-9 rounded-full border px-4 text-[13px] transition-colors",
                        active
                          ? "border-solid bg-solid text-solidfg"
                          : "border-line text-mute hover:border-line2 hover:text-ink",
                      )}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* 03 — more details */}
        <section className="grid grid-cols-1 gap-4 border-t border-line py-10 md:grid-cols-[200px_1fr] md:gap-10">
          <div>
            <p className="font-mono text-xs text-faint">03</p>
            <h2 className="mt-1 text-[15px] font-semibold text-ink">More details</h2>
            <p className="mt-2 text-[13px] leading-relaxed text-faint">
              Optional: Website, docs, audience, and self-hosting.
            </p>
          </div>
          <div>
            <button
              type="button"
              onClick={() => setDetailsOpen((o) => !o)}
              className="flex h-10 items-center gap-2 rounded-lg border border-dashed border-line2 px-4 text-sm text-ink2 transition-colors hover:text-ink"
            >
              Add details
              <ChevronDown className={cn("h-4 w-4 transition-transform", detailsOpen && "rotate-180")} />
            </button>
            {detailsOpen && (
              <div className="animate-pop mt-5 grid gap-5 sm:grid-cols-2">
                <div>
                  <label htmlFor="web" className="block text-[13px] font-medium text-ink2">
                    Website
                  </label>
                  <input
                    id="web"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    placeholder="https://example.com"
                    className="mt-2 h-11 w-full rounded-lg border border-line bg-card px-3.5 text-sm text-ink outline-none transition-colors placeholder:text-faint focus:border-line2"
                  />
                </div>
                <div>
                  <label htmlFor="docs" className="block text-[13px] font-medium text-ink2">
                    Docs
                  </label>
                  <input
                    id="docs"
                    value={docs}
                    onChange={(e) => setDocs(e.target.value)}
                    placeholder="https://docs.example.com"
                    className="mt-2 h-11 w-full rounded-lg border border-line bg-card px-3.5 text-sm text-ink outline-none transition-colors placeholder:text-faint focus:border-line2"
                  />
                </div>
                <div>
                  <span className="block text-[13px] font-medium text-ink2">Audience</span>
                  <div className="mt-2">
                    <Dropdown
                      value={audience}
                      onChange={setAudience}
                      align="left"
                      label="Who is it for?"
                      options={[
                        { value: "personal", label: "Personal use" },
                        { value: "team", label: "Teams" },
                        { value: "selfhost", label: "Self-hosters" },
                        { value: "dev", label: "Developers" },
                      ]}
                    />
                  </div>
                </div>
                <label className="flex cursor-pointer items-center gap-3 self-end pb-2 text-sm text-ink2">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={selfHosting}
                    onClick={() => setSelfHosting((s) => !s)}
                    className={cn(
                      "grid h-5 w-5 place-items-center rounded-md border transition-colors",
                      selfHosting ? "border-accent bg-accent text-zinc-950" : "border-line2 bg-card",
                    )}
                  >
                    {selfHosting && <Check className="h-3.5 w-3.5" />}
                  </button>
                  Supports self-hosting
                </label>
              </div>
            )}
          </div>
        </section>

        {formError && (
          <p className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-500">
            {formError}
          </p>
        )}

        {/* footer actions */}
        <div className="flex flex-col gap-4 border-t border-line pt-7 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[13px] text-faint">
            Looking for an alternative instead?{" "}
            <button
              type="button"
              onClick={() => setCancelNote(true)}
              className="text-ink2 underline underline-offset-4 transition-colors hover:text-ink"
            >
              Request one
            </button>
            {cancelNote && <span className="ml-2 text-faint">(opens the community wishlist — coming soon)</span>}
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
              disabled={!canSubmit || submitting}
              className="rounded-lg bg-solid px-4 py-2.5 text-sm font-medium text-solidfg transition-colors hover:bg-solidhover disabled:cursor-not-allowed disabled:opacity-40"
            >
              {submitting ? "Submitting…" : "Submit project"}
            </button>
          </div>
        </div>
        {!canSubmit && (
          <p className="mt-3 text-right text-xs text-faint">
            Add a valid repo URL, name, category, description, and at least one platform to submit.
          </p>
        )}
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

function Dash() {
  return <span className="hidden h-px w-8 bg-line2 sm:block" aria-hidden />;
}
