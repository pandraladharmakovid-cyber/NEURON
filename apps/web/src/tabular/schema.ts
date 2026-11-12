import type { ParsedCSV, Configuration, Options } from "./types";
import { LIMITS } from "./limits";
import { assert } from "./errors";
export function validateTable(value: unknown): ParsedCSV {
  const a = value as ParsedCSV;
  assert(
    a &&
      Array.isArray(a.headers) &&
      a.headers.length >= 2 &&
      a.headers.length <= LIMITS.columns,
    "CSV needs 2–100 columns.",
  );
  assert(
    a.headers.every(
      (h) =>
        typeof h === "string" &&
        h.trim() === h &&
        h.length > 0 &&
        h.length <= LIMITS.headerChars,
    ),
    "Headers must be nonempty, trimmed and <=100 characters.",
  );
  assert(
    new Set(a.headers.map((h) => h.toLowerCase())).size === a.headers.length,
    "CSV headers must be unique (case-insensitive).",
  );
  assert(
    Array.isArray(a.rows) && a.rows.length > 0 && a.rows.length <= LIMITS.rows,
    "CSV must have 1–25,000 data rows.",
  );
  assert(
    a.rows.length * a.headers.length <= LIMITS.cells,
    "CSV exceeds 500,000 cells.",
  );
  for (const row of a.rows)
    assert(
      Array.isArray(row) &&
        row.length === a.headers.length &&
        row.every((c) => typeof c === "string" && c.length <= LIMITS.cellChars),
      "CSV contains ragged rows or oversized/non-text cells.",
    );
  return a;
}
export function validateConfiguration(
  value: unknown,
  headers?: string[],
): Configuration {
  const a = value as Configuration;
  assert(
    a &&
      (a.task === "classification" || a.task === "regression") &&
      typeof a.target === "string" &&
      a.target.length > 0 &&
      a.target.length <= 100,
    "Choose a supported task and target.",
  );
  assert(
    Array.isArray(a.features) &&
      a.features.length >= 1 &&
      a.features.length <= LIMITS.features,
    "Choose 1–30 feature columns.",
  );
  const names = new Set<string>();
  for (const f of a.features) {
    assert(
      f &&
        typeof f.name === "string" &&
        f.name.length > 0 &&
        f.name.length <= 100 &&
        (f.kind === "numeric" || f.kind === "categorical"),
      "Invalid feature specification.",
    );
    assert(
      f.name !== a.target && !names.has(f.name),
      "Target cannot be a feature; feature names must be unique.",
    );
    if (headers)
      assert(
        headers.includes(f.name),
        "Selected feature is not in this dataset.",
      );
    names.add(f.name);
  }
  if (headers)
    assert(headers.includes(a.target), "Target is not in this dataset.");
  return {
    task: a.task,
    target: a.target,
    features: a.features.map((f) => ({ name: f.name, kind: f.kind })),
  };
}
export function validateOptions(value: Options) {
  assert(
    Number.isInteger(value.epochs) && value.epochs >= 1 && value.epochs <= 500,
    "Epochs must be between 1 and 500.",
  );
  assert(
    Number.isFinite(value.learningRate) &&
      value.learningRate >= 0.0001 &&
      value.learningRate <= 0.1,
    "Learning rate must be 0.0001–0.1.",
  );
  assert(
    Number.isFinite(value.l2) && value.l2 >= 0 && value.l2 <= 1,
    "L2 must be 0–1.",
  );
  assert(
    Number.isInteger(value.seed) && value.seed >= 0 && value.seed <= 2147483647,
    "Invalid split seed.",
  );
  assert(
    Number.isInteger(value.patience) &&
      value.patience >= 2 &&
      value.patience <= 100,
    "Patience must be 2–100 epochs.",
  );
  assert(
    Number.isInteger(value.batchSize) &&
      value.batchSize >= 4 &&
      value.batchSize <= 256,
    "Batch size must be 4–256.",
  );
  return value;
}
