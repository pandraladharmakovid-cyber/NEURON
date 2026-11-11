import { describe, it, expect } from "vitest";
import { MODEL_FILES, validateEncoderManifest } from "../pwa/asset-manager";
import { runActivity, activeJobs } from "../pwa/update-manager";
describe("pinned encoder boundary", () => {
  it("pins every shard and manifest", () => {
    expect(MODEL_FILES).toHaveLength(5);
    for (const f of MODEL_FILES) {
      expect(f.hash).toMatch(/^[a-f0-9]{64}$/);
      expect(f.bytes).toBeGreaterThan(0);
    }
  });
  it("rejects manifest paths that escape the approved pack", () =>
    expect(() =>
      validateEncoderManifest({
        modelTopology: {},
        weightsManifest: [{ paths: ["../../evil"], weights: [] }],
      }),
    ).toThrow());
  it("accepts the exact bounded shard list", () =>
    expect(
      validateEncoderManifest({
        modelTopology: {},
        weightsManifest: [
          { paths: MODEL_FILES.slice(1).map((f) => f.name), weights: [] },
        ],
      }),
    ).toBeTruthy());
  it("tracks and releases activity on failure", async () => {
    await expect(
      runActivity(async () => {
        expect(activeJobs()).toBe(1);
        throw new Error("cancel");
      }),
    ).rejects.toThrow("cancel");
    expect(activeJobs()).toBe(0);
  });
});