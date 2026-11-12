import { describe, it, expect } from "vitest";
import { parseRoute, routeTitle } from "../app/router";
import { decodePreferences, DEFAULT_PREFERENCES } from "../app/providers";
import {
  safeExternalURL,
  safeLocalRoute,
  projectRoute,
  downloadName,
} from "../lib/url-safety";
import { explainError } from "../lib/errors";
describe("typed route and local privacy contracts", () => {
  it.each([
    ["/", "home"],
    ["/projects", "projects"],
    ["/settings", "settings"],
    ["/shares", "shares"],
    ["/tabular", "tabular-home"],
    ["/projects/abc/train", "image"],
    ["/tabular/abc/predict", "tabular"],
  ])("routes %s without a permissive fallback", (path, kind) =>
    expect(parseRoute(path).kind).toBe(kind),
  );
  it.each([
    "/projects/../train",
    "/projects/a/b",
    "//evil.test",
    "/tabular/%2f/train",
    "/projects/abc?secret=x",
    "/receive/short/secret",
  ])("rejects malformed route %s", (path) =>
    expect(parseRoute(path).kind).toBe("not-found"),
  );
  it("keeps share capabilities out of document titles", () => {
    const secret = "b".repeat(43),
      r = parseRoute("/receive/" + "a".repeat(32) + "/" + secret);
    expect(r.kind).toBe("receive");
    expect(routeTitle(r)).not.toContain(secret);
  });
  it("validates URL and filename boundaries", () => {
    expect(safeExternalURL("https://example.com/docs")).toBe(
      "https://example.com/docs",
    );
    expect(() => safeExternalURL("javascript:alert(1)")).toThrow();
    expect(() =>
      safeExternalURL("https://user:password@example.com"),
    ).toThrow();
    expect(() => safeLocalRoute("//evil")).toThrow();
    expect(() => safeLocalRoute("/projects/x#secret")).toThrow();
    expect(projectRoute("abc", "train")).toBe("#/projects/abc/train");
    expect(() => projectRoute("../escape")).toThrow();
    expect(downloadName("../unsafe name", ".json")).not.toContain("/");
  });
  it("validates preference fields, defaults corrupt data and strips unknown fields", () => {
    expect(decodePreferences("{")).toEqual(DEFAULT_PREFERENCES);
    expect(
      decodePreferences('{"cameraEnabled":"false","reducedMotion":false}'),
    ).toEqual(DEFAULT_PREFERENCES);
    expect(
      decodePreferences(
        '{"cameraEnabled":false,"reducedMotion":true,"secret":"not stored"}',
      ),
    ).toEqual({ cameraEnabled: false, reducedMotion: true });
  });
  it.each([
    ["NotAllowedError", "permission"],
    ["NotFoundError", "permission"],
    ["NotReadableError", "permission"],
    ["QuotaExceededError", "quota"],
    ["AbortError", "cancelled"],
    ["InvalidStateError", "storage"],
  ])("provides actionable %s feedback", (name, code) => {
    expect(explainError(new DOMException("original", name)).code).toBe(code);
    expect(
      explainError(new DOMException("original", name)).message.length,
    ).toBeGreaterThan(20);
  });
});
