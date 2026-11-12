import { it, expect, beforeAll } from "vitest";
import { fixture, config, options } from "./fixtures";
import { trainTabular } from "../../tabular/train";
import {
  validateTabularModel,
  readTabularModel,
} from "../../tabular/model-format";
import type { Artifact } from "../../tabular/types";
let artifact: Artifact;
beforeAll(async () => {
  artifact = await trainTabular({
    dataset: await fixture(),
    config,
    options: { ...options, epochs: 3 },
  });
});
it.each([
  "weights",
  "labels",
  "preprocessing",
  "provenance",
  "history",
  "evaluation",
])("rejects malformed model section %s", (key) => {
  const a = structuredClone(artifact);
  (a as unknown as Record<string, unknown>)[key] = null;
  expect(() => validateTabularModel(a)).toThrow();
});
it("rejects non-finite weights, inconsistent confusion and mismatched dimensions", () => {
  const a = structuredClone(artifact);
  a.weights[0] = NaN;
  expect(() => validateTabularModel(a)).toThrow();
  const b = structuredClone(artifact);
  b.preprocessing.width++;
  expect(() => validateTabularModel(b)).toThrow();
  const c = structuredClone(artifact);
  if (c.evaluation.test.kind === "classification")
    c.evaluation.test.confusion[0][0]++;
  expect(() => validateTabularModel(c)).toThrow();
});
it("strips unexpected executable or hidden payload fields", () => {
  const a = validateTabularModel({
    ...artifact,
    script: "alert(1)",
    rawRows: [["private"]],
  });
  expect("script" in a).toBe(false);
  expect("rawRows" in a).toBe(false);
});
it("rejects invalid JSON and image artifacts", async () => {
  await expect(readTabularModel(new Blob(["{"]))).rejects.toThrow();
  expect(() =>
    validateTabularModel({ format: "neuron-image-model" }),
  ).toThrow();
});
