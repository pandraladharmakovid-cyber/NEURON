import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { Miniflare } from "miniflare";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { allowedOrigin, checkProduction, type Env } from "../src/config";
import { purgeExpired } from "../src/lib/object-store";
import { route } from "../src/router";
let mf: Miniflare;
let ip = 0;
const origin = "http://localhost:5173";
const hash = createHash("sha256").update("a".repeat(43)).digest("hex");
const cipher = () => new Uint8Array([78, 82, 78, 1, ...Array(60).fill(7)]);
function headers(extra: Record<string, string> = {}) {
  return {
    Origin: origin,
    "CF-Connecting-IP": "198.51.100." + ++ip,
    "X-Neuron-Client": "1",
    ...extra,
  };
}
async function upload(extra: Record<string, string> = {}) {
  return mf.dispatchFetch("https://relay.test/api/shares", {
    method: "POST",
    headers: headers({
      "Content-Type": "application/octet-stream",
      "X-Neuron-TTL": "3600",
      "X-Neuron-Delete-Hash": hash,
      ...extra,
    }),
    body: cipher(),
  });
}
beforeAll(async () => {
  const result = await build({
    entryPoints: [fileURLToPath(new URL("../src/index.ts", import.meta.url))],
    bundle: true,
    write: false,
    format: "esm",
    platform: "browser",
    target: "es2022",
  });
  mf = new Miniflare({
    modules: true,
    script: result.outputFiles[0].text,
    compatibilityDate: "2026-07-01",
    r2Buckets: ["SHARES"],
    durableObjects: { LIMITER: { className: "RateLimiter", useSQLite: true } },
    bindings: {
      ENVIRONMENT: "development",
      ENABLE_UPLOADS: "true",
      ALLOWED_ORIGINS: origin,
      RATE_SALT: "test-only-salt-not-a-production-secret",
    },
  });
  await mf.ready;
});
afterAll(async () => {
  await mf?.dispose();
});
describe("real Worker + R2 + Durable Object relay", () => {
  it("fails closed when production has no rate secret", () =>
    expect(() =>
      checkProduction({ ENVIRONMENT: "production", RATE_SALT: "" } as Env),
    ).toThrow("RATE_SALT"));
  it("does not inherit the development preview-origin wildcard in production", () =>
    expect(
      allowedOrigin("https://untrusted.e2b.app", {
        ENVIRONMENT: "production",
        ALLOWED_ORIGINS: origin,
      } as Env),
    ).toBe(false));
  it("keeps production uploads disabled until explicitly enabled", async () => {
    const env = {
      ENVIRONMENT: "production",
      RATE_SALT: "x".repeat(32),
      ALLOWED_ORIGINS: origin,
      ENABLE_UPLOADS: "false",
    } as Env;
    const request = new Request("https://relay.test/api/shares", {
      method: "POST",
      headers: headers(),
    });
    await expect(route(request as never, env)).rejects.toThrow("disabled");
  });
  it("purges expired R2 records while retaining live ciphertext", async () => {
    const bucket = await mf.getR2Bucket("SHARES");
    await bucket.put("share/expired-for-cron", cipher(), {
      customMetadata: {
        expiresAt: String(Date.now() - 1000),
        deleteHash: hash,
      },
    });
    await bucket.put("share/live-for-cron", cipher(), {
      customMetadata: {
        expiresAt: String(Date.now() + 3600000),
        deleteHash: hash,
      },
    });
    expect(
      await purgeExpired({ SHARES: bucket } as unknown as Env),
    ).toBeGreaterThan(0);
    expect(await bucket.get("share/expired-for-cron")).toBeNull();
    expect(await bucket.get("share/live-for-cron")).not.toBeNull();
  });

  it("reports protocol support without enabling a fake endpoint", async () => {
    const r = await mf.dispatchFetch("https://relay.test/api/shares/health");
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({
      service: "neuron-encrypted-relay",
      version: 1,
      uploadsEnabled: true,
    });
    expect(r.headers.get("cache-control")).toContain("no-store");
  });
  it("stores exactly ciphertext and returns it without deletion metadata", async () => {
    const r = await upload();
    expect(r.status).toBe(201);
    const data = (await r.json()) as { id: string };
    expect(data.id).toMatch(/^[A-Za-z0-9_-]{32}$/);
    const get = await mf.dispatchFetch(
      "https://relay.test/api/shares/" + data.id,
      { headers: headers() },
    );
    expect(new Uint8Array(await get.arrayBuffer())).toEqual(cipher());
    expect(get.headers.get("X-Neuron-Delete-Hash")).toBeNull();
  });
  it("rejects wrong deletion capability, then revokes with the right one", async () => {
    const data = (await (await upload()).json()) as { id: string };
    const path = "https://relay.test/api/shares/" + data.id;
    const bad = await mf.dispatchFetch(path, {
      method: "DELETE",
      headers: headers({ Authorization: "Bearer " + "b".repeat(43) }),
    });
    expect(bad.status).toBe(403);
    const good = await mf.dispatchFetch(path, {
      method: "DELETE",
      headers: headers({ Authorization: "Bearer " + "a".repeat(43) }),
    });
    expect(good.status).toBe(204);
    expect((await mf.dispatchFetch(path, { headers: headers() })).status).toBe(
      404,
    );
  });
  it("enforces expiry and immediately removes stale ciphertext on access", async () => {
    const id = "e".repeat(32),
      bucket = await mf.getR2Bucket("SHARES");
    await bucket.put("share/" + id, cipher(), {
      customMetadata: {
        expiresAt: String(Date.now() - 1000),
        deleteHash: hash,
      },
    });
    const r = await mf.dispatchFetch("https://relay.test/api/shares/" + id, {
      headers: headers(),
    });
    expect(r.status).toBe(410);
    expect(await bucket.get("share/" + id)).toBeNull();
  });
  it("rejects foreign browser origins", async () =>
    expect((await upload({ Origin: "https://attacker.invalid" })).status).toBe(
      403,
    ));
  it("rejects plaintext and wrong magic envelopes", async () => {
    const r = await mf.dispatchFetch("https://relay.test/api/shares", {
      method: "POST",
      headers: headers({
        "Content-Type": "application/octet-stream",
        "X-Neuron-TTL": "3600",
        "X-Neuron-Delete-Hash": hash,
      }),
      body: "raw private image",
    });
    expect(r.status).toBe(400);
  });
  it("rejects unsupported TTLs", async () =>
    expect((await upload({ "X-Neuron-TTL": "999999999" })).status).toBe(400));
  it("rejects invalid deletion hashes", async () =>
    expect((await upload({ "X-Neuron-Delete-Hash": "short" })).status).toBe(
      400,
    ));
  it("rejects actual oversized ciphertext bodies", async () => {
    const bytes = new Uint8Array(8 * 1024 * 1024 + 65);
    bytes.set([78, 82, 78, 1]);
    const response = await mf.dispatchFetch("https://relay.test/api/shares", {
      method: "POST",
      headers: headers({
        "Content-Type": "application/octet-stream",
        "X-Neuron-TTL": "3600",
        "X-Neuron-Delete-Hash": hash,
      }),
      body: bytes,
    });
    expect(response.status).toBe(413);
  });
  it("limits each client to three upload reservations per hour", async () => {
    const sameIP = "203.0.113.9";
    for (let i = 0; i < 3; i++)
      expect((await upload({ "CF-Connecting-IP": sameIP })).status).toBe(201);
    const r = await upload({ "CF-Connecting-IP": sameIP });
    expect(r.status).toBe(429);
    expect(r.headers.get("retry-after")).toBe("3600");
  });
  it("rejects deletion without a separate capability", async () => {
    const data = (await (await upload()).json()) as { id: string };
    expect(
      (
        await mf.dispatchFetch("https://relay.test/api/shares/" + data.id, {
          method: "DELETE",
          headers: headers(),
        })
      ).status,
    ).toBe(401);
  });
  it("does not treat malformed references as object paths", async () =>
    expect(
      (await mf.dispatchFetch("https://relay.test/api/shares/not-a-share"))
        .status,
    ).toBe(404));
});