import type { TrainingInput, Progress, Artifact, Report } from "./types";
import {
  validateTable,
  validateConfiguration,
  validateOptions,
} from "./schema";
import { splitRows } from "./split";
import { fitPreprocessor } from "./preprocessing";
import { encodeRows } from "./vectorize";
import { moments, numberValue } from "./numeric";
import { Adam } from "./optimizer";
import { logits, softmax } from "./linear";
import { classificationReport, regressionReport } from "./metrics";
import { shuffle, random } from "./random";
import { sha256 } from "../lib/checksums";
import { assert } from "./errors";
export async function trainTabular(
  input: TrainingInput,
  onProgress: (p: Progress) => void = () => {},
): Promise<Artifact> {
  const table = validateTable(input.dataset),
    config = validateConfiguration(input.config, table.headers),
    options = validateOptions(input.options);
  const datasetHash = await sha256(
    JSON.stringify({ headers: table.headers, rows: table.rows }),
  );
  assert(
    datasetHash === input.dataset.hash,
    "Dataset integrity mismatch. Reimport the CSV.",
  );
  const split = splitRows(table, config, options.seed),
    preprocessing = fitPreprocessor(table, config, split.train),
    x = encodeRows(table, preprocessing),
    target = table.headers.indexOf(config.target);
  const labels =
      config.task === "classification"
        ? [...new Set(table.rows.map((r) => r[target].trim()))].sort()
        : [],
    outputs = config.task === "classification" ? labels.length : 1;
  const rawY = table.rows.map((r) =>
    config.task === "classification"
      ? labels.indexOf(r[target].trim())
      : numberValue(r[target])!,
  );
  const targetScale =
      config.task === "regression"
        ? moments(split.train.map((i) => rawY[i]))
        : { mean: 0, std: 1 },
    y = rawY.map((v) =>
      config.task === "classification"
        ? v
        : (v - targetScale.mean) / targetScale.std,
    );
  const size = preprocessing.width * outputs,
    parameters = new Float64Array(size + outputs),
    optimizer = new Adam(parameters.length, options.learningRate),
    rng = random(options.seed),
    history: Artifact["history"] = [];
  let best = Infinity,
    bestEpoch = 0,
    stale = 0,
    bestParameters = new Float64Array(parameters);
  const weights = () => parameters.subarray(0, size),
    bias = () => parameters.subarray(size);
  function outputsFor(i: number) {
    const z = logits(x[i], weights(), bias(), outputs);
    return config.task === "classification" ? softmax(z) : [z[0]];
  }
  function loss(rows: number[]) {
    let total = 0;
    for (const i of rows) {
      const p = outputsFor(i);
      total +=
        config.task === "classification"
          ? -Math.log(Math.max(1e-12, p[y[i]]))
          : (p[0] - y[i]) ** 2;
    }
    return total / rows.length;
  }
  function report(rows: number[]): Report {
    return config.task === "classification"
      ? classificationReport(
          rows.map((i) => y[i]),
          rows.map(outputsFor),
          outputs,
        )
      : regressionReport(
          rows.map((i) => rawY[i]),
          rows.map(
            (i) => outputsFor(i)[0] * targetScale.std + targetScale.mean,
          ),
        );
  }
  for (let epoch = 1; epoch <= options.epochs; epoch++) {
    const order = shuffle(split.train, rng);
    for (let offset = 0; offset < order.length; offset += options.batchSize) {
      const batch = order.slice(offset, offset + options.batchSize),
        gradient = new Float64Array(parameters.length);
      for (const i of batch) {
        const p = outputsFor(i);
        for (let k = 0; k < outputs; k++) {
          const delta =
            config.task === "classification"
              ? p[k] - (y[i] === k ? 1 : 0)
              : 2 * (p[0] - y[i]);
          for (let j = 0; j < preprocessing.width; j++)
            gradient[k * preprocessing.width + j] +=
              (delta * x[i][j]) / batch.length;
          gradient[size + k] += delta / batch.length;
        }
      }
      for (let j = 0; j < size; j++) gradient[j] += options.l2 * parameters[j];
      optimizer.update(parameters, gradient);
    }
    const trainLoss = loss(split.train),
      validationLoss = loss(split.validation),
      validationReport = report(split.validation);
    assert(
      Number.isFinite(trainLoss) && Number.isFinite(validationLoss),
      "Non-finite loss. Clean data or reduce learning rate.",
    );
    history.push({
      epoch,
      trainLoss,
      validationLoss,
      validationScore:
        validationReport.kind === "classification"
          ? validationReport.accuracy
          : validationReport.rmse,
    });
    onProgress({
      stage: "Training linear model",
      epoch,
      total: options.epochs,
      history: [...history],
    });
    if (validationLoss < best - 1e-6) {
      best = validationLoss;
      bestParameters = new Float64Array(parameters);
      bestEpoch = epoch;
      stale = 0;
    } else stale++;
    await new Promise((resolve) => setTimeout(resolve, 0));
    if (stale >= options.patience) break;
  }
  parameters.set(bestParameters);
  const testHash = await sha256(
    JSON.stringify({
      config,
      rows: split.test
        .map((i) => table.rows[i])
        .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
    }),
  );
  return {
    format: "neuron-tabular",
    version: 1,
    algorithm:
      config.task === "classification" ? "softmax-linear" : "ridge-linear",
    config,
    preprocessing,
    labels,
    targetScale,
    weights: Array.from(weights()),
    bias: Array.from(bias()),
    history,
    evaluation: {
      validation: report(split.validation),
      test: report(split.test),
    },
    provenance: {
      datasetHash,
      testHash,
      seed: options.seed,
      trainRows: split.train.length,
      validationRows: split.validation.length,
      testRows: split.test.length,
      bestEpoch,
    },
    createdAt: Date.now(),
  };
}
