/**
 * Blog CMS contract: public reads see published posts only; drafts and all
 * writes are moderator-only; slugs are stable; publish stamps publishedAt.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", async () => {
  const { fake } = await import("./fake-db");
  return { db: fake.db };
});

import { GET as listPosts, POST as createPost } from "@/app/api/posts/route";
import {
  DELETE as deletePost,
  GET as getPost,
  PATCH as updatePost,
} from "@/app/api/posts/[id]/route";
import { fake } from "./fake-db";
import { jsonRequest, readJson, withId } from "./helpers";

const TOKEN = "test-admin-token-1234567890";

let ipSeq = 30;
const nextIp = () => `203.0.113.${++ipSeq}`;

const NEW_POST = {
  title: "Release notes",
  excerpt: "A short summary of what changed in this release.",
  content: "Long enough content to satisfy the twenty character minimum.",
  tags: ["changelog"],
};

beforeEach(() => {
  process.env.ADMIN_TOKEN = TOKEN;
  fake.reset();
  fake.seedPosts([
    {
      id: "post-1",
      slug: "hello-world",
      title: "Hello world",
      status: "published",
      publishedAt: new Date("2026-01-01T00:00:00Z"),
    },
    {
      id: "post-2",
      slug: "secret-draft",
      title: "Secret draft",
      status: "draft",
      publishedAt: null,
    },
  ]);
});

describe("GET /api/posts", () => {
  it("returns published posts only, publicly", async () => {
    const res = await listPosts(jsonRequest("/api/posts", { ip: nextIp() }));
    expect(res.status).toBe(200);
    const body = (await readJson(res)) as { posts: { slug: string }[]; total: number };
    expect(body.posts.map((p) => p.slug)).toEqual(["hello-world"]);
    expect(body.total).toBe(1);
  });

  it("?all=1 includes drafts — admin only", async () => {
    const anon = await listPosts(jsonRequest("/api/posts?all=1", { ip: nextIp() }));
    expect(anon.status).toBe(401);

    const admin = await listPosts(
      jsonRequest("/api/posts?all=1", { token: TOKEN, ip: nextIp() }),
    );
    const body = (await readJson(admin)) as { posts: { slug: string }[] };
    expect(body.posts.map((p) => p.slug).sort()).toEqual(["hello-world", "secret-draft"]);
  });
});

describe("GET /api/posts/[id]", () => {
  it("published posts are public by id or slug", async () => {
    expect((await getPost(jsonRequest("/api/posts/hello-world", { ip: nextIp() }), withId("hello-world"))).status).toBe(200);
    expect((await getPost(jsonRequest("/api/posts/post-1", { ip: nextIp() }), withId("post-1"))).status).toBe(200);
  });

  it("drafts are unreachable via slug — even for admins (stable public URLs)", async () => {
    const res = await getPost(
      jsonRequest("/api/posts/secret-draft", { token: TOKEN, ip: nextIp() }),
      withId("secret-draft"),
    );
    expect(res.status).toBe(404);
  });

  it("drafts are readable by id only for admins (the editing path)", async () => {
    const anon = await getPost(jsonRequest("/api/posts/post-2", { ip: nextIp() }), withId("post-2"));
    expect(anon.status).toBe(404);

    const admin = await getPost(
      jsonRequest("/api/posts/post-2", { token: TOKEN, ip: nextIp() }),
      withId("post-2"),
    );
    expect(admin.status).toBe(200);
    expect(((await readJson(admin)) as { post: { status: string } }).post.status).toBe("draft");
  });
});

describe("POST /api/posts", () => {
  it("401 anonymously, 400 on invalid bodies", async () => {
    const anon = await createPost(
      jsonRequest("/api/posts", { method: "POST", body: NEW_POST, ip: nextIp() }),
    );
    expect(anon.status).toBe(401);

    const bad = await createPost(
      jsonRequest("/api/posts", {
        method: "POST",
        body: { title: "x", excerpt: "short", content: "tiny" },
        token: TOKEN,
        ip: nextIp(),
      }),
    );
    expect(bad.status).toBe(400);
    expect((await readJson(bad)).error).toBe("Validation failed");
  });

  it("creates a draft by default with a slug from the title", async () => {
    const res = await createPost(
      jsonRequest("/api/posts", { method: "POST", body: NEW_POST, token: TOKEN, ip: nextIp() }),
    );
    expect(res.status).toBe(201);
    const { post } = (await readJson(res)) as {
      post: { slug: string; status: string; publishedAt: string | null };
    };
    expect(post.slug).toBe("release-notes");
    expect(post.status).toBe("draft");
    expect(post.publishedAt).toBeNull();
  });

  it("slugifies and de-collides slugs (-2, -3)", async () => {
    const mk = () =>
      createPost(
        jsonRequest("/api/posts", { method: "POST", body: NEW_POST, token: TOKEN, ip: nextIp() }),
      );
    expect(((await readJson(await mk())) as { post: { slug: string } }).post.slug).toBe("release-notes");
    expect(((await readJson(await mk())) as { post: { slug: string } }).post.slug).toBe("release-notes-2");
    expect(((await readJson(await mk())) as { post: { slug: string } }).post.slug).toBe("release-notes-3");
  });

  it("publishing at create time stamps publishedAt", async () => {
    const res = await createPost(
      jsonRequest("/api/posts", {
        method: "POST",
        body: { ...NEW_POST, status: "published" },
        token: TOKEN,
        ip: nextIp(),
      }),
    );
    const { post } = (await readJson(res)) as { post: { status: string; publishedAt: string | null } };
    expect(post.status).toBe("published");
    expect(post.publishedAt).not.toBeNull();
  });
});

describe("PATCH /api/posts/[id]", () => {
  it("401 anonymously; edits content; slug follows the rename policy", async () => {
    const anon = await updatePost(
      jsonRequest("/api/posts/post-1", { method: "PATCH", body: { title: "Hacked" }, ip: nextIp() }),
      withId("post-1"),
    );
    expect(anon.status).toBe(401);

    /* retitling alone never moves the URL */
    const res = await updatePost(
      jsonRequest("/api/posts/post-1", {
        method: "PATCH",
        body: { title: "Hello world v2" },
        token: TOKEN,
        ip: nextIp(),
      }),
      withId("post-1"),
    );
    expect(res.status).toBe(200);
    const { post } = (await readJson(res)) as { post: { title: string; slug: string } };
    expect(post.title).toBe("Hello world v2");
    expect(post.slug).toBe("hello-world"); // stable URL, deliberate renames are PATCH-only
  });

  it("first publish stamps publishedAt; re-publish keeps the original date", async () => {
    const publish = () =>
      updatePost(
        jsonRequest("/api/posts/post-2", {
          method: "PATCH",
          body: { status: "published" },
          token: TOKEN,
          ip: nextIp(),
        }),
        withId("post-2"),
      );

    const first = (await readJson(await publish())) as { post: { publishedAt: string } };
    expect(first.post.publishedAt).not.toBeNull();

    const again = (await readJson(await publish())) as { post: { publishedAt: string } };
    expect(again.post.publishedAt).toBe(first.post.publishedAt);
  });

  it("404 on unknown post", async () => {
    const res = await updatePost(
      jsonRequest("/api/posts/ghost", { method: "PATCH", body: { title: "Ghost" }, token: TOKEN, ip: nextIp() }),
      withId("ghost"),
    );
    expect(res.status).toBe(404);
  });
});

