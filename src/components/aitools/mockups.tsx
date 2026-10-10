"use client";

/* Hand-built CSS mockups used inside featured cards. No external images. */

import { cn } from "@/lib/utils";
import { Play, Plus, Zap, Bot, Braces } from "lucide-react";

function WindowFrame({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("overflow-hidden rounded-lg border border-line bg-[#141417] shadow-xl shadow-black/30", className)}>
      <div className="flex h-6 items-center gap-1.5 border-b border-line bg-[#1a1a1e] px-2.5">
        <span className="h-1.5 w-1.5 rounded-full bg-zinc-600" />
        <span className="h-1.5 w-1.5 rounded-full bg-zinc-600" />
        <span className="h-1.5 w-1.5 rounded-full bg-zinc-600" />
        <span className="ml-2 truncate font-mono text-[9px] text-faint">{title}</span>
      </div>
      {children}
    </div>
  );
}

export function TerminalMock() {
  return (
    <WindowFrame title="opencode — zsh" className="w-full max-w-[250px]">
      <div className="space-y-1.5 p-3 font-mono text-[10px] leading-relaxed">
        <p>
          <span className="text-accent">$</span> <span className="text-ink2">opencode</span>
        </p>
        <p className="text-faint">✻ pairing on src/auth.ts · 2 files</p>
        <p className="text-ink2">
          <span className="text-accent">✻</span> refactor session middleware…
        </p>
        <p className="text-accent">✔ 12 tests passing</p>
        <p className="text-faint">
          <span className="text-ink2">▍</span> awaiting your review
        </p>
      </div>
    </WindowFrame>
  );
}

export function ChatMock({ compact = false }: { compact?: boolean }) {
  return (
    <WindowFrame title="Open WebUI — New chat" className="w-full max-w-[250px]">
      <div className="flex">
        {!compact && (
          <div className="hidden w-14 shrink-0 space-y-2 border-r border-line p-2 sm:block">
            <div className="h-1.5 rounded bg-line" />
            <div className="h-1.5 w-8 rounded bg-line" />
            <div className="h-1.5 w-10 rounded bg-line" />
          </div>
        )}
        <div className="flex-1 space-y-2 p-3">
          <div className="ml-auto w-fit max-w-[80%] rounded-lg rounded-br-sm bg-elev px-2.5 py-1.5 text-[10px] text-ink2">
            Summarize my repo activity
          </div>
          <div className="w-fit max-w-[85%] rounded-lg rounded-bl-sm border border-line bg-card px-2.5 py-1.5 text-[10px] leading-relaxed text-mute">
            42 commits this week — mostly agent tooling. Want a breakdown?
          </div>
          <div className="flex items-center gap-2 rounded-full border border-line bg-card px-2.5 py-1.5">
            <span className="h-1 w-full max-w-[70px] rounded bg-line" />
            <span className="ml-auto h-2.5 w-2.5 rounded-full bg-accent/80" />
          </div>
        </div>
      </div>
    </WindowFrame>
  );
}

function NodeBox({ title, className }: { title: string; className?: string }) {
  return (
    <div className={cn("w-24 rounded-md border border-line bg-[#1b1b20]", className)}>
      <div className="border-b border-line px-2 py-1 font-mono text-[8px] text-ink2">{title}</div>
      <div className="space-y-1.5 p-2">
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-accent/70" />
          <span className="h-1 flex-1 rounded bg-line" />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400/70" />
          <span className="h-1 flex-1 rounded bg-line" />
        </div>
      </div>
    </div>
  );
}

