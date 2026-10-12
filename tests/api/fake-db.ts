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

type Where = Record<string, unknown> | undefined;

function matchesWhere(tool: FakeTool, where: Where): boolean {
  if (!where) return true;
  return Object.entries(where).every(([key, cond]) => {
    if (key === "OR") {
      return (cond as Where[]).some((c) => matchesWhere(tool, c));
    }
    const value = (tool as unknown as Record<string, unknown>)[key];
    if (cond !== null && typeof cond === "object") {
      const c = cond as { contains?: string; mode?: string; in?: string[]; not?: unknown };
      if (c.contains !== undefined) {
        /* mirrors Prisma: `contains` is case-sensitive unless mode: "insensitive" */
        return c.mode === "insensitive"
          ? String(value).toLowerCase().includes(c.contains.toLowerCase())
          : String(value).includes(c.contains);
      }
      if (c.in !== undefined) return c.in.includes(String(value));
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
  let voteSeq = 0;

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
      tools[idx] = { ...tools[idx], ...args.data };
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

  const db = {
    tool: toolModel,
    vote: voteModel,
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
    reset(): void {
      tools.length = 0;
      votes.length = 0;
    },
    rawTools: tools,
    rawVotes: votes,
  };
}

/** Singleton shared by the @/lib/db mock and the test file. */
export const fake = createFakeDb();