describe("slug rename policy", () => {
  beforeEach(() => {
    fake.seedPosts([{ id: "post-rename", slug: "old-name", title: "Old name", status: "published", publishedAt: new Date("2026-01-01") }]);
  });

  it("renames when explicitly requested and the old URL keeps resolving", async () => {
    const res = await updatePost(
      jsonRequest("/api/posts/post-rename", {
        method: "PATCH",
        body: { slug: "new-name" },
        token: TOKEN,
        ip: nextIp(),
      }),
      withId("post-rename"),
    );
    expect(res.status).toBe(200);
    const { post } = (await readJson(res)) as { post: { slug: string } };
    expect(post.slug).toBe("new-name");

    /* old public URL still resolves to the published post */
    expect((await getPost(jsonRequest("/api/posts/old-name", { ip: nextIp() }), withId("old-name"))).status).toBe(200);
    expect((await getPost(jsonRequest("/api/posts/new-name", { ip: nextIp() }), withId("new-name"))).status).toBe(200);
  });

  it("normalize: input is slugified, not trusted verbatim", async () => {
    const res = await updatePost(
      jsonRequest("/api/posts/post-rename", {
        method: "PATCH",
        body: { slug: "My Cool Post!!" },
        token: TOKEN,
        ip: nextIp(),
      }),
      withId("post-rename"),
    );
    expect(((await readJson(res)) as { post: { slug: string } }).post.slug).toBe("my-cool-post");
  });

  it("400 on gibberish slugs", async () => {
    const res = await updatePost(
      jsonRequest("/api/posts/post-rename", {
        method: "PATCH",
        body: { slug: "!!!" },
        token: TOKEN,
        ip: nextIp(),
      }),
      withId("post-rename"),
    );
    expect(res.status).toBe(400);
  });

  it("409 on a clash with another post's slug or retired slug", async () => {
    fake.seedPosts([
      { id: "post-holder", slug: "taken", title: "Taken" },
      { id: "post-retired", slug: "retired-current", previousSlugs: "former-home" },
    ]);

    const clash = await updatePost(
      jsonRequest("/api/posts/post-rename", {
        method: "PATCH",
        body: { slug: "taken" },
        token: TOKEN,
        ip: nextIp(),
      }),
      withId("post-rename"),
    );
    expect(clash.status).toBe(409);

    const retiredClash = await updatePost(
      jsonRequest("/api/posts/post-rename", {
        method: "PATCH",
        body: { slug: "former-home" },
        token: TOKEN,
        ip: nextIp(),
      }),
      withId("post-rename"),
    );
    expect(retiredClash.status).toBe(409);
  });

  it("same-slug PATCH is a no-op (nothing retired)", async () => {
    const res = await updatePost(
      jsonRequest("/api/posts/post-rename", {
        method: "PATCH",
        body: { slug: "old-name" },
        token: TOKEN,
        ip: nextIp(),
      }),
      withId("post-rename"),
    );
    expect(res.status).toBe(200);
    expect(fake.rawPosts.find((p) => p.id === "post-rename")?.previousSlugs).toBe("");
  });

  it("renaming back and forth keeps every public URL valid", async () => {
    const patch = (slug: string) =>
      updatePost(
        jsonRequest("/api/posts/post-rename", { method: "PATCH", body: { slug }, token: TOKEN, ip: nextIp() }),
        withId("post-rename"),
      );
    expect((await patch("new-name")).status).toBe(200);
    expect((await patch("old-name")).status).toBe(200); // restore from the retired list

    const row = fake.rawPosts.find((p) => p.id === "post-rename");
    expect(row?.slug).toBe("old-name");
    expect(row?.previousSlugs.split(",")).toEqual(["new-name"]); // single history entry, no dupes
    for (const slug of ["old-name", "new-name"]) {
      expect((await getPost(jsonRequest(`/api/posts/${slug}`, { ip: nextIp() }), withId(slug))).status).toBe(200);
    }
  });

  it("drafts never leak through old or new slugs", async () => {
    fake.seedPosts([{ id: "post-draft-r", slug: "draft-old", title: "Draft", status: "draft" }]);
    await updatePost(
      jsonRequest("/api/posts/post-draft-r", {
        method: "PATCH",
        body: { slug: "draft-new" },
        token: TOKEN,
        ip: nextIp(),
      }),
      withId("post-draft-r"),
    );
    /* slug lookups expose published rows only — old or new, admin or not */
    for (const slug of ["draft-old", "draft-new"]) {
      expect((await getPost(jsonRequest(`/api/posts/${slug}`, { token: TOKEN, ip: nextIp() }), withId(slug))).status).toBe(404);
      expect((await getPost(jsonRequest(`/api/posts/${slug}`, { ip: nextIp() }), withId(slug))).status).toBe(404);
    }
    /* the id remains the admin editing path */
    expect((await getPost(jsonRequest("/api/posts/post-draft-r", { token: TOKEN, ip: nextIp() }), withId("post-draft-r"))).status).toBe(200);
  });
});

