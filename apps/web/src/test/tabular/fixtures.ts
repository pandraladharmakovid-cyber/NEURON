import type { Configuration, Dataset } from "../../tabular/types";
import { sha256 } from "../../tabular/../lib/checksums";
import { DEFAULT_OPTIONS } from "../../tabular/limits";
export const config: Configuration = {
  task: "classification",
  target: "label",
  features: [
    { name: "x", kind: "numeric" },
    { name: "group", kind: "categorical" },
  ],
};
export const options = { ...DEFAULT_OPTIONS, epochs: 70, patience: 12 };
export async function fixture(regression = false): Promise<Dataset> {
  const headers = ["x", "group", "label"],
    rows = Array.from({ length: 160 }, (_, i) => {
      const x = (i - 80) / 20;
      return [
        String(x),
        i % 2 ? "odd" : "even",
        regression ? String(3 * x + 7) : x < 0 ? "cold" : "warm",
      ];
    });
  return {
    projectId: crypto.randomUUID(),
    fileName: "fixture.csv",
    headers,
    rows,
    hash: await sha256(JSON.stringify({ headers, rows })),
    createdAt: Date.now(),
  };
}
export const regressionConfig: Configuration = {
  ...config,
  task: "regression",
};
