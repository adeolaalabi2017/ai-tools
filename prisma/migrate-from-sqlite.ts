/* One-off: copy the SQLite data (db/custom.db) into the Neon Postgres
 * database configured in DATABASE_URL. Safe to re-run: clears each table
 * first, then copies. Dates come out of SQLite as epoch millis, booleans
 * as 0/1 — both converted here. */

/// <reference types="bun-types" />
import { Database } from "bun:sqlite";
import { PrismaClient } from "@prisma/client";

const db = new Database("db/custom.db", { readonly: true });
const prisma = new PrismaClient();

const num = (v: unknown): number => (v == null ? 0 : Number(v));
const bool = (v: unknown): boolean => v === 1 || v === true;
const date = (v: unknown): Date | null =>
  v == null ? null : new Date(typeof v === "number" ? v : String(v));
const str = (v: unknown): string => (v == null ? "" : String(v));
const nstr = (v: unknown): string | null => (v == null ? null : String(v));

async function main() {
  /* wipe in FK order */
  await prisma.vote.deleteMany();
  await prisma.wantVote.deleteMany();
  await prisma.pageView.deleteMany();
  await prisma.ad.deleteMany();
  await prisma.post.deleteMany();
  await prisma.want.deleteMany();
  await prisma.tool.deleteMany();

  const tools = db.query("SELECT * FROM Tool").all() as Record<string, unknown>[];
  await prisma.tool.createMany({
    data: tools.map((t) => ({
      id: str(t.id),
      name: str(t.name),
      repo: str(t.repo),
      desc: str(t.desc),
      replaces: str(t.replaces),
      cat: str(t.cat),
      stars: num(t.stars),
      platforms: str(t.platforms),
      selfHosted: bool(t.selfHosted),
      sourceAvailable: bool(t.sourceAvailable),
      weeklyGain: t.weeklyGain == null ? null : num(t.weeklyGain),
      createdAt: date(t.createdAt) ?? new Date(),
      emoji: str(t.emoji),
      glyph: nstr(t.glyph),
      status: str(t.status),
      submitter: nstr(t.submitter),
      featured: bool(t.featured),
      logoUrl: nstr(t.logoUrl),
      screenshotUrl: nstr(t.screenshotUrl),
      headerUrl: nstr(t.headerUrl),
    })),
  });
  console.log(`Tool: ${tools.length}`);

  const votes = db.query("SELECT * FROM Vote").all() as Record<string, unknown>[];
  if (votes.length) {
    await prisma.vote.createMany({
      data: votes.map((v) => ({
        id: str(v.id),
        toolId: str(v.toolId),
        voter: str(v.voter),
        createdAt: date(v.createdAt) ?? new Date(),
      })),
    });
  }
  console.log(`Vote: ${votes.length}`);

  const wants = db.query("SELECT * FROM Want").all() as Record<string, unknown>[];
  await prisma.want.createMany({
    data: wants.map((w) => ({
      id: str(w.id),
      target: str(w.target),
      note: nstr(w.note),
      status: str(w.status),
      requester: nstr(w.requester),
      dupes: num(w.dupes),
      baseVotes: num(w.baseVotes),
      connected: str(w.connected),
      createdAt: date(w.createdAt) ?? new Date(),
    })),
  });
  console.log(`Want: ${wants.length}`);

  const wantVotes = db.query("SELECT * FROM WantVote").all() as Record<string, unknown>[];
  if (wantVotes.length) {
    await prisma.wantVote.createMany({
      data: wantVotes.map((v) => ({
        id: str(v.id),
        wantId: str(v.wantId),
        voter: str(v.voter),
        createdAt: date(v.createdAt) ?? new Date(),
      })),
    });
  }
  console.log(`WantVote: ${wantVotes.length}`);

  const posts = db.query("SELECT * FROM Post").all() as Record<string, unknown>[];
  await prisma.post.createMany({
    data: posts.map((p) => ({
      id: str(p.id),
      slug: str(p.slug),
      title: str(p.title),
      excerpt: str(p.excerpt),
      content: str(p.content),
      author: str(p.author),
      tags: str(p.tags),
      coverEmoji: str(p.coverEmoji),
      status: str(p.status),
      publishedAt: date(p.publishedAt),
      createdAt: date(p.createdAt) ?? new Date(),
      updatedAt: date(p.updatedAt) ?? new Date(),
    })),
  });
  console.log(`Post: ${posts.length}`);

  const ads = db.query("SELECT * FROM Ad").all() as Record<string, unknown>[];
  await prisma.ad.createMany({
    data: ads.map((a) => ({
      id: str(a.id),
      name: str(a.name),
      headline: str(a.headline),
      body: str(a.body),
      ctaLabel: str(a.ctaLabel),
      ctaUrl: str(a.ctaUrl),
      imageUrl: nstr(a.imageUrl),
      emoji: str(a.emoji),
      placement: str(a.placement),
      active: bool(a.active),
      weight: num(a.weight),
      impressions: num(a.impressions),
      clicks: num(a.clicks),
      createdAt: date(a.createdAt) ?? new Date(),
      updatedAt: date(a.updatedAt) ?? new Date(),
    })),
  });
  console.log(`Ad: ${ads.length}`);

  const pvs = db.query("SELECT * FROM PageView").all() as Record<string, unknown>[];
  await prisma.pageView.createMany({
    data: pvs.map((p) => ({
      id: str(p.id),
      path: str(p.path),
      session: str(p.session),
      createdAt: date(p.createdAt) ?? new Date(),
    })),
  });
  console.log(`PageView: ${pvs.length}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log("DONE");
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
