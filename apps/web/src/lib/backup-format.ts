import type { Project, Sample, ModelVersion, FeedbackItem } from "./types";
import { uid } from "./types";
import { sha256, validHash } from "./checksums";
import { toBase64, fromBase64, validateArtifact } from "./model-format";
export const BACKUP_LIMIT = 64 * 1024 * 1024;
const MEDIA_LIMIT = 32 * 1024 * 1024;
type Media = {
  id: string;
  labelId: string;
  data: string;
  hash: string;
  createdAt: number;
  versionId?: string;
  predictedLabel?: string;
};
export type Backup = {
  format: "neuron-project";
  version: 1;
  project: Project;
  samples: Media[];
  versions: ModelVersion[];
  feedback: Media[];
  createdAt: number;
};
export type Snapshot = {
  project: Project;
  samples: Sample[];
  versions: ModelVersion[];
  feedback: FeedbackItem[];
};
function text(x: unknown, max = 100): x is string {
  return typeof x === "string" && x.trim().length > 0 && x.length <= max;
}
export function validateBackupShape(value: unknown): Backup {
  const b = value as Backup;
  if (
    !b ||
    b.format !== "neuron-project" ||
    b.version !== 1 ||
    !b.project ||
    !text(b.project.id) ||
    !text(b.project.name, 64) ||
    !Array.isArray(b.project.labels) ||
    b.project.labels.length < 2 ||
    b.project.labels.length > 20
  )
    throw new Error("Unsupported NEURON project backup.");
  const labelIds = new Set<string>(),
    names = new Set<string>();
  for (const l of b.project.labels) {
    if (
      !l ||
      !text(l.id) ||
      !text(l.name, 64) ||
      labelIds.has(l.id) ||
      names.has(l.name.toLowerCase())
    )
      throw new Error("Invalid backup classes.");
    labelIds.add(l.id);
    names.add(l.name.toLowerCase());
  }
  if (
    ![b.project.createdAt, b.project.updatedAt, b.createdAt].every(
      Number.isFinite,
    ) ||
    !Array.isArray(b.samples) ||
    b.samples.length > 1000 ||
    !Array.isArray(b.versions) ||
    b.versions.length > 50 ||
    !Array.isArray(b.feedback) ||
    b.feedback.length > 100
  )
    throw new Error("Backup exceeds supported record limits.");
  const versionIds = new Set<string>();
  for (const v of b.versions) {
    if (
      !v ||
      !text(v.id) ||
      versionIds.has(v.id) ||
      v.projectId !== b.project.id ||
      !Number.isFinite(v.createdAt)
    )
      throw new Error("Invalid model version.");
    versionIds.add(v.id);
    validateArtifact(v.artifact);
  }
  if (b.project.activeVersionId && !versionIds.has(b.project.activeVersionId))
    throw new Error("Active model is missing from backup.");
  const allIds = new Set<string>();
  let chars = 0;
  for (const [list, feedback] of [
    [b.samples, false],
    [b.feedback, true],
  ] as const)
    for (const m of list) {
      if (
        !m ||
        !text(m.id) ||
        allIds.has(m.id) ||
        !labelIds.has(m.labelId) ||
        !Number.isFinite(m.createdAt) ||
        !validHash(m.hash) ||
        typeof m.data !== "string" ||
        m.data.length > 2 * 1024 * 1024 ||
        !/^[A-Za-z0-9+/]*={0,2}$/.test(m.data)
      )
        throw new Error("Invalid image record in backup.");
      if (
        feedback &&
        (!text(m.versionId) ||
          !versionIds.has(m.versionId!) ||
          typeof m.predictedLabel !== "string" ||
          m.predictedLabel.length > 64)
      )
        throw new Error("Invalid feedback record.");
      allIds.add(m.id);
      chars += m.data.length;
    }
  if (chars > Math.ceil((MEDIA_LIMIT * 4) / 3) + 4096)
    throw new Error("Backup images exceed the 32 MB media budget.");
  return b;
}
export async function encodeBackup(snapshot: Snapshot): Promise<Blob> {
  let bytes = 0;
  async function encode(s: Sample | FeedbackItem): Promise<Media> {
    bytes += s.blob.size;
    if (bytes > MEDIA_LIMIT)
      throw new Error(
        "This phase supports at most 32 MB of image/feedback data per backup.",
      );
    return {
      id: s.id,
      labelId: s.labelId,
      createdAt: s.createdAt,
      data: toBase64(await s.blob.arrayBuffer()),
      hash: await sha256(s.blob),
      ...("versionId" in s
        ? { versionId: s.versionId, predictedLabel: s.predictedLabel }
        : {}),
    };
  }
  const samples: Media[] = [],
    feedback: Media[] = [];
  for (const s of snapshot.samples) samples.push(await encode(s));
  for (const f of snapshot.feedback) feedback.push(await encode(f));
  const b: Backup = {
    format: "neuron-project",
    version: 1,
    project: snapshot.project,
    samples,
    feedback,
    versions: snapshot.versions,
    createdAt: Date.now(),
  };
  validateBackupShape(b);
  const blob = new Blob([JSON.stringify(b)], { type: "application/json" });
  if (blob.size > BACKUP_LIMIT)
    throw new Error("Backup exceeds the 64 MB file limit.");
  return blob;
}
export async function decodeBackup(file: Blob): Promise<Snapshot> {
  if (file.size > BACKUP_LIMIT)
    throw new Error("Backup exceeds the 64 MB file limit.");
  let raw: unknown;
  try {
    raw = JSON.parse(await file.text());
  } catch {
    throw new Error("Backup is not valid JSON.");
  }
  const b = validateBackupShape(raw),
    projectId = uid(),
    versionMap = new Map(b.versions.map((v) => [v.id, uid()]));
  async function media(m: Media) {
    const data = fromBase64(m.data);
    if ((await sha256(data)) !== m.hash)
      throw new Error("Backup image checksum mismatch. No data was restored.");
    const bytes = new Uint8Array(data);
    if (
      bytes.length < 4 ||
      bytes[0] !== 255 ||
      bytes[1] !== 216 ||
      bytes[2] !== 255
    )
      throw new Error("Only normalized JPEG images are supported in backups.");
    return new Blob([data], { type: "image/jpeg" });
  }
  const samples: Sample[] = [],
    feedback: FeedbackItem[] = [];
  for (const m of b.samples)
    samples.push({
      id: uid(),
      projectId,
      labelId: m.labelId,
      createdAt: m.createdAt,
      blob: await media(m),
      hash: m.hash,
    });
  for (const m of b.feedback)
    feedback.push({
      id: uid(),
      projectId,
      labelId: m.labelId,
      createdAt: m.createdAt,
      blob: await media(m),
      versionId: versionMap.get(m.versionId!)!,
      predictedLabel: m.predictedLabel!,
    });
  const project: Project = {
    id: projectId,
    name: (b.project.name.slice(0, 52) + " (restored)").slice(0, 64),
    labels: b.project.labels,
    createdAt: b.project.createdAt,
    updatedAt: Date.now(),
    activeVersionId: b.project.activeVersionId
      ? versionMap.get(b.project.activeVersionId)
      : undefined,
  };
  return {
    project,
    samples,
    feedback,
    versions: b.versions.map((v) => ({
      id: versionMap.get(v.id)!,
      projectId,
      createdAt: v.createdAt,
      artifact: validateArtifact(v.artifact),
    })),
  };
}