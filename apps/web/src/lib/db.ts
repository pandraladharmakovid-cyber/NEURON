import { openDB, type DBSchema } from "idb";
import type { Project, Sample, ModelVersion, FeedbackItem } from "./types";
export interface NeuronDB extends DBSchema {
  projects: { key: string; value: Project };
  samples: { key: string; value: Sample; indexes: { "by-project": string } };
  versions: {
    key: string;
    value: ModelVersion;
    indexes: { "by-project": string };
  };
  feedback: {
    key: string;
    value: FeedbackItem;
    indexes: { "by-project": string };
  };
}
let connection: ReturnType<typeof openDB<NeuronDB>> | undefined;
export function database() {
  if (!("indexedDB" in globalThis))
    throw new Error("IndexedDB unavailable. Use a normal browser window.");
  return (connection ??= openDB<NeuronDB>("neuron-local", 2, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        db.createObjectStore("projects", { keyPath: "id" });
        db.createObjectStore("samples", { keyPath: "id" }).createIndex(
          "by-project",
          "projectId",
        );
        db.createObjectStore("versions", { keyPath: "id" }).createIndex(
          "by-project",
          "projectId",
        );
      }
      if (oldVersion < 2)
        db.createObjectStore("feedback", { keyPath: "id" }).createIndex(
          "by-project",
          "projectId",
        );
    },
    blocking() {
      connection?.then((db) => db.close());
      connection = undefined;
    },
    terminated() {
      connection = undefined;
    },
  }));
}
export async function closeDatabase() {
  const db = await connection;
  db?.close();
  connection = undefined;
}
export async function saveProject(project: Project) {
  const db = await database();
  const tx = trackTransaction(db.transaction("projects", "readwrite"));
  const previous = await tx.store.get(project.id);
  // Creation uses a fresh UUID. Existing callers may edit metadata, but cannot inject raw samples.
  await tx.store.put({
    ...project,
    updatedAt: Math.max(project.updatedAt, previous?.updatedAt ?? 0),
  });
  await tx.done;
}
export async function listProjects() {
  return (await (await database()).getAll("projects")).sort(
    (a, b) => b.updatedAt - a.updatedAt,
  );
}
export async function getProject(id: string) {
  return (await database()).get("projects", id);
}
export async function listSamples(id: string) {
  return (await database()).getAllFromIndex("samples", "by-project", id);
}
export async function listVersions(id: string) {
  return (
    await (await database()).getAllFromIndex("versions", "by-project", id)
  ).sort((a, b) => b.createdAt - a.createdAt);
}
export async function deleteProject(id: string) {
  const db = await database();
  const tx = trackTransaction(
    db.transaction(
      ["projects", "samples", "versions", "feedback"],
      "readwrite",
    ),
  );
  await tx.objectStore("projects").delete(id);
  for (const name of ["samples", "versions", "feedback"] as const)
    for (const key of await tx
      .objectStore(name)
      .index("by-project")
      .getAllKeys(id))
      await tx.objectStore(name).delete(key);
  await tx.done;
}
export async function commitVersion(version: ModelVersion) {
  const db = await database();
  const tx = trackTransaction(
    db.transaction(["projects", "versions"], "readwrite"),
  );
  const project = await tx.objectStore("projects").get(version.projectId);
  if (!project) {
    tx.abort();
    await tx.done.catch(() => {});
    throw new Error("Project no longer exists.");
  }
  await tx.objectStore("versions").add(version);
  await tx
    .objectStore("projects")
    .put({ ...project, activeVersionId: version.id, updatedAt: Date.now() });
  await tx.done;
}
export async function activateVersion(projectId: string, versionId: string) {
  const db = await database();
  const tx = trackTransaction(
    db.transaction(["projects", "versions"], "readwrite"),
  );
  const p = await tx.objectStore("projects").get(projectId),
    v = await tx.objectStore("versions").get(versionId);
  if (!p || !v || v.projectId !== projectId) {
    tx.abort();
    await tx.done.catch(() => {});
    throw new Error("Model version not found.");
  }
  await tx
    .objectStore("projects")
    .put({ ...p, activeVersionId: versionId, updatedAt: Date.now() });
  await tx.done;
}
export async function deleteLabel(project: Project, labelId: string) {
  const db = await database();
  const tx = trackTransaction(
    db.transaction(["projects", "samples", "feedback"], "readwrite"),
  );
  const current = await tx.objectStore("projects").get(project.id);
  if (!current || current.labels.length <= 2) {
    tx.abort();
    await tx.done.catch(() => {});
    throw new Error("At least two classes are required.");
  }
  for (const store of ["samples", "feedback"] as const)
    for (const s of await tx
      .objectStore(store)
      .index("by-project")
      .getAll(project.id))
      if (s.labelId === labelId) await tx.objectStore(store).delete(s.id);
  await tx
    .objectStore("projects")
    .put({
      ...current,
      labels: current.labels.filter((l) => l.id !== labelId),
      updatedAt: Date.now(),
    });
  await tx.done;
}
export async function importVersion(project: Project, version: ModelVersion) {
  const db = await database();
  const tx = trackTransaction(
    db.transaction(
      ["projects", "samples", "versions", "feedback"],
      "readwrite",
    ),
  );
  const current = await tx.objectStore("projects").get(project.id);
  if (!current) {
    tx.abort();
    await tx.done.catch(() => {});
    throw new Error("Project no longer exists.");
  }
  for (const store of ["samples", "feedback"] as const)
    for (const key of await tx
      .objectStore(store)
      .index("by-project")
      .getAllKeys(project.id))
      await tx.objectStore(store).delete(key);
  await tx.objectStore("versions").add(version);
  await tx
    .objectStore("projects")
    .put({
      ...current,
      labels: version.artifact.labels,
      activeVersionId: version.id,
      updatedAt: Date.now(),
    });
  await tx.done;
}
export async function snapshotProject(id: string) {
  const db = await database();
  const tx = trackTransaction(
    db.transaction(["projects", "samples", "versions", "feedback"], "readonly"),
  );
  const [project, samples, versions, feedback] = await Promise.all([
    tx.objectStore("projects").get(id),
    tx.objectStore("samples").index("by-project").getAll(id),
    tx.objectStore("versions").index("by-project").getAll(id),
    tx.objectStore("feedback").index("by-project").getAll(id),
  ]);
  await tx.done;
  if (!project) throw new Error("Project not found.");
  return { project, samples, versions, feedback };
}

export function trackTransaction<T extends { done: Promise<unknown> }>(
  tx: T,
): T {
  void tx.done.catch(() => {});
  return tx;
}