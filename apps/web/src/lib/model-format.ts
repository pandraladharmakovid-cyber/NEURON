import type { ModelArtifact } from "./types";
export const MAX_MODEL_BYTES = 8 * 1024 * 1024;
export function toBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let result = "";
  for (let i = 0; i < bytes.length; i += 8192)
    result += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(result);
}
export function fromBase64(s: string): ArrayBuffer {
  const raw = atob(s);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes.buffer;
}
function fail(): never {
  throw new Error("Invalid or incompatible NEURON image model.");
}
export function validateArtifact(value: unknown): ModelArtifact {
  if (!value || typeof value !== "object") return fail();
  const a = value as ModelArtifact;
  if (
    a.format !== "neuron-image" ||
    a.version !== 1 ||
    a.encoder !== "mobilenet-v2-1.0" ||
    a.embeddingSize !== 1280
  )
    return fail();
  if (!Array.isArray(a.labels) || a.labels.length < 2 || a.labels.length > 20)
    return fail();
  const ids = new Set<string>(),
    names = new Set<string>();
  for (const l of a.labels) {
    if (
      !l ||
      typeof l.id !== "string" ||
      !l.id ||
      l.id.length > 100 ||
      typeof l.name !== "string" ||
      !l.name.trim() ||
      l.name.length > 64 ||
      ids.has(l.id) ||
      names.has(l.name.trim().toLowerCase())
    )
      return fail();
    ids.add(l.id);
    names.add(l.name.trim().toLowerCase());
  }
  const n = a.labels.length;
  if (!Array.isArray(a.weightSpecs) || a.weightSpecs.length !== 2)
    return fail();
  const expected = [[1280, n], [n]];
  for (let i = 0; i < 2; i++) {
    const s = a.weightSpecs[i];
    if (
      !s ||
      s.dtype !== "float32" ||
      s.name !== `head_${i}` ||
      JSON.stringify(s.shape) !== JSON.stringify(expected[i])
    )
      return fail();
  }
  if (
    typeof a.weightData !== "string" ||
    a.weightData.length > MAX_MODEL_BYTES ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(a.weightData)
  )
    return fail();
  let buffer: ArrayBuffer;
  try {
    buffer = fromBase64(a.weightData);
  } catch {
    return fail();
  }
  if (buffer.byteLength !== (1280 * n + n) * 4) return fail();
  for (const x of new Float32Array(buffer))
    if (!Number.isFinite(x)) return fail();
  if (
    !Number.isFinite(a.createdAt) ||
    !Array.isArray(a.epochs) ||
    a.epochs.length > 100
  )
    return fail();
  for (const e of a.epochs)
    if (
      !e ||
      ![e.epoch, e.loss, e.accuracy, e.valLoss, e.valAccuracy].every(
        Number.isFinite,
      )
    )
      return fail();
  const v = a.evaluation;
  if (
    !v ||
    !Number.isInteger(v.total) ||
    v.total < 1 ||
    v.total > 1000 ||
    !Number.isFinite(v.accuracy) ||
    v.accuracy < 0 ||
    v.accuracy > 1 ||
    !Array.isArray(v.matrix) ||
    v.matrix.length !== n
  )
    return fail();
  let total = 0,
    correct = 0;
  for (let i = 0; i < n; i++) {
    const row = v.matrix[i];
    if (!Array.isArray(row) || row.length !== n) return fail();
    for (let j = 0; j < n; j++) {
      const c = row[j];
      if (!Number.isInteger(c) || c < 0) return fail();
      total += c;
      if (i === j) correct += c;
    }
  }
  if (total !== v.total || Math.abs(correct / total - v.accuracy) > 1e-6)
    return fail();
  if (a.provenance) {
    const p = a.provenance;
    if (
      !/^[a-f0-9]{64}$/.test(p.datasetHash) ||
      !/^[a-f0-9]{64}$/.test(p.validationHash) ||
      !Number.isInteger(p.seed) ||
      !Number.isInteger(p.sampleCount) ||
      p.sampleCount < 10 ||
      p.sampleCount > 1000
    )
      return fail();
  }
  return structuredClone(a);
}
export async function readModel(file: File) {
  if (file.size > MAX_MODEL_BYTES)
    throw new Error("Model file exceeds the 8 MB safety limit.");
  let value: unknown;
  try {
    value = JSON.parse(await file.text());
  } catch {
    throw new Error("This file is not valid JSON.");
  }
  return validateArtifact(value);
}
export function exportModel(artifact: ModelArtifact, name: string) {
  const blob = new Blob([JSON.stringify(validateArtifact(artifact))], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name.replace(/[^a-z0-9_-]/gi, "_")}.neuron.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}