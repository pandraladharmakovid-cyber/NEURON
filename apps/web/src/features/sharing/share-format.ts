import { validateArtifact } from "../../lib/model-format";
import type { ModelArtifact } from "../../lib/types";
export type SharedModel = {
  format: "neuron-shared-model";
  version: 1;
  name: string;
  artifact: ModelArtifact;
};
export function shareableArtifact(value: unknown): ModelArtifact {
  const a = validateArtifact(value);
  // Whitelist fields. Unknown fields in an imported model must not hitchhike into shares.
  return {
    format: a.format,
    version: a.version,
    encoder: a.encoder,
    embeddingSize: a.embeddingSize,
    labels: a.labels.map((l) => ({ id: l.id, name: l.name })),
    weightSpecs: a.weightSpecs.map((s) => ({
      name: s.name,
      shape: [...s.shape],
      dtype: s.dtype,
    })),
    weightData: a.weightData,
    epochs: a.epochs.map((e) => ({
      epoch: e.epoch,
      loss: e.loss,
      accuracy: e.accuracy,
      valLoss: e.valLoss,
      valAccuracy: e.valAccuracy,
    })),
    evaluation: {
      accuracy: a.evaluation.accuracy,
      total: a.evaluation.total,
      matrix: a.evaluation.matrix.map((row) => [...row]),
    },
    createdAt: a.createdAt,
    ...(a.provenance
      ? {
          provenance: {
            datasetHash: a.provenance.datasetHash,
            validationHash: a.provenance.validationHash,
            seed: a.provenance.seed,
            sampleCount: a.provenance.sampleCount,
          },
        }
      : {}),
  };
}
export function encodeShared(name: string, artifact: ModelArtifact) {
  if (!name.trim() || name.length > 64) throw new Error("Invalid model name.");
  const payload: SharedModel = {
    format: "neuron-shared-model",
    version: 1,
    name: name.trim(),
    artifact: shareableArtifact(artifact),
  };
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  if (bytes.length > 8 * 1024 * 1024)
    throw new Error("Model exceeds the 8 MB sharing limit.");
  return bytes;
}
export function decodeShared(bytes: Uint8Array): SharedModel {
  if (bytes.length > 8 * 1024 * 1024)
    throw new Error("Shared model exceeds the size limit.");
  let value: SharedModel;
  try {
    value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new Error("Decrypted model is not valid UTF-8 JSON.");
  }
  if (
    !value ||
    value.format !== "neuron-shared-model" ||
    value.version !== 1 ||
    typeof value.name !== "string" ||
    !value.name.trim() ||
    value.name.length > 64
  )
    throw new Error("Unsupported shared model format.");
  return {
    format: "neuron-shared-model",
    version: 1,
    name: value.name,
    artifact: shareableArtifact(value.artifact),
  };
}