describe("scheduled publishing", () => {
  const FUTURE = () => new Date(Date.now() + 60 * 60_000).toISOString();

  it("create: schedules with a future publishAt (hidden publicly, admin list shows it)", async () => {
    const res = await createPost(
      jsonRequest("/api/posts", {
        method: "POST",
        body: { ...NEW_POST, status: "scheduled", publishAt: FUTURE() },
        token: TOKEN,
        ip: nextIp(),
      }),
    );
    expect(res.status).toBe(201);
    const { post } = (await readJson(res)) as { post: { status: string; publishAt: string | null } };
    expect(post.status).toBe("scheduled");
    expect(post.publishAt).not.toBeNull();

    /* public list excludes it; admin ?all=1 includes it */
    const pub = await readJson(await listPosts(jsonRequest("/api/posts", { ip: nextIp() }))) as { total: number };
    expect(pub.total).toBe(1); // hello-world only
    const admin = await readJson(
      await listPosts(jsonRequest("/api/posts?all=1", { token: TOKEN, ip: nextIp() })),
    ) as { total: number };
    expect(admin.total).toBe(3); // hello-world, secret-draft, scheduled
  });

  it("create: 400 on missing publishAt or a past date", async () => {
    const noDate = await createPost(
      jsonRequest("/api/posts", {
        method: "POST",
        body: { ...NEW_POST, status: "scheduled" },
        token: TOKEN,
        ip: nextIp(),
      }),
    );
    expect(noDate.status).toBe(400);

    const past = await createPost(
      jsonRequest("/api/posts", {
        method: "POST",
        body: { ...NEW_POST, status: "scheduled", publishAt: "2020-01-01T00:00:00Z" },
        token: TOKEN,
        ip: nextIp(),
      }),
    );
    expect(past.status).toBe(400);
  });

  it("schedule via PATCH; rescheduling in place; cancel to draft clears the date", async () => {
    fake.seedPosts([{ id: "post-sched", slug: "to-schedule", title: "To schedule" }]);
    const patch = (body: unknown) =>
      updatePost(
        jsonRequest("/api/posts/post-sched", { method: "PATCH", body, token: TOKEN, ip: nextIp() }),
        withId("post-sched"),
      );

    /* schedule via PATCH (no status change but carries publishAt) */
    const scheduled = await patch({ status: "scheduled", publishAt: FUTURE() });
    expect(((await readJson(scheduled)) as { post: { status: string } }).post.status).toBe("scheduled");

    /* in-place reschedule (no status sent) */
    const later = new Date(Date.now() + 5 * 60 * 60_000).toISOString();
    const rescheduled = await patch({ publishAt: later });
    expect(((await readJson(rescheduled)) as { post: { publishAt: string } }).post.publishAt).toBe(
      later,
    );

    /* schedule sending future date while staying scheduled passes through */

    /* cancel: scheduled → draft clears the date */
    const cancelled = await patch({ status: "draft" });
    const cancelledBody = (await readJson(cancelled)) as { post: { status: string; publishAt: string | null } };
    expect(cancelledBody.post.status).toBe("draft");
    expect(cancelledBody.post.publishAt).toBeNull();
  });

  it("public reads auto-publish due scheduled posts, stamping the scheduled instant", async () => {
    fake.seedPosts([
      {
        id: "post-due",
        slug: "due-post",
        title: "Due",
        status: "scheduled",
        publishAt: new Date(Date.now() - 30_000), // already due
        publishedAt: null,
      },
      {
        id: "post-later",
        slug: "later-post",
        title: "Later",
        status: "scheduled",
        publishAt: new Date(Date.now() + 60_000),
        publishedAt: null,
      },
    ]);
    const res = await listPosts(jsonRequest("/api/posts", { ip: nextIp() }));
    const body = (await readJson(res)) as { posts: { id: string; publishedAt: string | null }[] };
    const ids = body.posts.map((t) => t.id);
    expect(ids).toContain("post-due");
    expect(ids).not.toContain("post-later");
    const due = body.posts.find((t) => t.id === "post-due")!;
    /* publishedAt stamped with the scheduled instant, not the sweep time */
    expect(due.publishedAt).not.toBeNull();

    /* persisted: due row is now published */
    const row = fake.rawPosts.find((p) => p.id === "post-due");
    expect(row?.status).toBe("published");
    expect(row?.publishedAt?.getTime()).toBe(row?.publishAt?.getTime());
  });

  it("publishing a scheduled post consumes the schedule and keeps draft-like rules", async () => {
    fake.seedPosts([{ id: "post-s2", slug: "s2", title: "Schedule 2" }]);
    const patch = (body: unknown) =>
      updatePost(
        jsonRequest("/api/posts/post-s2", { method: "PATCH", body, token: TOKEN, ip: nextIp() }),
        withId("post-s2"),
      );
    await patch({ status: "scheduled", publishAt: FUTURE() });
    const published = await patch({ status: "published" });
    const body = (await readJson(published)) as { post: { status: string; publishAt: string | null } };
    expect(body.post.status).toBe("published");
    expect(body.post.publishAt).toBeNull();
  });

  it("PATCH scheduling validates: past date rejected, missing date rejected", async () => {
    fake.seedPosts([{ id: "post-s3", slug: "s3", title: "Schedule 3" }]);
    const patch = (body: unknown) =>
      updatePost(
        jsonRequest("/api/posts/post-s3", { method: "PATCH", body, token: TOKEN, ip: nextIp() }),
        withId("post-s3"),
      );
    expect((await patch({ status: "scheduled", publishAt: "2020-01-01T00:00:00Z" })).status).toBe(400);
    expect((await patch({ status: "scheduled" })).status).toBe(400);
    /* already-scheduled post can keep its date (effective = existing) */
    expect(
      (
        await patch({ status: "scheduled", publishAt: FUTURE() })
      ).status,
    ).toBe(200);
  });
});

describe("DELETE /api/posts/[id]", () => {
  it("401 anonymously; deletes with a token", async () => {
    const anon = await deletePost(
      jsonRequest("/api/posts/post-1", { method: "DELETE", ip: nextIp() }),
      withId("post-1"),
    );
    expect(anon.status).toBe(401);

    const res = await deletePost(
      jsonRequest("/api/posts/post-1", { method: "DELETE", token: TOKEN, ip: nextIp() }),
      withId("post-1"),
    );
    expect(res.status).toBe(200);
    expect((await readJson(res)).deleted).toBe(true);
    expect(fake.rawPosts.map((p) => p.id)).not.toContain("post-1");
  });
});
