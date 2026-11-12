import type { Snapshot, Project, Dataset, Version } from "./types";
import { LIMITS } from "./limits";
import { assert } from "./errors";
import { validateTable, validateConfiguration } from "./schema";
import { validateTabularModel } from "./model-format";
import { sha256 } from "../lib/checksums";
import { tabularDB, track } from "./database";
export async function encodeBackup(snapshot: Snapshot) {
  assert(
    snapshot.versions.length <= LIMITS.versions,
    "At most 50 versions per CSV backup. Export individual models if needed.",
  );
  const blob = new Blob(
    [
      JSON.stringify({
        format: "neuron-tabular-backup",
        version: 1,
        ...snapshot,
      }),
    ],
    { type: "application/json" },
  );
  assert(blob.size <= LIMITS.backupBytes, "CSV backup exceeds 64 MB.");
  return blob;
}
export async function decodeBackup(file: Blob): Promise<Snapshot> {
  assert(file.size <= LIMITS.backupBytes, "CSV backup exceeds 64 MB.");
  let a: Snapshot & { format: string; version: number };
  try {
    a = JSON.parse(await file.text());
  } catch {
    throw new Error("Backup is not valid JSON.");
  }
  assert(
    a && a.format === "neuron-tabular-backup" && a.version === 1,
    "Not a CSV studio backup. Image backups are a different format.",
  );
  const p = a.project;
  assert(
    p &&
      typeof p.id === "string" &&
      p.id.length <= 100 &&
      typeof p.name === "string" &&
      p.name.trim().length > 0 &&
      p.name.length <= 64 &&
      Number.isFinite(p.createdAt) &&
      Number.isFinite(p.updatedAt),
    "Invalid backup project.",
  );
  assert(
    Array.isArray(a.versions) && a.versions.length <= LIMITS.versions,
    "Invalid version list.",
  );
  let dataset: Dataset | null = null;
  if (a.dataset) {
    validateTable(a.dataset);
    assert(
      a.dataset.projectId === p.id &&
        typeof a.dataset.fileName === "string" &&
        a.dataset.fileName.length <= 160 &&
        Number.isFinite(a.dataset.createdAt),
      "Invalid dataset metadata.",
    );
    const hash = await sha256(
      JSON.stringify({ headers: a.dataset.headers, rows: a.dataset.rows }),
    );
    assert(hash === a.dataset.hash, "Dataset checksum mismatch.");
    dataset = {
      projectId: p.id,
      fileName: a.dataset.fileName,
      hash,
      headers: a.dataset.headers,
      rows: a.dataset.rows,
      createdAt: a.dataset.createdAt,
    };
  }
  const ids = new Set<string>();
  const versions = a.versions.map((v) => {
    assert(
      v &&
        typeof v.id === "string" &&
        v.id.length > 0 &&
        v.id.length <= 100 &&
        !ids.has(v.id) &&
        v.projectId === p.id &&
        Number.isFinite(v.createdAt),
      "Invalid version reference.",
    );
    ids.add(v.id);
    return {
      id: v.id,
      projectId: p.id,
      createdAt: v.createdAt,
      artifact: validateTabularModel(v.artifact),
    };
  });
  assert(
    !p.activeVersionId || ids.has(p.activeVersionId),
    "Backup active model is missing.",
  );
  const config = p.config
    ? validateConfiguration(p.config, dataset?.headers)
    : null;
  return {
    project: {
      id: p.id,
      name: p.name,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      config,
      activeVersionId: p.activeVersionId,
    },
    dataset,
    versions,
  };
}
export async function restoreBackup(file: Blob) {
  const original = await decodeBackup(file),
    projectId = crypto.randomUUID(),
    mapping = new Map(
      original.versions.map((v) => [v.id, crypto.randomUUID()]),
    );
  const project: Project = {
      ...original.project,
      id: projectId,
      name: (original.project.name.slice(0, 52) + " (restored)").slice(0, 64),
      updatedAt: Date.now(),
      activeVersionId: original.project.activeVersionId
        ? mapping.get(original.project.activeVersionId)
        : undefined,
    },
    versions: Version[] = original.versions.map((v) => ({
      ...v,
      id: mapping.get(v.id)!,
      projectId,
    }));
  const db = await tabularDB(),
    tx = track(
      db.transaction(["projects", "datasets", "versions"], "readwrite"),
    );
  await tx.objectStore("projects").add(project);
  if (original.dataset)
    await tx.objectStore("datasets").add({ ...original.dataset, projectId });
  for (const version of versions) await tx.objectStore("versions").add(version);
  await tx.done;
  return project;
}
