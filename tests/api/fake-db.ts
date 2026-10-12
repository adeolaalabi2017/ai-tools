/**
 * In-memory stand-in for the Prisma client (src/lib/db.ts).
 *
 * Implements only the query surface the route handlers under test actually
 * use — anything else throws, so the suite fails loudly (not silently green)
 * if a route grows new queries. Ordering semantics mirror the live backend
 * (PostgreSQL): ASC → NULLs last, DESC → NULLs first, with support for the
 * explicit { sort, nulls } orderBy form.
 */

export interface FakeTool {
  id: string;
  name: string;
  repo: string;
  desc: string;
  replaces: string;
  cat: string;
  stars: number;
  platforms: string; // CSV
  selfHosted: boolean;
  sourceAvailable: boolean;
  weeklyGain: number | null;
  createdAt: Date;
  emoji: string;
  glyph: string | null;
  status: string;
  submitter: string | null;
  featured: boolean;
  logoUrl: string | null;
  screenshotUrl: string | null;
  headerUrl: string | null;
}

export interface FakeVote {
  id: string;
  toolId: string;
  voter: string;
  createdAt: Date;
}

export interface FakePost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  author: string;
  tags: string;
  coverEmoji: string;
  status: string;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface FakeAd {
  id: string;
  name: string;
  headline: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
  imageUrl: string | null;
  emoji: string;
  placement: string;
  active: boolean;
  weight: number;
  impressions: number;
  clicks: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface FakeWant {
  id: string;
  target: string;
  note: string | null;
  status: string;
  requester: string | null;
  dupes: number;
  baseVotes: number;
  connected: string;
  createdAt: Date;
}

export interface FakeWantVote {
  id: string;
  wantId: string;
  voter: string;
  createdAt: Date;
}

export interface FakePageView {
  id: string;
  path: string;
  session: string;
  createdAt: Date;
}

export interface FakeRateEvent {
  id: string;
  bucket: string;
  ip: string;
  createdAt: Date;
}

type Row = Record<string, unknown>;
type Where = Row | undefined;

function matchesWhere(tool: FakeTool, where: Where): boolean {
  if (!where) return true;
  return Object.entries(where).every(([key, cond]) => {
    if (key === "OR") {
      return (cond as Where[]).some((c) => matchesWhere(tool, c));
    }
    const value = (tool as unknown as Row)[key];
    if (cond !== null && typeof cond === "object") {
      const c = cond as {
        contains?: string;
        mode?: string;
        in?: string[];
        not?: unknown;
        gte?: Date | number;
        lt?: Date | number;
      };
      if (c.contains !== undefined) {
        /* mirrors Prisma: `contains` is case-sensitive unless mode: "insensitive" */
        return c.mode === "insensitive"
          ? String(value).toLowerCase().includes(c.contains.toLowerCase())
          : String(value).includes(c.contains);
      }
      if (c.in !== undefined) return c.in.includes(String(value));
      if (c.gte !== undefined) {
        const a = value instanceof Date ? value.getTime() : Number(value);
        const b = c.gte instanceof Date ? c.gte.getTime() : Number(c.gte);
        return a >= b;
      }
      if (c.lt !== undefined) {
        const a = value instanceof Date ? value.getTime() : Number(value);
        const b = c.lt instanceof Date ? c.lt.getTime() : Number(c.lt);
        return a < b;
      }
      if ("not" in c) {
        if (c.not === null) return value !== null && value !== undefined;
        return value !== c.not;
      }
      throw new Error(`fake db: unsupported where operator on ${key}: ${JSON.stringify(cond)}`);
    }
    return value === cond;
  });
}

type OrderDir = "asc" | "desc";

/** Prisma write operators the routes use (increment) + plain values. */
function applyData(row: Row, data: Row): Row {
  const out: Row = { ...row };
  for (const [key, value] of Object.entries(data)) {
    if (value !== null && typeof value === "object" && "increment" in (value as Row)) {
      const inc = Number((value as { increment: number }).increment);
      out[key] = Number(out[key] ?? 0) + inc;
    } else {
      out[key] = value;
    }
  }
  return out;
}
interface OrderSpec {
  dir: OrderDir;
  nulls: "first" | "last";
}

function parseOrder(value: unknown, dir: OrderDir): OrderSpec {
  if (value !== null && typeof value === "object") {
    const v = value as { sort?: OrderDir; nulls?: "first" | "last" };
    return { dir: v.sort ?? dir, nulls: v.nulls ?? (v.sort === "asc" ? "last" : "first") };
  }
  /* bare "asc"/"desc": Postgres defaults — ASC NULLS LAST, DESC NULLS FIRST */
  return { dir, nulls: dir === "asc" ? "last" : "first" };
}

function compareValues(a: unknown, b: unknown, spec: OrderSpec): number {
  const aNull = a === null || a === undefined;
  const bNull = b === null || b === undefined;
  /* NULL placement is absolute — it must not flip with the sort direction */
  if (aNull && bNull) return 0;
  if (aNull) return spec.nulls === "first" ? -1 : 1;
  if (bNull) return spec.nulls === "first" ? 1 : -1;

  const av = a instanceof Date ? a.getTime() : a;
  const bv = b instanceof Date ? b.getTime() : b;
  let cmp: number;
  if (typeof av === "number" && typeof bv === "number") cmp = av - bv;
  else cmp = String(av) < String(bv) ? -1 : String(av) > String(bv) ? 1 : 0;
  return spec.dir === "desc" ? -cmp : cmp;
}

function compare(toolA: FakeTool, toolB: FakeTool, orderBy: unknown, votes: FakeVote[]): number {
  const clauses = Array.isArray(orderBy) ? orderBy : [orderBy];
  for (const clause of clauses as Record<string, unknown>[]) {
    for (const [key, value] of Object.entries(clause)) {
      let a: unknown;
      let b: unknown;
      let spec: OrderSpec;
      if (key === "toolVotes") {
        /* only supported form: { toolVotes: { _count: "desc" } } */
        const v = value as { _count: OrderDir };
        a = votes.filter((x) => x.toolId === toolA.id).length;
        b = votes.filter((x) => x.toolId === toolB.id).length;
        spec = parseOrder(v._count, "desc");
      } else {
        a = (toolA as unknown as Record<string, unknown>)[key];
        b = (toolB as unknown as Record<string, unknown>)[key];
        spec = parseOrder(value, value === "asc" ? "asc" : "desc");
      }
      const cmp = compareValues(a, b, spec);
      if (cmp !== 0) return cmp;
    }
  }
  return 0;
}

export function createFakeDb() {
  const tools: FakeTool[] = [];
  const votes: FakeVote[] = [];
  const posts: FakePost[] = [];
  const ads: FakeAd[] = [];
  const wants: FakeWant[] = [];
  const wantVotes: FakeWantVote[] = [];
  const pageViews: FakePageView[] = [];
  const rateEvents: FakeRateEvent[] = [];
  let voteSeq = 0;
  let rowSeq = 0;

  const toolModel = {
    async findUnique(args: { where: { id: string }; include?: unknown }) {
      const tool = tools.find((t) => t.id === args.where.id);
      return tool ? withCount(tool, args.include) : null;
    },
    async findMany(args: {
      where?: Where;
      orderBy?: unknown;
      skip?: number;
      take?: number;
      include?: unknown;
    }) {
      let rows = tools.filter((t) => matchesWhere(t, args.where));
      if (args.orderBy) rows = [...rows].sort((a, b) => compare(a, b, args.orderBy, votes));
      const skip = args.skip ?? 0;
      const take = args.take ?? rows.length;
      rows = rows.slice(skip, skip + take);
      return rows.map((t) => withCount(t, args.include));
    },
    async count(args: { where?: Where }) {
      return tools.filter((t) => matchesWhere(t, args.where)).length;
    },
    async create(args: { data: Partial<FakeTool> & { id: string }; include?: unknown }) {
      const tool: FakeTool = {
        name: "",
        repo: "",
        desc: "",
        replaces: "",
        cat: "",
        stars: 0,
        platforms: "web",
        selfHosted: false,
        sourceAvailable: false,
        weeklyGain: null,
        createdAt: new Date(),
        emoji: "🧩",
        glyph: null,
        status: "curated",
        submitter: null,
        featured: false,
        logoUrl: null,
        screenshotUrl: null,
        headerUrl: null,
        ...args.data,
      };
      tools.push(tool);
      return withCount(tool, args.include);
    },
    async update(args: { where: { id: string }; data: Partial<FakeTool>; include?: unknown }) {
      const idx = tools.findIndex((t) => t.id === args.where.id);
      if (idx === -1) throw new Error(`fake db: tool not found: ${args.where.id}`);
      tools[idx] = {
        ...tools[idx],
        ...(applyData(tools[idx] as unknown as Row, args.data as Row) as unknown as FakeTool),
      };
      return withCount(tools[idx], args.include);
    },
    async delete(args: { where: { id: string } }) {
      const idx = tools.findIndex((t) => t.id === args.where.id);
      if (idx === -1) throw new Error(`fake db: tool not found: ${args.where.id}`);
      const [removed] = tools.splice(idx, 1);
      /* schema has onDelete: Cascade */
      for (let i = votes.length - 1; i >= 0; i--) {
        if (votes[i].toolId === args.where.id) votes.splice(i, 1);
      }
      return removed;
    },
  };

  function withCount(tool: FakeTool, include: unknown): FakeTool & { _count?: { toolVotes: number } } {
    const inc = include as { _count?: { select?: { toolVotes?: boolean } } } | undefined;
    if (inc?._count?.select?.toolVotes) {
      return { ...tool, _count: { toolVotes: votes.filter((v) => v.toolId === tool.id).length } };
    }
    return { ...tool };
  }

  const voteModel = {
    async findUnique(args: {
      where: { toolId_voter: { toolId: string; voter: string } };
    }) {
      const { toolId, voter } = args.where.toolId_voter;
      return votes.find((v) => v.toolId === toolId && v.voter === voter) ?? null;
    },
    async create(args: { data: { toolId: string; voter: string } }) {
      const vote: FakeVote = {
        id: `vote-${++voteSeq}`,
        toolId: args.data.toolId,
        voter: args.data.voter,
        createdAt: new Date(),
      };
      votes.push(vote);
      return vote;
    },
    async delete(args: { where: { id: string } }) {
      const idx = votes.findIndex((v) => v.id === args.where.id);
      if (idx === -1) throw new Error(`fake db: vote not found: ${args.where.id}`);
      const [removed] = votes.splice(idx, 1);
      return removed;
    },
    async count(args: { where?: { toolId?: string } }) {
      return args.where?.toolId
        ? votes.filter((v) => v.toolId === args.where!.toolId).length
        : votes.length;
    },
  };

  const postModel = {
    async findUnique(args: { where: { id?: string; slug?: string } }) {
      return (
        posts.find(
          (p) =>
            (args.where.id !== undefined && p.id === args.where.id) ||
            (args.where.slug !== undefined && p.slug === args.where.slug),
        ) ?? null
      );
    },
    async findFirst(args: { where: { OR: { id?: string; slug?: string }[] } }) {
      return (
        posts.find((p) =>
          args.where.OR.some(
            (c) =>
              (c.id !== undefined && p.id === c.id) ||
              (c.slug !== undefined && p.slug === c.slug),
          ),
        ) ?? null
      );
    },
    async findMany(args: { where?: Where; orderBy?: unknown }) {
      let rows = posts.filter((p) => matchesWhere(p as unknown as FakeTool, args.where));
      if (args.orderBy) {
        rows = [...rows].sort((a, b) =>
          compare(a as unknown as FakeTool, b as unknown as FakeTool, args.orderBy, votes),
        );
      }
      return rows;
    },
    async create(args: { data: Partial<FakePost> & { slug: string } }) {
      const now = new Date();
      const post: FakePost = {
        id: `post-${++rowSeq}`,
        title: "",
        excerpt: "",
        content: "",
        author: "AIStore Editors",
        tags: "",
        coverEmoji: "📝",
        status: "draft",
        publishedAt: null,
        createdAt: now,
        updatedAt: now,
        ...args.data,
      };
      posts.push(post);
      return post;
    },
    async update(args: { where: { id: string }; data: Row }) {
      const idx = posts.findIndex((p) => p.id === args.where.id);
      if (idx === -1) throw new Error(`fake db: post not found: ${args.where.id}`);
      posts[idx] = applyData(posts[idx] as unknown as Row, args.data) as unknown as FakePost;
      return posts[idx];
    },
    async delete(args: { where: { id: string } }) {
      const idx = posts.findIndex((p) => p.id === args.where.id);
      if (idx === -1) throw new Error(`fake db: post not found: ${args.where.id}`);
      const [removed] = posts.splice(idx, 1);
      return removed;
    },
  };

  const adModel = {
    async findUnique(args: { where: { id: string } }) {
      return ads.find((a) => a.id === args.where.id) ?? null;
    },
    async findMany(args: { where?: Where; orderBy?: unknown }) {
      let rows = ads.filter((a) => matchesWhere(a as unknown as FakeTool, args.where));
      if (args.orderBy) {
        rows = [...rows].sort((x, y) =>
          compare(x as unknown as FakeTool, y as unknown as FakeTool, args.orderBy, votes),
        );
      }
      return rows;
    },
    async create(args: { data: Partial<FakeAd> }) {
      const now = new Date();
      const ad: FakeAd = {
        id: `ad-${++rowSeq}`,
        name: "",
        headline: "",
        body: "",
        ctaLabel: "Learn more",
        ctaUrl: "",
        imageUrl: null,
        emoji: "✨",
        placement: "browse",
        active: false,
        weight: 1,
        impressions: 0,
        clicks: 0,
        createdAt: now,
        updatedAt: now,
        ...args.data,
      };
      ads.push(ad);
      return ad;
    },
    async update(args: { where: { id: string }; data: Row }) {
      const idx = ads.findIndex((a) => a.id === args.where.id);
      if (idx === -1) throw new Error(`fake db: ad not found: ${args.where.id}`);
      ads[idx] = applyData(ads[idx] as unknown as Row, args.data) as unknown as FakeAd;
      return ads[idx];
    },
    async delete(args: { where: { id: string } }) {
      const idx = ads.findIndex((a) => a.id === args.where.id);
      if (idx === -1) throw new Error(`fake db: ad not found: ${args.where.id}`);
      const [removed] = ads.splice(idx, 1);
      return removed;
    },
  };

  function wantWithCount(want: FakeWant, include?: unknown): FakeWant & { _count?: { wantVotes: number } } {
    const inc = include as { _count?: { select?: { wantVotes?: boolean } } } | undefined;
    if (inc?._count?.select?.wantVotes) {
      return { ...want, _count: { wantVotes: wantVotes.filter((v) => v.wantId === want.id).length } };
    }
    return { ...want };
  }

  const wantModel = {
    async findUnique(args: { where: { id: string }; include?: unknown }) {
      const want = wants.find((w) => w.id === args.where.id);
      return want ? wantWithCount(want, args.include) : null;
    },
    async findMany(args: { where?: Where; include?: unknown; orderBy?: unknown }) {
      let rows = wants.filter((w) => matchesWhere(w as unknown as FakeTool, args.where));
      if (args.orderBy) {
        rows = [...rows].sort((x, y) =>
          compare(x as unknown as FakeTool, y as unknown as FakeTool, args.orderBy, votes),
        );
      }
      return rows.map((w) => wantWithCount(w, args.include));
    },
    async create(args: { data: Partial<FakeWant> & { id: string } }) {
      const want: FakeWant = {
        target: "",
        note: null,
        status: "open",
        requester: null,
        dupes: 0,
        baseVotes: 0,
        connected: "",
        createdAt: new Date(),
        ...args.data,
      };
      wants.push(want);
      return want;
    },
    async update(args: { where: { id: string }; data: Row; include?: unknown }) {
      const idx = wants.findIndex((w) => w.id === args.where.id);
      if (idx === -1) throw new Error(`fake db: want not found: ${args.where.id}`);
      wants[idx] = applyData(wants[idx] as unknown as Row, args.data) as unknown as FakeWant;
      return wantWithCount(wants[idx], args.include);
    },
    async delete(args: { where: { id: string } }) {
      const idx = wants.findIndex((w) => w.id === args.where.id);
      if (idx === -1) throw new Error(`fake db: want not found: ${args.where.id}`);
      const [removed] = wants.splice(idx, 1);
      /* WantVote rows cascade */
      for (let i = wantVotes.length - 1; i >= 0; i--) {
        if (wantVotes[i].wantId === args.where.id) wantVotes.splice(i, 1);
      }
      return removed;
    },
  };

  const wantVoteModel = {
    async findUnique(args: { where: { wantId_voter: { wantId: string; voter: string } } }) {
      const { wantId, voter } = args.where.wantId_voter;
      return wantVotes.find((v) => v.wantId === wantId && v.voter === voter) ?? null;
    },
    async create(args: { data: { wantId: string; voter: string } }) {
      const vote: FakeWantVote = {
        id: `wantvote-${++rowSeq}`,
        wantId: args.data.wantId,
        voter: args.data.voter,
        createdAt: new Date(),
      };
      wantVotes.push(vote);
      return vote;
    },
    async count(args: { where?: { wantId?: string } }) {
      return args.where?.wantId
        ? wantVotes.filter((v) => v.wantId === args.where!.wantId).length
        : wantVotes.length;
    },
    async delete(args: { where: { id: string } }) {
      const idx = wantVotes.findIndex((v) => v.id === args.where.id);
      if (idx === -1) throw new Error(`fake db: wantVote not found: ${args.where.id}`);
      const [removed] = wantVotes.splice(idx, 1);
      return removed;
    },
  };

  const pageViewModel = {
    async create(args: { data: { path: string; session: string } }) {
      const pv: FakePageView = {
        id: `pv-${++rowSeq}`,
        path: args.data.path,
        session: args.data.session,
        createdAt: new Date(),
      };
      pageViews.push(pv);
      return pv;
    },
    async findMany(args: { where?: Where }) {
      return pageViews.filter((p) => matchesWhere(p as unknown as FakeTool, args.where));
    },
    async deleteMany() {
      pageViews.length = 0;
      return { count: 0 };
    },
  };

  const rateEventModel = {
    async count(args: { where?: Where }) {
      return rateEvents.filter((e) => matchesWhere(e as unknown as FakeTool, args.where)).length;
    },
    async findMany(args: { where?: Where; orderBy?: unknown; take?: number }) {
      let rows = rateEvents.filter((e) => matchesWhere(e as unknown as FakeTool, args.where));
      if (args.orderBy) {
        rows = [...rows].sort((x, y) =>
          compare(x as unknown as FakeTool, y as unknown as FakeTool, args.orderBy, votes),
        );
      }
      return args.take !== undefined ? rows.slice(0, args.take) : rows;
    },
    async create(args: { data: { bucket: string; ip: string } }) {
      const ev: FakeRateEvent = {
        id: `rate-${++rowSeq}`,
        bucket: args.data.bucket,
        ip: args.data.ip,
        createdAt: new Date(),
      };
      rateEvents.push(ev);
      return ev;
    },
    async deleteMany(args: { where?: Where }) {
      const before = rateEvents.length;
      const keep = rateEvents.filter((e) => !matchesWhere(e as unknown as FakeTool, args.where));
      rateEvents.length = 0;
      rateEvents.push(...keep);
      return { count: before - keep.length };
    },
  };

  const db = {
    tool: toolModel,
    vote: voteModel,
    post: postModel,
    ad: adModel,
    want: wantModel,
    wantVote: wantVoteModel,
    pageView: pageViewModel,
    rateEvent: rateEventModel,
    /* interactive transaction: routes use the callback form */
    async $transaction<T>(fn: (tx: typeof db) => Promise<T>): Promise<T> {
      return fn(db);
    },
  };

  return {
    db: db as unknown as import("@prisma/client").PrismaClient,
    seedTools(rows: (Partial<FakeTool> & { id: string })[]): void {
      for (const row of rows) {
        tools.push({
          name: row.id,
          repo: `owner/${row.id}`,
          desc: `Description for ${row.id}`,
          replaces: "Something",
          cat: "coding",
          stars: 0,
          platforms: "web",
          selfHosted: false,
          sourceAvailable: false,
          weeklyGain: null,
          createdAt: new Date("2026-01-01T00:00:00Z"),
          emoji: "🧩",
          glyph: null,
          status: "curated",
          submitter: null,
          featured: false,
          logoUrl: null,
          screenshotUrl: null,
          headerUrl: null,
          ...row,
        } as FakeTool);
      }
    },
    seedVotes(rows: { toolId: string; voter: string }[]): void {
      for (const row of rows) {
        votes.push({
          id: `vote-${++voteSeq}`,
          toolId: row.toolId,
          voter: row.voter,
          createdAt: new Date(),
        });
      }
    },
    seedPosts(rows: (Partial<FakePost> & { slug: string })[]): void {
      for (const row of rows) {
        const now = new Date();
        posts.push({
          id: row.id ?? `post-${++rowSeq}`,
          slug: row.slug,
          title: row.title ?? row.slug,
          excerpt: row.excerpt ?? "An excerpt long enough to pass validation.",
          content: row.content ?? "Content for this post goes here.",
          author: row.author ?? "AIStore Editors",
          tags: row.tags ?? "",
          coverEmoji: row.coverEmoji ?? "📝",
          status: row.status ?? "draft",
          publishedAt: row.publishedAt ?? null,
          createdAt: row.createdAt ?? now,
          updatedAt: row.updatedAt ?? now,
        });
      }
    },
    seedAds(rows: Partial<FakeAd>[]): void {
      for (const row of rows) {
        const now = new Date();
        ads.push({
          id: row.id ?? `ad-${++rowSeq}`,
          name: row.name ?? "Test ad",
          headline: row.headline ?? "A headline",
          body: row.body ?? "A body line.",
          ctaLabel: row.ctaLabel ?? "Learn more",
          ctaUrl: row.ctaUrl ?? "https://example.com",
          imageUrl: row.imageUrl ?? null,
          emoji: row.emoji ?? "✨",
          placement: row.placement ?? "browse",
          active: row.active ?? true,
          weight: row.weight ?? 1,
          impressions: row.impressions ?? 0,
          clicks: row.clicks ?? 0,
          createdAt: row.createdAt ?? now,
          updatedAt: row.updatedAt ?? now,
        });
      }
    },
    seedWants(rows: (Partial<FakeWant> & { id: string })[]): void {
      for (const row of rows) {
        wants.push({
          target: row.target ?? row.id,
          note: row.note ?? null,
          status: row.status ?? "open",
          requester: row.requester ?? null,
          dupes: row.dupes ?? 0,
          baseVotes: row.baseVotes ?? 0,
          connected: row.connected ?? "",
          createdAt: row.createdAt ?? new Date(),
          ...row,
        });
      }
    },
    seedWantVotes(rows: { wantId: string; voter: string }[]): void {
      for (const row of rows) {
        wantVotes.push({
          id: `wantvote-${++rowSeq}`,
          wantId: row.wantId,
          voter: row.voter,
          createdAt: new Date(),
        });
      }
    },
    seedPageViews(rows: { path: string; session: string; createdAt?: Date }[]): void {
      for (const row of rows) {
        pageViews.push({
          id: `pv-${++rowSeq}`,
          path: row.path,
          session: row.session,
          createdAt: row.createdAt ?? new Date(),
        });
      }
    },
    reset(): void {
      tools.length = 0;
      votes.length = 0;
      posts.length = 0;
      ads.length = 0;
      wants.length = 0;
      wantVotes.length = 0;
      pageViews.length = 0;
      rateEvents.length = 0;
    },
    rawTools: tools,
    rawVotes: votes,
    rawPosts: posts,
    rawAds: ads,
    rawWants: wants,
    rawWantVotes: wantVotes,
    rawPageViews: pageViews,
    rawRateEvents: rateEvents,
  };
}

/**
 * Singleton shared by the @/lib/db mock and the test files. Backed by
 * globalThis so it survives vi.resetModules() — that lets tests simulate a
 * process restart while the store (like the real DB) keeps its rows.
 */
export const fake: ReturnType<typeof createFakeDb> =
  (globalThis as { __fakeDb?: ReturnType<typeof createFakeDb> }).__fakeDb ??=
    createFakeDb();
