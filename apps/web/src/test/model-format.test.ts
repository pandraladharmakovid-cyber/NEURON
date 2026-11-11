import { describe, it, expect } from "vitest";
import { validateArtifact, toBase64, fromBase64 } from "../lib/model-format";
import type { ModelArtifact } from "../lib/types";
function fixture(): ModelArtifact {
  return {
    format: "neuron-image",
    version: 1,
    encoder: "mobilenet-v2-1.0",
    embeddingSize: 1280,
    labels: [
      { id: "a", name: "Cats" },
      { id: "b", name: "Dogs" },
    ],
    weightSpecs: [
      { name: "head_0", shape: [1280, 2], dtype: "float32" },
      { name: "head_1", shape: [2], dtype: "float32" },
    ],
    weightData: toBase64(new Float32Array(2562).buffer),
    epochs: [],
    evaluation: {
      accuracy: 1,
      total: 2,
      matrix: [
        [1, 0],
        [0, 1],
      ],
    },
    createdAt: 1,
  };
}
describe("model boundary", () => {
  it("round trips binary data", () => {
    const data = new Float32Array([0.1, -0.9, 42]);
    expect(new Float32Array(fromBase64(toBase64(data.buffer)))).toEqual(data);
  });
  it("accepts valid bounded artifacts and returns an isolated clone", () => {
    const a = fixture();
    const b = validateArtifact(a);
    expect(b).toEqual(a);
    expect(b).not.toBe(a);
  });
  it("rejects unknown formats", () =>
    expect(() =>
      validateArtifact({ ...fixture(), format: "javascript" }),
    ).toThrow());
  it("rejects mismatched tensor dimensions", () => {
    const a = fixture();
    a.weightSpecs[0].shape = [2, 1280];
    expect(() => validateArtifact(a)).toThrow();
  });
  it("rejects truncated weights", () => {
    const a = fixture();
    a.weightData = "AAAA";
    expect(() => validateArtifact(a)).toThrow();
  });
  it("rejects nonfinite weights", () => {
    const a = fixture();
    const w = new Float32Array(2562);
    w[0] = NaN;
    a.weightData = toBase64(w.buffer);
    expect(() => validateArtifact(a)).toThrow();
  });
  it("rejects executable/arbitrary tensor names", () => {
    const a = fixture();
    a.weightSpecs[0].name = "__proto__";
    expect(() => validateArtifact(a)).toThrow();
  });
  it("rejects inconsistent validation reports", () => {
    const a = fixture();
    a.evaluation.accuracy = 0;
    expect(() => validateArtifact(a)).toThrow();
  });
  it("rejects duplicate class names", () => {
    const a = fixture();
    a.labels[1].name = "cats";
    expect(() => validateArtifact(a)).toThrow();
  });
});