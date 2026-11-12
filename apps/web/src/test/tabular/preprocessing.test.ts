import { it, expect } from "vitest";
import { fitPreprocessor } from "../../tabular/preprocessing";
import { vectorize } from "../../tabular/vectorize";
import { config } from "./fixtures";
it("fits means and vocabularies on training indices only", () => {
  const t = {
    headers: ["x", "group", "label"],
    rows: [
      ["1", "a", "cold"],
      ["3", "a", "warm"],
      ["99999", "secret-test-only", "cold"],
    ],
  };
  const p = fitPreprocessor(t, config, [0, 1]);
  expect(p.features[0]).toMatchObject({ mean: 2 });
  expect(p.features[1]).toMatchObject({ levels: ["a"] });
  const missing = Array.from(vectorize({}, p)),
    unknown = Array.from(
      vectorize({ x: "99999", group: "secret-test-only" }, p),
    );
  expect(missing[1]).toBe(1);
  expect(unknown[0]).toBe(8);
  expect(missing).not.toEqual(unknown);
  expect(missing.every(Number.isFinite)).toBe(true);
});
it("caps category vocabulary and represents all-missing numeric columns", () => {
  const rows = Array.from({ length: 50 }, (_, i) => ["", String(i), "cold"]);
  const p = fitPreprocessor(
    { headers: ["x", "group", "label"], rows },
    config,
    rows.map((_, i) => i),
  );
  expect(
    p.features[1].kind === "categorical" && p.features[1].levels.length,
  ).toBe(16);
  expect(p.features[0]).toMatchObject({ mean: 0, std: 1 });
});
