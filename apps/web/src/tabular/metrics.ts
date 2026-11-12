import type { ClassificationReport, RegressionReport } from "./types";
import { argmax } from "./linear";
import { assert } from "./errors";
export function classificationReport(
  actual: number[],
  probabilities: number[][],
  classes: number,
): ClassificationReport {
  assert(
    actual.length > 0 && actual.length === probabilities.length,
    "Invalid classification evaluation input.",
  );
  const confusion = Array.from({ length: classes }, () =>
    Array<number>(classes).fill(0),
  );
  let loss = 0,
    correct = 0;
  actual.forEach((label, i) => {
    const scores = probabilities[i];
    assert(
      Number.isInteger(label) &&
        label >= 0 &&
        label < classes &&
        scores.length === classes &&
        scores.every((s) => Number.isFinite(s) && s >= 0 && s <= 1),
      "Invalid class probabilities.",
    );
    const predicted = argmax(scores);
    confusion[label][predicted]++;
    if (label === predicted) correct++;
    loss -= Math.log(Math.max(1e-12, scores[label]));
  });
  let f1 = 0;
  for (let k = 0; k < classes; k++) {
    const tp = confusion[k][k],
      fp = confusion.reduce((n, row) => n + row[k], 0) - tp,
      fn = confusion[k].reduce((a, b) => a + b, 0) - tp;
    f1 += 2 * tp + fp + fn ? (2 * tp) / (2 * tp + fp + fn) : 0;
  }
  return {
    kind: "classification",
    rows: actual.length,
    accuracy: correct / actual.length,
    macroF1: f1 / classes,
    logLoss: loss / actual.length,
    confusion,
  };
}
export function regressionReport(
  actual: number[],
  predicted: number[],
): RegressionReport {
  assert(
    actual.length > 0 &&
      actual.length === predicted.length &&
      [...actual, ...predicted].every(Number.isFinite),
    "Invalid regression evaluation input.",
  );
  const mean = actual.reduce((a, b) => a + b, 0) / actual.length;
  let squared = 0,
    absolute = 0,
    variance = 0;
  actual.forEach((v, i) => {
    squared += (v - predicted[i]) ** 2;
    absolute += Math.abs(v - predicted[i]);
    variance += (v - mean) ** 2;
  });
  return {
    kind: "regression",
    rows: actual.length,
    mae: absolute / actual.length,
    rmse: Math.sqrt(squared / actual.length),
    r2: variance > 1e-18 ? 1 - squared / variance : null,
  };
}
