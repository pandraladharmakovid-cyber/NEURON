import { afterEach, it, expect, vi } from "vitest";
import { oneShotWorker } from "../lib/worker-client";
import { activeJobs } from "../pwa/update-manager";
class FakeWorker {
  onmessage: ((e: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  onmessageerror: (() => void) | null = null;
  terminate = vi.fn();
  postMessage = vi.fn();
}
afterEach(() => vi.useRealTimers());
it("decodes an actual worker reply contract and terminates after success", async () => {
  const w = new FakeWorker(),
    result = oneShotWorker(
      () => w as unknown as Worker,
      { file: "bounded" },
      (value) => String(value),
    );
  w.onmessage?.({ data: { ok: true, value: "normalized" } });
  expect(await result).toBe("normalized");
  expect(w.terminate).toHaveBeenCalledOnce();
  expect(activeJobs()).toBe(0);
});
it("rejects error replies and always releases job activity", async () => {
  const w = new FakeWorker(),
    result = oneShotWorker(
      () => w as unknown as Worker,
      {},
      (x) => x,
    );
  w.onmessage?.({ data: { ok: false, error: "Decode failed" } });
  await expect(result).rejects.toThrow(/Decode failed/);
  expect(w.terminate).toHaveBeenCalledOnce();
  expect(activeJobs()).toBe(0);
});
it("terminates on cancellation without waiting for worker completion", async () => {
  const w = new FakeWorker(),
    controller = new AbortController(),
    result = oneShotWorker(
      () => w as unknown as Worker,
      {},
      (x) => x,
      { signal: controller.signal },
    );
  controller.abort();
  await expect(result).rejects.toMatchObject({ name: "AbortError" });
  expect(w.terminate).toHaveBeenCalledOnce();
  expect(activeJobs()).toBe(0);
});
it("does not create workers for an already aborted request", async () => {
  const create = vi.fn(),
    c = new AbortController();
  c.abort();
  await expect(
    oneShotWorker(create, {}, (x) => x, { signal: c.signal }),
  ).rejects.toMatchObject({ name: "AbortError" });
  expect(create).not.toHaveBeenCalled();
});
it("times out a hung worker and clears its resources", async () => {
  vi.useFakeTimers();
  const w = new FakeWorker(),
    result = oneShotWorker(
      () => w as unknown as Worker,
      {},
      (x) => x,
      { timeoutMs: 50 },
    ),
    failure = expect(result).rejects.toThrow(/timed out/);
  await vi.advanceTimersByTimeAsync(50);
  await failure;
  expect(w.terminate).toHaveBeenCalledOnce();
  expect(activeJobs()).toBe(0);
});
it.each(["runtime", "decode", "protocol"])(
  "handles %s failure without active-job leaks",
  async (kind) => {
    const w = new FakeWorker(),
      result = oneShotWorker(
        () => w as unknown as Worker,
        {},
        (x) => {
          if (kind === "decode") throw new Error("Invalid blob");
          return x;
        },
      );
    if (kind === "runtime") w.onerror?.();
    else if (kind === "protocol") w.onmessage?.({ data: { bad: "message" } });
    else w.onmessage?.({ data: { ok: true, value: null } });
    await expect(result).rejects.toThrow();
    expect(w.terminate).toHaveBeenCalledOnce();
    expect(activeJobs()).toBe(0);
  },
);
