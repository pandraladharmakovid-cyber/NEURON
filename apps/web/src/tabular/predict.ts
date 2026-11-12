import type { Artifact, Prediction } from "./types";
import { vectorize } from "./vectorize";
import { logits, softmax, argmax } from "./linear";
import { assert } from "./errors";
export function predictRow(
  artifact: Artifact,
  values: Record<string, string>,
): Prediction {
  const x = vectorize(values, artifact.preprocessing),
    z = logits(x, artifact.weights, artifact.bias, artifact.bias.length);
  if (artifact.config.task === "classification") {
    const p = softmax(z);
    return {
      kind: "classification",
      label: artifact.labels[argmax(p)],
      scores: artifact.labels
        .map((label, i) => ({ label, score: p[i] }))
        .sort((a, b) => b.score - a.score),
    };
  }
  const value = z[0] * artifact.targetScale.std + artifact.targetScale.mean;
  assert(
    Number.isFinite(value),
    "Prediction is non-finite. Check the model and inputs.",
  );
  return { kind: "regression", value };
}
export function requireBatchHeaders(artifact: Artifact, headers: string[]) {
  for (const f of artifact.config.features)
    assert(
      headers.includes(f.name),
      `Prediction CSV is missing feature: ${f.name}`,
    );
}
