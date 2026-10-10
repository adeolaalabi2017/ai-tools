/* ------------------------------------------------------------------ */
/*  Mark the editorial picks as featured in the DB.                    */
/*  Mirrors EDITORS_PICKS in src/lib/aitools/data.ts so the live       */
/*  database and the static fallback agree on which tools carry the    */
/*  "Featured" badge. Idempotent — safe to re-run.                     */
/*                                                                     */
/*  Run with: bun prisma/featured-seed.ts                              */
/* ------------------------------------------------------------------ */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const FEATURED_IDS = ["opencode", "voicestudio", "comfyui"];

async function main() {
  const res = await prisma.tool.updateMany({
    where: { id: { in: FEATURED_IDS } },
    data: { featured: true },
  });
  console.log(`featured-seed: flagged ${res.count} tool(s) as featured`);
  const total = await prisma.tool.count({ where: { featured: true } });
  console.log(`featured-seed: ${total} featured tool(s) in total`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
