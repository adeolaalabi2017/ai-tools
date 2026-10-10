"use client";

/* ------------------------------------------------------------------ */
/*  Minimal, dependency-free markdown renderer for CMS blog content.   */
/*  Builds React elements directly (no dangerouslySetInnerHTML), so    */
/*  authored content can never inject markup. Supports the subset the  */
/*  CMS needs: headings, paragraphs, bold/italic/inline-code, links,   */
/*  fenced code blocks, ordered/unordered lists, quotes, and rules.    */
/* ------------------------------------------------------------------ */

import { Fragment, type ReactNode } from "react";

/* ------------------------------ inline ------------------------------ */

/** Parse one line's inline formatting into React nodes. */
function inline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  /* order matters: code first so its content is never reformatted */
  const re = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*\s][^*]*\*)|(\[[^\]]+\]\([^)\s]+\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const tok = m[0];
    const key = `${keyPrefix}-i${i++}`;
    if (tok.startsWith("`")) {
      nodes.push(
        <code
          key={key}
          className="rounded-[5px] border border-line bg-elev px-1.5 py-0.5 font-mono text-[0.85em] text-ink2"
        >
          {tok.slice(1, -1)}
        </code>,
      );
    } else if (tok.startsWith("**")) {
      nodes.push(
        <strong key={key} className="font-semibold text-ink">
          {tok.slice(2, -2)}
        </strong>,
      );
    } else if (tok.startsWith("*")) {
      nodes.push(<em key={key}>{tok.slice(1, -1)}</em>);
    } else {
      const label = tok.slice(1, tok.indexOf("]"));
      const href = tok.slice(tok.indexOf("](") + 2, -1);
      nodes.push(
        <a
          key={key}
          href={href}
          target={href.startsWith("http") ? "_blank" : undefined}
          rel={href.startsWith("http") ? "noreferrer" : undefined}
          className="text-accent underline decoration-accent/40 underline-offset-2 transition-colors hover:decoration-accent"
        >
          {label}
        </a>,
      );
    }
    last = m.index + tok.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

/* ------------------------------ blocks ------------------------------ */

export function Markdown({ source }: { source: string }) {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let k = 0;

  const push = (node: ReactNode) => blocks.push(node);

  while (i < lines.length) {
    const line = lines[i];

    /* blank */
    if (!line.trim()) {
      i += 1;
      continue;
    }

    /* fenced code block */
    if (line.trimStart().startsWith("```")) {
      const lang = line.trim().slice(3).trim();
      const buf: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].trimStart().startsWith("```")) {
        buf.push(lines[i]);
        i += 1;
      }
      i += 1; // closing fence
      push(
        <pre
          key={k++}
          className="thin-scroll overflow-x-auto rounded-xl border border-line bg-elev p-4 font-mono text-[13px] leading-relaxed text-ink2"
        >
          {lang ? (
            <span className="mb-2 block text-[10px] uppercase tracking-[0.18em] text-faint">{lang}</span>
          ) : null}
          <code>{buf.join("\n")}</code>
        </pre>,
      );
      continue;
    }

    /* heading */
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) {
      const depth = h[1].length;
      const text = inline(h[2], `h${k}`);
      if (depth === 1) {
        push(
          <h2 key={k++} className="pt-4 text-[22px] font-bold tracking-tight text-ink">
            {text}
          </h2>,
        );
      } else if (depth === 2) {
        push(
          <h3 key={k++} className="pt-3 text-lg font-bold tracking-tight text-ink">
            {text}
          </h3>,
        );
      } else {
        push(
          <h4 key={k++} className="pt-2 text-[15px] font-semibold text-ink">
            {text}
          </h4>,
        );
      }
      i += 1;
      continue;
    }

    /* horizontal rule */
    if (/^\s*(---+|\*\*\*+)\s*$/.test(line)) {
      push(<hr key={k++} className="border-line" />);
      i += 1;
      continue;
    }

    /* blockquote */
    if (line.trimStart().startsWith(">")) {
      const buf: string[] = [];
      while (i < lines.length && lines[i].trimStart().startsWith(">")) {
        buf.push(lines[i].trimStart().replace(/^>\s?/, ""));
        i += 1;
      }
      push(
        <blockquote
          key={k++}
          className="rounded-r-lg border-l-2 border-accent/50 bg-accent-soft/40 px-4 py-3 text-[15px] italic leading-relaxed text-mute"
        >
          {inline(buf.join(" "), `q${k}`)}
        </blockquote>,
      );
      continue;
    }

    /* unordered list */
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ""));
        i += 1;
      }
      push(
        <ul key={k++} className="list-disc space-y-1.5 pl-5 text-[15px] leading-relaxed text-mute">
          {items.map((it, j) => (
            <li key={j}>{inline(it, `ul${k}-${j}`)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    /* ordered list */
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ""));
        i += 1;
      }
      push(
        <ol key={k++} className="list-decimal space-y-1.5 pl-5 text-[15px] leading-relaxed text-mute">
          {items.map((it, j) => (
            <li key={j}>{inline(it, `ol${k}-${j}`)}</li>
          ))}
        </ol>,
      );
      continue;
    }

    /* paragraph (consecutive non-empty, non-special lines) */
    const buf: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,4})\s/.test(lines[i]) &&
      !lines[i].trimStart().startsWith("```") &&
      !lines[i].trimStart().startsWith(">") &&
      !/^\s*[-*]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i]) &&
      !/^\s*(---+|\*\*\*+)\s*$/.test(lines[i])
    ) {
      buf.push(lines[i].trim());
      i += 1;
    }
    push(
      <p key={k++} className="text-[15px] leading-relaxed text-mute">
        {buf.map((b, j) => (
          <Fragment key={j}>
            {j > 0 && " "}
            {inline(b, `p${k}-${j}`)}
          </Fragment>
        ))}
      </p>,
    );
  }

  return <div className="space-y-4">{blocks}</div>;
}

/** Rough read-time estimate at ~210 wpm. */
export function readMinutes(content: string): number {
  const words = content.trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 210));
}
