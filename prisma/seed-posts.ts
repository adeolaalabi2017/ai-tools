/* Seed three editorial posts so the blog section ships with content. */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const posts = [
  {
    slug: "welcome-to-aistore",
    title: "Welcome to AIStore — the open-source AI directory",
    excerpt:
      "Why we built another directory: a curated, community-voted home for the best open-source AI tools, and how to get the most out of it.",
    author: "AIStore Editors",
    tags: "news,community",
    coverEmoji: "👋",
    status: "published",
    content: `## Why AIStore exists

Every week a dozen "awesome-ai" lists pop up, and every week they go stale. AIStore is a different take: a **small, curated catalog** of open-source AI tools that actually hold up — plus a community layer that keeps it honest.

## What you can do here

- **Discover** — editor's picks, trending repos, and well-reviewed staples across 12 categories
- **Vote** — every tool has an upvote chip; the community ranking updates live
- **Submit** — ship an open-source tool? The Submit form takes two minutes
- **Request** — the Wanted board collects alternatives people wish existed

## How curation works

Submissions land in a moderation queue. Editors check that the repo is genuinely open source, that the description matches reality, and that it replaces something specific. Approved tools get a **community** badge and start collecting votes.

> The best directory isn't the biggest one — it's the one where every row deserves its place.

## What's next

A changelog, monthly community roundups, and deep dives on tools that deserve more attention. Watch this space — everything is managed from the new admin CMS, so updates will be frequent.

Happy exploring!`,
  },
  {
    slug: "how-featured-picks-work",
    title: "How Featured picks work (and how to get one)",
    excerpt:
      "The green Featured badge isn't a paid slot — it's an editors' flag. Here's exactly what we look for before a tool earns it.",
    author: "AIStore Editors",
    tags: "featured,guide",
    coverEmoji: "⭐",
    status: "published",
    content: `## The badge

You've seen it on cards and tool pages: a small green **Featured** pill. It marks an editors' pick — tools we believe are the strongest open option in their category right now.

## What earns a feature

1. **Genuine open source** — a license you can build a business on
2. **A specific replacement** — "replaces X" has to be true, not marketing
3. **Momentum** — active commits, real issues, responsive maintainers
4. **Polish** — docs that let a new user succeed in under ten minutes

## How it's toggled

Moderators flip the badge from the admin console — either at approval time ("Approve & feature") or later from the Featured picks panel. The change goes live instantly across the catalog: cards, rows, and the tool page.

## No pay-to-win

There is no paid placement. If you maintain a tool you think qualifies, submit it, grow the community case with votes, and keep shipping — the badge follows the work.`,
  },
  {
    slug: "community-roundup-october",
    title: "Community roundup: what the directory voted for this month",
    excerpt:
      "NightOwl went from submission to featured in a week, the Wanted board crowned a new top request, and three categories got new blood.",
    author: "AIStore Editors",
    tags: "community,roundup",
    coverEmoji: "🗳️",
    status: "published",
    content: `## From queue to featured in seven days

**NightOwl** — a calm late-night writing companion — was submitted by the community, approved through the review queue, and earned its Featured badge within a week. That's the pipeline working exactly as designed.

## What the community asked for

The Wanted board keeps rising requests sorted by votes. This month's leader: a serious open-source replacement for collaborative whiteboards. Requests marked **in progress** now show connected tools, so you can watch alternatives materialize.

## Category movements

- **Agents** keeps growing — 8 tools and the highest star count in the catalog
- **Writing** got two new entries after the NightOwl feature
- **Video & Audio** is the quiet climber: 158K combined stars

## Your turn

Votes are one click on every card. Requests take thirty seconds on the Wanted board. Submissions are open — and if your tool gets featured, you'll see it announced right here.`,
  },
];

for (const p of posts) {
  await db.post.upsert({
    where: { slug: p.slug },
    update: {},
    create: { ...p, publishedAt: new Date() },
  });
}

const total = await db.post.count();
console.log(`Seeded posts — total: ${total}`);
await db.$disconnect();