export function NodesMock() {
  return (
    <WindowFrame title="ComfyUI — workflow" className="w-full max-w-[250px]">
      <div className="relative h-[104px] p-2.5">
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 240 100" fill="none" aria-hidden>
          <path d="M92 32 C 130 32, 128 66, 158 66" stroke="var(--line-2)" strokeWidth="1.5" />
          <path d="M92 44 C 118 44, 120 26, 158 26" stroke="var(--line-2)" strokeWidth="1.5" />
        </svg>
        <NodeBox title="Load Checkpoint" className="absolute left-3 top-4" />
        <NodeBox title="KSampler" className="absolute right-3 top-3" />
        <div className="absolute bottom-2 right-3 flex items-center gap-1.5 rounded-md border border-line bg-card px-2 py-1">
          <span className="h-2 w-2 rounded-sm bg-gradient-to-br from-amber-300 to-emerald-400" />
          <span className="h-1 w-10 rounded bg-line" />
          <span className="h-1 w-6 rounded bg-line" />
        </div>
      </div>
    </WindowFrame>
  );
}

export function WaveMock() {
  const bars = [5, 9, 14, 20, 26, 30, 24, 18, 12, 17, 23, 28, 21, 15, 10, 6, 9, 13, 8, 5];
  return (
    <WindowFrame title="VoiceStudio — take 03" className="w-full max-w-[250px]">
      <div className="p-3">
        <div className="flex h-14 items-center gap-[3px]">
          {bars.map((h, i) => (
            <span
              key={i}
              className={cn("w-[3px] rounded-full", i % 3 === 0 ? "bg-accent/80" : "bg-zinc-600")}
              style={{ height: `${h}px` }}
            />
          ))}
        </div>
        <div className="mt-2 flex items-center gap-2 border-t border-line pt-2">
          <span className="grid h-5 w-5 place-items-center rounded-full bg-accent text-black">
            <Play className="h-2.5 w-2.5 fill-black" />
          </span>
          <span className="h-1 flex-1 rounded bg-line" />
          <span className="font-mono text-[8px] text-faint">00:42</span>
        </div>
      </div>
    </WindowFrame>
  );
}

export function FlowMock() {
  return (
    <WindowFrame title="n8n — AI workflow" className="w-full max-w-[250px]">
      <div className="flex h-[104px] items-center gap-0 px-3">
        <div className="flex flex-col items-center gap-1">
          <span className="grid h-8 w-8 place-items-center rounded-lg border border-line bg-[#1b1b20] text-amber-400">
            <Zap className="h-3.5 w-3.5" />
          </span>
          <span className="font-mono text-[7px] text-faint">Trigger</span>
        </div>
        <span className="h-px flex-1 bg-line2" />
        <span className="grid h-4 w-4 place-items-center rounded-full border border-line bg-card text-faint">
          <Plus className="h-2.5 w-2.5" />
        </span>
        <span className="h-px flex-1 bg-line2" />
        <div className="flex flex-col items-center gap-1">
          <span className="grid h-8 w-8 place-items-center rounded-lg border border-line bg-[#1b1b20] text-ink2">
            <Braces className="h-3.5 w-3.5" />
          </span>
          <span className="font-mono text-[7px] text-faint">Code</span>
        </div>
        <span className="h-px flex-1 bg-line2" />
        <span className="grid h-4 w-4 place-items-center rounded-full border border-line bg-card text-faint">
          <Plus className="h-2.5 w-2.5" />
        </span>
        <span className="h-px flex-1 bg-line2" />
        <div className="flex flex-col items-center gap-1">
          <span className="grid h-8 w-8 place-items-center rounded-lg border border-accent/40 bg-accent/10 text-accent">
            <Bot className="h-3.5 w-3.5" />
          </span>
          <span className="font-mono text-[7px] text-faint">AI Agent</span>
        </div>
      </div>
    </WindowFrame>
  );
}

export function FeaturedArt({ kind }: { kind: "terminal" | "chat" | "nodes" | "wave" | "flow" }) {
  if (kind === "terminal") return <TerminalMock />;
  if (kind === "nodes") return <NodesMock />;
  if (kind === "wave") return <WaveMock />;
  if (kind === "flow") return <FlowMock />;
  return <ChatMock />;
}
