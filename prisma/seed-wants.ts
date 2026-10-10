/* ------------------------------------------------------------------ */
/*  AIStore — seed the "Wanted alternatives" request board             */
/*  Idempotent: every row is upserted by its slug id.                  */
/*  Run: bun prisma/seed-wants.ts                                      */
/* ------------------------------------------------------------------ */

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

interface SeedWant {
  id: string;
  target: string;
  note: string;
  status: "open" | "progress" | "fulfilled";
  requester: string;
  dupes: number;
  baseVotes: number;
  /** Tool ids from the catalog that answer this request. */
  connected: string[];
  createdAt: Date;
}

const day = 24 * 60 * 60 * 1000;
const ago = (days: number) => new Date(Date.now() - days * day);

const WANTS: SeedWant[] = [
  {
    id: "chatgpt",
    target: "ChatGPT",
    note: "A daily-driver chat UI that runs against any model, keeps history local, and works for a small team.",
    status: "fulfilled",
    requester: "ana",
    dupes: 88,
    baseVotes: 214,
    connected: ["open-webui", "librechat"],
    createdAt: ago(96),
  },
  {
    id: "notion",
    target: "Notion",
    note: "Docs, wikis, and databases with offline sync — and an open file format we actually own.",
    status: "fulfilled",
    requester: "krish",
    dupes: 63,
    baseVotes: 151,
    connected: ["appflowy", "reor"],
    createdAt: ago(84),
  },
  {
    id: "zapier",
    target: "Zapier",
    note: "Automation recipes across tools we already run, without per-task pricing.",
    status: "fulfilled",
    requester: "tomi",
    dupes: 37,
    baseVotes: 119,
    connected: ["n8n", "activepieces"],
    createdAt: ago(70),
  },
  {
    id: "github-copilot",
    target: "GitHub Copilot",
    note: "Inline completions and agent-style edits inside the editors and terminals we already use.",
    status: "progress",
    requester: "priya",
    dupes: 29,
    baseVotes: 147,
    connected: ["aider", "cline"],
    createdAt: ago(58),
  },
  {
    id: "perplexity",
    target: "Perplexity",
    note: "An answer engine we can point at our own sources and self-host.",
    status: "progress",
    requester: "rio",
    dupes: 22,
    baseVotes: 119,
    connected: ["perplexica"],
    createdAt: ago(49),
  },
  {
    id: "elevenlabs",
    target: "ElevenLabs",
    note: "Voice cloning and TTS that don't send every script to a third party.",
    status: "progress",
    requester: "sam",
    dupes: 19,
    baseVotes: 109,
    connected: ["coqui", "voicestudio"],
    createdAt: ago(41),
  },
  {
    id: "midjourney",
    target: "Midjourney",
    note: "Generated art with a workflow we can tweak — nodes, controlnets, our own checkpoints.",
    status: "open",
    requester: "yuki",
    dupes: 18,
    baseVotes: 115,
    connected: [],
    createdAt: ago(33),
  },
  {
    id: "google-analytics",
    target: "Google Analytics",
    note: "Traffic stats without shipping every visitor's data to an ad company.",
    status: "open",
    requester: "dana",
    dupes: 12,
    baseVotes: 82,
    connected: [],
    createdAt: ago(24),
  },
  {
    id: "zoom",
    target: "Zoom",
    note: "Calls that don't need an account or a 200 MB download to join.",
    status: "open",
    requester: "leo",
    dupes: 9,
    baseVotes: 62,
    connected: [],
    createdAt: ago(15),
  },
  {
    id: "1password",
    target: "1Password",
    note: "Team password sharing we can host ourselves, with sync we can audit.",
    status: "open",
    requester: "noor",
    dupes: 7,
    baseVotes: 51,
    connected: [],
    createdAt: ago(9),
  },
];

async function main() {
  let created = 0;
  let updated = 0;

  for (const w of WANTS) {
    const existing = await db.want.findUnique({ where: { id: w.id } });
    const data = {
      target: w.target,
      note: w.note,
      status: w.status,
      requester: w.requester,
      dupes: w.dupes,
      baseVotes: w.baseVotes,
      connected: w.connected.join(","),
      createdAt: w.createdAt,
    };
    if (existing) {
      await db.want.update({ where: { id: w.id }, data });
      updated++;
    } else {
      await db.want.create({ data: { id: w.id, ...data } });
      created++;
    }
  }

  console.log(`[seed-wants] upserted ${WANTS.length} wants (${created} created, ${updated} updated)`);
}

main()
  .catch((err) => {
    console.error("[seed-wants] failed", err);
    process.exitCode = 1;
  })
  .finally(() => {
    void db.$disconnect();
  });
