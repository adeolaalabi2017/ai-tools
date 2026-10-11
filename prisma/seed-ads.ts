/* ------------------------------------------------------------------ */
/*  Seed: house ads + 30 days of synthetic page analytics.            */
/*  Run: bun prisma/seed-ads.ts                                       */
/*  Idempotent-ish: ads upsert by name; analytics only seeds when the */
/*  PageView table is empty so real traffic is never mixed with fake. */
/* ------------------------------------------------------------------ */

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const ADS = [
  {
    name: "Acme Cloud — inference credits",
    headline: "Ship AI features this week",
    body: "Acme Cloud gives you managed inference with zero DevOps. $50 free credits.",
    ctaLabel: "Get $50 free",
    ctaUrl: "https://example.com/acme-cloud",
    emoji: "☁️",
    placement: "browse",
    weight: 2,
  },
  {
    name: "DevDeck — weekly digest",
    headline: "The open-source AI digest",
    body: "One email a week: the newest self-hostable AI tools, hand-picked.",
    ctaLabel: "Subscribe",
    ctaUrl: "https://example.com/devdeck",
    emoji: "📬",
    placement: "blog",
    weight: 1,
  },
  {
    name: "ForgeSelf — hosting for makers",
    headline: "Self-host on a tiny VPS",
    body: "One-click installs for Ollama, Open WebUI, and 200+ open apps.",
    ctaLabel: "Start free",
    ctaUrl: "https://example.com/forgeself",
    emoji: "🛠️",
    placement: "wanted",
    weight: 1,
  },
];

const TRAFFIC: { path: string; share: number }[] = [
  { path: "discover", share: 0.3 },
  { path: "browse", share: 0.19 },
  { path: "tool", share: 0.13 },
  { path: "categories", share: 0.1 },
  { path: "blog", share: 0.09 },
  { path: "trending", share: 0.07 },
  { path: "category", share: 0.06 },
  { path: "wanted", share: 0.04 },
  { path: "submit", share: 0.02 },
];

function pickPath(): string {
  const roll = Math.random();
  let acc = 0;
  for (const t of TRAFFIC) {
    acc += t.share;
    if (roll <= acc) return t.path;
  }
  return "discover";
}

/** Weekday traffic beats weekends; slow growth over the window. */
function viewsForDay(daysAgo: number): number {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  const dow = d.getUTCDay();
  const weekend = dow === 0 || dow === 6 ? 0.62 : 1;
  const growth = 0.72 + 0.28 * (1 - daysAgo / 30);
  const noise = 0.82 + Math.random() * 0.36;
  return Math.round(96 * weekend * growth * noise);
}

async function main() {
  for (const ad of ADS) {
    await db.ad.upsert({
      where: { id: `seed-${ad.placement}` },
      update: {},
      create: { ...ad, id: `seed-${ad.placement}`, active: true },
    });
  }
  console.log(`Seeded ${ADS.length} ads`);

  /* replace any previous synthetic seed so re-runs stay clean */
  const removed = await db.pageView.deleteMany({ where: { session: { startsWith: "seed-" } } });
  if (removed.count > 0) console.log(`Removed ${removed.count} previously seeded page views`);

  let created = 0;
  for (let daysAgo = 29; daysAgo >= 0; daysAgo--) {
    const views = viewsForDay(daysAgo);
    /* each day: 20-45 sessions, 1-4 pageviews each */
    const sessions = Math.max(8, Math.round(views / 3.2));
    let written = 0;
    for (let s = 0; s < sessions && written < views; s++) {
      const sid = `seed-${daysAgo}-${s}`;
      const pages = 1 + Math.floor(Math.random() * 3.4);
      for (let p = 0; p < pages && written < views; p++) {
        const at = new Date();
        at.setUTCDate(at.getUTCDate() - daysAgo);
        at.setUTCHours(Math.floor(Math.random() * 24), Math.floor(Math.random() * 60), 0, 0);
        await db.pageView.create({
          data: { path: pickPath(), session: sid, createdAt: at },
        });
        written++;
        created++;
      }
    }
  }
  console.log(`Seeded ${created} synthetic page views across 30 days`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
