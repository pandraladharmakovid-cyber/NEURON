import { tabularDB, track } from "./database";
import type {
  Project,
  Dataset,
  Configuration,
  Artifact,
  Version,
  Snapshot,
} from "./types";
import { validateTable, validateConfiguration } from "./schema";
import { validateTabularModel } from "./model-format";
import { sha256, validHash } from "../lib/checksums";
import { assert } from "./errors";
export async function createProject(name: string) {
  assert(
    name.trim().length > 0 && name.trim().length <= 64,
    "Project name must be 1–64 characters.",
  );
  const now = Date.now(),
    project: Project = {
      id: crypto.randomUUID(),
      name: name.trim(),
      createdAt: now,
      updatedAt: now,
      config: null,
    };
  await (await tabularDB()).add("projects", project);
  return project;
}
export async function projects() {
  return (await (await tabularDB()).getAll("projects")).sort(
    (a, b) => b.updatedAt - a.updatedAt,
  );
}
export async function snapshot(id: string): Promise<Snapshot> {
  const db = await tabularDB(),
    tx = track(
      db.transaction(["projects", "datasets", "versions"], "readonly"),
    );
  const [project, dataset, versions] = await Promise.all([
    tx.objectStore("projects").get(id),
    tx.objectStore("datasets").get(id),
    tx.objectStore("versions").index("by-project").getAll(id),
  ]);
  await tx.done;
  assert(project, "CSV project not found.");
  return {
    project,
    dataset: dataset ?? null,
    versions: versions.sort((a, b) => b.createdAt - a.createdAt),
  };
}
export async function replaceDataset(dataset: Dataset) {
  validateTable(dataset);
  assert(
    validHash(dataset.hash) &&
      (await sha256(
        JSON.stringify({ headers: dataset.headers, rows: dataset.rows }),
      )) === dataset.hash,
    "Dataset checksum mismatch.",
  );
  assert(dataset.fileName.length <= 160, "File name too long.");
  const db = await tabularDB(),
    tx = track(db.transaction(["projects", "datasets"], "readwrite")),
    project = await tx.objectStore("projects").get(dataset.projectId);
  assert(project, "Project was deleted.");
  await tx.objectStore("datasets").put(dataset);
  await tx
    .objectStore("projects")
    .put({ ...project, config: null, updatedAt: Date.now() });
  await tx.done;
}
export async function saveConfiguration(
  id: string,
  hash: string,
  config: Configuration,
) {
  const db = await tabularDB(),
    tx = track(db.transaction(["projects", "datasets"], "readwrite")),
    project = await tx.objectStore("projects").get(id),
    dataset = await tx.objectStore("datasets").get(id);
  assert(
    project && dataset && dataset.hash === hash,
    "Dataset changed. Reload before saving configuration.",
  );
  const safe = validateConfiguration(config, dataset.headers);
  await tx
    .objectStore("projects")
    .put({ ...project, config: safe, updatedAt: Date.now() });
  await tx.done;
}
export async function saveVersion(id: string, value: Artifact) {
  const artifact = validateTabularModel(value),
    db = await tabularDB(),
    tx = track(
      db.transaction(["projects", "datasets", "versions"], "readwrite"),
    ),
    project = await tx.objectStore("projects").get(id),
    dataset = await tx.objectStore("datasets").get(id);
  assert(
    project &&
      dataset &&
      dataset.hash === artifact.provenance.datasetHash &&
      JSON.stringify(project.config) === JSON.stringify(artifact.config),
    "Dataset/config changed during training. The result was not activated; previous versions are unchanged.",
  );
  const version: Version = {
    id: crypto.randomUUID(),
    projectId: id,
    createdAt: Date.now(),
    artifact,
  };
  await tx.objectStore("versions").add(version);
  await tx
    .objectStore("projects")
    .put({ ...project, activeVersionId: version.id, updatedAt: Date.now() });
  await tx.done;
  return version;
}
export async function activateVersion(projectId: string, versionId: string) {
  const db = await tabularDB(),
    tx = track(db.transaction(["projects", "versions"], "readwrite")),
    p = await tx.objectStore("projects").get(projectId),
    v = await tx.objectStore("versions").get(versionId);
  assert(
    p && v && v.projectId === projectId,
    "Model version does not belong to this project.",
  );
  await tx
    .objectStore("projects")
    .put({ ...p, activeVersionId: versionId, updatedAt: Date.now() });
  await tx.done;
}
export async function deleteProject(id: string) {
  const db = await tabularDB(),
    tx = track(
      db.transaction(["projects", "datasets", "versions"], "readwrite"),
    );
  await tx.objectStore("projects").delete(id);
  await tx.objectStore("datasets").delete(id);
  for (const key of await tx
    .objectStore("versions")
    .index("by-project")
    .getAllKeys(id))
    await tx.objectStore("versions").delete(key);
  await tx.done;
}
export async function importModel(
  value: Artifact,
  name = "Imported CSV model",
) {
  const artifact = validateTabularModel(value),
    now = Date.now(),
    project: Project = {
      id: crypto.randomUUID(),
      name: name.trim().slice(0, 64) || "Imported CSV model",
      createdAt: now,
      updatedAt: now,
      config: artifact.config,
    },
    version: Version = {
      id: crypto.randomUUID(),
      projectId: project.id,
      createdAt: now,
      artifact,
    };
  project.activeVersionId = version.id;
  const db = await tabularDB(),
    tx = track(db.transaction(["projects", "versions"], "readwrite"));
  await tx.objectStore("projects").add(project);
  await tx.objectStore("versions").add(version);
  await tx.done;
  return project;
}
