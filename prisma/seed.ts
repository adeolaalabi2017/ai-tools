/* Seed the AIStore database from the curated static tool list. */
import { PrismaClient } from "@prisma/client";
import { TOOLS } from "../src/lib/aitools/data";

const prisma = new PrismaClient();

async function main() {
  let created = 0;
  let updated = 0;

  for (const t of TOOLS) {
    const row = {
      id: t.id,
      name: t.name,
      repo: t.repo,
      desc: t.desc,
      replaces: t.replaces,
      cat: t.cat,
      stars: t.stars,
      platforms: t.platforms.join(","),
      selfHosted: Boolean(t.selfHosted),
      sourceAvailable: Boolean(t.sourceAvailable),
      weeklyGain: typeof t.weeklyGain === "number" ? t.weeklyGain : null,
      createdAt: new Date(t.createdAt),
      emoji: t.emoji.trim() || "🧩",
      glyph: t.glyph ?? null,
      status: "curated",
      featured: Boolean(t.featured),
      /* logoUrl is an explicit override only (submitter/admin). The original
         brand logo is derived at render time — see brandLogoUrl() in
         src/lib/aitools/data.ts — so seeding stays mapping-fresh. */
      logoUrl: t.logoUrl ?? null,
    };
    const existing = await prisma.tool.findUnique({ where: { id: t.id } });
    if (existing) {
      await prisma.tool.update({ where: { id: t.id }, data: row });
      updated++;
    } else {
      await prisma.tool.create({ data: row });
      created++;
    }
  }

  const total = await prisma.tool.count();
  console.log(`Seed complete: ${created} created, ${updated} updated, ${total} total tools.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
