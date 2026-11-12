import type { Artifact, Report, Preprocessor } from "./types";
import { validateConfiguration } from "./schema";
import { LIMITS } from "./limits";
import { assert } from "./errors";
import { validHash } from "../lib/checksums";
function finite(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}
function report(raw: Report, task: string, classes: number): Report {
  assert(
    raw &&
      Number.isInteger(raw.rows) &&
      raw.rows >= 1 &&
      raw.rows <= LIMITS.rows,
    "Invalid report row count.",
  );
  if (task === "classification") {
    assert(
      raw.kind === "classification" &&
        [raw.accuracy, raw.macroF1, raw.logLoss].every(finite) &&
        raw.accuracy >= 0 &&
        raw.accuracy <= 1 &&
        raw.macroF1 >= 0 &&
        raw.macroF1 <= 1 &&
        raw.logLoss >= 0,
      "Invalid classification report.",
    );
    assert(
      Array.isArray(raw.confusion) && raw.confusion.length === classes,
      "Invalid confusion matrix.",
    );
    let total = 0,
      correct = 0;
    for (let i = 0; i < classes; i++) {
      assert(
        Array.isArray(raw.confusion[i]) && raw.confusion[i].length === classes,
        "Invalid confusion shape.",
      );
      for (let j = 0; j < classes; j++) {
        const n = raw.confusion[i][j];
        assert(
          Number.isInteger(n) && n >= 0 && n <= LIMITS.rows,
          "Invalid confusion count.",
        );
        total += n;
        if (i === j) correct += n;
      }
    }
    assert(
      total === raw.rows && Math.abs(correct / total - raw.accuracy) < 1e-8,
      "Inconsistent confusion report.",
    );
    return {
      kind: "classification",
      rows: raw.rows,
      accuracy: raw.accuracy,
      macroF1: raw.macroF1,
      logLoss: raw.logLoss,
      confusion: raw.confusion.map((row) => [...row]),
    };
  }
  assert(
    raw.kind === "regression" &&
      finite(raw.mae) &&
      raw.mae >= 0 &&
      finite(raw.rmse) &&
      raw.rmse >= 0 &&
      (raw.r2 === null || finite(raw.r2)),
    "Invalid regression report.",
  );
  return {
    kind: "regression",
    rows: raw.rows,
    mae: raw.mae,
    rmse: raw.rmse,
    r2: raw.r2,
  };
}
export function validateTabularModel(value: unknown): Artifact {
  const a = value as Artifact;
  assert(
    a && a.format === "neuron-tabular" && a.version === 1,
    "Unsupported CSV model format.",
  );
  const config = validateConfiguration(a.config);
  assert(
    a.algorithm ===
      (config.task === "classification" ? "softmax-linear" : "ridge-linear"),
    "Unsupported algorithm.",
  );
  assert(
    Array.isArray(a.labels) &&
      a.labels.length <= (config.task === "classification" ? 20 : 0) &&
      a.labels.every(
        (l) =>
          typeof l === "string" &&
          l.length > 0 &&
          l.length <= 64 &&
          l === l.trim(),
      ) &&
      new Set(a.labels).size === a.labels.length,
    "Invalid class labels.",
  );
  if (config.task === "classification")
    assert(a.labels.length >= 2, "At least two classes required.");
  assert(
    a.preprocessing &&
      Array.isArray(a.preprocessing.features) &&
      a.preprocessing.features.length === config.features.length,
    "Invalid preprocessing.",
  );
  let width = 0;
  const features: Preprocessor["features"] = a.preprocessing.features.map(
    (f, i) => {
      assert(
        f &&
          f.name === config.features[i].name &&
          f.kind === config.features[i].kind,
        "Preprocessing/config mismatch.",
      );
      if (f.kind === "numeric") {
        assert(
          finite(f.mean) &&
            Math.abs(f.mean) <= 1e12 &&
            finite(f.std) &&
            f.std >= 1e-9 &&
            f.std <= 2e12 &&
            f.clip === 8,
          "Invalid numeric preprocessing.",
        );
        width += 2;
        return {
          kind: "numeric",
          name: f.name,
          mean: f.mean,
          std: f.std,
          clip: 8,
        };
      }
      assert(
        f.kind === "categorical" &&
          Array.isArray(f.levels) &&
          f.levels.length <= LIMITS.levels &&
          f.levels.every(
            (s) =>
              typeof s === "string" &&
              s.trim() === s &&
              s.length > 0 &&
              s.length <= LIMITS.levelChars,
          ) &&
          new Set(f.levels).size === f.levels.length,
        "Invalid category vocabulary.",
      );
      width += f.levels.length + 2;
      return { kind: "categorical", name: f.name, levels: [...f.levels] };
    },
  );
  assert(
    width === a.preprocessing.width && width > 0 && width <= LIMITS.encoded,
    "Invalid encoded dimensions.",
  );
  const outputs = config.task === "classification" ? a.labels.length : 1;
  assert(
    Array.isArray(a.weights) &&
      a.weights.length === width * outputs &&
      a.weights.every((n) => finite(n) && Math.abs(n) <= 1e6) &&
      Array.isArray(a.bias) &&
      a.bias.length === outputs &&
      a.bias.every((n) => finite(n) && Math.abs(n) <= 1e6),
    "Invalid linear weights.",
  );
  assert(
    a.targetScale &&
      finite(a.targetScale.mean) &&
      Math.abs(a.targetScale.mean) <= 1e12 &&
      finite(a.targetScale.std) &&
      a.targetScale.std >= 1e-9 &&
      a.targetScale.std <= 2e12,
    "Invalid target scaling.",
  );
  assert(
    Array.isArray(a.history) &&
      a.history.length >= 1 &&
      a.history.length <= 500,
    "Invalid training history.",
  );
  const history = a.history.map((e, i) => {
    assert(
      e &&
        e.epoch === i + 1 &&
        [e.trainLoss, e.validationLoss, e.validationScore].every(finite) &&
        e.trainLoss >= 0 &&
        e.validationLoss >= 0,
      "Invalid epoch metrics.",
    );
    return {
      epoch: e.epoch,
      trainLoss: e.trainLoss,
      validationLoss: e.validationLoss,
      validationScore: e.validationScore,
    };
  });
  const p = a.provenance;
  assert(
    p &&
      validHash(p.datasetHash) &&
      validHash(p.testHash) &&
      Number.isInteger(p.seed) &&
      p.seed >= 0 &&
      p.seed <= 2147483647 &&
      [p.trainRows, p.validationRows, p.testRows].every(
        (n) => Number.isInteger(n) && n > 0,
      ) &&
      p.trainRows + p.validationRows + p.testRows <= LIMITS.rows &&
      Number.isInteger(p.bestEpoch) &&
      p.bestEpoch >= 1 &&
      p.bestEpoch <= history.length,
    "Invalid model provenance.",
  );
  assert(a.evaluation, "Missing evaluation.");
  const validation = report(a.evaluation.validation, config.task, outputs),
    test = report(a.evaluation.test, config.task, outputs);
  assert(
    validation.rows === p.validationRows && test.rows === p.testRows,
    "Evaluation row counts mismatch.",
  );
  assert(
    finite(a.createdAt) && a.createdAt >= 0 && a.createdAt <= 8.64e15,
    "Invalid model timestamp.",
  );
  return {
    format: "neuron-tabular",
    version: 1,
    algorithm: a.algorithm,
    config,
    preprocessing: { width, features },
    labels: [...a.labels],
    targetScale: { mean: a.targetScale.mean, std: a.targetScale.std },
    weights: [...a.weights],
    bias: [...a.bias],
    history,
    evaluation: { validation, test },
    provenance: {
      datasetHash: p.datasetHash,
      testHash: p.testHash,
      seed: p.seed,
      trainRows: p.trainRows,
      validationRows: p.validationRows,
      testRows: p.testRows,
      bestEpoch: p.bestEpoch,
    },
    createdAt: a.createdAt,
  };
}
export async function readTabularModel(file: Blob) {
  assert(file.size <= LIMITS.modelBytes, "CSV model exceeds 8 MB.");
  let value: unknown;
  try {
    value = JSON.parse(await file.text());
  } catch {
    throw new Error("Model is not valid JSON.");
  }
  return validateTabularModel(value);
}
