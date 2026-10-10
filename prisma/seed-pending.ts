/* ------------------------------------------------------------------ */
/*  Seed 2 demo community submissions awaiting moderation.             */
/*  Idempotent: upserts by id and forces status back to "pending",     */
/*  so re-running restores the demo queue state.                       */
/*                                                                     */
/*  Run with: bun prisma/seed-pending.ts                               */
/* ------------------------------------------------------------------ */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const PENDING_TOOLS = [
  {
    id: "nightowl",
    name: "NightOwl",
    repo: "nightscout/nightowl",
    desc: "A calm late-night writing companion for focused authors.",
    replaces: "iA Writer",
    cat: "writing",
    platforms: "web,mac",
    submitter: "QA Bot",
    emoji: "🧩",
    glyph: null as string | null,
    stars: 0,
    weeklyGain: null as number | null,
    selfHosted: false,
    sourceAvailable: false,
  },
  {
    id: "promptdeck",
    name: "PromptDeck",
    repo: "labs/promptdeck",
    desc: "Version, diff, and share your team's LLM prompts.",
    replaces: "Google Docs prompts",
    cat: "devtools",
    platforms: "web",
    submitter: "QA Bot",
    emoji: "🧩",
    glyph: null as string | null,
    stars: 0,
    weeklyGain: null as number | null,
    selfHosted: false,
    sourceAvailable: false,
  },
];

async function main() {
  for (const t of PENDING_TOOLS) {
    const { id, ...data } = t;
    await prisma.tool.upsert({
      where: { id },
      update: { ...data, status: "pending" },
      create: { ...t, status: "pending" },
    });
    console.log(`✓ upserted "${id}" (status: pending)`);
  }

  const pending = await prisma.tool.count({ where: { status: "pending" } });
  const total = await prisma.tool.count();
  console.log(`Pending seed complete: ${pending} pending of ${total} total tools.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
