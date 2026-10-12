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
  it("401 anonymously; edits content; slug never changes", async () => {
    const anon = await updatePost(
      jsonRequest("/api/posts/post-1", { method: "PATCH", body: { title: "Hacked" }, ip: nextIp() }),
      withId("post-1"),
    );
    expect(anon.status).toBe(401);

    const res = await updatePost(
      jsonRequest("/api/posts/post-1", {
        method: "PATCH",
        body: { title: "Hello world v2", slug: "hijacked-slug" },
        token: TOKEN,
        ip: nextIp(),
      }),
      withId("post-1"),
    );
    expect(res.status).toBe(200);
    const { post } = (await readJson(res)) as { post: { title: string; slug: string } };
    expect(post.title).toBe("Hello world v2");
    expect(post.slug).toBe("hello-world"); // immutable — public links stay stable
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
