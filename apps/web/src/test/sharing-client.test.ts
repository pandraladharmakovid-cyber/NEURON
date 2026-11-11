import { afterEach, describe, it, expect, vi } from "vitest";
import {
  relayHealth,
  downloadEncrypted,
  uploadEncrypted,
  revokeEncrypted,
} from "../features/sharing/relay-client";
afterEach(() => vi.unstubAllGlobals());
describe("bounded same-origin relay client", () => {
  it("uses relative URLs and never sends an encryption key", async () => {
    const fetcher = vi.fn(
      async (_url: RequestInfo | URL, _options?: RequestInit) =>
        new Response(new Uint8Array([1, 2, 3])),
    );
    vi.stubGlobal("fetch", fetcher);
    await downloadEncrypted("a".repeat(32), new AbortController().signal);
    expect(fetcher.mock.calls[0][0]).toBe("/api/shares/" + "a".repeat(32));
    const options = fetcher.mock.calls[0][1] as RequestInit;
    expect(options.credentials).toBe("omit");
    expect(options.cache).toBe("no-store");
  });
  it("returns actionable relay errors", async () => {
    vi.stubGlobal(
      "fetch",
      async () => new Response('{"error":"Expired share"}', { status: 410 }),
    );
    await expect(
      downloadEncrypted("a".repeat(32), new AbortController().signal),
    ).rejects.toThrow("410: Expired");
  });
  it("rejects HTML masquerading as a health endpoint", async () => {
    vi.stubGlobal("fetch", async () => new Response('{"service":"other"}'));
    await expect(relayHealth()).rejects.toThrow("Incompatible");
  });
  it("rejects a malformed upload before networking", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    await expect(
      uploadEncrypted(
        new Uint8Array(1),
        "bad",
        3600,
        new AbortController().signal,
      ),
    ).rejects.toThrow("Invalid upload");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("puts deletion capabilities in authorization headers, not URLs", async () => {
    const fetcher = vi.fn(
      async (_url: RequestInfo | URL, _options?: RequestInit) =>
        new Response(null, { status: 204 }),
    );
    vi.stubGlobal("fetch", fetcher);
    await revokeEncrypted("a".repeat(32), "b".repeat(43));
    expect(fetcher.mock.calls[0][0]).not.toContain("b".repeat(43));
    expect((fetcher.mock.calls[0][1] as RequestInit).headers).toEqual({
      "X-Neuron-Client": "1",
      Authorization: "Bearer " + "b".repeat(43),
    });
  });
});