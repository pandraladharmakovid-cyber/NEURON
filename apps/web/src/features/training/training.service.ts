import { tf, embed, makeHead } from "../../lib/ml";
import { toBase64 } from "../../lib/model-format";
import type {
  Project,
  Sample,
  EpochMetric,
  Evaluation,
  ModelArtifact,
} from "../../lib/types";
import { sha256 } from "../../lib/checksums";
import { runActivity } from "../../pwa/update-manager";
import { validateLabels } from "../projects/project.service";
export function random(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function splitIndices(labels: number[], seed: number) {
  const rng = random(seed),
    train: number[] = [],
    validation: number[] = [];
  for (const label of [...new Set(labels)]) {
    const indices = labels
      .map((v, i) => (v === label ? i : -1))
      .filter((i) => i !== -1);
    if (indices.length < 5)
      throw new Error("Every class needs at least 5 images.");
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    const count = Math.max(1, Math.floor(indices.length * 0.2));
    validation.push(...indices.slice(0, count));
    train.push(...indices.slice(count));
  }
  return { train, validation };
}
export function evaluate(
  actual: number[],
  predicted: number[],
  classes: number,
): Evaluation {
  if (!actual.length || actual.length !== predicted.length)
    throw new Error("Invalid evaluation data.");
  const matrix = Array.from({ length: classes }, () =>
    Array<number>(classes).fill(0),
  );
  let correct = 0;
  actual.forEach((a, i) => {
    const p = predicted[i];
    if (
      a < 0 ||
      a >= classes ||
      p < 0 ||
      p >= classes ||
      !Number.isInteger(a) ||
      !Number.isInteger(p)
    )
      throw new Error("Invalid prediction index.");
    matrix[a][p]++;
    if (a === p) correct++;
  });
  return { accuracy: correct / actual.length, matrix, total: actual.length };
}
export type TrainingOptions = {
  epochs: number;
  learningRate: number;
  seed: number;
};
export type TrainingProgress = {
  stage: string;
  done: number;
  total: number;
  metrics: EpochMetric[];
};
async function trainInternal(
  project: Project,
  samples: Sample[],
  options: TrainingOptions,
  signal: AbortSignal,
  progress: (p: TrainingProgress) => void,
): Promise<ModelArtifact> {
  validateLabels(project.labels);
  if (
    !Number.isInteger(options.epochs) ||
    options.epochs < 1 ||
    options.epochs > 100 ||
    options.learningRate < 0.00001 ||
    options.learningRate > 0.1 ||
    !Number.isFinite(options.learningRate)
  )
    throw new Error("Invalid training settings.");
  const ids = project.labels.map((l) => l.id);
  const targets = samples.map((s) => ids.indexOf(s.labelId));
  if (targets.some((i) => i < 0))
    throw new Error("Dataset contains an unknown class.");
  const { train: training, validation } = splitIndices(targets, options.seed);
  const check = () => {
    if (signal.aborted)
      throw new DOMException("Training cancelled.", "AbortError");
  };
  const vectors: Float32Array[] = [];
  const metrics: EpochMetric[] = [];
  progress({
    stage: "Downloading / loading image encoder",
    done: 0,
    total: samples.length,
    metrics: [],
  });
  for (let i = 0; i < samples.length; i++) {
    check();
    vectors.push(await embed(samples[i].blob));
    progress({
      stage: "Extracting image features",
      done: i + 1,
      total: samples.length,
      metrics: [],
    });
    await tf.nextFrame();
  }
  check();
  const makeX = (indices: number[]) =>
    tf.tensor2d(
      indices.map((i) => Array.from(vectors[i])),
      [indices.length, 1280],
    );
  const makeY = (indices: number[]) =>
    tf.tidy(() =>
      tf.oneHot(
        tf.tensor1d(
          indices.map((i) => targets[i]),
          "int32",
        ),
        ids.length,
      ),
    );
  let x: ReturnType<typeof makeX> | undefined,
    y: tf.Tensor | undefined,
    vx: ReturnType<typeof makeX> | undefined,
    vy: tf.Tensor | undefined;
  const head = makeHead(ids.length, options.seed);
  const optimizer = tf.train.adam(options.learningRate);
  try {
    x = makeX(training);
    y = makeY(training);
    vx = makeX(validation);
    vy = makeY(validation);
    head.compile({
      optimizer,
      loss: "categoricalCrossentropy",
      metrics: ["accuracy"],
    });
    await head.fit(x, y, {
      epochs: options.epochs,
      batchSize: Math.min(16, training.length),
      shuffle: true,
      validationData: [vx, vy],
      callbacks: {
        onBatchEnd: async () => {
          if (signal.aborted) head.stopTraining = true;
          await tf.nextFrame();
        },
        onEpochEnd: async (epoch, logs) => {
          const metric: EpochMetric = {
            epoch: epoch + 1,
            loss: Number(logs?.loss ?? 0),
            accuracy: Number(logs?.acc ?? logs?.accuracy ?? 0),
            valLoss: Number(logs?.val_loss ?? 0),
            valAccuracy: Number(logs?.val_acc ?? logs?.val_accuracy ?? 0),
          };
          if (!Object.values(metric).every(Number.isFinite)) {
            head.stopTraining = true;
            throw new Error("Training diverged. Reduce learning rate.");
          }
          metrics.push(metric);
          progress({
            stage: "Training classifier",
            done: epoch + 1,
            total: options.epochs,
            metrics: [...metrics],
          });
        },
      },
    });
    check();
    const predicted = tf.tidy(() =>
      (head.predict(vx!) as tf.Tensor).argMax(-1),
    );
    let indices: number[];
    try {
      indices = Array.from(await predicted.data());
    } finally {
      predicted.dispose();
    }
    const evaluation = evaluate(
      validation.map((i) => targets[i]),
      indices,
      ids.length,
    );
    // getWeights() references model-owned variables. encode before head disposal.
    const weights = head.getWeights();
    const named: tf.NamedTensorMap = {};
    weights.forEach((w, i) => (named[`head_${i}`] = w));
    const encoded = await tf.io.encodeWeights(named);
    check();
    const rows = await Promise.all(
      samples.map(async (s) => ({
        hash: await sha256(s.blob),
        labelId: s.labelId,
      })),
    );
    const provenance = {
      datasetHash: await sha256(
        JSON.stringify({
          labels: project.labels,
          rows: [...rows].sort((a, b) =>
            (a.hash + a.labelId).localeCompare(b.hash + b.labelId),
          ),
        }),
      ),
      validationHash: await sha256(
        JSON.stringify({
          labels: project.labels,
          rows: validation
            .map((i) => rows[i])
            .sort((a, b) =>
              (a.hash + a.labelId).localeCompare(b.hash + b.labelId),
            ),
        }),
      ),
      seed: options.seed,
      sampleCount: samples.length,
    };
    return {
      provenance,
      format: "neuron-image",
      version: 1,
      encoder: "mobilenet-v2-1.0",
      embeddingSize: 1280,
      labels: structuredClone(project.labels),
      weightSpecs: encoded.specs as ModelArtifact["weightSpecs"],
      weightData: toBase64(encoded.data),
      epochs: metrics,
      evaluation,
      createdAt: Date.now(),
    };
  } finally {
    x?.dispose();
    y?.dispose();
    vx?.dispose();
    vy?.dispose();
    head.dispose();
    optimizer.dispose();
  }
}

export function train(...args: Parameters<typeof trainInternal>) {
  return runActivity(() => trainInternal(...args));
}