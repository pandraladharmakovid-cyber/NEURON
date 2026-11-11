import { describe, it, expect } from "vitest";
import { shareLink, parseShareLink } from "../features/sharing/share-links";
import { randomSecret } from "../features/sharing/crypto";
import {
  encodeShared,
  decodeShared,
  shareableArtifact,
} from "../features/sharing/share-format";
import { toBase64 } from "../lib/model-format";
import type { ModelArtifact } from "../lib/types";
function model(): ModelArtifact {
  return {
    format: "neuron-image",
    version: 1,
    encoder: "mobilenet-v2-1.0",
    embeddingSize: 1280,
    labels: [
      { id: "a", name: "A" },
      { id: "b", name: "B" },
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
describe("share format and secret links", () => {
  it("places the encryption key exclusively in the fragment", () => {
    const key = randomSecret(),
      url = shareLink("https://neuron.example", "x".repeat(32), key);
    expect(new URL(url).pathname).toBe("/");
    expect(new URL(url).search).toBe("");
    expect(parseShareLink(url)).toEqual({
      id: "x".repeat(32),
      secret: key,
      origin: "https://neuron.example",
    });
  });
  it("rejects query-bearing or malformed links", () => {
    expect(() =>
      parseShareLink("https://neuron.example/?key=secret"),
    ).toThrow();
    expect(() =>
      shareLink("https://neuron.example/path", "x".repeat(32), randomSecret()),
    ).toThrow();
  });
  it("round trips a real bounded weight artifact", () => {
    const m = model();
    expect(decodeShared(encodeShared("Plants", m)).artifact).toEqual(m);
  });
  it("strips hidden datasets and unknown fields from imported artifacts", () => {
    const m = {
      ...model(),
      samples: ["private image"],
      secret: "not part of model",
    };
    expect(shareableArtifact(m)).not.toHaveProperty("samples");
    expect(shareableArtifact(m)).not.toHaveProperty("secret");
  });
  it("rejects non-model encrypted payloads after decryption", () =>
    expect(() =>
      decodeShared(new TextEncoder().encode('{"format":"code"}')),
    ).toThrow());
  it("rejects oversized names", () =>
    expect(() => encodeShared("x".repeat(65), model())).toThrow());
});