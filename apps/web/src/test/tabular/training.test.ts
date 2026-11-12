import { it, expect } from "vitest";
import { fixture, config, regressionConfig, options } from "./fixtures";
import { trainTabular } from "../../tabular/train";
import { predictRow, requireBatchHeaders } from "../../tabular/predict";
import { classificationReport, regressionReport } from "../../tabular/metrics";
import { validateTabularModel } from "../../tabular/model-format";
it("learns real classification, emits history and preserves export/import predictions", async () => {
  const d = await fixture(),
    progress: number[] = [];
  const a = await trainTabular({ dataset: d, config, options }, (p) =>
    progress.push(p.epoch),
  );
  expect(progress.length).toBe(a.history.length);
  expect(
    a.evaluation.test.kind === "classification" && a.evaluation.test.accuracy,
  ).toBeGreaterThan(0.9);
  const p = predictRow(a, { x: "-2", group: "odd" });
  expect(p.kind === "classification" && p.label).toBe("cold");
  expect(
    predictRow(validateTabularModel(JSON.parse(JSON.stringify(a))), {
      x: "-2",
      group: "odd",
    }),
  ).toEqual(p);
  expect(() => requireBatchHeaders(a, ["x"])).toThrow(/group/);
});
it("learns regression in original units and records honest held-out errors", async () => {
  const a = await trainTabular({
    dataset: await fixture(true),
    config: regressionConfig,
    options: { ...options, epochs: 100 },
  });
  expect(
    a.evaluation.test.kind === "regression" && a.evaluation.test.rmse,
  ).toBeLessThan(0.3);
  const p = predictRow(a, { x: "2", group: "even" });
  expect(p.kind === "regression" && p.value).toBeCloseTo(13, 0);
  validateTabularModel(a);
});
it("produces deterministic weights and rejects dataset tampering", async () => {
  const d = await fixture(),
    input = { dataset: d, config, options: { ...options, epochs: 3 } };
  const a = await trainTabular(input),
    b = await trainTabular(input);
  expect(a.weights).toEqual(b.weights);
  expect(a.provenance.testHash).toBe(b.provenance.testHash);
  d.rows[0][0] = "99";
  await expect(trainTabular(input)).rejects.toThrow(/integrity/);
});
it("computes confusion, F1, logloss and constant-target R2 explicitly", () => {
  const c = classificationReport(
    [0, 1],
    [
      [0.9, 0.1],
      [0.6, 0.4],
    ],
    2,
  );
  expect(c.confusion).toEqual([
    [1, 0],
    [1, 0],
  ]);
  expect(c.accuracy).toBe(0.5);
  expect(c.macroF1).toBeCloseTo(1 / 3);
  expect(regressionReport([2, 2], [2, 2]).r2).toBeNull();
  expect(regressionReport([1, 2, 3], [1, 2, 3]).r2).toBe(1);
});
