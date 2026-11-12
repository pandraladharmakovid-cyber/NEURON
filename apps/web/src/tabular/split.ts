import type { ParsedCSV, Configuration, Split } from "./types";
import { shuffle, random } from "./random";
import { numberValue } from "./numeric";
import { assert } from "./errors";
export function splitRows(
  table: ParsedCSV,
  config: Configuration,
  seed: number,
): Split {
  const target = table.headers.indexOf(config.target),
    features = config.features.map((f) => table.headers.indexOf(f.name));
  const groups = new Map<string, number[]>();
  for (let i = 0; i < table.rows.length; i++) {
    const row = table.rows[i],
      y = row[target].trim();
    assert(
      y !== "",
      "Target contains missing values. Correct the CSV before training.",
    );
    if (config.task === "regression")
      assert(
        numberValue(y) !== null,
        "Regression targets must be valid finite numbers (magnitude <=1e12).",
      );
    else
      assert(y.length <= 64, "Classification labels must be <=64 characters.");
    const key = JSON.stringify(features.map((j) => row[j].trim()));
    const group = groups.get(key) ?? [];
    if (config.task === "classification" && group.length)
      assert(
        table.rows[group[0]][target].trim() === y,
        "Identical feature records have conflicting class labels. Correct or remove the conflict.",
      );
    group.push(i);
    groups.set(key, group);
  }
  const buckets = new Map<string, number[][]>();
  for (const g of groups.values()) {
    const label =
      config.task === "classification"
        ? table.rows[g[0]][target].trim()
        : "regression";
    const bucket = buckets.get(label) ?? [];
    bucket.push(g);
    buckets.set(label, bucket);
  }
  if (config.task === "classification")
    assert(
      buckets.size >= 2 && buckets.size <= 20,
      "Classification needs 2–20 distinct labels.",
    );
  const result: Split = { train: [], validation: [], test: [] },
    rng = random(seed);
  for (const bucket of buckets.values()) {
    assert(
      bucket.length >= (config.task === "classification" ? 10 : 30),
      config.task === "classification"
        ? "Each class needs at least 10 distinct feature groups."
        : "Regression needs at least 30 distinct feature groups.",
    );
    const ordered = shuffle(bucket, rng),
      test = Math.max(1, Math.floor(ordered.length * 0.15)),
      validation = Math.max(1, Math.floor(ordered.length * 0.15));
    ordered.forEach((g, i) =>
      result[
        i < test ? "test" : i < test + validation ? "validation" : "train"
      ].push(...g),
    );
  }
  return result;
}
